// arbiter CLI — the headless client over the core library. Agents-first:
// everything here is also doable with plain file tools per PROTOCOL.md; the
// CLI just makes it cheap and adds the CAS write path.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { arbitrate } from '../core/arbitrate.js';
import { listStaged, sha256, stagedDirFor, walkCorpus } from '../core/corpus.js';
import { regenFull, regenIncremental } from '../core/dashboard.js';
import { extractFacts } from '../core/facts.js';
import { fmGetRaw } from '../core/fm.js';
import { buildIndex } from '../core/indexdb.js';
import { buildDashboardDates, buildIdMap, normalize } from '../core/normalize.js';
import { parseFrontmatter, parseItemFile, splitLines } from '../core/parse.js';
import {
  activeSet,
  chain,
  needsReviewCandidates,
  overdue,
  recordPage,
  stagedItems,
} from '../core/queries.js';
import { SchemaSet } from '../core/schema.js';
import { triage } from '../core/triage.js';
import { validateCorpus } from '../core/validate.js';
import { TYPE_TO_DIR } from '../core/model.js';
import { createArbiterServer } from '../web/server.js';

interface Args {
  cmd: string;
  positional: string[];
  flags: Map<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const [cmd = 'help', ...rest] = argv;
  const positional: string[] = [];
  const flags = new Map<string, string | boolean>();
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!;
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags.set(key, next);
        i++;
      } else {
        flags.set(key, true);
      }
    } else {
      positional.push(a);
    }
  }
  return { cmd, positional, flags };
}

/**
 * Data-directory resolution, so `arbiter` works from any directory:
 *   1. --data flag
 *   2. ARBITER_DATA environment variable
 *   3. walk up from cwd looking for arbiter-data/PROTOCOL.md
 *      (or being inside the data directory itself)
 */
