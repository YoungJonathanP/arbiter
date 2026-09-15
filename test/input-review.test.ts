import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { accessibleRelationships, beginInputReview, finishInputReview, pendingInput,
  type Audience, type InputState, type ReviewTask, type Disposition } from '../src/core/input-review.js';
import { commitFile, readJournals } from '../src/core/commit.js';
import { sha256 } from '../src/core/corpus.js';

const shared: Audience = { kind: 'shared' }, personal: Audience = { kind: 'restricted', readers: ['sam'] };
const task: ReviewTask = { id: 'tasks/reset-2026q3', revision: 'before', audience: shared };
const note = '---\nauthor: Sam\ncaptured: 2026-09-10T09:15\ndate: 2026-09-09\n---\nExpired links need an explanation.\n';
function setup(): InputState {
  return { sources: [{ id: 'journal/feedback', bytes: note, audience: shared }],
    links: [{ id: 'link-1', task: task.id, source: 'journal/feedback', audience: shared }], receipts: [] };
}
function acknowledge(state: InputState, disposition: Disposition, selectedTask = task) {
  const selected = pendingInput(selectedTask, state, 'sam');
  const review = beginInputReview(selectedTask, state, 'sam', selected);
  state.receipts.push(...finishInputReview(selectedTask, state, review,
    selected.map(input => ({ input, disposition, reason: 'Explicitly reviewed the expiry feedback.' })), '2026-09-10T09:30'));
}

test('later task status or timestamp changes never acknowledge linked input', () => {
  const state = setup(), done = { ...task, revision: 'done-at-09:20', status: 'done' };
  assert.equal(pendingInput(done, state, 'sam')[0]!.disposition, 'new');
  const before = structuredClone(state);
  beginInputReview(done, state, 'sam', pendingInput(done, state, 'sam'));
  assert.deepEqual(state, before, 'reading and projection are side-effect free');
  acknowledge(state, 'presented', done);
  assert.equal(done.status, 'done');
  assert.equal(pendingInput(done, state, 'sam')[0]!.disposition, 'presented');
});

test('same-timestamp edits and backdated source revisions reappear after incorporation', () => {
  const state = setup();
  acknowledge(state, 'incorporated');
  assert.equal(pendingInput(task, state, 'sam').length, 0);
  state.sources[0]!.bytes += 'Also explain how to request a new link.\n';
  const edited = pendingInput(task, state, 'sam');
  assert.equal(edited[0]!.disposition, 'new');
  assert.notEqual(edited[0]!.revision, state.receipts[0]!.revision);
  assert.match(edited[0]!.bytes, /captured: 2026-09-10T09:15/);
});

test('old notes newly linked and removed/re-added links have independent receipts', () => {
  const state = setup(), other = { ...task, id: 'tasks/reset-copy-2026q3' };
  acknowledge(state, 'dismissed');
  state.links.push({ ...state.links[0]!, id: 'link-2', task: other.id });
  assert.equal(pendingInput(other, state, 'sam')[0]!.disposition, 'new');
  assert.equal(pendingInput(task, state, 'sam').length, 0);
  state.links[0] = { ...state.links[0]!, id: 'link-3' };
  assert.equal(pendingInput(task, state, 'sam')[0]!.disposition, 'new');
});

test('presentation and deferral remain actionable and require explicit final disposition', () => {
  const state = setup();
  acknowledge(state, 'presented');
  acknowledge(state, 'deferred');
  assert.equal(pendingInput(task, state, 'sam')[0]!.disposition, 'deferred');
  assert.deepEqual(state.receipts.map(r => r.disposition), ['presented', 'deferred']);
  acknowledge(state, 'dismissed');
  assert.equal(pendingInput(task, state, 'sam').length, 0);
});

test('input arriving or changing during review cannot be swallowed by a review timestamp', () => {
  const state = setup(), selected = pendingInput(task, state, 'sam');
  const review = beginInputReview(task, state, 'sam', selected);
  state.sources[0]!.bytes += 'Concurrent correction.\n';
  state.sources.push({ ...state.sources[0]!, id: 'journal/new' });
  state.links.push({ ...state.links[0]!, id: 'link-2', source: 'journal/new' });
  state.receipts.push(...finishInputReview(task, state, review,
    [{ input: selected[0]!, disposition: 'incorporated', reason: 'Applied the originally observed wording.' }], '2026-09-10T10:00'));
  assert.equal(state.receipts[0]!.revision, selected[0]!.revision);
  assert.deepEqual(pendingInput(task, state, 'sam').map(p => p.disposition), ['new', 'new']);
  const currentReview = beginInputReview(task, state, 'sam', []);
  assert.throws(() => finishInputReview(task, state, currentReview,
    [{ input: pendingInput(task, state, 'sam')[0]!, disposition: 'dismissed', reason: 'Not read' }], '2026-09-10T10:00'), /unobserved/);
});

test('stale human task revision, unavailable input and ambiguous identities require rereading', () => {
  const state = setup(), selected = pendingInput(task, state, 'sam');
  const review = beginInputReview(task, state, 'sam', selected);
  const decisions = [{ input: selected[0]!, disposition: 'deferred' as const, reason: 'Scope conflict' }];
  assert.throws(() => finishInputReview({ ...task, revision: 'human-done' }, state, review, decisions, '2026-09-10T10:00'), /Task changed/);
  state.sources[0]!.audience = { kind: 'restricted', readers: ['lee'] };
  assert.throws(() => finishInputReview(task, state, review, decisions, '2026-09-10T10:00'), /no longer available/);
  assert.throws(() => beginInputReview(task, state, 'sam', selected), /unavailable/);
  state.sources.push(state.sources[0]!);
  assert.throws(() => pendingInput(task, state, 'sam'), /Ambiguous/);
});

