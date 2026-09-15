import { regenFull } from './dashboard.js';
import { ITEM_DIRS, STATUSES } from './model.js';
// Bounded discovery over an already visibility-filtered, current projection.
// File kinds come from the corpus; supported types come from the shared model catalog.
import type { readProjection } from './projection.js';
import { isTerminal, type ItemFacts } from './facts.js';
import { assessCheckpoint } from './checkpoint.js';
import { fmGet } from './fm.js';
import { parseItemFile } from './parse.js';

type Snapshot = ReturnType<typeof readProjection>;
export interface DiscoveryOptions {
  q?: string;
  tiers?: string;
  archive?: string;
  dir?: string;
  status?: string;
  parent?: string;
  page?: number;
  pageSize?: number;
}
export interface DiscoveryResult {
  path: string; tier: number; title: string; preview: string;
  stagedCount?: number; ref?: string; parent?: string; status?: string; review?: string; archived?: string;
  supersededBy?: string; verification?: string; scope?: string;
  checkpoint?: ReturnType<typeof checkpointSummary>;
}
export function discoveryOptions(input: DiscoveryOptions): Required<Pick<DiscoveryOptions, 'q' | 'tiers' | 'archive' | 'page' | 'pageSize'>> & DiscoveryOptions {
  const o = { q: '', tiers: '2,3', archive: 'exclude', page: 0, pageSize: 10, ...input };
  if (!/^[123](,[123])*$/.test(o.tiers)) throw new Error('tiers must be a comma-separated selection of 1,2,3');
  if (!['exclude', 'include', 'only'].includes(o.archive)) throw new Error('archive must be exclude, include or only');
  if (!Number.isSafeInteger(o.page) || o.page < 0 || !Number.isSafeInteger(o.pageSize) || o.pageSize < 1 || o.pageSize > 50
    || !Number.isSafeInteger(o.page * o.pageSize)) throw new Error('page must be nonnegative; page-size must be 1..50');
  if (o.dir && !(ITEM_DIRS as readonly string[]).includes(o.dir)) throw new Error('unknown item directory');
  if (o.status && !STATUSES.has(o.status)) throw new Error('unknown status');
  if (o.q.length > 200) throw new Error('query must be at most 200 characters');
  return o;
}
export function compact(text: string, limit = 240): string {
  const value = text.replace(/\s+/g, ' ').trim();
  return value.length > limit ? value.slice(0, limit - 1) + '…' : value;
}
function previewAround(text: string, terms: string[]): string {
  const line = text.replace(/\s+/g, ' ').trim();
  const positions = terms.map(term => line.toLowerCase().indexOf(term)).filter(n => n >= 0);
  const start = positions.length ? Math.max(0, Math.min(...positions) - 60) : 0;
  return compact((start ? '…' : '') + line.slice(start));
}
export function compareItems(a: ItemFacts, b: ItemFacts): number {
  const terminal = Number(isTerminal(a.status)) - Number(isTerminal(b.status));
  return terminal || compareText(orderDate(b), orderDate(a)) || compareText(a.ref, b.ref);
}
function orderDate(f?: ItemFacts): string {
  return f?.kind === 'work-item' ? f.updatedRaw?.replace(/^["']|["']$/g, '') ?? '' : f?.date ?? f?.updatedDate ?? '';
}
function compareText(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }
export function checkpointSummary(snapshot: Snapshot, ref: string) {
  const task = snapshot.files.find(f => f.relPath === `${ref}.md`);
  if (!task || !ref.startsWith('tasks/')) return undefined;
  const pointer = fmGet(parseItemFile(task.text).fm, 'checkpoint');
  const source = pointer === `${ref}/checkpoint.md` ? snapshot.files.find(f => f.relPath === pointer) : undefined;
  if (!source) return { readiness: pointer ? 'review-required' : 'unprepared', nextAction: '', path: undefined as string | undefined, reasons: ['Current checkpoint unavailable'], reasonCount: 1 };
  const assessment = assessCheckpoint(source.relPath, source.text, snapshot.files);
  const section = parseItemFile(source.text).sections.find(s => s.heading === 'Next actions');
  const next = section && 'lines' in section ? section.lines.join(' ') : '';
  const reasons = [...assessment.errors, ...assessment.reasons];
  return { path: source.relPath, readiness: assessment.readiness, nextAction: compact(next), reasons: reasons.slice(0, 3).map(r => compact(r)), reasonCount: reasons.length };
}

/** Only selected page rows get checkpoint assessment; history is never an input. */
export function discover(snapshot: Snapshot, input: DiscoveryOptions = {}, now = new Date().toISOString().slice(0, 16)) {
  const options = discoveryOptions(input), tiers = new Set(options.tiers.split(',').map(Number));
  const terms = options.q.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const byRef = new Map(snapshot.facts.map(f => [f.ref, f]));
  const candidates: { row: DiscoveryResult; facts?: ItemFacts; score: number }[] = [];
  const protocol = snapshot.files.find(f => f.relPath === 'PROTOCOL.md');
  for (const original of snapshot.files) {
    const file = tiers.has(1) && original.relPath === 'DASHBOARD.md' ? { ...original, text: regenFull(snapshot.facts, original.text, {
      now, protocolRaw: fmGet(parseItemFile(protocol?.text ?? '').fm, 'version') ?? '?', inputs: snapshot.inputs,
    }) } : original;
    const tier = file.relPath === 'DASHBOARD.md' ? 1 : file.kind === 'item' ? 2 : file.kind === 'doc' || file.kind === 'checkpoint' ? 3 : 0;
    if (!tiers.has(tier) || !tier || file.relPath.includes('/checkpoints/')) continue;
    const ref = file.relPath.split('/').slice(0, 2).join('/').replace(/\.md$/, '');
    const owner = byRef.get(ref);
    const ast = parseItemFile(file.text);
    const archived = owner?.archived ?? fmGet(ast.fm, 'archived');
    if ((options.archive === 'exclude' && archived) || (options.archive === 'only' && !archived)) continue;
    if (options.dir && file.relPath.split('/')[0] !== options.dir) continue;
    if (options.status && owner?.status !== options.status) continue;
    if (options.parent && (tier !== 2 || owner?.parent !== options.parent)) continue;
    const title = tier === 2 ? owner?.title ?? ref : fmGet(ast.fm, 'title') ?? ast.title ?? file.relPath;
    const haystack = `${title}\n${file.relPath}\n${file.text}`.toLowerCase();
    if (!terms.every(term => haystack.includes(term))) continue;
    const matchLine = file.text.split('\n').find(line => terms.length && terms.some(term => line.toLowerCase().includes(term)))
      ?? (tier === 2 ? owner?.summaryFirst : undefined) ?? ast.sections.flatMap(s => 'lines' in s ? s.lines : []).find(line => line.trim()) ?? '';
    candidates.push({ facts: owner, score: terms.filter(term => title.toLowerCase().includes(term)).length,
      row: { path: file.relPath, tier, title: compact(title, 160), preview: previewAround(matchLine, terms),
        stagedCount: owner?.stagedCount, ref: owner?.ref, parent: owner?.parent, status: owner?.status, review: owner?.review, supersededBy: owner?.supersededBy, verification: owner?.verification, scope: owner?.scope ? compact(owner.scope) : undefined, archived } });
  }
  candidates.sort((a, b) => b.score - a.score || Number(isTerminal(a.facts?.status)) - Number(isTerminal(b.facts?.status))
    || compareText(orderDate(b.facts), orderDate(a.facts))
    || compareText(a.row.path, b.row.path));
  const total = candidates.length, start = options.page * options.pageSize;
  const results = candidates.slice(start, start + options.pageSize).map(({ row }) => ({ ...row,
    ...(row.tier === 2 && row.ref?.startsWith('tasks/') ? { checkpoint: checkpointSummary(snapshot, row.ref) } : {}) }));
  return { options, total, page: options.page, pageSize: options.pageSize,
    nextPage: start + results.length < total ? options.page + 1 : null, results };
}

/** Direct dependencies only, separate from parent/child navigation. */
export function dependencies(snapshot: Snapshot, ref: string) {
  const task = snapshot.files.find(f => f.relPath === `${ref}.md`);
  if (!task) return [];
  const ast = parseItemFile(task.text);
  const rows = ast.sections.flatMap(s => s.kind === 'checklist' ? s.steps.flatMap(step => step.continuations
    .filter(c => c.kw === 'blocked-by').map(c => ({ source: c.target, reason: c.label }))) : []);
  const pointer = fmGet(ast.fm, 'checkpoint');
  const cp = pointer === `${ref}/checkpoint.md` ? snapshot.files.find(f => f.relPath === pointer) : undefined;
  if (cp) rows.push(...assessCheckpoint(cp.relPath, cp.text, snapshot.files).predicates
    .map(p => ({ source: '', reason: `${p.condition} — ${p.state}: ${p.evidence}` })));
  return rows;
}