function dataDir(args: Args): string {
  const flag = args.flags.get('data');
  if (typeof flag === 'string') return path.resolve(flag);
  const env = process.env['ARBITER_DATA'];
  if (env !== undefined && env !== '') return path.resolve(env);
  let cur = process.cwd();
  for (;;) {
    const candidate = path.join(cur, 'arbiter-data');
    if (fs.existsSync(path.join(candidate, 'PROTOCOL.md'))) return candidate;
    if (path.basename(cur) === 'arbiter-data' && fs.existsSync(path.join(cur, 'PROTOCOL.md'))) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  console.error(
    'no arbiter-data directory found — pass --data <dir>, set ARBITER_DATA, or run inside a tree containing arbiter-data/PROTOCOL.md',
  );
  process.exit(2);
}

function nowStamp(args: Args): string {
  const flag = args.flags.get('now');
  if (typeof flag === 'string') return flag;
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function protocolRaw(dir: string): string {
  const p = path.join(dir, 'PROTOCOL.md');
  if (fs.existsSync(p)) {
    const fm = parseFrontmatter(splitLines(fs.readFileSync(p, 'utf8')));
    const raw = fm ? fmGetRaw(fm.fm, 'version') : undefined;
    if (raw) return raw;
  }
  return '"0.4.4"';
}

function resolveItemPath(dir: string, arg: string): { abs: string; rel: string } {
  let rel = arg.endsWith('.md') ? arg : `${arg}.md`;
  if (path.isAbsolute(rel)) rel = path.relative(dir, rel).split(path.sep).join('/');
  const abs = path.join(dir, ...rel.split('/'));
  if (!fs.existsSync(abs)) {
    console.error(`no such item: ${rel}`);
    process.exit(2);
  }
  return { abs, rel };
}

function quarterOf(date: string): string {
  const [y, m] = [date.slice(0, 4), Number(date.slice(5, 7))];
  return `${y}q${Math.floor((m - 1) / 3) + 1}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// --- commands -----------------------------------------------------------------

function cmdValidate(args: Args): void {
  const dir = dataDir(args);
  const files = walkCorpus(dir);
  const schemas = SchemaSet.load(dir);
  const report = validateCorpus(dir, files, schemas);
  for (const w of report.warnings) console.log(`warning ${w.relPath}: ${w.message}`);
  for (const e of report.errors) console.log(`ERROR   ${e.relPath}: ${e.message}`);
  console.log(
    `${files.length} files, ${report.errors.length} error(s), ${report.warnings.length} warning(s)`,
  );
  if (report.errors.length > 0) process.exit(1);
}

function cmdRegen(args: Args): void {
  const dir = dataDir(args);
  const files = walkCorpus(dir);
  const schemas = SchemaSet.load(dir);
  const facts = extractFacts(dir, files, schemas);
  const dashPath = path.join(dir, 'DASHBOARD.md');
  const prev = fs.existsSync(dashPath) ? fs.readFileSync(dashPath, 'utf8') : null;
  const opts = { now: nowStamp(args), protocolRaw: protocolRaw(dir), generator: 'arbiter-cli' };
  const out =
    prev !== null && !args.flags.get('full') ? regenIncremental(facts, prev, opts) : regenFull(facts, prev, opts);
  if (args.flags.get('dry-run')) {
    process.stdout.write(out);
    return;
  }
  fs.writeFileSync(dashPath, out, 'utf8');
  console.log(`regenerated ${path.relative(process.cwd(), dashPath)} (${prev === null ? 'full rebuild' : 'incremental'})`);
}

function cmdTriage(args: Args): void {
  const dir = dataDir(args);
  const files = walkCorpus(dir);
  const schemas = SchemaSet.load(dir);
  const actions = triage(dir, files, schemas, {
    now: nowStamp(args),
    dryRun: Boolean(args.flags.get('dry-run')),
  });
  if (actions.length === 0) {
    console.log('triage: nothing to do');
    return;
  }
  for (const a of actions) console.log(`${a.relPath}: ${a.action}`);
  if (!args.flags.get('dry-run')) cmdRegen(args);
}

function cmdQuery(args: Args): void {
  const dir = dataDir(args);
  const files = walkCorpus(dir);
  const schemas = SchemaSet.load(dir);
  const facts = extractFacts(dir, files, schemas);
  const db = buildIndex(facts);
  const today = nowStamp(args).slice(0, 10);
  const sub = args.positional[0] ?? 'staged';
  const rows = (() => {
    switch (sub) {
      case 'overdue':
        return overdue(db, today);
      case 'needs-review':
        return needsReviewCandidates(db, today);
      case 'staged':
        return stagedItems(db);
      case 'active':
        return activeSet(db, args.positional[1] ?? 'tasks');
      case 'page':
        return recordPage(db, args.positional[1] ?? 'journal', Number(args.positional[2] ?? '0'));
      case 'chain': {
        const refs = chain(db, args.positional[1] ?? '');
        for (const r of refs) console.log(r);
        return null;
      }
      default:
        console.error(`unknown query: ${sub} (overdue | needs-review | staged | active <dir> | page <dir> [n] | chain <ref>)`);
        process.exit(2);
    }
  })();
  if (rows === null) return;
  if (args.flags.get('json')) {
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  for (const r of rows) {
    const status = r.status ? `[${r.status}] ` : '';
    const staged = r.staged_count > 0 ? `(${r.staged_count} staged) ` : '';
    console.log(`${status}${staged}${r.title} — ${r.date ?? r.updated_date ?? '?'} -> ${r.rel_path}`);
  }
}

function cmdNew(args: Args): void {
  const dir = dataDir(args);
  const type = args.positional[0];
  const title = args.positional.slice(1).join(' ');
  if (!type || !title) {
    console.error('usage: arbiter new <type> <title...> [--force]');
    process.exit(2);
  }
  const schemas = SchemaSet.load(dir);
  const schema = schemas.get(type);
  if (!schema) {
    console.error(`unknown type "${type}" (have: ${schemas.names().join(', ')})`);
    process.exit(2);
  }
  const now = nowStamp(args);
  const today = now.slice(0, 10);
  const base = slugify(title);
  const slugForm = schema.slugForm ?? '<base>';
  const id = slugForm.includes('YYYYqN')
    ? `${base}-${quarterOf(today)}`
    : slugForm.includes('YYYY-MM-DD')
      ? `${base}-${today}`
      : base;
  const itemDir = TYPE_TO_DIR[type]!;
  const rel = `${itemDir}/${id}.md`;
  const abs = path.join(dir, itemDir, `${id}.md`);

  // reopen rule: same <base> within ±2 quarters → reopen, don't duplicate
  if (schema.kind === 'work-item' && !args.flags.get('force')) {
    const dirAbs = path.join(dir, itemDir);
    const existing = fs.existsSync(dirAbs) ? fs.readdirSync(dirAbs) : [];
    const rivals = existing.filter((f) => {
      const m = /^(.*)-(\d{4})q([1-4])\.md$/.exec(f);
      if (!m || m[1] !== base) return false;
      const [y, q] = [Number(m[2]), Number(m[3])];
      const [cy, cq] = [Number(today.slice(0, 4)), Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1];
      return Math.abs((cy - y) * 4 + (cq - q)) <= 2;
    });
    if (rivals.length > 0) {
      console.error(
        `reopen rule (PROTOCOL.md#slugs): ${itemDir}/${rivals[0]} shares base "${base}" within ±2 quarters — reopen it instead, or pass --force`,
      );
      process.exit(1);
    }
  }
  if (fs.existsSync(abs)) {
    console.error(`already exists: ${rel}`);
    process.exit(1);
  }

  const fmLines = ['---', `id: ${id}`, `type: ${type}`, `title: ${title}`];
  if (schema.kind === 'work-item') fmLines.push('status: todo');
  if (schema.fields.get('date')?.required) fmLines.push(`date: ${today}`);
  if (type === 'accomplishment') fmLines.push('source: []');
  fmLines.push(`created: ${today}`, `updated: ${now}`, '---');
  const sections: string[] = [];
  for (const [name, def] of schema.sections) {
    if (def.required) sections.push(`## ${name}`, '');
  }
  const pointerReminder =
    schema.kind === 'work-item'
      ? 'update marks in place; check <id>.staged/ before editing'
      : 'record: capture now, structure later';
  const body = [
    ...fmLines,
    '',
    `# ${title}`,
    '',
    ...sections,
    `<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · ${pointerReminder} -->`,
    '',
  ].join('\n');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, 'utf8');
  console.log(rel);
}

