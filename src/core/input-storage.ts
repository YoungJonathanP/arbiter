// Protocol 0.4.15 persistence adapter. AccessPolicy is trusted host configuration,
// never a request field. Default local app access exposes shared records only.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { walkCorpus, listStaged } from './corpus.js';
import { parseItemFile } from './parse.js';
import { fmGet, fmSet, serializeFrontmatter } from './fm.js';
import { validDate } from './date.js';
import { readProjection } from './projection.js';
import { visibilityPolicy } from './visibility.js';
import { extractFacts } from './facts.js';
import { SchemaSet } from './schema.js';
import { CommitConflict, withCommitSession, type CommitPlan } from './commit.js';
import { beginInputReview, finishInputReview, pendingInput, audienceAllows, accessibleRelationships, type Audience, type InputReview, type InputRevision, type Disposition, type InputReceipt } from './input-review.js';
import { checkInputProtocol, emptyInputLedger, eventMarkdown, INPUT_POINTER, inputLedgerPath, parseInputLedger, replayInputEvents, revisionOf, type InputEffect, type InputEvent } from './input-storage-format.js';

export interface InputAccessPolicy {
  /** Change whenever external grants change. The adapter rechecks under lock. */
  revision: string;
  resolve: (rel: string, bytes: string) => Audience;
  /** Trusted host operation: reserve fresh generated resources for this actor only. */
  provision?: (actor: string, resources: string[], expectedRevision: string) => void;
}
const defaultAccess: InputAccessPolicy = { revision: 'shared-only-v1', resolve: (_rel, bytes) =>
  fmGet(parseItemFile(bytes).fm, 'visibility') === 'private' ? { kind: 'restricted', readers: [] } : { kind: 'shared' } };
type Writer = <P extends CommitPlan>(target: string, plan: (current: string | null) => P, opts?: { expected?: string }) => P;

export function readInputState(dir: string, task: string, access: InputAccessPolicy = defaultAccess) {
  const accessRevision = access.revision;
  const ledgerPath = inputLedgerPath(task), files = walkCorpus(dir, { includeHistory: false });
  const get = (rel: string) => files.find(f => f.relPath === rel)?.text ?? null;
  const taskBytes = get(`${task}.md`);
  if (taskBytes === null) throw new Error('Task unavailable');
  const protocol = get('PROTOCOL.md') ?? '';
  const supported = ['0.4.15', '0.4.16', '0.4.17'].includes(fmGet(parseItemFile(protocol).fm, 'version') ?? '');
  const ledger = get(ledgerPath), events = ledger === null ? [] : parseInputLedger(task, ledger);
  if (ledger !== null && !supported) throw new Error('Input storage requires explicit protocol 0.4.15 adoption');
  if (ledger !== null) checkInputProtocol(events, fmGet(parseItemFile(protocol).fm, 'version') ?? '');
  const replay = replayInputEvents(events);
  const policy = visibilityPolicy(extractFacts(dir, files, SchemaSet.fromFiles(files)), files);
  const audience = (rel: string, bytes: string): Audience => {
    // Default exports must also respect inherited privacy and redacted references.
    if (access === defaultAccess && (!policy.allowsPath(rel) || policy.redact(bytes) !== bytes)) return { kind: 'restricted', readers: [] };
    return access.resolve(rel, bytes);
  };
  const reviewTask = { id: task, revision: revisionOf(taskBytes), audience: audience(`${task}.md`, taskBytes) };
  const sources = [...new Set(replay.links.map(l => l.source))].flatMap(id => {
    const bytes = get(`${id}.md`);
    return bytes === null ? [] : [{ id, bytes, audience: audience(`${id}.md`, bytes) }];
  });
  // Public links carry no access grant. Restricted sources stay restricted; the
  // default renderer has no personal-principal authentication adapter.
  const links = replay.links.map(l => ({ ...l, task, audience: access === defaultAccess
    ? l.visibility === 'private' ? { kind: 'restricted' as const, readers: [] } : sources.find(s => s.id === l.source)?.audience ?? { kind: 'restricted' as const, readers: [] }
    : access.resolve(`${ledgerPath}#${l.id}`, ledger ?? '') }));
  const state = { sources, links, receipts: replay.receipts };
  const basis = revisionOf(JSON.stringify([taskBytes, ledger, protocol, accessRevision,
    reviewTask.audience, sources, links]));
  if (access.revision !== accessRevision) throw new CommitConflict('Access policy changed; refresh and review');
  return { task: reviewTask, taskBytes, state, ledger, events, replay, supported, basis };
}

