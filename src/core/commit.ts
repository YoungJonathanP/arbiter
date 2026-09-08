// Local-filesystem commit boundary. SQLite supplies an OS-released writer lock;
// fsynced JSON journals (not the SQLite cache) retain intent across process death.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { listStaged, sha256, stagedDirFor } from './corpus.js';
import type { ProposalInput, ProposalReceipt } from './arbitrate.js';
import { classifyPath, parseDocFile } from './parse.js';
import { fmGet } from './fm.js';
import { checkpointHistoryPath } from './checkpoint.js';

export class CommitConflict extends Error {}
export type CommitPhase = 'prepared' | 'before-replace' | 'replaced' | 'verified' | 'before-cleanup';
export interface CommitPlan {
  text: string;
  verify?: (text: string) => boolean;
  proposals?: ProposalInput[];
  receipts?: ProposalReceipt[];
  allowStaged?: boolean;
}
export interface Journal {
  version: 1;
  id: string;
  target: string;
  before: string | null;
  after: string;
  state: 'prepared' | 'complete' | 'conflict';
  proposals: ProposalInput[];
  receipts: ProposalReceipt[];
  cleaned?: boolean;
  observed?: string | null;
  reason?: string;
}
export interface CommitOptions {
  expected?: string;
  /** Fault injection for tests. Never selected via CLI/environment. */
  hook?: (phase: CommitPhase) => void;
}

