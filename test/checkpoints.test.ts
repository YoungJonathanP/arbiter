import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { initData, checkData } from '../src/cli/data.js';
import { sha256, walkCorpus } from '../src/core/corpus.js';
import { parseItemFile, parseDocFile, classifyPath } from '../src/core/parse.js';
import { serializeItem } from '../src/core/serialize.js';
import { fmGet } from '../src/core/fm.js';
import { assessCheckpoint, checkpointHistoryPath, checkpointPath, contextBudget, parseCheckpointFile, serializeCheckpoint } from '../src/core/checkpoint.js';
import { commitFile, CommitConflict, recoverCommits, stageProposal } from '../src/core/commit.js';
import { validateCorpus } from '../src/core/validate.js';
import { SchemaSet } from '../src/core/schema.js';
import { normalize } from '../src/core/normalize.js';
import { fixtureContext } from './helpers.js';
import { readProjection } from '../src/core/projection.js';

const ref = 'tasks/synthetic-assignment-2026q3';
const current = checkpointPath(ref);
const at = '2026-09-07T12:00';
function setup(t: { after(fn: () => void): void }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-checkpoint-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  initData(dir);
  fs.writeFileSync(path.join(dir, `${ref}.md`), `---\nid: synthetic-assignment-2026q3\ntype: task\ntitle: Synthetic assignment\nstatus: in-flight\nowner: agent-session\ncheckpoint: ${current}\nupdated: ${at}\n---\n\n# Synthetic assignment\n\n## Summary\n\nImplement one synthetic outcome.\n\n## Plan inputs\n\n- design: [Selected rule](https://example.test/design)\n\n## Checklist\n\n- [ ] Verify the outcome; ticket ABC-42 <!-- ^verify -->\n\n## Artifacts\n\n- report: [Acceptance](https://example.test/report)\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place -->\n`);
  return dir;
}
function packet(dir: string, previous = 'none', next = 'Implement the bounded change.'): string {
  const sources = [`${ref}.md`, 'PROTOCOL.md', 'types/_base.md', 'types/task.md'];
  const inputs = sources.map((source, i) => `  input-${i}: { source: kb:${source}, revision: sha256:${sha256(fs.readFileSync(path.join(dir, source), 'utf8'))}, observed: ${at}, purpose: essential assignment input }`).join('\n');
  const kb = fmGet(parseDocFile(fs.readFileSync(path.join(dir, 'PROTOCOL.md'), 'utf8')).fm, 'kb-id');
  return `---\nrole: checkpoint\ntask: ${ref}\nkb: ${kb}\nrepository: urn:example:synthetic-repo\nbranch: main\nrevision: abc123\nowner: agent-session\nreadiness: ready\ncaptured: ${at}\nverified: ${at}\nprevious: ${previous}\ninputs:\n${inputs}\npredicates:\n  workspace: { state: met, owner: agent-session, condition: workspace and local edits authorized, evidence: observed clean synthetic workspace in current session }\nconflicts: []\n---\n\n# Continue synthetic assignment\n\n## Assignment\n\nImplement one bounded change; exclude publication and unrelated tasks.\n\n## Authority\n\nCurrent user authorizes local implementation and tests.\n\n## Verified state\n\nScaffold inspected; implementation has not started.\n\n## Constraints\n\nKeep ticket ABC-42 and row ^verify; preserve append-only detail. Source: task input-0.\n\n## Next actions\n\n${next} Stop when acceptance passes or a predicate changes.\n\n## Completion\n\nSynthetic acceptance passes; return the report.\n\n## Evidence\n\n- report: [Observed acceptance](https://example.test/report)\n\n<!-- arbiter:checkpoint · PROTOCOL.md#checkpoints · recheck inputs before resuming -->\n`;
}
function report(dir: string) {
  const files = walkCorpus(dir);
  return validateCorpus(dir, files, SchemaSet.fromFiles(files));
}
function assessment(dir: string, text: string) { return assessCheckpoint(current, text, walkCorpus(dir)); }

