// Shared capture and exact-byte handoffs. Preview artifacts are self-contained,
// deterministic and revalidated on use; they contain no filesystem authority.
import { walkCorpus, sha256, listStaged, type CorpusFile } from './corpus.js';
import { assessCheckpoint, checkpointPath, CHECKPOINT_SECTIONS, contextBudget } from './checkpoint.js';
import { parseItemFile, parseDocFile } from './parse.js';
import { serializeItem, serializeStep } from './serialize.js';
import { fmGet, fmSet, serializeFrontmatter } from './fm.js';
import { visibilityPolicy } from './visibility.js';
import { extractFacts } from './facts.js';
import { SchemaSet } from './schema.js';
import { validateCorpus } from './validate.js';
import { CommitConflict, withCommitSession } from './commit.js';

export interface HandoffRequest {
  ref: string;
  /** Omit to preview the current stored checkpoint. Supply exact draft Markdown to capture. */
  checkpoint?: string;
  owner?: string;
  format?: 'markdown' | 'json';
  offline?: boolean;
  expand?: string[];
  override?: { maxBytes: number; reason: string };
  /** Observations are supplied by the caller, never fetched or inferred. */
  observations?: Record<string, string>;
  extraction?: { surface: string; replacement: string };
}
export interface HandoffPreview {
  version: 1;
  request: HandoffRequest;
  token: string;
  basis: string;
  current: string;
  checkpointBefore: string | null;
  taskBefore: string;
  taskAfter: string;
  checkpoint: string;
  history?: { path: string; text: string };
  packet: string;
  bytes: number;
  allowed: boolean;
  assessment: ReturnType<typeof assessCheckpoint>;
  diagnostics: string[];
}
const digest = (text: string) => `sha256:${sha256(text)}`;
const scalar = (value: string) => {
  if (typeof value !== 'string' || /[\r\n\u0000]/.test(value)) throw new Error('metadata must be single-line text');
  return `'${value.replace(/'/g, "''")}'`;
};
const records = (entries: Record<string, string>[]) => entries.map(({ id, ...fields }) =>
  `  ${id}: { ${Object.entries(fields).map(([k, v]) => `${k}: ${scalar(v)}`).join(', ')} }`).join('\n');
