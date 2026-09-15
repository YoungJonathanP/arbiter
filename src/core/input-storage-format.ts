// Canonical private audit ledger for protocol 0.4.15. JSON is confined to one
// explicitly delimited event per Markdown section; ordinary prose stays opaque.
import { sha256 } from './corpus.js';
import type { InputReceipt, WorkRelationship } from './input-review.js';

export const INPUT_POINTER = '<!-- arbiter:input-review · PROTOCOL.md#linked-input · append events; never acknowledge by timestamp -->\n';
export const inputLedgerPath = (task: string): string => {
  if (!/^tasks\/[a-z0-9][a-z0-9-]*$/.test(task)) throw new Error('Invalid input-review task');
  return `${task}/input-review.md`;
};
export const revisionOf = (text: string | null) => text === null ? 'new' : `sha256:${sha256(text)}`;
export type InputEffect =
  | { kind: 'link'; id: string; source: string; visibility: 'shared' | 'private' }
  | { kind: 'source-edit'; source: string }
  | { kind: 'unlink'; id: string }
  | { kind: 'relationship'; id: string; entity: string; visibility: 'shared' | 'private'; role: WorkRelationship['role'] }
  | { kind: 'disconnect'; id: string }
  | { kind: 'review'; receipts: InputReceipt[] }
  | { kind: 'status'; status: string; checklist: 'complete' | 'preserve' };
export interface InputEvent {
  id: string;
  actor: string;
  at: string;
  previous: string;
  operation: InputEffect | { kind: 'intent'; target: string; before: string | null; after: string; effect: InputEffect }
    | { kind: 'applied'; intent: string } | { kind: 'cancelled'; intent: string };
}
export function checkInputProtocol(events: InputEvent[], protocol: string) {
  if (!['0.4.15', '0.4.16', '0.4.17'].includes(protocol)) throw new Error('Input-review storage requires protocol 0.4.15 or 0.4.16');
  if (!['0.4.16', '0.4.17'].includes(protocol) && events.some(e => e.operation.kind === 'source-edit'
    || (e.operation.kind === 'intent' && ['source-edit', 'relationship'].includes(e.operation.effect.kind))))
    throw new Error('Appointment edits and person creation require protocol 0.4.16');
}
const fail = (): never => { throw new Error('Invalid input-review ledger'); };
const nonempty = (v: unknown): v is string => typeof v === 'string' && !!v.trim() && !/[\r\n\0]/.test(v);
const digest = (v: unknown) => typeof v === 'string' && /^sha256:[0-9a-f]{64}$/.test(v);
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const sourceRef = (v: unknown) => typeof v === 'string' && /^(journal|meetings)\/[a-z0-9][a-z0-9-]*$/.test(v);
function keys(value: object, expected: string[]) {
  if (Object.keys(value).sort().join() !== expected.sort().join()) fail();
}
function effect(value: InputEffect, task: string) {
  if (!value || typeof value !== 'object') fail();
  switch (value.kind) {
    case 'link': keys(value, ['kind', 'id', 'source', 'visibility']); if (!uuid(value.id) || !sourceRef(value.source) || !['shared', 'private'].includes(value.visibility)) fail(); break;
    case 'source-edit': keys(value, ['kind', 'source']); if (!sourceRef(value.source)) fail(); break;
    case 'unlink': case 'disconnect': keys(value, ['kind', 'id']); if (!uuid(value.id)) fail(); break;
    case 'relationship':
      keys(value, ['kind', 'id', 'entity', 'role', 'visibility']);
      if (!uuid(value.id) || !['shared', 'private'].includes(value.visibility) || !/^[a-z]+\/[a-z0-9][a-z0-9-]*$/.test(value.entity)
        || !['contributor', 'reviewer', 'stakeholder', 'owner', 'note-author'].includes(value.role)) fail(); break;
    case 'status':
      keys(value, ['kind', 'status', 'checklist']);
      if (!['todo', 'in-flight', 'blocked', 'done', 'dropped'].includes(value.status) || !['complete', 'preserve'].includes(value.checklist)) fail(); break;
    case 'review':
      keys(value, ['kind', 'receipts']);
      if (!Array.isArray(value.receipts) || !value.receipts.length) fail();
      if (new Set(value.receipts.map(r => r.link)).size !== value.receipts.length) fail();
      for (const r of value.receipts) {
        keys(r, ['task', 'source', 'link', 'revision', 'disposition', 'reason', 'reviewer', 'reviewedAt', 'taskRevision']);
        if (r.task !== task || !sourceRef(r.source) || !uuid(r.link) || !digest(r.revision) || !digest(r.taskRevision)
          || !['presented', 'incorporated', 'deferred', 'dismissed'].includes(r.disposition)
          || !nonempty(r.reason) || !nonempty(r.reviewer) || !nonempty(r.reviewedAt) || !Number.isFinite(Date.parse(r.reviewedAt))) fail();
      }
      break;
    default: fail();
  }
}
function header(task: string) {
  inputLedgerPath(task);
  return `---\nrole: input-review\nversion: 0.4.15\ntask: ${task}\nvisibility: private\n---\n\n# Linked input audit\n\n`;
}
export const emptyInputLedger = (task: string) => header(task) + INPUT_POINTER;
export const eventMarkdown = (event: InputEvent) => `## Event ${event.id}\n\n\`\`\`json\n${JSON.stringify(event)}\n\`\`\`\n\n`;