test('private linked input can be presented personally but cannot enter shared task prose', () => {
  const state = setup();
  state.sources[0]!.audience = personal;
  assert.deepEqual(pendingInput(task, state, 'lee'), []);
  assert.deepEqual(pendingInput(task, state, null), []);
  assert.equal(pendingInput(task, state, 'sam')[0]!.canIncorporate, false);
  acknowledge(state, 'presented');
  assert.throws(() => acknowledge(state, 'incorporated'), /Sharing decision/);
  assert.equal(state.receipts.length, 1);
  const personalTask = { ...task, audience: personal };
  assert.equal(pendingInput(personalTask, state, 'sam')[0]!.canIncorporate, true);
  acknowledge(state, 'incorporated', personalTask);
});

test('restricted associations and review audit text stay out of shared projections', () => {
  const state = setup();
  state.links[0]!.audience = personal;
  assert.deepEqual(pendingInput(task, state, 'lee'), []);
  assert.equal(pendingInput(task, state, 'sam')[0]!.canIncorporate, false);
  state.links[0]!.audience = shared;
  acknowledge(state, 'deferred');
  state.receipts[0]!.reason = 'PRIVATE review commentary';
  state.receipts[0]!.reviewer = 'PRIVATE reviewer';
  assert.doesNotMatch(JSON.stringify(pendingInput(task, state, null)), /PRIVATE/);
  assert.deepEqual(pendingInput({ ...task, audience: personal }, state, 'lee'), []);
});

test('both relationship cards use the same accessible edges without assigning ownership or access', () => {
  const entities = [{ id: 'people/sam', title: 'Sam', audience: shared },
    { id: 'people/private', title: 'Secret collaborator', audience: personal }];
  const edges = [{ id: 'edge-1', entity: entities[0]!.id, task: task.id, role: 'reviewer' as const, audience: shared },
    { id: 'edge-2', entity: entities[1]!.id, task: task.id, role: 'owner' as const, audience: shared },
    { id: 'edge-3', entity: entities[0]!.id, task: task.id, role: 'stakeholder' as const, audience: personal }];
  const before = structuredClone({ task, entities, edges });
  const publicEdges = accessibleRelationships([task], entities, edges, null);
  assert.equal(publicEdges.length, 1);
  assert.deepEqual(publicEdges.filter(e => e.task === task.id), publicEdges.filter(e => e.entity === 'people/sam'));
  assert.doesNotMatch(JSON.stringify(publicEdges), /Secret|people\/private|edge-2|edge-3/);
  assert.equal(accessibleRelationships([task], entities, edges, 'sam').length, 3);
  assert.deepEqual(accessibleRelationships([{ ...task, audience: personal }], entities, edges, 'lee'), []);
  assert.deepEqual({ task, entities, edges }, before);
});

test('receipt ordering uses append order and validates explicit dispositions', () => {
  const state = setup();
  acknowledge(state, 'presented');
  const input = pendingInput(task, state, 'sam')[0]!;
  const review = beginInputReview(task, state, 'sam', [input]);
  state.receipts.push(...finishInputReview(task, state, review,
    [{ input, disposition: 'deferred', reason: 'Unresolved conflict' }], '2026-09-09T08:00'));
  assert.equal(pendingInput(task, state, 'sam')[0]!.disposition, 'deferred');
  const currentReview = beginInputReview(task, state, 'sam', [input]);
  assert.throws(() => finishInputReview(task, state, currentReview,
    [{ input, disposition: 'dismissed', reason: '' }], '2026-09-10T10:00'), /reason/);
  assert.throws(() => finishInputReview(task, state, currentReview, [], 'invalid'), /time/);
});

test('a competing review cannot silently replace a disposition from the same base', () => {
  const state = setup(), input = pendingInput(task, state, 'sam')[0]!;
  const stale = beginInputReview(task, state, 'sam', [input]);
  acknowledge(state, 'deferred');
  assert.throws(() => finishInputReview(task, state, stale,
    [{ input, disposition: 'dismissed', reason: 'Racing reviewer' }], '2026-09-10T10:00'), /receipts changed/);
  assert.equal(pendingInput(task, state, 'sam')[0]!.disposition, 'deferred');
});

test('CAS foundation preserves human Done, stale-write rejection and recoverable Undo without consuming a note', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-input-review-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const rel = `${task.id}.md`, original = '---\nstatus: in-flight\nupdated: 2026-09-10T09:00\n---\n\n# Reset\n\nHuman imported café prose.\n';
  commitFile(dir, rel, () => ({ text: original }), { expected: 'new' });
  const stale = sha256(original);
  const state = setup();
  // Add note writes a linked source, never the task body. App routing is pending.
  commitFile(dir, 'journal/feedback.md', () => ({ text: note }), { expected: 'new' });
  assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), original);
  const done = original.replace('in-flight', 'done').replace('09:00', '09:20');
  commitFile(dir, rel, () => ({ text: done }), { expected: stale });
  assert.throws(() => commitFile(dir, rel, () => ({ text: original + 'Stale agent work\n' }), { expected: stale }), /CAS mismatch/);
  assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), done);
  assert.equal(pendingInput({ ...task, revision: sha256(done) }, state, 'sam')[0]!.disposition, 'new');
  assert.ok(readJournals(dir).some(j => j.target === rel && j.before === original && j.after === done && j.state === 'complete'));
  const undo = original.replace('09:00', '09:25');
  commitFile(dir, rel, () => ({ text: undo }), { expected: sha256(done) });
  assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), undo);
  assert.ok(readJournals(dir).some(j => j.before === done && j.after === undo));
  assert.throws(() => commitFile(dir, rel, () => ({ text: original }), { expected: sha256(done) }), /CAS mismatch/);
});