export function inputReviewView(dir: string, task: string, actor: string | null = null, access: InputAccessPolicy = defaultAccess) {
  const s = readInputState(dir, task, access);
  if (!audienceAllows(s.task.audience, actor)) throw new Error('Task unavailable');
  const readableLinks = new Set(pendingInput(s.task, { ...s.state, receipts: [] }, actor).map(i => i.link));
  const lastReview = s.state.receipts.findLast(r => readableLinks.has(r.link))?.reviewedAt ?? null;
  return { lastReview, taskRevision: s.task.revision, basis: s.basis, supported: s.supported,
    // No private audit timestamp, reason, actor, identity or count enters exports.
    pending: pendingInput(s.task, s.state, actor), reconciliationRequired: !!s.replay.pending && s.replay.pending.actor === actor };
}
function writable(dir: string, task: string, actor: string, access: InputAccessPolicy) {
  const s = readInputState(dir, task, access);
  if (!s.supported) throw new Error('Input actions require explicit protocol 0.4.15 adoption');
  if (!actor.trim() || !audienceAllows(s.task.audience, actor)) throw new Error('Task unavailable');
  if (listStaged(dir, `${task}.md`).length) throw new CommitConflict('Task has pending proposals; resolve before input actions');
  if (s.replay.pending) throw new CommitConflict('Incomplete input action; re-observe and reconcile its intent');
  return s;
}
function append(write: Writer, task: string, ledger: string | null, actor: string, at: string, operation: InputEvent['operation']) {
  const old = ledger ?? emptyInputLedger(task), events = parseInputLedger(task, old);
  const event: InputEvent = { id: randomUUID(), actor, at, previous: events.length ? revisionOf(eventMarkdown(events.at(-1)!)) : 'none', operation };
  const next = old.slice(0, -INPUT_POINTER.length) + eventMarkdown(event) + INPUT_POINTER;
  write(inputLedgerPath(task), () => ({ text: next }), { expected: revisionOf(ledger) });
  return { ledger: next, event };
}
function observed(s: ReturnType<typeof readInputState>, basis: string) {
  if (s.basis !== basis) throw new CommitConflict('Input view changed; refresh and review');
}
function writeEffect(dir: string, write: Writer, task: string, s: ReturnType<typeof readInputState>, actor: string, at: string,
  target: string, before: string | null, after: string, effect: InputEffect, access: InputAccessPolicy,
  hooks: { afterContent?: () => void } = {}) {
  const accessRevision = access.revision;
  const intent = append(write, task, s.ledger, actor, at, { kind: 'intent', target, before, after, effect });
  // Exact write intent survives any failure; no receipt is emitted before reread.
  write(target, () => ({ text: after }), { expected: revisionOf(before) });
  hooks.afterContent?.();
  const current = readInputState(dir, task, access);
  if (fs.readFileSync(path.join(dir, target), 'utf8') !== after || current.ledger !== intent.ledger
    || (target !== `${task}.md` && current.taskBytes !== s.taskBytes)
    || access.revision !== accessRevision) throw new CommitConflict('Input action changed during write; reconcile intent');
  // Recheck source/access state after a task write too. Receipts remain old exact
  // revisions if a source changed; access revocation refuses acknowledgment.
  if (effect.kind === 'review') {
    const review = beginInputReview(s.task, s.state, actor, effect.receipts);
    finishInputReview(s.task, { ...current.state, receipts: s.state.receipts }, review,
      effect.receipts.map(r => ({ input: r, disposition: r.disposition, reason: r.reason })), at);
    if (!audienceAllows(current.task.audience, actor)) throw new CommitConflict('Task access changed; reconcile intent');
  }
  return append(write, task, intent.ledger, actor, at, { kind: 'applied', intent: intent.event.id });
}

