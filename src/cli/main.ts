import { impactReport, promotionCandidate } from '../core/evidence.js';
import { discover } from '../core/discovery.js';
// arbiter CLI — the headless client over the core library. Agents-first:
// everything here is also doable with plain file tools per PROTOCOL.md; the
// CLI just makes it cheap and adds the CAS write path.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { draftCheckpoint, previewHandoff, captureCheckpoint, exportHandoff, type HandoffRequest, type HandoffPreview } from '../core/handoff.js';
import { arbitrateFile } from '../core/arbitrate-file.js';
import { proposalProblems } from '../core/arbitrate.js';
import { commitFile, CommitConflict, readJournals, recoverCommits, stageProposal } from '../core/commit.js';
import { randomUUID } from 'node:crypto';
import { parseItemFile, parseProposal } from '../core/parse.js';
import { listStaged, sha256, stagedDirFor, walkCorpus } from '../core/corpus.js';
import { regenFull, regenIncremental } from '../core/dashboard.js';
import { readProjection } from '../core/projection.js';
import { extractFacts } from '../core/facts.js';
import { fmGet, fmGetRaw } from '../core/fm.js';
import { buildIndex } from '../core/indexdb.js';
import { buildDashboardDates, buildIdMap, normalize } from '../core/normalize.js';
import { parseFrontmatter, splitLines } from '../core/parse.js';
import {
  activeSet,
  chain,
  children,
  needsReviewCandidates,
  overdue,
  recordPage,
  stagedItems,
} from '../core/queries.js';
import { SchemaSet } from '../core/schema.js';
import { triage } from '../core/triage.js';
import { validateCorpus } from '../core/validate.js';
import { TYPE_TO_DIR } from '../core/model.js';
import { personalAccessFile } from '../web/personal-access.js';
import { createArbiterServer } from '../web/server.js';

import { type Args, parseArgs, help } from './args.js';
import { assertMutable, checkData, initData, isFrozen, itemPath, selectData } from './data.js';

// Resolve and check once per invocation, including triage's follow-up regen.
let selectedDir: string;
function dataDir(_args: Args): string { return selectedDir; }

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
  throw new Error('PROTOCOL.md has no version');
}