export function parseInputLedger(task: string, text: string): InputEvent[] {
  if (!text.startsWith(header(task)) || !text.endsWith(INPUT_POINTER)) fail();
  const body = text.slice(header(task).length, -INPUT_POINTER.length);
  const events: InputEvent[] = [];
  let consumed = '';
  for (const m of body.matchAll(/## Event ([a-f0-9-]+)\n\n```json\n([^\n]+)\n```\n\n/g)) {
    const e = JSON.parse(m[2]!) as InputEvent;
    keys(e, ['id', 'actor', 'at', 'previous', 'operation']);
    if (!uuid(e.id) || e.id !== m[1] || events.some(old => old.id === e.id) || !nonempty(e.actor)
      || !nonempty(e.at) || !Number.isFinite(Date.parse(e.at))
      || e.previous !== (events.length ? revisionOf(eventMarkdown(events.at(-1)!)) : 'none')) fail();
    const op = e.operation;
    if (!op || typeof op !== 'object') fail();
    if (op.kind === 'intent') {
      keys(op, ['kind', 'target', 'before', 'after', 'effect']);
      if (!(op.before === null || typeof op.before === 'string') || typeof op.after !== 'string'
        || !(op.target === `${task}.md` || /^(journal|meetings|people)\/[a-z0-9][a-z0-9-]*\.md$/.test(op.target))) fail();
      effect(op.effect, task);
      if (op.effect.kind === 'link') {
        if (op.target !== `${op.effect.source}.md` || op.before !== null) fail();
      } else if (op.effect.kind === 'source-edit') {
        if (op.target !== `${op.effect.source}.md` || op.before === null || op.before === op.after) fail();
      } else if (op.effect.kind === 'relationship') {
        if (!op.effect.entity.startsWith('people/') || op.target !== `${op.effect.entity}.md` || op.before !== null) fail();
      } else if (op.effect.kind === 'review' || op.effect.kind === 'status') {
        if (op.target !== `${task}.md` || op.before === null || op.before === op.after) fail();
        if (op.effect.kind === 'review' && op.effect.receipts.some(r => r.taskRevision !== revisionOf(op.before))) fail();
      } else fail();
    } else if (op.kind === 'applied' || op.kind === 'cancelled') {
      keys(op, ['kind', 'intent']); if (!uuid(op.intent)) fail();
    } else effect(op, task);
    events.push(e); consumed += m[0];
  }
  if (consumed !== body) fail();
  replayInputEvents(events); // Validate causal order, incarnation reuse and receipt attribution.
  return events;
}

export function replayInputEvents(events: InputEvent[]) {
  const links = new Map<string, { id: string; source: string; visibility: 'shared' | 'private' }>();
  const relationships = new Map<string, Extract<InputEffect, { kind: 'relationship' }>>();
  const used = new Set<string>();
  const receipts: InputReceipt[] = [];
  let lastReview: string | null = null;
  let pending: InputEvent | null = null;
  const apply = (op: InputEffect, event: InputEvent, written: boolean) => {
    if (op.kind === 'link' || op.kind === 'relationship') {
      if (used.has(op.id)) fail(); used.add(op.id);
      if (op.kind === 'link') links.set(op.id, { id: op.id, source: op.source, visibility: op.visibility }); else relationships.set(op.id, op);
    } else if (op.kind === 'unlink') { if (!links.delete(op.id)) fail(); }
    else if (op.kind === 'disconnect') { if (!relationships.delete(op.id)) fail(); }
    else if (op.kind === 'review') {
      for (const r of op.receipts) {
        if (links.get(r.link)?.source !== r.source || r.reviewer !== event.actor || r.reviewedAt !== event.at
          || (r.disposition === 'incorporated' && !written)) fail();
      }
      receipts.push(...op.receipts); lastReview = event.at;
    } else if (op.kind === 'source-edit') { if (!written || ![...links.values()].some(l => l.source === op.source)) fail(); }
    else if (!written) fail(); // Status evidence requires verified intent completion.
  };
  for (const event of events) {
    const op = event.operation;
    if (op.kind === 'applied' || op.kind === 'cancelled') {
      if (!pending || pending.id !== op.intent || pending.operation.kind !== 'intent' || event.actor !== pending.actor) fail();
      if (op.kind === 'applied' && pending?.operation.kind === 'intent') apply(pending.operation.effect, pending, true);
      pending = null;
    } else {
      if (pending) fail();
      if (op.kind === 'intent') pending = event; else apply(op, event, false);
    }
  }
  return { links: [...links.values()], relationships: [...relationships.values()], receipts, lastReview, pending };
}

export function validateInputAppend(task: string, before: string | null, after: string) {
  const old = before === null ? emptyInputLedger(task) : before;
  parseInputLedger(task, old); const events = parseInputLedger(task, after);
  if (!after.startsWith(old.slice(0, -INPUT_POINTER.length))) throw new Error('Input-review history is append-only');
  return events;
}