export function linkInput(dir: string, task: string, source: string, basis: string, actor: string,
  at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = writable(dir, task, actor, access); observed(s, basis);
    if (!/^(journal|meetings)\/[a-z0-9][a-z0-9-]*$/.test(source)) throw new Error('Select a journal or meeting source');
    const bytes = fs.readFileSync(path.join(dir, `${source}.md`), 'utf8');
    if (!audienceAllows(access.resolve(`${source}.md`, bytes), actor)) throw new Error('Source unavailable');
    const id = randomUUID();
    if (access.provision) access.provision(actor, [`${inputLedgerPath(task)}#${id}`], access.revision);
    const current = writable(dir, task, actor, access);
    if (current.taskBytes !== s.taskBytes || current.ledger !== s.ledger) throw new CommitConflict('Input changed during access provisioning');
    const visibility = access === defaultAccess || access.resolve(`${inputLedgerPath(task)}#${id}`, s.ledger ?? '').kind === 'shared' ? 'shared' : 'private';
    return append(write, task, s.ledger, actor, at, { kind: 'link', id, source, visibility });
  });
}
export function unlinkInput(dir: string, task: string, id: string, basis: string, actor: string,
  at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = writable(dir, task, actor, access); observed(s, basis);
    if (!pendingInput(s.task, { ...s.state, receipts: [] }, actor).some(i => i.link === id)) throw new Error('Link unavailable');
    return append(write, task, s.ledger, actor, at, { kind: 'unlink', id });
  });
}
export function captureQuickNote(dir: string, task: string, note: string, basis: string, actor: string,
  options: { at?: string; eventDate?: string; personal?: boolean; afterContent?: () => void } = {}, access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = writable(dir, task, actor, access); observed(s, basis);
    const at = options.at ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    if (!note.trim() || note.length > 100000 || !Number.isFinite(Date.parse(at)) || /[\r\n]/.test(at)
      || (options.eventDate && !validDate(options.eventDate))) throw new Error('Invalid note or capture date');
    // Quick capture preserves the task's audience conservatively. Personal access
    // needs the separately configured identity/policy adapter before wider sharing.
    const id = `input-${randomUUID()}`, source = `journal/${id}`, link = randomUUID();
    if (options.personal) {
      if (!access.provision) throw new Error('Personal capture requires trusted policy provisioning');
      access.provision(actor, [`${source}.md`, `${inputLedgerPath(task)}#${link}`], access.revision);
    }
    const current = writable(dir, task, actor, access);
    if (current.taskBytes !== s.taskBytes || current.ledger !== s.ledger) throw new CommitConflict('Input changed during access provisioning');
    const text = `---\nid: ${id}\ntype: journal\ntitle: Task note\nupdated: ${at}\ndate: ${options.eventDate ?? at.slice(0, 10)}\n${!options.personal && s.task.audience.kind === 'shared' ? '' : 'visibility: private\n'}---\n\n# Task note\n\n## Summary\n\n${note}\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · preserve captured input -->\n`;
    writeEffect(dir, write, task, current, actor, at, `${source}.md`, null, text, { kind: 'link', id: link, source, visibility: access === defaultAccess ? 'shared' : 'private' }, access, options);
    return { source };
  });
}
export function beginStoredInputReview(dir: string, task: string, actor: string, selected: InputRevision[], access: InputAccessPolicy = defaultAccess) {
  const s = readInputState(dir, task, access);
  return { review: beginInputReview(s.task, s.state, actor, selected), basis: s.basis };
}
export function saveInputReview(dir: string, task: string, actor: string, preview: { review: InputReview; basis: string },
  decisions: { input: InputRevision; disposition: Disposition; reason: string }[],
  options: { at?: string; incorporation?: string; afterContent?: () => void } = {}, access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = writable(dir, task, actor, access); observed(s, preview.basis);
    if (preview.review.reviewer !== actor) throw new Error('Review actor differs from authenticated session');
    const at = options.at ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const receipts = finishInputReview(s.task, s.state, preview.review, decisions, at);
    const operation: InputEffect = { kind: 'review', receipts };
    const incorporated = receipts.some(r => r.disposition === 'incorporated');
    if (incorporated) {
      if (!options.incorporation?.trim()) throw new Error('Incorporation requires a reviewed task-content change');
      const taskAfter = incorporatedTask(s.taskBytes, receipts, options.incorporation, at);
      writeEffect(dir, write, task, s, actor, at, `${task}.md`, s.taskBytes, taskAfter, operation, access, options);
    } else {
      if (options.incorporation !== undefined) throw new Error('Task content requires an incorporated disposition');
      append(write, task, s.ledger, actor, at, operation);
    }
    return { reviewedAt: at, receipts: receipts.length };
  });
}