function resolveItemPath(dir: string, arg: string): { abs: string; rel: string } {
  const { abs, rel } = itemPath(dir, arg);
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

function cmdHandoff(args: Args): void {
  const dir = dataDir(args), ref = itemPath(dir, args.positional[0]!).rel.replace(/\.md$/, '');
  const readJson = (key: string) => JSON.parse(fs.readFileSync(String(args.flags.get(key)), 'utf8'));
  if (args.flags.has('capture') || args.flags.has('export')) {
    const capture = args.flags.has('capture');
    const preview = readJson(capture ? 'capture' : 'export') as HandoffPreview;
    if (preview.request.ref !== ref) throw new Error('Preview belongs to a different task');
    if (capture) {
      assertMutable(dir);
      console.log(JSON.stringify(captureCheckpoint(dir, preview), null, 2));
    } else process.stdout.write(exportHandoff(dir, preview));
    return;
  }
  if (args.cmd === 'checkpoint' && !args.flags.has('file')) {
    process.stdout.write(draftCheckpoint(dir, ref)); return;
  }
  const request: HandoffRequest = args.flags.has('file') ? readJson('file') : { ref };
  if (request.ref !== ref) throw new Error('Request belongs to a different task');
  if (args.cmd === 'checkpoint' && !request.checkpoint) throw new Error('Checkpoint preview requires draft Markdown in request.checkpoint');
  if (args.cmd === 'handoff' && request.checkpoint) throw new Error('Use checkpoint for draft previews');
  if (args.flags.has('format')) request.format = String(args.flags.get('format')) as 'markdown' | 'json';
  console.log(JSON.stringify(previewHandoff(dir, request), null, 2));
}

function cmdValidate(args: Args): void {
  const dir = dataDir(args);
  const files = walkCorpus(dir);
  const schemas = SchemaSet.load(dir);
  const report = validateCorpus(dir, files, schemas);
  for (const journal of readJournals(dir)) {
    if (journal.state !== 'complete') report.warnings.push({ severity: 'warning', relPath: `.arbiter/transactions/${journal.id}.json`, message: `${journal.state}: ${journal.target}; inspect with recover --dry-run${journal.reason ? `; ${journal.reason}` : ''}` });
  }
  for (const w of report.warnings) console.log(`warning ${w.relPath}${w.line ? `:${w.line}` : ''}: ${w.message}`);
  for (const e of report.errors) console.log(`ERROR   ${e.relPath}${e.line ? `:${e.line}` : ''}: ${e.message}`);
  console.log(
    `${files.length} files, ${report.errors.length} error(s), ${report.warnings.length} warning(s)`,
  );
  if (report.errors.length > 0) process.exit(1);
}

function cmdRegen(args: Args): void {
  const dir = dataDir(args);
  const { facts, inputs } = readProjection(dir);
  const dashPath = path.join(dir, 'DASHBOARD.md');
  const prev = fs.existsSync(dashPath) ? fs.readFileSync(dashPath, 'utf8') : null;
  const opts = { now: nowStamp(args), protocolRaw: protocolRaw(dir), generator: 'arbiter-cli', inputs };
  const out =
    prev !== null && !args.flags.get('full') ? regenIncremental(facts, prev, opts) : regenFull(facts, prev, opts);
  if (args.flags.get('dry-run')) {
    process.stdout.write(out);
    return;
  }
  commitFile(dir, 'DASHBOARD.md', () => ({ text: out }), { expected: prev === null ? 'new' : sha256(prev) });
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
  const { facts, inputs } = readProjection(dir);
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
        return activeSet(db, args.positional[1] ?? 'tasks', today);
      case 'children':
        return children(db, args.positional[1] ?? '');
      case 'page':
        return recordPage(db, args.positional[1] ?? 'journal', Number(args.positional[2] ?? '0'));
      case 'chain': {
        const refs = chain(db, args.positional[1] ?? '');
        for (const r of refs) console.log(r);
        return null;
      }
      default:
        console.error(`unknown query: ${sub} (overdue | needs-review | staged | active <dir> | children <ref> | page <dir> [n] | chain <ref>)`);
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
    console.log(`${status}${staged}${r.review ? `(review: ${r.review}) ` : ''}${r.title} — ${r.date ?? r.updated_date ?? '?'} -> ${r.rel_path}`);
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
  const eventDate = String(args.flags.get('date') ?? today);
  if (!title.trim() || /[\r\n]/.test(title)) throw new Error('title must be nonempty and on one line');
  const base = slugify(title);
  if (!base) throw new Error('title must contain letters or digits for a valid slug');
  const slugForm = schema.slugForm ?? '<base>';
  const id = slugForm.includes('YYYYqN')
    ? `${base}-${quarterOf(eventDate)}`
    : slugForm.includes('YYYY-MM-DD')
      ? `${base}-${eventDate}`
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
      const [cy, cq] = [Number(eventDate.slice(0, 4)), Math.floor((Number(eventDate.slice(5, 7)) - 1) / 3) + 1];
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
  if (schema.fields.get('date')?.required) fmLines.push(`date: ${eventDate}`);
  for (const [key, def] of schema.fields) {
    const candidateDefault = type === 'accomplishment' && schema.version === '0.4.18' && key === 'verification';
    if ((!def.required && !candidateDefault) || ['id', 'type', 'title', 'status', 'date', 'created', 'updated'].includes(key)) continue;
    if (def.type === 'ref-list') fmLines.push(`${key}: []`);
    else if (def.default) fmLines.push(`${key}: ${def.default}`);
  }
  fmLines.push(`created: ${today}`, `updated: ${now}`, '---');
  const sections: string[] = [];
  for (const [name, def] of schema.sections) {
    if (def.required || (type === 'accomplishment' && schema.version === '0.4.18' && ['Observations', 'Uncertainty'].includes(name))) sections.push(`## ${name}`, '');
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
  commitFile(dir, rel, () => ({ text: body }), { expected: 'new' });
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
  const diagnostics = validateCorpus(dir, walkCorpus(dir), SchemaSet.load(dir));
  for (const d of [...diagnostics.errors, ...diagnostics.warnings]) console.error(`${d.severity}: ${d.relPath}${d.line ? `:${d.line}` : ''}: ${d.message}`);
  const result = arbitrateFile(dir, rel, { dryRun: Boolean(args.flags.get('dry-run')) });
  for (const f of result.flags) console.log(`note: ${f}`);
  if (args.flags.get('dry-run')) {
    process.stdout.write(result.itemText);
    console.log(`\nwould delete: ${result.deleted.join(', ') || '(none)'}`);
    console.log(`would keep staged: ${result.remaining.join(', ') || '(none)'}`);
    return;
  }
  console.log(
    `${rel}: arbitrated ${result.deleted.length} proposal(s)` +
      (result.remaining.length > 0 ? `; ${result.remaining.length} remain staged for review` : ''),
  );
}

function cmdPropose(args: Args): void {
  const dir = dataDir(args);
  const { abs, rel } = resolveItemPath(dir, args.positional[0]!);
  const before = fs.readFileSync(abs, 'utf8');
  const updated = nowStamp(args);
  const author = String(args.flags.get('author') ?? 'agent');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(author)) throw new Error('--author must be a lowercase slug');
  const id = `${updated.slice(0, 10)}-${author}-${randomUUID()}`;
  const op = String(args.flags.get('op'));
  const intent = String(args.flags.get('intent'));
  const quote = (s: string) => `'${s.replaceAll("'", "''")}'`;
  const text = `---\nid: ${id}\nitem: ${rel.replace(/\.md$/, '')}\nbase: sha256:${sha256(before)}\nauthor: ${author}\nupdated: ${updated}\nops: [${quote(op)}]\n---\n\n# Proposed change\n\n${intent}\n\n<!-- arbiter:staged · PROTOCOL.md#arbitration · pending proposal -->\n`;
  const p = { filename: `${id}.md`, text };
  const problems = proposalProblems(parseProposal(text), p.filename, parseItemFile(before));
  if (problems.length) throw new Error(problems.join('; '));
  stageProposal(dir, rel, p);
  console.log(`${stagedDirFor(rel)}/${p.filename}`);
}

function cmdWrite(args: Args): void {
  const dir = dataDir(args);
  const target = args.positional[0];
  const ifMatch = args.flags.get('if-match');
  if (!target || typeof ifMatch !== 'string') {
    console.error('usage: arbiter write <path> --if-match <sha256|new> [--file <src>]  (content from --file or stdin)');
    process.exit(2);
  }
  const { abs, rel } = itemPath(dir, target);
  const src = args.flags.get('file');
  const content = typeof src === 'string' ? fs.readFileSync(src, 'utf8') : fs.readFileSync(0, 'utf8');

  commitFile(dir, rel, () => ({ text: content, verify: observed => observed === content }), { expected: ifMatch });
  console.log(sha256(content));
}

function cmdServe(args: Args): void {
  const dir = dataDir(args);
  const port = Number(args.flags.get('port') ?? 4870);
  // local-only by design: the data directory is not for a public audience.
  // Overriding the bind address is a deliberate, explicit act.
  const host = typeof args.flags.get('host') === 'string' ? String(args.flags.get('host')) : '127.0.0.1';
  const policyFile = args.flags.get('personal-policy');
  if (policyFile && !['127.0.0.1', '::1', 'localhost'].includes(host)) throw new Error('Personal review requires a loopback bind');
  if (policyFile) {
    const relative = path.relative(fs.realpathSync(dir), fs.realpathSync(String(policyFile)));
    if (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) throw new Error('Personal policy must stay outside the KB');
  }
  const server = createArbiterServer(dir, { personalAccess: policyFile ? personalAccessFile(String(policyFile)) : undefined });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`http://${host}:${port} is already serving (arbiter serve running?) — open it, or pass --port <n>`);
      process.exit(1);
    }
    throw err;
  });
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
      if (!args.flags.get('dry-run')) commitFile(dir, f.relPath, () => ({ text: res.text, verify: observed => normalize(f.relPath, observed, { ...ctx, mtime: f.mtime }).text === res.text }), { expected: sha256(f.text) });
      console.log(`normalized ${f.relPath}`);
    }
  }
  console.log(changed === 0 ? 'already canonical' : `${changed} file(s) normalized`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.cmd === 'help') { help(); return; }
  selectedDir = selectData(args);
  const mutates = ['init', 'new', 'write', 'propose', 'recover', 'regen', 'triage', 'arbitrate', 'normalize'].includes(args.cmd) && !args.flags.has('dry-run');
  if (mutates) assertMutable(selectedDir);
  else if (isFrozen(selectedDir)) console.error('note: frozen conformance corpus (read-only)');
  if (args.cmd === 'init') {
    initData(selectedDir);
    cmdRegen(args);
    cmdValidate(args);
    console.log('initialized KB: protocol 0.4.17/base 0.4.17; concrete schemas 0.4, 0.4.14, 0.4.16 and 0.4.18');
    return;
  }
  const state = checkData(selectedDir);
  if (state === 'empty') {
    const message = 'empty bootstrap directory (not initialized); run init --data <dir> before use';
    if (['validate', 'doctor'].includes(args.cmd)) { console.log(message); return; }
    throw new Error(message);
  }
  if (args.cmd === 'doctor') {
    console.log(`KB identity: protocol ${fmGet(parseFrontmatter(splitLines(fs.readFileSync(path.join(selectedDir, 'PROTOCOL.md'), 'utf8')))!.fm, 'version')}; supported concrete schemas 0.4, 0.4.14, 0.4.16 and 0.4.18`);
    cmdValidate(args);
    return;
  }
  switch (args.cmd) {
    case 'report':
      process.stdout.write(impactReport(readProjection(selectedDir), String(args.flags.get('since')), String(args.flags.get('until') ?? nowStamp(args).slice(0, 10)), nowStamp(args).slice(0, 10)));
      break;
    case 'promote':
      process.stdout.write(promotionCandidate(readProjection(selectedDir), args.positional[0]!.replace(/\.md$/, ''), String(args.flags.get('date')), nowStamp(args)));
      break;
    case 'checkpoint':
    case 'handoff':
      cmdHandoff(args);
      break;
    case 'validate':
      cmdValidate(args);
      break;
    case 'regen':
      cmdRegen(args);
      break;
    case 'triage':
      cmdTriage(args);
      break;
    case 'search': {
      const result = discover(readProjection(selectedDir), { q: args.positional[0] ?? '',
        ...Object.fromEntries([...args.flags].filter(([k]) => !['data', 'json', 'page', 'page-size'].includes(k))),
        page: Number(args.flags.get('page') ?? 0), pageSize: Number(args.flags.get('page-size') ?? 10) });
      if (args.flags.has('json')) console.log(JSON.stringify(result, null, 2));
      else {
        console.log(`${result.total} results; page ${result.page}; next ${result.nextPage ?? 'none'}`);
        for (const row of result.results) console.log(`${row.title}${row.status ? ` [${row.status}]` : ''}${row.archived ? ' (archived)' : ''} -> ${row.path}\n  ${row.preview}${row.parent ? `\n  parent: ${row.parent}` : ''}${row.checkpoint ? `\n  checkpoint: ${row.checkpoint.readiness}; ${row.checkpoint.nextAction}` : ''}`);
      }
      break;
    }
    case 'query':
      cmdQuery(args);
      break;
    case 'new':
      cmdNew(args);
      break;
    case 'arbitrate':
      cmdArbitrate(args);
      break;
    case 'propose':
      cmdPropose(args);
      break;
    case 'recover':
      console.log(JSON.stringify(args.flags.has('dry-run') ? readJournals(selectedDir) : recoverCommits(selectedDir), null, 2));
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
}

try { main(); } catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(error instanceof CommitConflict ? 3 : 2);
}