function cmdArbitrate(args: Args): void {
  const dir = dataDir(args);
  const target = args.positional[0];
  if (!target) {
    console.error('usage: arbiter arbitrate <dir>/<id> [--dry-run]');
    process.exit(2);
  }
  const { abs, rel } = resolveItemPath(dir, target);
  const stagedNames = listStaged(dir, rel);
  if (stagedNames.length === 0) {
    console.log(`${rel}: nothing staged`);
    return;
  }
  const stagedAbs = path.join(dir, ...stagedDirFor(rel).split('/'));
  const before = fs.readFileSync(abs, 'utf8');
  const proposals = stagedNames.map((name) => ({
    filename: name,
    text: fs.readFileSync(path.join(stagedAbs, name), 'utf8'),
  }));
  const result = arbitrate(before, proposals);
  for (const f of result.flags) console.log(`note: ${f}`);
  if (args.flags.get('dry-run')) {
    process.stdout.write(result.itemText);
    console.log(`\nwould delete: ${result.deleted.join(', ') || '(none)'}`);
    console.log(`would keep staged: ${result.remaining.join(', ') || '(none)'}`);
    return;
  }
  // write, then verify: a write you have not observed in the file is not done
  fs.writeFileSync(abs, result.itemText, 'utf8');
  const observed = fs.readFileSync(abs, 'utf8');
  if (observed !== result.itemText) {
    console.error(`${rel}: post-write verification failed — a concurrent writer landed; re-run arbitrate`);
    process.exit(3);
  }
  for (const name of result.deleted) fs.unlinkSync(path.join(stagedAbs, name));
  // an emptied .staged/ directory is removed (leaving it is also conforming)
  if (result.remaining.length === 0 && fs.existsSync(stagedAbs) && fs.readdirSync(stagedAbs).length === 0) {
    fs.rmdirSync(stagedAbs);
  }
  console.log(
    `${rel}: arbitrated ${result.deleted.length} proposal(s)` +
      (result.remaining.length > 0 ? `; ${result.remaining.length} escalated (needs-review)` : ''),
  );
}