/** Explicit re-observation only. Never restores old bytes over concurrent work. */
export function reconcileInputIntent(dir: string, task: string, actor: string, basis: string,
  access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = readInputState(dir, task, access); observed(s, basis);
    const pending = s.replay.pending;
    if (!s.supported || !pending || pending.actor !== actor || pending.operation.kind !== 'intent'
      || !audienceAllows(s.task.audience, actor)) throw new Error('Intent unavailable');
    const op = pending.operation, file = path.join(dir, op.target);
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (current !== op.before && current !== op.after) throw new CommitConflict('Intent target differs from both revisions; reconcile content explicitly');
    // A review needs a fresh sharing/source decision after interruption. Cancel
    // its receipt intent even if task prose landed; input remains actionable.
    const kind = current === op.after && op.effect.kind !== 'review' ? 'applied' : 'cancelled';
    return append(write, task, s.ledger, actor, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), { kind, intent: pending.id });
  });
}

/** Local operator command; request fields cannot select an actor or grant access.
 * Outstanding proposals are resolved through arbitration before this operation. */
export function setHumanTaskStatus(dir: string, task: string, actor: string, basis: string,
  status: string, checklist: 'complete' | 'preserve', at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = writable(dir, task, actor, access); observed(s, basis);
    if (!['todo', 'in-flight', 'blocked', 'done', 'dropped'].includes(status) || !['complete', 'preserve'].includes(checklist)) throw new Error('Choose status and checklist resolution');
    const ast = parseItemFile(s.taskBytes);
    if (!ast.fm) throw new Error('Structured task required');
    const open = ast.sections.flatMap(s => s.kind === 'checklist' ? s.steps : []).some(s => s.mark !== 'x');
    if (status === 'done' && open && checklist !== 'complete') throw new Error('Resolve unfinished checklist explicitly before Done');
    fmSet(ast.fm, 'status', status); fmSet(ast.fm, 'updated', at);
    const head = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(s.taskBytes)!;
    let body = s.taskBytes.slice(head[0].length);
    if (checklist === 'complete') {
      // Parser-selected source lines only: opaque imported rows are untouched.
      const lines = s.taskBytes.split('\n');
      for (const step of ast.sections.flatMap(section => section.kind === 'checklist' ? section.steps : [])) {
        if (step.rawLine !== undefined) lines[step.rawLine - 1] = lines[step.rawLine - 1]!.replace(/^(\s*[-*+] )\[[^\]]*\]/, '$1[x]');
      }
      body = lines.join('\n').slice(head[0].length);
    }
    const after = serializeFrontmatter(ast.fm).join('\n') + '\n' + body;
    if (after === s.taskBytes) return { taskRevision: s.task.revision };
    writeEffect(dir, write, task, s, actor, at, `${task}.md`, s.taskBytes, after, { kind: 'status', status, checklist }, access);
    return { taskRevision: revisionOf(after) };
  });
}

