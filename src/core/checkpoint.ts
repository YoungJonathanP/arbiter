// Checkpoint contract and read-only assessment. Capture/export surfaces belong
// to T06. No status changes or authority are inferred from this assessment.
import type { CheckpointFile, CheckpointInput, CheckpointReadiness, Frontmatter, StartPredicate } from './model.js';
import type { CorpusFile } from './corpus.js';
import { sha256 } from './corpus.js';
import { fmGet, parseFlowMap } from './fm.js';
import { parseDocFile, parseItemFile } from './parse.js';
import { serializeDoc } from './serialize.js';

export const parseCheckpointFile = (text: string): CheckpointFile => parseDocFile(text);
export const serializeCheckpoint = (file: CheckpointFile): string => serializeDoc(file);
export const CHECKPOINT_SECTIONS = ['Assignment', 'Authority', 'Verified state', 'Constraints', 'Next actions', 'Completion', 'Evidence'] as const;
export const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})?$/;
const UNKNOWN = new Set(['unknown', 'unassigned', 'none']);
export const SIZE_TARGETS = { overview: 4096, summary: 1024, rowCharacters: 400, handoff: 6144, exportCeiling: 10240 } as const;

/** Call on the COMPLETE emitted packet, including manifest/protocol/override.
 * A larger budget never overrides readiness, authority or visibility checks. */
export function contextBudget(emitted: string, override?: { maxBytes: number; reason: string }) {
  const bytes = Buffer.byteLength(emitted, 'utf8');
  const deliberate = !!override && Number.isSafeInteger(override.maxBytes)
    && override.maxBytes > SIZE_TARGETS.exportCeiling && !!override.reason.trim();
  return { bytes, warning: bytes > SIZE_TARGETS.handoff,
    allowed: bytes <= SIZE_TARGETS.exportCeiling || (deliberate && bytes <= override!.maxBytes) };
}

export function checkpointPath(ref: string): string {
  if (!/^tasks\/[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}q[1-4]$/.test(ref)) throw new Error('checkpoint owner must be a task object ref');
  return `${ref}/checkpoint.md`;
}

export function checkpointHistoryPath(ref: string, digest: string): string {
  checkpointPath(ref);
  if (!HASH_RE.test(digest)) throw new Error('checkpoint history requires sha256:<hex>');
  return `${ref}/checkpoints/${digest.slice(7)}.md`;
}

function records(fm: Frontmatter | null, key: string, keys: string[], errors: string[]): Record<string, string>[] {
  const value = fm?.entries.find(e => e.key === key)?.value;
  if (value?.kind !== 'map' || !value.entries.length) {
    errors.push(`${key}: expected a nonempty block mapping`);
    return [];
  }
  const ids = new Set<string>();
  return value.entries.map(entry => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.key) || ids.has(entry.key)) errors.push(`${key}: invalid or duplicate record id`);
    ids.add(entry.key);
    const fields = entry.value.kind === 'scalar' ? parseFlowMap(entry.value.raw) : [];
    const record: Record<string, string> = { id: entry.key };
    for (const name of keys) {
      const field = fields.find(e => e.key === name);
      const v = field?.value.kind === 'scalar' ? fmGet({ entries: [field] }, name) : undefined;
      if (!v?.trim()) errors.push(`${key}.${entry.key}: missing scalar ${name}`);
      record[name] = v ?? '';
    }
    if (fields.length !== keys.length || new Set(fields.map(f => f.key)).size !== fields.length || fields.some(f => !keys.includes(f.key)))
      errors.push(`${key}.${entry.key}: expected exactly ${keys.join(', ')}`);
    return record;
  });
}

export interface CheckpointAssessment {
  readiness: CheckpointReadiness;
  errors: string[];
  warnings: string[];
  reasons: string[];
  inputs: CheckpointInput[];
  predicates: StartPredicate[];
}

/** Revisions supplied here must come from observations made for this read.
 * Never fetch URLs or recursively read referenced checkpoint history. */