function replaceMetadata(text: string, fm: NonNullable<ReturnType<typeof parseDocFile>['fm']>): string {
  const head = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(text);
  if (!head) throw new Error('Structured frontmatter required');
  return serializeFrontmatter(fm).join('\n') + '\n' + text.slice(head[0].length);
}
function refreshTaskInput(text: string, id: string, revision: string): string {
  const ast = parseDocFile(text), inputs = ast.fm?.entries.find(e => e.key === 'inputs');
  if (!inputs) throw new Error('missing inputs');
  // Refresh exactly one observed hash. Other nested records retain their authored bytes.
  inputs.rawLines = inputs.rawLines.map(line => line.trimStart().startsWith(id + ':')
    ? line.replace(/(revision:\s*['"]?)sha256:[0-9a-f]{64}/, '$1' + revision) : line);
  return replaceMetadata(text, ast.fm!);
}
function sources(dir: string) {
  const files = walkCorpus(dir, { includeHistory: false });
  const policy = visibilityPolicy(extractFacts(dir, files, SchemaSet.fromFiles(files)), files);
  const safe = (text: string) => {
    // Known private identifiers and common credential syntax are refused, not
    // stripped from essential rules. No heuristic can recognize arbitrary secrets.
    if (policy.redact(text) !== text || /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16})\b|https?:\/\/[^\s/]+:[^\s/]+@|\b(?:password|api[_-]?key|access[_-]?token|secret)\s*[:=]\s*[^\s,}]+/i.test(text))
      throw new Error('Excluded private material or credential syntax in selected content; repair the source before preview');
  };
  const get = (rel: string): CorpusFile => {
    const f = files.find(f => f.relPath === rel);
    if (!f || !policy.allowsPath(rel)) throw new Error('Selected source unavailable or excluded; select visible current inputs');
    safe(f.text);
    return f;
  };
  return { files, policy, safe, get };
}

/** Draft defaults make unknowns explicit; they never claim readiness/ownership. */
export function draftCheckpoint(dir: string, ref: string, at = new Date().toISOString()): string {
  const cp = checkpointPath(ref), { get, files } = sources(dir);
  const task = get(`${ref}.md`), ast = parseItemFile(task.text);
  const existing = files.find(f => f.relPath === cp);
  if (existing) {
    const text = get(cp).text;
    if (fmGet(parseDocFile(text).fm, 'role') !== 'checkpoint') throw new Error('Reserved checkpoint path is a legacy document; migrate explicitly');
    const next = parseDocFile(text);
    fmSet(next.fm!, 'previous', digest(text));
    fmSet(next.fm!, 'captured', at);
    return replaceMetadata(text, next.fm!);
  }
  const inputs = [`${ref}.md`, 'PROTOCOL.md', 'types/_base.md', 'types/task.md'].map((p, i) => ({ id: `input-${i}`, source: `kb:${p}`, revision: digest(get(p).text), observed: at, purpose: 'required assignment input' }));
  const owner = fmGet(ast.fm, 'owner') ?? 'unassigned';
  return `---\nrole: checkpoint\ntask: ${ref}\nkb: ${fmGet(parseDocFile(get('PROTOCOL.md').text).fm, 'kb-id') ?? 'unknown'}\nrepository: urn:workspace:unknown\nbranch: unknown\nrevision: unknown\nowner: ${scalar(owner)}\nreadiness: unprepared\ncaptured: ${at}\nverified: ${at}\nprevious: none\ninputs:\n${records(inputs)}\npredicates:\n  workspace: { state: unknown, owner: ${scalar(owner)}, condition: verify receiving workspace and current authority, evidence: unknown }\nconflicts: []\n---\n\n# Continue ${ast.title ?? ref}\n\n${CHECKPOINT_SECTIONS.map(name => `## ${name}\n\n${name === 'Evidence' ? `- source: [Assignment](${ref}.md)` : 'Unknown; record the observed facts and applicable rules.'}`).join('\n\n')}\n\n<!-- arbiter:checkpoint · PROTOCOL.md#checkpoints · recheck inputs before resuming -->\n`;
}

/** Extraction keeps all original bytes in a linked detail, row anchors in place,
 * and the extracted rules directly in this packet. No automatic prose summary. */
function extract(ref: string, text: string, spec: NonNullable<HandoffRequest['extraction']>) {
  if (!spec.replacement?.trim() || /\n|<!--|^##/.test(spec.replacement)) throw new Error('Extraction requires a one-line authored replacement');
  const ast = parseItemFile(text);
  let original: string;
  const docId = `handoff-history-${sha256(text)}`;
  const rel = `${ref}/${docId}.md`;
  if (spec.surface === 'Summary') {
    const section = ast.sections.find(s => s.heading === 'Summary');
    if (section?.kind !== 'prose') throw new Error('Select a parsed Summary or checklist anchor for extraction');
    original = section.lines.join('\n');
    section.lines = ['', spec.replacement, '', `[Preserved Summary](${rel})`, ''];
  } else {
    const steps = ast.sections.flatMap(s => s.kind === 'checklist' ? s.steps : []);
    const matches = steps.filter(s => s.anchor === spec.surface.replace(/^\^/, ''));
    if (matches.length !== 1) throw new Error('Select one unambiguous parsed checklist anchor');
    const step = matches[0]!;
    original = serializeStep(step).join('\n');
    step.text = spec.replacement;
    step.continuations.push({ kw: 'see', label: 'Preserved row and identifiers', target: rel });
  }
  // Exact full original task retained, including opaque bytes, anchors and IDs.
  const history = { path: rel, text: `---\nid: ${docId}\nkind: note\nitem: ${ref.split('/')[1]}\n---\n\n# Preserved task before extraction\n\n${text}\n<!-- arbiter:tier-3 · PROTOCOL.md#tier-3 · append only -->\n` };
  return { task: serializeItem(ast), original, history };
}

export function previewHandoff(dir: string, request: HandoffRequest): HandoffPreview {
  const req: HandoffRequest = JSON.parse(JSON.stringify(request));
  const cp = checkpointPath(req.ref), state = sources(dir);
  if (req.format !== undefined && !['markdown', 'json'].includes(req.format)) throw new Error('format must be markdown or json');
  if (req.expand && (!Array.isArray(req.expand) || req.expand.some(p => typeof p !== 'string'))) throw new Error('expand must contain selected KB source paths');
  if (req.override && (!Number.isSafeInteger(req.override.maxBytes) || req.override.maxBytes <= 10240 || !req.override.reason?.trim())) throw new Error('Size override requires maxBytes above 10240 and a reason');
  const taskBefore = state.get(`${req.ref}.md`).text;
  const stored = state.files.find(f => f.relPath === cp);
  const current = stored ? digest(state.get(cp).text) : 'new';
  if (stored && fmGet(parseDocFile(stored.text).fm, 'role') !== 'checkpoint') throw new Error('Reserved checkpoint path is a legacy document; migrate explicitly');
  if (!req.checkpoint && !stored) throw new Error('No current checkpoint; create and edit a draft first');
  if (!req.checkpoint && (req.owner !== undefined || req.extraction)) throw new Error('Owner/extraction edits require a checkpoint draft');
  let checkpoint = req.checkpoint ?? stored!.text;
  let taskAfter = taskBefore;
  let history: HandoffPreview['history'];
  let extracted = '';
  if (req.checkpoint) {
    if (req.extraction) {
      const result = extract(req.ref, taskAfter, req.extraction);
      taskAfter = result.task; history = result.history; extracted = result.original;
    }
    const task = parseItemFile(taskAfter), draft = parseDocFile(checkpoint);
    if (!task.fm || !draft.fm) throw new Error('Structured task and checkpoint frontmatter required');
    const pointer = fmGet(task.fm, 'checkpoint');
    if (pointer && pointer !== cp) throw new Error('Existing task checkpoint pointer requires explicit migration');
    if (fmGet(draft.fm, 'previous') !== (current === 'new' ? 'none' : current)) throw new CommitConflict('Draft previous differs from current checkpoint; refresh the draft');
    fmSet(task.fm, 'checkpoint', cp);
    if (req.owner !== undefined) { scalar(req.owner); fmSet(task.fm, 'owner', req.owner); fmSet(draft.fm, 'owner', req.owner); }
    // Avoid gratuitous timestamp/serialization changes when task metadata is unchanged.
    const candidate = replaceMetadata(taskAfter, task.fm);
    if (candidate !== taskBefore) fmSet(task.fm, 'updated', fmGet(draft.fm, 'captured') ?? 'unknown');
    taskAfter = replaceMetadata(taskAfter, task.fm);
    checkpoint = replaceMetadata(checkpoint, draft.fm);
    // Only the intentionally edited task input is refreshed. Selected dependencies
    // keep their authored revisions until the caller explicitly observes them.
    const inputs = assessCheckpoint(cp, checkpoint, state.files).inputs;
    const input = inputs.find(i => i.source === `kb:${req.ref}.md`);
    if (input && input.revision === digest(taskBefore) && input.revision !== digest(taskAfter)) {
      checkpoint = refreshTaskInput(checkpoint, input.id, digest(taskAfter));
    }
  }
  if (extracted) checkpoint = checkpoint.replace('<!-- arbiter:checkpoint', `## Preserved extraction context\n\n${extracted}\n\n<!-- arbiter:checkpoint`);
  state.safe(JSON.stringify(req)); state.safe(checkpoint); state.safe(taskAfter);
  const files = state.files.filter(f => state.policy.allowsPath(f.relPath)).map(f => f.relPath === `${req.ref}.md` ? { ...f, text: taskAfter } : f);
  if (history) files.push({ relPath: history.path, text: history.text, kind: 'doc', absPath: '', mtime: new Date(0) });
  const assessment = assessCheckpoint(cp, checkpoint, files, new Map(Object.entries(req.observations ?? {})));
  if (assessment.errors.length) throw new Error(`Checkpoint needs repair: ${assessment.errors.join('; ')}`);
  const localInputs = assessment.inputs.filter(i => i.source.startsWith('kb:'));
  // Refuse even metadata references to excluded inputs; do not disclose their names.
  for (const i of localInputs) state.get(i.source.slice(3));
  for (const p of req.expand ?? []) if (!localInputs.some(i => i.source === `kb:${p}`)) throw new Error('Expansion must name an explicitly selected KB input');
  const included = new Map<string, string>([[cp, checkpoint], [`${req.ref}.md`, taskAfter]]);
  const protocol = state.get('PROTOCOL.md').text;
  const checkpointRules = /^## Checkpoints\r?\n[\s\S]*?(?=^## |$(?![\s\S]))/m.exec(protocol)?.[0];
  if (!checkpointRules) throw new Error('Installed protocol lacks checkpoint rules; explicit upgrade required');
  const fullProtocol = req.offline || req.expand?.includes('PROTOCOL.md');
  included.set(fullProtocol ? 'PROTOCOL.md' : 'PROTOCOL.md#checkpoints', fullProtocol ? protocol : checkpointRules);
  for (const i of localInputs) if ((req.offline || req.expand?.includes(i.source.slice(3))) && i.source !== 'kb:PROTOCOL.md')
    included.set(i.source.slice(3), i.source === `kb:${req.ref}.md` ? taskAfter : state.get(i.source.slice(3)).text);
  const manifest = assessment.inputs.map(i => ({ source: i.source, revision: i.revision, purpose: i.purpose, included: included.has(i.source.slice(3)) ? 'full' : i.source === 'kb:PROTOCOL.md' ? 'checkpoints excerpt' : 'revision only; open selected source when needed' }));
  const metadata = {
    task: req.ref, checkpointRevision: digest(checkpoint), readiness: assessment.readiness,
    reasons: assessment.reasons, verified: fmGet(parseDocFile(checkpoint).fm, 'verified'),
    mode: req.offline ? 'offline planning snapshot' : assessment.readiness === 'ready' ? 'KB-linked snapshot' : 'planning snapshot; resolve readiness before implementation',
    recheck: 'Resolve KB UUID and repository identity to receiver-local paths. Re-read current task/checkpoint and selected source revisions; verify branch/worktree, owner, current authority and live dependency predicates before implementation. No network or repository state was fetched. Assignment grants no publication, merge, messaging or external-system authority.',
    limitations: req.offline ? 'Snapshot cannot establish current tickets, PRs, permissions or repository state. Planning only until live rechecks. Repo/external contents are not bundled; resolve their identities in the receiving workspace.' : 'Requires the identified KB and its installed protocol for implementation. All packets remain snapshots; no atomic read or external-editor guarantee.',
    omissions: ['Prior checkpoints and transaction journals are never expanded.', 'Unselected optional sources are not loaded into the packet.'],
    override: req.override ?? null, manifest,
  };
  const render = (bytes: number) => req.format === 'json'
    ? JSON.stringify({ ...metadata, bytes, sources: Object.fromEntries(included) }) + '\n'
    : `# Reviewed handoff\n\n${JSON.stringify({ ...metadata, bytes })}\n\n${[...included].map(([p, text]) => `## Included: ${p}\n\n${text}`).join('\n')}\n`;
  let packet = render(0);
  for (let i = 0; i < 10; i++) { const next = render(Buffer.byteLength(packet)); if (next === packet) break; packet = next; }
  state.safe(packet);
  const budget = contextBudget(packet, req.override);
  const diagnostics = validateCorpus(dir, files, SchemaSet.fromFiles(files), { verifyHistory: false }).warnings
    .filter(d => d.relPath === `${req.ref}.md`).map(d => `${d.line ? `Line ${d.line}: ` : ''}${d.message}; preview Summary or ^anchor extraction with an authored replacement`);
  if (budget.warning) diagnostics.push(`${budget.bytes} bytes exceeds the 6144-byte target; review selected expansions and linked detail`);
  if (!budget.allowed) diagnostics.push('Export exceeds budget. Reduce selected expansion or record a larger maxBytes and reason; no bytes were truncated.');
  // Basis covers visibility changes and staging, without exporting private names,
  // contents or counts. History growth and dashboard regeneration do not stale it.
  const basis = digest(JSON.stringify(state.files.filter(f => f.relPath !== 'DASHBOARD.md').map(f => [f.relPath, digest(f.text)])));
  const result = { version: 1 as const, request: req, basis, current, checkpointBefore: stored?.text ?? null, taskBefore, taskAfter, checkpoint, history, packet,
    bytes: budget.bytes, allowed: budget.allowed, assessment, diagnostics };
  return { ...result, token: digest(JSON.stringify(result)) };
}

function verifyPreview(dir: string, preview: HandoffPreview): HandoffPreview {
  let fresh: HandoffPreview;
  try { fresh = previewHandoff(dir, preview.request); }
  catch { throw new CommitConflict('Preview is stale or invalid; refresh and review before capture/copy/export'); }
  if (preview.version !== 1 || fresh.token !== preview.token || fresh.packet !== preview.packet)
    throw new CommitConflict('Preview is stale or changed; refresh and review before capture/copy/export');
  return fresh;
}
export function exportHandoff(dir: string, preview: HandoffPreview): string {
  const fresh = verifyPreview(dir, preview);
  if (fresh.request.checkpoint) throw new Error('Capture the draft, then preview the current version before export');
  if (!fresh.allowed) throw new Error('Packet exceeds reviewed byte budget');
  // Unready snapshots are useful for planning and explicitly label that state.
  return fresh.packet;
}
export function captureCheckpoint(dir: string, preview: HandoffPreview, options: {
  /** Library-only fault injection; never selectable by CLI or HTTP input. */
  afterTask?: () => void;
} = {}): { checkpointRevision: string } {
  if (!preview.request.checkpoint) throw new Error('Capture requires a reviewed draft');
  return withCommitSession(dir, write => {
    const fresh = verifyPreview(dir, preview);
    if (listStaged(dir, `${fresh.request.ref}.md`).length) throw new CommitConflict('Owning task has pending proposals; resolve before capture');
    if (fresh.assessment.reasons.some(r => /input .*: stale revision/.test(r))) throw new CommitConflict('Selected input revision is stale; re-observe before capture');
    if (fresh.history) write(fresh.history.path, current => {
      if (current !== null && current !== fresh.history!.text) throw new CommitConflict('Extraction history changed');
      return { text: fresh.history!.text };
    });
    write(`${fresh.request.ref}.md`, () => ({ text: fresh.taskAfter }), { expected: digest(fresh.taskBefore) });
    options.afterTask?.();
    write(checkpointPath(fresh.request.ref), () => ({ text: fresh.checkpoint }), { expected: fresh.current });
    return { checkpointRevision: digest(fresh.checkpoint) };
  });
}