export function undoHumanTaskStatus(dir: string, task: string, actor: string, basis: string,
  at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = writable(dir, task, actor, access); observed(s, basis);
    const completed = new Set(s.events.flatMap(e => e.operation.kind === 'applied' ? [e.operation.intent] : []));
    const last = s.events.findLast(e => completed.has(e.id) && e.operation.kind === 'intent' && e.operation.effect.kind === 'status');
    if (!last || last.operation.kind !== 'intent' || last.operation.before === null || last.operation.after !== s.taskBytes)
      throw new CommitConflict('Task changed since the status action; review before Undo');
    const before = last.operation.before, ast = parseItemFile(before);
    if (!ast.fm) throw new Error('Structured prior task required');
    fmSet(ast.fm, 'updated', at);
    const head = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(before)!;
    const after = serializeFrontmatter(ast.fm).join('\n') + '\n' + before.slice(head[0].length);
    writeEffect(dir, write, task, s, actor, at, `${task}.md`, s.taskBytes, after,
      { kind: 'status', status: fmGet(ast.fm, 'status') ?? 'todo', checklist: 'preserve' }, access);
    return { taskRevision: revisionOf(after) };
  });
}

/** Persist an association without mutating either endpoint or task ownership. */
export function connectInputEntity(dir: string, task: string, entity: string,
  role: Extract<InputEffect, { kind: 'relationship' }>['role'], basis: string, actor: string,
  at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = writable(dir, task, actor, access); observed(s, basis);
    if (!/^[a-z]+\/[a-z0-9][a-z0-9-]*$/.test(entity)) throw new Error('Invalid entity ref');
    const file = walkCorpus(dir, { includeHistory: false }).find(f => f.kind === 'item' && f.relPath === `${entity}.md`);
    if (!file || !audienceAllows(access.resolve(file.relPath, file.text), actor)
      || (access === defaultAccess && !readProjection(dir).files.some(f => f.relPath === file.relPath && !f.redacted))) throw new Error('Entity unavailable');
    const id = randomUUID();
    if (access.provision) access.provision(actor, [`${inputLedgerPath(task)}#${id}`], access.revision);
    const current = writable(dir, task, actor, access);
    if (current.taskBytes !== s.taskBytes || current.ledger !== s.ledger) throw new CommitConflict('Input changed during access provisioning');
    const visibility = access === defaultAccess || access.resolve(`${inputLedgerPath(task)}#${id}`, s.ledger ?? '').kind === 'shared' ? 'shared' : 'private';
    return append(write, task, s.ledger, actor, at, { kind: 'relationship', id, entity, role, visibility });
  });
}
export function inputRelationships(dir: string, task: string, actor: string | null = null, access: InputAccessPolicy = defaultAccess) {
  const s = readInputState(dir, task, access);
  const files = access === defaultAccess ? readProjection(dir).files : walkCorpus(dir, { includeHistory: false });
  const entities = [...new Set(s.replay.relationships.map(e => e.entity))].flatMap(id => {
    const file = files.find(f => f.kind === 'item' && f.relPath === `${id}.md` && !f.redacted);
    return file ? [{ id, title: fmGet(parseItemFile(file.text).fm, 'title') ?? id, audience: access.resolve(file.relPath, file.text) }] : [];
  });
  const edges = s.replay.relationships.map(e => ({ ...e, task, audience: access === defaultAccess
    ? e.visibility === 'private' ? { kind: 'restricted' as const, readers: [] } : { kind: 'shared' as const }
    : access.resolve(`${inputLedgerPath(task)}#${e.id}`, s.ledger ?? '') }));
  return accessibleRelationships([s.task], entities, edges, actor);
}
export function disconnectInputEntity(dir: string, task: string, id: string, basis: string, actor: string,
  at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = writable(dir, task, actor, access); observed(s, basis);
    if (!inputRelationships(dir, task, actor, access).some(e => e.id === id)) throw new Error('Relationship unavailable');
    return append(write, task, s.ledger, actor, at, { kind: 'disconnect', id });
  });
}