test('synthetic portable checkpoint round-trips, validates and resumes without reading history', t => {
  const dir = setup(t), first = packet(dir);
  commitFile(dir, current, () => ({ text: first }), { expected: 'new' });
  assert.equal(checkData(dir), 'ready');
  assert.equal(classifyPath(current), 'checkpoint');
  assert.equal(serializeCheckpoint(parseCheckpointFile(first)), first);
  assert.equal(normalize(current, first, fixtureContext(dir)).text, first);
  assert.equal(assessment(dir, first).readiness, 'ready');
  assert.deepEqual(report(dir), { errors: [], warnings: [] });
  const second = packet(dir, `sha256:${sha256(first)}`, 'Run the focused acceptance test.');
  commitFile(dir, current, () => ({ text: second }), { expected: sha256(first) });
  const history = checkpointHistoryPath(ref, `sha256:${sha256(first)}`);
  assert.equal(classifyPath(history), 'checkpoint-history');
  assert.equal(fs.readFileSync(path.join(dir, history), 'utf8'), first);
  assert.equal(serializeCheckpoint(parseCheckpointFile(first)), first);
  assert.equal(normalize(history, first, fixtureContext(dir)).text, first);
  assert.deepEqual(report(dir), { errors: [], warnings: [] });
  const projection = readProjection(dir);
  assert.ok(!projection.files.some(f => f.kind === 'checkpoint-history'));
  const handed = projection.files.find(f => f.relPath === current)!.text;
  const resumed = assessCheckpoint(current, handed, projection.files);
  assert.equal(resumed.readiness, 'ready');
  assert.match(handed, /Run the focused acceptance test/);
  assert.match(handed, /Keep ticket ABC-42 and row \^verify; preserve append-only detail/);
  assert.doesNotMatch(handed, new RegExp(dir));
  assert.equal(assessCheckpoint(current, second, projection.files, new Map(), true).errors.some(e => e.includes('history missing')), true);
});

test('changed dependency, conflicts and unknown owner cannot silently become ready', t => {
  const dir = setup(t), first = packet(dir);
  commitFile(dir, current, () => ({ text: first }), { expected: 'new' });
  fs.appendFileSync(path.join(dir, `${ref}.md`), '\nChanged without touching timestamps.\n');
  assert.match(assessment(dir, first).reasons.join('; '), /stale revision/);
  assert.equal(assessment(dir, first).readiness, 'review-required');
  const fresh = packet(dir);
  const conflict = fresh.replace('conflicts: []', 'conflicts: [decision A conflicts with decision B; both need user review]');
  assert.equal(assessment(dir, conflict).readiness, 'review-required');
  assert.equal(assessment(dir, fresh.replace('owner: agent-session', 'owner: unassigned')).readiness, 'review-required');
  assert.equal(assessment(dir, fresh.replace('revision: abc123', 'revision: unknown')).readiness, 'review-required');
  assert.equal(assessment(dir, fresh.replace('state: met', 'state: unknown')).readiness, 'review-required');
  assert.equal(assessment(dir, fresh.replace('state: met', 'state: unmet')).readiness, 'waiting');
  assert.equal(assessment(dir, fresh.replace('readiness: ready', 'readiness: unprepared')).readiness, 'unprepared');
  assert.equal(assessment(dir, fresh.replace('## Authority', '## Missing authority')).readiness, 'unprepared');
  assert.equal(fmGet(parseItemFile(fs.readFileSync(path.join(dir, `${ref}.md`), 'utf8')).fm, 'status'), 'in-flight');
});