function cmdWrite(args: Args): void {
  const dir = dataDir(args);
  const target = args.positional[0];
  const ifMatch = args.flags.get('if-match');
  if (!target || typeof ifMatch !== 'string') {
    console.error('usage: arbiter write <path> --if-match <sha256|new> [--file <src>]  (content from --file or stdin)');
    process.exit(2);
  }
  const rel = target.endsWith('.md') ? target : `${target}.md`;
  const abs = path.join(dir, ...rel.split('/'));
  const src = args.flags.get('file');
  const content = typeof src === 'string' ? fs.readFileSync(src, 'utf8') : fs.readFileSync(0, 'utf8');

  const exists = fs.existsSync(abs);
  const current = exists ? sha256(fs.readFileSync(abs, 'utf8')) : 'new';
  if (current !== ifMatch) {
    console.error(`CAS mismatch: current is ${current} — re-read, rebase or stage a proposal (PROTOCOL.md#arbitration)`);
    process.exit(3);
  }
  // staging is sticky: while any proposal pends, every writer stages
  if (listStaged(dir, rel).length > 0) {
    console.error(`refused: ${stagedDirFor(rel)}/ has pending proposals — stage your change and arbitrate`);
    process.exit(3);
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  console.log(sha256(content));
}

function cmdServe(args: Args): void {
  const dir = dataDir(args);
  const port = Number(args.flags.get('port') ?? 4870);
  // local-only by design: the data directory is not for a public audience.
  // Overriding the bind address is a deliberate, explicit act.
  const host = typeof args.flags.get('host') === 'string' ? String(args.flags.get('host')) : '127.0.0.1';
  const server = createArbiterServer(dir);
  server.listen(port, host, () => {
    console.log(`arbiter serve (read-only) — http://${host}:${port}`);
    console.log(`data: ${dir}`);
    if (host !== '127.0.0.1') console.log('warning: bound beyond localhost — this directory is private data');
  });
}

function cmdHash(args: Args): void {
  const dir = dataDir(args);
  const target = args.positional[0];
  if (!target) {
    console.error('usage: arbiter hash <path>');
    process.exit(2);
  }
  const { abs } = resolveItemPath(dir, target);
  console.log(`sha256:${sha256(fs.readFileSync(abs, 'utf8'))}`);
}

function cmdNormalize(args: Args): void {
  const dir = dataDir(args);
  const files = walkCorpus(dir);
  const schemas = SchemaSet.load(dir);
  const dashPath = path.join(dir, 'DASHBOARD.md');
  const ctx = {
    schemas,
    today: nowStamp(args).slice(0, 10),
    dashboardDates: buildDashboardDates(fs.existsSync(dashPath) ? fs.readFileSync(dashPath, 'utf8') : null),
    idsByBareId: buildIdMap(files.filter((f) => f.kind === 'item').map((f) => f.relPath)),
  };
  let changed = 0;
  for (const f of files) {
    if (f.kind === 'protocol') continue;
    const res = normalize(f.relPath, f.text, { ...ctx, mtime: f.mtime });
    for (const flag of res.flags) console.log(`note: ${flag}`);
    if (res.changed) {
      changed++;
      if (!args.flags.get('dry-run')) fs.writeFileSync(f.absPath, res.text, 'utf8');
      console.log(`normalized ${f.relPath}`);
    }
  }
  console.log(changed === 0 ? 'already canonical' : `${changed} file(s) normalized`);
}

function help(): void {
  console.log(`arbiter — headless core for the Arbiter knowledge base (protocol 0.4.4)

usage: arbiter <command> [args] [--data <dir>] [--now <YYYY-MM-DDTHH:MM>]

data dir: --data > $ARBITER_DATA > nearest arbiter-data/ walking up from cwd

  validate                       judge the data directory against grammar + type schemas
  regen [--full] [--dry-run]     regenerate DASHBOARD.md (incremental by default)
  triage [--dry-run]             needs-review stamps, archive flags, 24h staged sweep
  query <sub> [--json]           overdue | needs-review | staged | active <dir> | page <dir> [n] | chain <ref>
  new <type> <title...>          create an item (slug form + reopen rule enforced)
  arbitrate <dir>/<id> [--dry-run]  apply/resolve staged proposals (pure, confluent)
  write <path> --if-match <sha256|new>  CAS write; content from stdin or --file
  normalize [--dry-run]          liberal → canonical repair pass (idempotent)
  serve [--port 4870]            read-only local renderer for visual inspection (binds 127.0.0.1)
  hash <path>                    sha256 of a file, for --if-match`);
}

const args = parseArgs(process.argv.slice(2));
switch (args.cmd) {
  case 'validate':
    cmdValidate(args);
    break;
  case 'regen':
    cmdRegen(args);
    break;
  case 'triage':
    cmdTriage(args);
    break;
  case 'query':
    cmdQuery(args);
    break;
  case 'new':
    cmdNew(args);
    break;
  case 'arbitrate':
    cmdArbitrate(args);
    break;
  case 'write':
    cmdWrite(args);
    break;
  case 'normalize':
    cmdNormalize(args);
    break;
  case 'serve':
    cmdServe(args);
    break;
  case 'hash':
    cmdHash(args);
    break;
  default:
    help();
}