/** Preview and apply share the same exact-byte constructor. */
function incorporatedTask(before: string, receipts: InputReceipt[], incorporation: string, at: string) {
  const ast = parseItemFile(before);
  if (!ast.fm || !ast.pointer) throw new Error('Structured task and pointer required');
  if (!incorporation.trim() || incorporation.length > 100000) throw new Error('Invalid incorporation');
  fmSet(ast.fm, 'updated', at);
  const head = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(before)!;
  const tail = /<!-- arbiter:[^\n]+ -->\r?\n?$/.exec(before);
  if (!tail) throw new Error('Final pointer required');
  const attribution = receipts.filter(r => r.disposition === 'incorporated').map(r =>
    `- input: [${r.source}](${r.source}.md) (${r.revision})`).join('\n');
  return serializeFrontmatter(ast.fm).join('\n') + '\n' + before.slice(head[0].length, tail.index)
    + `## Input review ${at}\n\n${incorporation}\n\n${attribution}\n\n` + tail[0];
}
export function previewInputIncorporation(dir: string, task: string, actor: string, input: InputRevision,
  basis: string, incorporation: string, reason: string, access: InputAccessPolicy = defaultAccess) {
  const s = writable(dir, task, actor, access); observed(s, basis);
  const preview = beginStoredInputReview(dir, task, actor, [input], access);
  const at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const decisions = [{ input, disposition: 'incorporated' as const, reason }];
  const receipts = finishInputReview(s.task, s.state, preview.review, decisions, at);
  return { preview, decisions, at, incorporation, before: s.taskBytes,
    after: incorporatedTask(s.taskBytes, receipts, incorporation, at) };
}
export function applyInputIncorporation(dir: string, task: string, actor: string,
  preview: ReturnType<typeof previewInputIncorporation>, access: InputAccessPolicy = defaultAccess) {
  // The HTTP layer retains the preview server-side, so a browser cannot replace it.
  return saveInputReview(dir, task, actor, preview.preview, preview.decisions,
    { at: preview.at, incorporation: preview.incorporation }, access);
}

/** Structured appointment capture uses the existing meeting record, with an
 * explicit date and optional scheduling prose. Editing keeps its stable ref. */
export function saveAppointment(dir: string, task: string, actor: string, basis: string,
  appointment: { title: string; date: string; time: string; details: string; source?: string; revision?: string },
  at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'), access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = writable(dir, task, actor, access); observed(s, basis);
    if (!['0.4.16', '0.4.17'].includes(fmGet(parseItemFile(fs.readFileSync(path.join(dir, 'PROTOCOL.md'), 'utf8')).fm, 'version') ?? '')) throw new Error('Appointment controls require protocol 0.4.16');
    if (typeof appointment.title !== 'string' || !appointment.title.trim() || appointment.title.length > 200
      || /[\r\n]/.test(appointment.title) || !validDate(appointment.date)
      || typeof appointment.time !== 'string' || appointment.time.length > 200 || /[\r\n]/.test(appointment.time)
      || typeof appointment.details !== 'string' || appointment.details.length > 100000) throw new Error('Invalid appointment fields');
    const id = `appointment-${randomUUID()}-${appointment.date}`, source = appointment.source ?? `meetings/${id}`;
    let before: string | null = null;
    if (appointment.source) {
      if (!/^meetings\/[a-z0-9][a-z0-9-]*$/.test(source)
        || !pendingInput(s.task, { ...s.state, receipts: [] }, actor).some(i => i.source === source)) throw new Error('Appointment unavailable');
      before = fs.readFileSync(path.join(dir, `${source}.md`), 'utf8');
      if (revisionOf(before) !== appointment.revision) throw new CommitConflict('Appointment changed; refresh and review');
      if (listStaged(dir, `${source}.md`).length) throw new CommitConflict('Appointment has pending proposals');
    }
    const link = randomUUID();
    if (before === null && access !== defaultAccess) {
      if (!access.provision) throw new Error('Personal appointment capture requires trusted policy provisioning');
      access.provision(actor, [`${source}.md`, `${inputLedgerPath(task)}#${link}`], access.revision);
    }
    const current = writable(dir, task, actor, access);
    if (current.taskBytes !== s.taskBytes || current.ledger !== s.ledger) throw new CommitConflict('Input changed during access provisioning');
    const summary = `${appointment.details}\n\nScheduled time: ${appointment.time || 'unspecified'}\n`;
    let after: string;
    if (before === null) {
      after = `---\nid: ${id}\ntype: meeting\n${access === defaultAccess ? '' : 'visibility: private\n'}title: ${JSON.stringify(appointment.title)}\nupdated: ${at}\ndate: ${appointment.date}\n---\n\n# ${appointment.title}\n\n## Summary\n\n${summary}\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · preserve captured input -->\n`;
    } else {
      // Preserve all old meeting prose/anchors and add the scheduling correction.
      const ast = parseItemFile(before); if (!ast.fm || !ast.pointer) throw new Error('Structured appointment required');
      fmSet(ast.fm, 'updated', at); fmSet(ast.fm, 'date', appointment.date); fmSet(ast.fm, 'title', JSON.stringify(appointment.title));
      const head = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(before)!;
      const tail = /<!-- arbiter:[^\n]+ -->\r?\n?$/.exec(before); if (!tail) throw new Error('Final pointer required');
      after = serializeFrontmatter(ast.fm).join('\n') + '\n' + before.slice(head[0].length, tail.index)
        + `## Appointment revision ${at}\n\n${appointment.title} · ${appointment.date}\n\n${summary}\n` + tail[0];
    }
    // Reusing the link keeps the incarnation; the source revision becomes pending.
    writeEffect(dir, write, task, current, actor, at, `${source}.md`, before, after,
      before === null ? { kind: 'link', id: link, source, visibility: access === defaultAccess ? 'shared' : 'private' } : { kind: 'source-edit', source }, access);
    return { source };
  });
}