export function assessCheckpoint(relPath: string, text: string, files: readonly CorpusFile[],
  observedRevisions: ReadonlyMap<string, string> = new Map(), verifyHistory = false): CheckpointAssessment {
  const ast = parseCheckpointFile(text);
  const errors: string[] = [], warnings: string[] = [], reasons: string[] = [];
  const byPath = new Map(files.map(f => [f.relPath, f]));
  const ref = relPath.split('/').slice(0, 2).join('/');
  const history = relPath.includes('/checkpoints/');
  const get = (key: string) => fmGet(ast.fm, key) ?? '';
  const scalarKeys = ['role', 'task', 'kb', 'repository', 'branch', 'revision', 'owner', 'readiness', 'captured', 'verified', 'previous'];
  for (const key of scalarKeys) {
    const entry = ast.fm?.entries.find(e => e.key === key);
    if (entry?.value.kind !== 'scalar' || !get(key).trim()) errors.push(`required scalar missing: ${key}`);
  }
  const seen = new Set<string>();
  for (const entry of ast.fm?.entries ?? []) {
    if (seen.has(entry.key)) errors.push(`duplicate frontmatter key: ${entry.key}`);
    seen.add(entry.key);
    if (![...scalarKeys, 'inputs', 'predicates', 'conflicts', 'visibility'].includes(entry.key)) warnings.push(`unknown checkpoint key preserved: ${entry.key}`);
  }
  if (get('role') !== 'checkpoint') errors.push('role must be checkpoint');
  if (get('task') !== ref || !/^tasks\/[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}q[1-4]$/.test(ref)) errors.push('task must match the owning task path');
  if (!ast.title) errors.push('checkpoint title is required');
  if (ast.pointer?.scope !== 'checkpoint' || ast.pointer.section !== 'checkpoints') errors.push('checkpoint pointer must name PROTOCOL.md#checkpoints');
  if (!['unprepared', 'ready', 'waiting', 'review-required'].includes(get('readiness'))) errors.push('invalid checkpoint readiness');
  if (!/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(get('kb'))) errors.push('kb must be a portable urn:uuid identity');
  if (!/^(https?:\/\/\S+|urn:[^\s]+)$/.test(get('repository'))) errors.push('repository must be an HTTP(S) identity or logical urn (never an absolute local path)');
  for (const key of ['captured', 'verified']) if (!TIME_RE.test(get(key)) || !Number.isFinite(Date.parse(get(key)))) errors.push(`${key} must be an observed datetime`);
  if (get('previous') !== 'none' && !HASH_RE.test(get('previous'))) errors.push('previous must be none or sha256:<hex>');
  if (get('visibility') && get('visibility') !== 'private') errors.push('visibility must be private when present');

  const sections = parseItemFile(text).sections;
  for (const name of CHECKPOINT_SECTIONS) {
    const found = sections.filter(s => s.heading === name);
    if (found.length !== 1 || (found[0]?.kind === 'prose' && !found[0].lines.some(l => l.trim()))) errors.push(`required nonempty section: ## ${name}`);
  }
  // Evidence uses the existing recoverable link grammar, not prose inference.
  const evidence = sections.find(s => s.heading === 'Evidence');
  if (evidence?.kind !== 'links' || !evidence.entries.length || evidence.rawRows?.some(r => r.kind === 'opaque')) errors.push('Evidence requires parsed link entries');
  if (evidence?.kind === 'links' && !history) for (const e of evidence.entries) {
    if (/^https?:\/\//.test(e.target)) continue;
    const [target, anchor] = e.target.split('#^');
    const source = byPath.get(target!);
    if (!source) errors.push('checkpoint evidence target does not resolve');
    else if (anchor !== undefined && !parseItemFile(source.text).sections.some(s => s.kind === 'checklist' && s.steps.some(step => step.anchor === anchor)))
      errors.push('checkpoint evidence anchor does not resolve');
  }
  const inputs = records(ast.fm, 'inputs', ['source', 'revision', 'observed', 'purpose'], errors) as unknown as CheckpointInput[];
  const predicates = records(ast.fm, 'predicates', ['state', 'owner', 'condition', 'evidence'], errors) as unknown as StartPredicate[];
  const sources = new Set<string>();
  for (const input of inputs) {
    const local = /^(kb|repo):(.+)$/.exec(input.source);
    if (sources.has(input.source)) errors.push(`inputs.${input.id}: duplicate source`);
    sources.add(input.source);
    if (local) {
      if (local[2]!.split('/').some(p => !p || p === '.' || p === '..' || p.startsWith('.arbiter')) || /[\\#:]/.test(local[2]!)) errors.push(`inputs.${input.id}: invalid relative source path`);
      if (!HASH_RE.test(input.revision)) errors.push(`inputs.${input.id}: local revision requires sha256:<hex>`);
      if (local[1] === 'kb' && (local[2] === 'DASHBOARD.md' || /\/checkpoints?[/\.]/.test(local[2]!))) errors.push(`inputs.${input.id}: generated checkpoints, history and dashboard are not input authority`);
    } else if (!/^https?:\/\/\S+$/.test(input.source)) errors.push(`inputs.${input.id}: unsupported source identity`);
    if (!TIME_RE.test(input.observed) || !Number.isFinite(Date.parse(input.observed))) errors.push(`inputs.${input.id}: invalid observed datetime`);
    if (!history) {
      const file = local?.[1] === 'kb' ? byPath.get(local[2]!) : undefined;
      const observed = local?.[1] === 'kb' ? (file ? `sha256:${sha256(file.text)}` : undefined) : observedRevisions.get(input.source);
      if (observed === undefined || input.revision === 'unknown') reasons.push(`input ${input.id}: unavailable or unverified revision`);
      else if (observed !== input.revision) reasons.push(`input ${input.id}: stale revision`);
    }
  }
  for (const source of [`kb:${ref}.md`, 'kb:PROTOCOL.md', 'kb:types/_base.md', 'kb:types/task.md']) {
    if (!sources.has(source)) errors.push(`required input missing: ${source}`);
  }
  for (const predicate of predicates) {
    if (!['met', 'unmet', 'unknown'].includes(predicate.state)) errors.push(`predicate ${predicate.id}: invalid state`);
    if (!history && (predicate.state === 'unknown' || UNKNOWN.has(predicate.owner) || UNKNOWN.has(predicate.evidence))) reasons.push(`predicate ${predicate.id}: unknown state, owner or evidence`);
  }
  const conflicts = ast.fm?.entries.find(e => e.key === 'conflicts')?.value;
  if (conflicts?.kind !== 'seq') errors.push('conflicts must be an explicit sequence (empty when resolved)');
  else if (!history && conflicts.items.length) reasons.push('unresolved decision conflicts; inspect conflicts and Constraints');
  const task = byPath.get(`${ref}.md`);
  if (!task) errors.push('owning task missing');
  if (!history && ['branch', 'revision'].some(key => UNKNOWN.has(get(key)))) reasons.push('workspace branch or revision is unverified');
  if (!history && task) {
    const taskAst = parseItemFile(task.text);
    const owner = fmGet(taskAst.fm, 'owner');
    if (!owner || !owner.trim() || taskAst.fm?.entries.find(e => e.key === 'owner')?.value.kind !== 'scalar' || UNKNOWN.has(owner) || UNKNOWN.has(get('owner'))) reasons.push('accountable owner unknown or unassigned');
    else if (owner !== get('owner')) reasons.push('owner differs from current task');
    if (fmGet(taskAst.fm, 'checkpoint') !== `${ref}/checkpoint.md`) errors.push('task checkpoint pointer must name its stable current path');
    if (fmGet(taskAst.fm, 'review') || fmGet(taskAst.fm, 'status') === 'needs-review') reasons.push('task requires explicit review');
    if (files.some(f => f.kind === 'proposal' && f.relPath.startsWith(`${ref}.staged/`))) reasons.push('owning task has pending proposals');
    const kb = byPath.get('PROTOCOL.md');
    if (!kb || fmGet(parseDocFile(kb.text).fm, 'kb-id') !== get('kb')) reasons.push('KB identity differs or is unassigned');
  }
  if (history) {
    if (!relPath.endsWith(`/${sha256(text)}.md`)) errors.push('history filename must equal the exact byte digest');
  }
  if (verifyHistory && HASH_RE.test(get('previous'))) {
    const prior = byPath.get(`${ref}/checkpoints/${get('previous').slice(7)}.md`);
    if (!prior || `sha256:${sha256(prior.text)}` !== get('previous')) errors.push('previous checkpoint history missing or changed');
  }
  if (Buffer.byteLength(text, 'utf8') > SIZE_TARGETS.handoff) warnings.push('checkpoint exceeds 6 KiB target; budget the complete emitted context before export');
  let readiness: CheckpointReadiness = get('readiness') as CheckpointReadiness;
  if (errors.length) readiness = 'unprepared';
  else if (reasons.length || readiness === 'review-required') readiness = 'review-required';
  else if (predicates.some(p => p.state === 'unmet') || readiness === 'waiting') readiness = 'waiting';
  // Captured state can be downgraded by observations, never automatically promoted.
  return { readiness, errors, warnings, reasons, inputs, predicates };
}