function read(file: string): string | null {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null; throw e; }
}
function syncDir(dir: string): void {
  const fd = fs.openSync(dir, 'r');
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}
function mkdir(dir: string): void {
  if (fs.existsSync(dir)) return;
  mkdir(path.dirname(dir));
  try { fs.mkdirSync(dir); syncDir(path.dirname(dir)); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
}
function atomic(file: string, text: string, mode = 0o600): void {
  mkdir(path.dirname(file));
  const tmp = path.join(path.dirname(file), `.arbiter-${randomUUID()}.tmp`);
  const fd = fs.openSync(tmp, 'wx', mode);
  try { fs.writeFileSync(fd, text, 'utf8'); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { fs.renameSync(tmp, file); syncDir(path.dirname(file)); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
function managedPath(dir: string, rel: string): string {
  if (!rel || path.isAbsolute(rel) || rel.split('/').some(p => !p || p === '.' || p === '..') || rel.startsWith('.arbiter/')) throw new Error(`invalid commit target: ${rel}`);
  const abs = path.resolve(dir, rel);
  // Do not follow managed symlinks, including journal/lock paths.
  let cur = path.resolve(dir);
  for (const part of rel.split('/')) {
    cur = path.join(cur, part);
    if (fs.existsSync(cur) && fs.lstatSync(cur).isSymbolicLink()) throw new Error(`managed symlink: ${cur}`);
  }
  return abs;
}
function journalDir(dir: string): string { return path.join(dir, '.arbiter', 'transactions'); }
function journalPath(dir: string, j: Journal): string { return path.join(journalDir(dir), `${j.id}.json`); }
function save(dir: string, j: Journal): void { atomic(journalPath(dir, j), JSON.stringify(j, null, 2) + '\n'); }

/** Read-only history/recovery inspection; never repairs during validation. */
export function readJournals(dir: string): Journal[] {
  const root = journalDir(dir);
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(n => n.endsWith('.json')).sort().map(n => {
    const j = JSON.parse(fs.readFileSync(path.join(root, n), 'utf8')) as Journal;
    if (j.version !== 1 || `${j.id}.json` !== n || !['prepared', 'complete', 'conflict'].includes(j.state) || typeof j.after !== 'string' || !(j.before === null || typeof j.before === 'string') || !Array.isArray(j.proposals) || !Array.isArray(j.receipts)) throw new Error(`invalid commit journal: ${n}`);
    managedPath(dir, j.target);
    for (const p of j.proposals) if (path.basename(p.filename) !== p.filename || typeof p.text !== 'string') throw new Error(`invalid journal proposal: ${n}`);
    return j;
  });
}
function conflict(dir: string, j: Journal, observed: string | null, reason: string): never {
  j.state = 'conflict'; j.observed = observed; j.reason = reason; save(dir, j);
  throw new CommitConflict(`${j.target}: ${reason}; preserved intent and observed bytes in ${journalPath(dir, j)}; re-read and reconcile`);
}
function cleanup(dir: string, j: Journal): void {
  const staged = path.join(dir, stagedDirFor(j.target));
  for (const receipt of j.receipts) {
    const p = j.proposals.find(p => p.filename === receipt.filename && sha256(p.text) === receipt.digest);
    if (!p) throw new Error(`receipt lacks retained intent: ${j.id}`);
    const file = path.join(staged, p.filename);
    // A replaced proposal is fresh intent; never delete it using an older receipt.
    const current = read(file);
    if (current !== null && sha256(current) === receipt.digest) { fs.unlinkSync(file); syncDir(staged); }
  }
  if (fs.existsSync(staged) && fs.readdirSync(staged).length === 0) { fs.rmdirSync(staged); syncDir(path.dirname(staged)); }
}
function recoverLocked(dir: string, target?: string): Journal[] {
  const journals = readJournals(dir).filter(j => target === undefined || j.target === target);
  for (const j of journals) {
    if (j.state === 'conflict') continue;
    if (j.state === 'complete') {
      if (!j.cleaned) {
        const current = read(managedPath(dir, j.target));
        if (current !== j.after) conflict(dir, j, current, 'external changes before recovered cleanup');
        cleanup(dir, j); j.cleaned = true; save(dir, j);
      }
      continue;
    }
    const abs = managedPath(dir, j.target);
    const current = read(abs);
    if (current !== j.after) {
      if (current !== j.before) conflict(dir, j, current, 'recovery found external changes');
      atomic(abs, j.after, fs.existsSync(abs) ? fs.statSync(abs).mode & 0o777 : 0o600);
    }
    if (read(abs) !== j.after) conflict(dir, j, read(abs), 'recovery postcondition failed');
    j.state = 'complete'; save(dir, j); cleanup(dir, j); j.cleaned = true; save(dir, j);
  }
  return journals;
}
function locked<T>(dir: string, run: () => T): T {
  managedPath(dir, '.arbiter');
  mkdir(path.join(dir, '.arbiter'));
  for (const name of ['writer-lock.sqlite', 'writer-lock.sqlite-journal', 'writer-lock.sqlite-wal', 'writer-lock.sqlite-shm', 'transactions']) {
    const file = path.join(dir, '.arbiter', name);
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) throw new Error(`managed symlink: ${file}`);
  }
  const db = new Database(path.join(dir, '.arbiter', 'writer-lock.sqlite'), { timeout: 5000 });
  try {
    db.exec('BEGIN IMMEDIATE');
    try { const result = run(); db.exec('COMMIT'); return result; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  } catch (e) {
    if ((e as { code?: string }).code === 'SQLITE_BUSY') throw new CommitConflict('writer busy; retry with the same base');
    throw e;
  } finally { db.close(); }
}

export function recoverCommits(dir: string, target?: string): Journal[] {
  return locked(dir, () => recoverLocked(dir, target));
}

/** All cooperating writers, including proposers, use this lock. The lock is
 * corpus-wide (stronger than per-item); unrelated items serialize as well. */
export function commitFile<T extends CommitPlan>(dir: string, target: string, plan: (current: string | null, receipts: ProposalReceipt[]) => T, opts: CommitOptions = {}): T {
  return locked(dir, () => commitFileLocked(dir, target, plan, opts));
}

/** A sequence under one cooperating lock; each write retains its own durable journal.
 * Not a multi-file transaction: earlier successful writes survive later failure. */
export function withCommitSession<T>(dir: string, run: (write: <P extends CommitPlan>(target: string, plan: (current: string | null) => P, opts?: CommitOptions) => P) => T): T {
  return locked(dir, () => {
    recoverLocked(dir);
    let active = true;
    try { return run((target, plan, opts = {}) => {
      if (!active) throw new Error('commit session has ended');
      return commitFileLocked(dir, target, plan, opts);
    }); } finally { active = false; }
  });
}

function commitFileLocked<T extends CommitPlan>(dir: string, target: string, plan: (current: string | null, receipts: ProposalReceipt[]) => T, opts: CommitOptions): T {
    const abs = managedPath(dir, target);
    const history = recoverLocked(dir, target);
    const before = read(abs);
    const actual = before === null ? 'new' : sha256(before);
    const expected = opts.expected?.replace(/^sha256:/, '').toLowerCase();
    if (expected !== undefined && actual !== expected) throw new CommitConflict(`CAS mismatch:\n  expected: ${expected === 'new' ? 'new' : `sha256:${expected}`}\n  actual: ${actual === 'new' ? 'new' : `sha256:${actual}`}`);
    const result = plan(before, history.filter(j => j.state === 'complete').flatMap(j => j.receipts));
    if (!result.allowStaged && listStaged(dir, target).length) throw new CommitConflict(`${target}: pending proposals — stage your change and arbitrate`);
    if (result.verify && !result.verify(result.text)) throw new Error(`${target}: proposed postcondition failed`);
    if (before === result.text && !result.receipts?.length) return result;
    const kind = classifyPath(target);
    if (kind === 'checkpoint-history') {
      if (before !== null) throw new CommitConflict('checkpoint history is immutable');
      if (!target.endsWith(`/${sha256(result.text)}.md`)) throw new Error('checkpoint history path must match its byte digest');
    }
    if (kind === 'checkpoint') {
      const ref = target.split('/').slice(0, 2).join('/');
      if (expected === undefined) throw new CommitConflict('checkpoint replacement requires an explicit CAS revision');
      if (listStaged(dir, `${ref}.md`).length) throw new CommitConflict('owning task has pending proposals; resolve before checkpoint replacement');
      const next = parseDocFile(result.text);
      if (fmGet(next.fm, 'role') !== 'checkpoint' || fmGet(next.fm, 'task') !== ref)
        throw new Error('checkpoint role/task must match its current path');
      if (fmGet(next.fm, 'previous') !== (before === null ? 'none' : `sha256:${sha256(before)}`))
        throw new CommitConflict('checkpoint previous must match the current byte revision');
      if (before !== null) {
        if (fmGet(parseDocFile(before).fm, 'role') !== 'checkpoint') throw new CommitConflict('reserved checkpoint path contains a legacy document; migrate explicitly before replacement');
        // Retain the exact prior version BEFORE journal/install. An interrupted
        // capture may leave an extra immutable snapshot, never lost history.
        const historyPath = managedPath(dir, checkpointHistoryPath(ref, `sha256:${sha256(before)}`));
        const saved = read(historyPath);
        if (saved !== null && saved !== before) throw new CommitConflict('checkpoint history digest collision or changed bytes');
        if (saved === null) atomic(historyPath, before);
      }
    }
    const id = randomUUID();
    const j: Journal = { version: 1, id, target, before, after: result.text, state: 'prepared', proposals: result.proposals ?? [],
      receipts: (result.receipts ?? []).map(r => ({ ...r, committedIn: r.committedIn ?? id })),
    };
    save(dir, j); opts.hook?.('prepared');
    if (read(abs) !== before) conflict(dir, j, read(abs), 'base changed before replacement');
    opts.hook?.('before-replace');
    if (read(abs) !== before) conflict(dir, j, read(abs), 'base changed before replacement');
    atomic(abs, result.text, fs.existsSync(abs) ? fs.statSync(abs).mode & 0o777 : 0o600);
    opts.hook?.('replaced');
    const observed = read(abs);
    if (observed !== result.text || (result.verify && !result.verify(observed))) conflict(dir, j, observed, 'postcondition failed after replacement');
    opts.hook?.('verified');
    j.state = 'complete'; save(dir, j);
    opts.hook?.('before-cleanup');
    if (read(abs) !== result.text) conflict(dir, j, read(abs), 'external edit before proposal cleanup');
    cleanup(dir, j); j.cleaned = true; save(dir, j);
    return result;
}

export function stageProposal(dir: string, target: string, p: ProposalInput): void {
  locked(dir, () => {
    managedPath(dir, target);
    if (path.basename(p.filename) !== p.filename || !p.filename.endsWith('.md')) throw new Error('invalid proposal filename');
    const file = managedPath(dir, `${stagedDirFor(target)}/${p.filename}`);
    if (read(file) !== null) throw new CommitConflict('proposal ID already exists');
    // atomic install under the cooperating lock; random IDs also isolate bare writers.
    atomic(file, p.text);
  });
}
