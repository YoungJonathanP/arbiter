// Revision-review model, persisted by the protocol 0.4.15 input-storage adapter.
// Callers supply a trusted, resolved audience; this module does not authenticate.
import { sha256 } from './corpus.js';

export type Audience = { kind: 'shared' } | { kind: 'restricted'; readers: string[] };
export interface ReviewTask { id: string; revision: string; audience: Audience }
export interface LinkedSource {
  id: string;
  /** Exact canonical bytes, including author, capture time and optional event date. */
  bytes: string;
  audience: Audience;
}
export interface InputLink {
  /** Stable association incarnation; removing and re-adding allocates a new ID. */
  id: string;
  task: string;
  source: string;
  audience: Audience;
}
export type Disposition = 'presented' | 'incorporated' | 'deferred' | 'dismissed';
export interface InputRevision {
  task: string;
  source: string;
  link: string;
  revision: string;
}
export interface InputReceipt extends InputRevision {
  disposition: Disposition;
  reason: string;
  reviewer: string;
  reviewedAt: string;
  taskRevision: string;
}
export interface InputReview {
  task: string;
  taskRevision: string;
  receiptRevision: string;
  reviewer: string;
  /** Only revisions actually selected and read may be receipted. */
  observed: InputRevision[];
}
export interface InputState {
  sources: LinkedSource[];
  links: InputLink[];
  /** Append order is authoritative; timestamps are descriptive, never cutoffs. */
  receipts: InputReceipt[];
}

export function audienceAllows(audience: Audience, viewer: string | null): boolean {
  return audience.kind === 'shared' || (viewer !== null && audience.readers.includes(viewer));
}

function covers(source: Audience, destination: Audience): boolean {
  return source.kind === 'shared' || (destination.kind === 'restricted'
    && destination.readers.every(reader => source.readers.includes(reader)));
}

function unique(ids: string[]) {
  if (ids.some(id => !id.trim()) || new Set(ids).size !== ids.length) throw new Error('Ambiguous input identities');
}

function same(a: InputRevision, b: InputRevision): boolean {
  return a.task === b.task && a.source === b.source && a.link === b.link && a.revision === b.revision;
}

function receiptRevision(task: string, state: InputState): string {
  return `sha256:${sha256(JSON.stringify(state.receipts.filter(receipt => receipt.task === task)))}`;
}

/** Filter before exposing bodies, associations or totals. Relationship access is
 * independent of both endpoints; a readable task never grants note access. */
export function pendingInput(task: ReviewTask, state: InputState, viewer: string | null) {
  if (!audienceAllows(task.audience, viewer)) return [];
  unique(state.sources.map(s => s.id));
  unique(state.links.map(l => l.id));
  return state.links.filter(link => link.task === task.id && audienceAllows(link.audience, viewer)).flatMap(link => {
    const source = state.sources.find(s => s.id === link.source);
    if (!source || !audienceAllows(source.audience, viewer)) return [];
    const input: InputRevision = { task: task.id, source: source.id, link: link.id,
      revision: `sha256:${sha256(source.bytes)}` };
    const receipt = state.receipts.findLast(r => same(r, input));
    if (receipt?.disposition === 'incorporated' || receipt?.disposition === 'dismissed') return [];
    // Receipt reasons/reviewer identities may contain private review context.
    // They belong in a separately authorized audit view, not this projection.
    return [{ ...input, bytes: source.bytes, disposition: receipt?.disposition ?? 'new' as const,
      canIncorporate: covers(source.audience, task.audience) && covers(link.audience, task.audience) }];
  });
}

/** Explicitly selecting a revision for reading does not acknowledge it. */
export function beginInputReview(task: ReviewTask, state: InputState, reviewer: string, selected: InputRevision[]): InputReview {
  if (!reviewer.trim() || !audienceAllows(task.audience, reviewer)) throw new Error('Review unavailable');
  unique(selected.map(input => input.link));
  const available = pendingInput(task, state, reviewer);
  if (selected.some(input => !available.some(current => same(current, input)))) throw new Error('Input changed or unavailable; read again');
  return { task: task.id, taskRevision: task.revision, receiptRevision: receiptRevision(task.id, state), reviewer, observed: selected.map(input => ({
    task: input.task, source: input.source, link: input.link, revision: input.revision,
  })) };
}

/** Pure candidate transition. Persist receipts through CAS with the review's task
 * revision and the receipt-log revision; never treat this return as a saved write.
 * Incorporation additionally requires a separately verified task-content write. */
export function finishInputReview(task: ReviewTask, state: InputState, review: InputReview,
  decisions: { input: InputRevision; disposition: Disposition; reason: string }[], reviewedAt: string): InputReceipt[] {
  if (review.task !== task.id || review.taskRevision !== task.revision) throw new Error('Task changed; recheck human actions before review');
  if (review.receiptRevision !== receiptRevision(task.id, state)) throw new Error('Review receipts changed; reconcile concurrent review');
  if (!audienceAllows(task.audience, review.reviewer)) throw new Error('Review unavailable');
  if (!Number.isFinite(Date.parse(reviewedAt))) throw new Error('Invalid review time');
  unique(decisions.map(d => d.input.link));
  unique(state.sources.map(s => s.id));
  unique(state.links.map(l => l.id));
  return decisions.map(decision => {
    if (!['presented', 'incorporated', 'deferred', 'dismissed'].includes(decision.disposition)
      || !decision.reason.trim()) throw new Error('Disposition requires an explicit reason');
    if (!review.observed.some(input => same(input, decision.input))) throw new Error('Cannot acknowledge an unobserved revision');
    const link = state.links.find(l => l.id === decision.input.link && l.task === task.id && l.source === decision.input.source);
    const source = state.sources.find(s => s.id === link?.source);
    if (!link || !source || !audienceAllows(link.audience, review.reviewer) || !audienceAllows(source.audience, review.reviewer))
      throw new Error('Input no longer available');
    if (decision.disposition === 'incorporated' && (!covers(source.audience, task.audience) || !covers(link.audience, task.audience)))
      throw new Error('Sharing decision required before incorporating restricted input');
    // A concurrent edit remains pending: receipt the old observed digest only.
    return { task: decision.input.task, source: decision.input.source, link: decision.input.link,
      revision: decision.input.revision, disposition: decision.disposition, reason: decision.reason,
      reviewer: review.reviewer, reviewedAt, taskRevision: review.taskRevision };
  });
}

export interface ConnectedEntity { id: string; title: string; audience: Audience }
export interface WorkRelationship {
  id: string;
  entity: string;
  task: string;
  role: 'contributor' | 'reviewer' | 'stakeholder' | 'owner' | 'note-author';
  audience: Audience;
}

/** One filtered edge set serves both cards; no ownership or access is assigned.
 * An owner relationship label does not set the task's accountable owner field. */
export function accessibleRelationships(tasks: ReviewTask[], entities: ConnectedEntity[], edges: WorkRelationship[], viewer: string | null) {
  unique(tasks.map(t => t.id)); unique(entities.map(e => e.id)); unique(edges.map(e => e.id));
  return edges.flatMap(edge => {
    const task = tasks.find(t => t.id === edge.task), entity = entities.find(e => e.id === edge.entity);
    if (!task || !entity || !audienceAllows(task.audience, viewer) || !audienceAllows(entity.audience, viewer)
      || !audienceAllows(edge.audience, viewer)) return [];
    return [{ id: edge.id, task: task.id, entity: entity.id, title: entity.title, role: edge.role }];
  });
}