export function createConnectedPerson(dir: string, task: string, actor: string, basis: string, title: string,
  role: Extract<InputEffect, { kind: 'relationship' }>['role'], access: InputAccessPolicy = defaultAccess) {
  return withCommitSession(dir, write => {
    const s = writable(dir, task, actor, access); observed(s, basis);
    if (!['0.4.16', '0.4.17'].includes(fmGet(parseItemFile(fs.readFileSync(path.join(dir, 'PROTOCOL.md'), 'utf8')).fm, 'version') ?? '')) throw new Error('Person creation requires protocol 0.4.16');
    if (typeof title !== 'string' || !title.trim() || title.length > 200 || /[\r\n]/.test(title)) throw new Error('Invalid person name');
    if (!['contributor', 'reviewer', 'stakeholder', 'owner', 'note-author'].includes(role)) throw new Error('Invalid relationship');
    const id = `person-${randomUUID()}`, entity = `people/${id}`, at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const edge = randomUUID();
    if (access !== defaultAccess) {
      if (!access.provision) throw new Error('Personal person creation requires trusted policy provisioning');
      access.provision(actor, [`${entity}.md`, `${inputLedgerPath(task)}#${edge}`], access.revision);
    }
    const current = writable(dir, task, actor, access);
    if (current.taskBytes !== s.taskBytes || current.ledger !== s.ledger) throw new CommitConflict('Input changed during access provisioning');
    const after = `---\nid: ${id}\ntype: person\n${access === defaultAccess ? '' : 'visibility: private\n'}title: ${JSON.stringify(title)}\nupdated: ${at}\ndate: ${at.slice(0, 10)}\n---\n\n# ${title}\n\n## Summary\n\nConnected entity.\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · association is independent of assignment and access -->\n`;
    writeEffect(dir, write, task, current, actor, at, `${entity}.md`, null, after,
      { kind: 'relationship', id: edge, entity, role, visibility: access === defaultAccess ? 'shared' : 'private' }, access);
    return { entity };
  });
}

export function inputSourcePreview(dir: string, task: string, actor: string, source: string, access: InputAccessPolicy = defaultAccess) {
  const s = readInputState(dir, task, access);
  const input = pendingInput(s.task, { ...s.state, receipts: [] }, actor).find(i => i.source === source);
  if (!input) throw new Error('Source unavailable');
  return { ...input, basis: s.basis };
}