test('external/repository inputs require caller observations; malformed metadata stays visible', t => {
  const dir = setup(t), first = packet(dir);
  const external = first.replace('predicates:\n', `  repo: { source: repo:src/work.ts, revision: sha256:${'a'.repeat(64)}, observed: ${at}, purpose: implementation boundary }\npredicates:\n`);
  assert.equal(assessment(dir, external).readiness, 'review-required');
  assert.equal(assessCheckpoint(current, external, walkCorpus(dir), new Map([['repo:src/work.ts', `sha256:${'a'.repeat(64)}`]])).readiness, 'ready');
  for (const bad of [external.replace('repo:src/work.ts', 'repo:../secret'), first.replace('state: met', 'state: magic'), first.replace('conflicts: []', 'conflicts: none'), first.replace('kb:PROTOCOL.md', 'kb:DASHBOARD.md'), first.replace('role: checkpoint', 'role: checkpoint\nrole: checkpoint')]) {
    assert.ok(assessment(dir, bad).errors.length);
    assert.equal(serializeCheckpoint(parseCheckpointFile(bad)), bad, 'invalid authored content is preserved for repair');
  }
  const linked = first.replace('https://example.test/report', `${ref}.md#^verify`);
  assert.deepEqual(assessment(dir, linked).errors, []);
  assert.ok(assessment(dir, linked.replace('#^verify)', '#^missing)')).errors.some(e => e.includes('anchor')));
});

test('CAS, owning staging and immutable history protect concurrent continuation', t => {
  const dir = setup(t), first = packet(dir);
  commitFile(dir, current, () => ({ text: first }), { expected: 'new' });
  const second = packet(dir, `sha256:${sha256(first)}`, 'Run acceptance.');
  commitFile(dir, current, () => ({ text: second }), { expected: sha256(first) });
  assert.throws(() => commitFile(dir, current, () => ({ text: second + '\n' }), { expected: sha256(first) }), CommitConflict);
  assert.throws(() => commitFile(dir, current, () => ({ text: first }), { expected: sha256(second) }), /previous/);
  assert.throws(() => commitFile(dir, current, () => ({ text: first })), /explicit CAS/);
  const history = checkpointHistoryPath(ref, `sha256:${sha256(first)}`);
  assert.throws(() => commitFile(dir, history, () => ({ text: second })), /immutable/);
  assert.equal(fs.readFileSync(path.join(dir, history), 'utf8'), first);
  stageProposal(dir, `${ref}.md`, { filename: 'pending.md', text: '# Pending intent\n' });
  const third = packet(dir, `sha256:${sha256(second)}`, 'Inspect result.');
  assert.throws(() => commitFile(dir, current, () => ({ text: third }), { expected: sha256(second) }), /pending proposals/);
  assert.equal(assessment(dir, second).readiness, 'review-required');
  assert.equal(fs.readFileSync(path.join(dir, current), 'utf8'), second);
});

test('interrupted replacement retains history and recovers the exact new checkpoint', t => {
  const dir = setup(t), first = packet(dir);
  commitFile(dir, current, () => ({ text: first }), { expected: 'new' });
  const second = packet(dir, `sha256:${sha256(first)}`, 'Verify recovered checkpoint.');
  assert.throws(() => commitFile(dir, current, () => ({ text: second }), { expected: sha256(first), hook: phase => { if (phase === 'prepared') throw new Error('interrupted'); } }), /interrupted/);
  assert.equal(fs.readFileSync(path.join(dir, checkpointHistoryPath(ref, `sha256:${sha256(first)}`)), 'utf8'), first);
  assert.equal(fs.readFileSync(path.join(dir, current), 'utf8'), first);
  recoverCommits(dir);
  assert.equal(fs.readFileSync(path.join(dir, current), 'utf8'), second);
  assert.deepEqual(report(dir), { errors: [], warnings: [] });
});

test('reserved legacy documents are not repurposed and history tampering fails validation', t => {
  const dir = setup(t);
  fs.mkdirSync(path.join(dir, ref), { recursive: true });
  const legacy = '---\nid: checkpoint\nkind: note\nitem: synthetic-assignment-2026q3\n---\n\n# Old detail\n\nKeep history.\n';
  fs.writeFileSync(path.join(dir, current), legacy);
  assert.throws(() => commitFile(dir, current, () => ({ text: packet(dir, `sha256:${sha256(legacy)}`) }), { expected: sha256(legacy) }), /legacy document/);
  assert.equal(fs.readFileSync(path.join(dir, current), 'utf8'), legacy);
  const first = packet(dir), history = checkpointHistoryPath(ref, `sha256:${sha256(first)}`);
  commitFile(dir, history, () => ({ text: first }), { expected: 'new' });
  fs.appendFileSync(path.join(dir, history), 'tampered\n');
  assert.ok(report(dir).errors.some(e => e.message.includes('byte digest')));
});

test('Plan inputs retains row identities and normalizes before Checklist; budget includes full Unicode output', t => {
  const dir = setup(t);
  const item = fs.readFileSync(path.join(dir, `${ref}.md`), 'utf8');
  const ast = parseItemFile(item);
  assert.equal(ast.sections.find(s => s.heading === 'Plan inputs')?.kind, 'links');
  ast.sections.reverse();
  const normalized = normalize(`${ref}.md`, serializeItem(ast), fixtureContext(dir)).text;
  assert.ok(normalized.indexOf('## Plan inputs') < normalized.indexOf('## Checklist'));
  assert.match(normalized, /ABC-42 <!-- \^verify -->/);
  assert.match(normalized, /https:\/\/example.test\/report/);
  assert.equal(contextBudget('é'.repeat(3073)).warning, true);
  const emitted = 'x'.repeat(10241);
  assert.equal(contextBudget(emitted).allowed, false);
  assert.equal(contextBudget(emitted, { maxBytes: 12000, reason: '' }).allowed, false);
  assert.equal(contextBudget(emitted, { maxBytes: 12000, reason: 'Keep essential constraints in reviewed export' }).allowed, true);
  assert.equal(contextBudget(emitted + 'x'.repeat(2000), { maxBytes: 12000, reason: 'approved size' }).allowed, false);
});

test('new KBs receive distinct portable identities and private owners hide checkpoints', t => {
  const dir = setup(t), other = setup(t);
  const identity = (d: string) => fmGet(parseDocFile(fs.readFileSync(path.join(d, 'PROTOCOL.md'), 'utf8')).fm, 'kb-id');
  assert.notEqual(identity(dir), identity(other));
  commitFile(dir, current, () => ({ text: packet(dir) }), { expected: 'new' });
  const taskPath = path.join(dir, `${ref}.md`);
  fs.writeFileSync(taskPath, fs.readFileSync(taskPath, 'utf8').replace('owner: agent-session', 'visibility: private\nowner: agent-session'));
  assert.ok(!readProjection(dir).files.some(f => f.relPath.startsWith(ref)));
});

test('size diagnostics locate oversized current surfaces without editing their bytes', t => {
  const dir = setup(t);
  const taskPath = path.join(dir, `${ref}.md`);
  const item = fs.readFileSync(taskPath, 'utf8').replace('Implement one synthetic outcome.', 'é'.repeat(600))
    .replace('Verify the outcome; ticket ABC-42', 'Long row '.repeat(60) + 'ticket ABC-42');
  fs.writeFileSync(taskPath, item);
  const large = packet(dir).replace('Implement the bounded change.', 'x'.repeat(6200));
  commitFile(dir, current, () => ({ text: large }), { expected: 'new' });
  const warnings = report(dir).warnings;
  assert.ok(warnings.some(w => w.message.includes('Summary exceeds 1 KiB')));
  assert.ok(warnings.some(w => w.message.includes('^verify exceeds 400') && w.line));
  assert.ok(warnings.some(w => w.message.includes('checkpoint exceeds 6 KiB')));
  assert.equal(fs.readFileSync(taskPath, 'utf8'), item);
  assert.equal(fs.readFileSync(path.join(dir, current), 'utf8'), large);
});
