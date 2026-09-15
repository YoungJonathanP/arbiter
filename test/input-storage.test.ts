import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';
import { initData } from '../src/cli/data.js';
import { commitFile, stageProposal, readJournals } from '../src/core/commit.js';
import { inputReviewView, readInputState, captureQuickNote, beginStoredInputReview, saveInputReview, linkInput, unlinkInput,
  setHumanTaskStatus, undoHumanTaskStatus, reconcileInputIntent, type InputAccessPolicy } from '../src/core/input-storage.js';
import { inputLedgerPath, parseInputLedger, revisionOf } from '../src/core/input-storage-format.js';
import { draftCheckpoint, previewHandoff, captureCheckpoint, exportHandoff } from '../src/core/handoff.js';
import { walkCorpus } from '../src/core/corpus.js';
import { validateCorpus } from '../src/core/validate.js';
import { SchemaSet } from '../src/core/schema.js';
import { readProjection } from '../src/core/projection.js';
import { createArbiterServer } from '../src/web/server.js';
import { normalize } from '../src/core/normalize.js';

const ref = 'tasks/input-storage-2026q3', actor = 'local-operator', at = '2026-09-10T10:00:00Z';
function setup(t: { after(fn: () => void): void }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-input-storage-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true })); initData(dir);
  fs.writeFileSync(path.join(dir, `${ref}.md`), `---\nid: input-storage-2026q3\ntype: task\ntitle: Storage exercise\nstatus: in-flight\nowner: operator\nupdated: ${at}\n---\n\n# Storage exercise\n\n## Summary\n\nPreserve imported prose and external [ticket](https://example.test/T-42).\n\n## Checklist\n\n- [ ] Verify capture <!-- ^capture -->\n\n## Artifacts\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place -->\n`);
  return dir;
}
const view = (dir: string) => inputReviewView(dir, ref, actor);
const note = (dir: string, body = 'New evidence') => captureQuickNote(dir, ref, body, view(dir).basis, actor, { at }).source;
const review = (dir: string, disposition: 'presented' | 'deferred' | 'dismissed' | 'incorporated', options: Parameters<typeof saveInputReview>[5] = {}) => {
  const input = view(dir).pending[0]!;
  const preview = beginStoredInputReview(dir, ref, actor, [input]);
  return saveInputReview(dir, ref, actor, preview, [{ input, disposition, reason: 'Observed synthetic evidence' }], { at, ...options });
};
function validation(dir: string) { const files = walkCorpus(dir); return validateCorpus(dir, files, SchemaSet.fromFiles(files)); }
function checkpoint(dir: string) {
  const text = draftCheckpoint(dir, ref, at).replace('branch: unknown', 'branch: main').replace('revision: unknown', 'revision: synthetic-123').replace('readiness: unprepared', 'readiness: ready')
    .replace('state: unknown', 'state: met').replace('evidence: unknown', 'evidence: synthetic authorization')
    .replaceAll('Unknown; record the observed facts and applicable rules.', 'Continue the bounded exercise, preserve T-42, then capture evidence.');
  return previewHandoff(dir, { ref, checkpoint: text });
}

test('durable capture/review survives reread; same-time source edits and status changes remain pending', t => {
  const dir = setup(t), before = readInputState(dir, ref).taskBytes;
  assert.throws(() => captureQuickNote(dir, ref, 'Invalid event date', view(dir).basis, actor, { at, eventDate: '2026-02-30' }), /Invalid note or capture date/);
  const source = note(dir);
  assert.equal(readInputState(dir, ref).taskBytes, before);
  assert.equal(view(dir).pending[0]!.disposition, 'new');
  review(dir, 'presented'); assert.equal(view(dir).lastReview, at);
  assert.equal(view(dir).pending[0]!.disposition, 'presented');
  setHumanTaskStatus(dir, ref, actor, view(dir).basis, 'done', 'complete', '2026-09-10T11:00:00Z');
  assert.equal(view(dir).lastReview, at); assert.equal(view(dir).pending.length, 1);
  review(dir, 'dismissed'); assert.equal(view(dir).pending.length, 0);
  fs.writeFileSync(path.join(dir, `${source}.md`), fs.readFileSync(path.join(dir, `${source}.md`), 'utf8').replace('New evidence', 'Edited without touching timestamp.'));
  assert.equal(view(dir).pending[0]!.disposition, 'new');
  assert.match(readInputState(dir, ref).taskBytes, /status: done/);
  assert.deepEqual(validation(dir).errors, []);
});

test('stale human Done/Undo and agent writes preserve imported bytes and revision receipts', t => {
  const dir = setup(t), before = readInputState(dir, ref).taskBytes, stale = view(dir);
  note(dir); assert.throws(() => setHumanTaskStatus(dir, ref, actor, stale.basis, 'done', 'complete'), /changed/);
  assert.throws(() => setHumanTaskStatus(dir, ref, actor, view(dir).basis, 'done', 'preserve'), /checklist/);
  setHumanTaskStatus(dir, ref, actor, view(dir).basis, 'done', 'complete', at);
  assert.match(readInputState(dir, ref).taskBytes, /- \[x\] Verify capture <!-- \^capture -->/);
  assert.throws(() => commitFile(dir, `${ref}.md`, () => ({ text: before }), { expected: revisionOf(before) }), /CAS mismatch/);
  undoHumanTaskStatus(dir, ref, actor, view(dir).basis, at);
  assert.equal(readInputState(dir, ref).taskBytes, before, 'Undo restores the original prose and marks');
  setHumanTaskStatus(dir, ref, actor, view(dir).basis, 'done', 'complete', at);
  fs.appendFileSync(path.join(dir, `${ref}.md`), '\nConcurrent human text.\n');
  assert.throws(() => undoHumanTaskStatus(dir, ref, actor, view(dir).basis), /Task changed/);
  assert.match(readInputState(dir, ref).taskBytes, /Concurrent human text/);
  assert.ok(readJournals(dir).some(j => j.target === `${ref}.md` && j.before === before && j.after.includes('status: done')));
});

test('staging and competing reviewers prevent writes; source changes require a fresh selection', t => {
  const dir = setup(t); note(dir);
  const input = view(dir).pending[0]!, preview = beginStoredInputReview(dir, ref, actor, [input]);
  review(dir, 'deferred');
  const decisions = [{ input, disposition: 'dismissed' as const, reason: 'Review' }];
  assert.throws(() => saveInputReview(dir, ref, actor, preview, decisions), /changed/);
  const current = beginStoredInputReview(dir, ref, actor, view(dir).pending);
  fs.appendFileSync(path.join(dir, `${input.source}.md`), '\nNew revision.\n');
  assert.throws(() => saveInputReview(dir, ref, actor, current, decisions), /changed/);
  assert.equal(view(dir).pending[0]!.disposition, 'new');
  stageProposal(dir, `${ref}.md`, { filename: 'pending.md', text: '# Retained proposal\n' });
  assert.throws(() => note(dir), /pending proposals/);
  assert.throws(() => setHumanTaskStatus(dir, ref, actor, view(dir).basis, 'done', 'complete'), /pending proposals/);
  assert.equal(fs.readFileSync(path.join(dir, `${ref}.staged/pending.md`), 'utf8'), '# Retained proposal\n');
});

test('interrupted note capture retains intent and reconciles the exact captured source without restoration', t => {
  const dir = setup(t), before = readInputState(dir, ref).taskBytes;
  assert.throws(() => captureQuickNote(dir, ref, 'Captured once', view(dir).basis, actor, { at, afterContent() { throw new Error('interrupted'); } }), /interrupted/);
  assert.equal(view(dir).pending.length, 0);
  assert.equal(view(dir).reconciliationRequired, true);
  assert.throws(() => note(dir), /reconcile/);
  const intent = readInputState(dir, ref).replay.pending!;
  assert.equal(intent.operation.kind, 'intent');
  reconcileInputIntent(dir, ref, actor, view(dir).basis);
  assert.equal(view(dir).pending.length, 1);
  assert.equal(readInputState(dir, ref).taskBytes, before);
  assert.equal(validation(dir).warnings.filter(w => /Incomplete input/.test(w.message)).length, 0);
});

test('incorporation verifies attributed task bytes before receipts; interruption never acknowledges input', t => {
  for (const interrupted of [false, true]) {
    const dir = setup(t); note(dir, 'Tested observation');
    const before = readInputState(dir, ref).taskBytes;
    const options = { incorporation: 'Applied the observed result.', afterContent: interrupted ? () => { throw new Error('interrupted'); } : undefined };
    if (interrupted) {
      assert.throws(() => review(dir, 'incorporated', options), /interrupted/);
      assert.equal(view(dir).pending.length, 1);
      reconcileInputIntent(dir, ref, actor, view(dir).basis);
      assert.equal(view(dir).pending.length, 1, 'Reconciliation requires a new review after content landed');
    } else { review(dir, 'incorporated', options); assert.equal(view(dir).pending.length, 0); }
    const after = readInputState(dir, ref).taskBytes;
    assert.match(after, /Applied the observed result/); assert.match(after, /sha256:[a-f0-9]{64}/);
    assert.ok(after.includes(before.slice(before.indexOf('# Storage'), before.indexOf('<!-- arbiter:tier-2'))));
    assert.ok(after.endsWith(before.slice(before.indexOf('<!-- arbiter:tier-2'))));
    assert.deepEqual(validation(dir).errors, []);
  }
});

test('recovery refuses externally changed targets and retains both the intent and concurrent bytes', t => {
  const dir = setup(t);
  assert.throws(() => captureQuickNote(dir, ref, 'Original note', view(dir).basis, actor, { at, afterContent() { throw new Error('interrupt'); } }), /interrupt/);
  const pending = readInputState(dir, ref).replay.pending!;
  assert.ok(pending.operation.kind === 'intent');
  fs.appendFileSync(path.join(dir, pending.operation.target), '\nConcurrent correction.\n');
  assert.throws(() => reconcileInputIntent(dir, ref, actor, view(dir).basis), /differs from both/);
  assert.match(fs.readFileSync(path.join(dir, pending.operation.target), 'utf8'), /Concurrent correction/);
  assert.ok(readInputState(dir, ref).replay.pending);
});

test('ledger grammar, CAS, append-only history and source references are validated', t => {
  const dir = setup(t); note(dir); const s = readInputState(dir, ref), rel = inputLedgerPath(ref);
  assert.throws(() => commitFile(dir, rel, () => ({ text: s.ledger! + 'tampered' }), { expected: revisionOf(s.ledger) }), /ledger/);
  assert.throws(() => commitFile(dir, rel, () => ({ text: s.ledger!.replace('Task note', 'forged') + '\n' })), /CAS/);
  const input = view(dir).pending[0]!;
  unlinkInput(dir, ref, input.link, view(dir).basis, actor, at);
  linkInput(dir, ref, input.source, view(dir).basis, actor, at);
  assert.notEqual(view(dir).pending[0]!.link, input.link);
  assert.throws(() => commitFile(dir, rel, () => ({ text: s.ledger! }), { expected: revisionOf(readInputState(dir, ref).ledger) }), /append-only/);
  const text = readInputState(dir, ref).ledger!;
  assert.equal(normalize(rel, text, {} as never).text, text);
  assert.throws(() => parseInputLedger(ref, text.replace('"kind":"link"', '"kind":"unknown"')), /ledger/);
  fs.unlinkSync(path.join(dir, `${input.source}.md`));
  assert.ok(validation(dir).errors.some(e => /Linked source/.test(e.message)));
});

test('default exports omit restricted input, audit reasons, actors, ledger bodies and review counts', t => {
  const dir = setup(t); note(dir, 'PUBLIC-INPUT'); review(dir, 'presented');
  const hidden = 'journal/restricted-input';
  fs.writeFileSync(path.join(dir, `${hidden}.md`), '---\nid: restricted-input\ntype: journal\ntitle: PRIVATE-TITLE\nvisibility: private\ndate: 2026-09-10\n---\n\n# PRIVATE-TITLE\n\nPRIVATE-BODY\n');
  const access: InputAccessPolicy = { revision: '1', resolve: () => ({ kind: 'restricted', readers: [actor] }) };
  linkInput(dir, ref, hidden, readInputState(dir, ref, access).basis, actor, at, access);
  assert.equal(view(dir).pending.length, 1);
  const projection = readProjection(dir);
  assert.ok(projection.files.every(f => f.kind !== 'input-review'));
  const visible = JSON.stringify(projection);
  assert.doesNotMatch(visible, /PRIVATE-BODY|PRIVATE-TITLE|restricted-input|Observed synthetic evidence/);
  const draft = checkpoint(dir); assert.match(draft.packet, /PUBLIC-INPUT/);
  assert.equal(draft.assessment.readiness, 'ready', 'Presented revisions are actionable, already presented');
  assert.doesNotMatch(draft.packet, /PRIVATE-BODY|PRIVATE-TITLE|restricted-input|Observed synthetic evidence|local-operator/);
  captureCheckpoint(dir, draft);
  const current = previewHandoff(dir, { ref, override: { maxBytes: 20000, reason: 'Inspect shared input and full privacy-test checkpoint' } }); assert.equal(exportHandoff(dir, current), current.packet);
  note(dir, 'ANOTHER-PUBLIC-INPUT'); assert.throws(() => exportHandoff(dir, current), /stale/);
  const refreshed = previewHandoff(dir, { ref });
  assert.equal(refreshed.assessment.readiness, 'review-required'); assert.match(refreshed.packet, /ANOTHER-PUBLIC-INPUT/);
});

test('trusted private audience never grants shared incorporation and access revisions invalidate review', t => {
  const dir = setup(t), source = note(dir);
  const access: InputAccessPolicy = { revision: 'policy-1', resolve: rel => rel === `${ref}.md` ? { kind: 'shared' } : { kind: 'restricted', readers: [actor] } };
  const input = inputReviewView(dir, ref, actor, access).pending[0]!;
  assert.equal(input.canIncorporate, false);
  const preview = beginStoredInputReview(dir, ref, actor, [input], access);
  assert.throws(() => saveInputReview(dir, ref, actor, preview, [{ input, disposition: 'incorporated', reason: 'No grant' }], { at, incorporation: 'Private material' }, access), /Sharing/);
  access.revision = 'policy-2';
  assert.throws(() => saveInputReview(dir, ref, actor, preview, [{ input, disposition: 'presented', reason: 'Read' }], { at }, access), /changed/);
  assert.match(fs.readFileSync(path.join(dir, `${source}.md`), 'utf8'), /New evidence/);
});

test('pending input participates in the whole-packet budget without truncation or silent acknowledgment', t => {
  const dir = setup(t); note(dir, 'BUDGET-NOTE ' + 'x'.repeat(12000));
  const draft = checkpoint(dir); assert.equal(draft.allowed, false); assert.match(draft.packet, /BUDGET-NOTE/);
  assert.equal(draft.bytes, Buffer.byteLength(draft.packet));
  captureCheckpoint(dir, draft);
  assert.throws(() => exportHandoff(dir, previewHandoff(dir, { ref })), /budget/);
  assert.equal(view(dir).pending[0]!.disposition, 'new');
});

test('old installed protocols refuse new input storage and leave existing task bytes untouched', t => {
  const dir = setup(t), protocol = path.join(dir, 'PROTOCOL.md');
  fs.writeFileSync(protocol, fs.readFileSync(protocol, 'utf8').replace('version: "0.4.17"', 'version: "0.4.14"'));
  const before = readInputState(dir, ref).taskBytes;
  assert.throws(() => note(dir), /explicit protocol/);
  assert.equal(readInputState(dir, ref).taskBytes, before); assert.equal(readInputState(dir, ref).ledger, null);
});

test('actual local app API captures notes, reviews, rejects stale Done and blocks forged access', async t => {
  const dir = setup(t), server = createArbiterServer(dir);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const page = await (await fetch(`${base}/item/${ref}`)).text();
  assert.match(page, /id="input-done"/); assert.match(page, /id="input-note"/);
  const token = /id="input-review"[^>]*data-token="([a-f0-9]+)"/.exec(page)![1]!;
  const api = (body: object, headers = {}) => fetch(`${base}/api/handoff`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-arbiter-token': token, ...headers }, body: JSON.stringify({ ref, ...body }) });
  assert.equal((await api({ action: 'input-note', note: 'rejected' }, { origin: 'https://attacker.test' })).status, 403);
  let v = await (await api({ action: 'input-view' })).json() as ReturnType<typeof view>;
  const stale = v;
  let response = await api({ action: 'input-note', basis: v.basis, note: 'HTTP-CAPTURE', actor: 'forged-user', audience: { kind: 'shared' } });
  assert.equal(response.status, 200); v = await response.json() as ReturnType<typeof view>;
  assert.equal((await api({ action: 'input-status', basis: stale.basis, status: 'done', checklist: 'complete' })).status, 409);
  assert.equal(readInputState(dir, ref).events[0]!.actor, actor);
  response = await api({ action: 'input-review', basis: v.basis, input: v.pending[0], disposition: 'presented', reason: 'Shown in app' });
  assert.equal(response.status, 200); v = await response.json() as ReturnType<typeof view>;
  const reviewedAt = v.lastReview;
  response = await api({ action: 'input-status', basis: v.basis, status: 'done', checklist: 'complete' });
  assert.equal(response.status, 200); v = await response.json() as ReturnType<typeof view>;
  assert.equal(v.lastReview, reviewedAt); assert.equal(v.pending[0]!.disposition, 'presented');
  assert.equal((await api({ action: 'input-undo', basis: v.basis })).status, 200);
  assert.match(readInputState(dir, ref).taskBytes, /status: in-flight/);
  const privateSource = 'journal/private-http';
  fs.writeFileSync(path.join(dir, `${privateSource}.md`), '---\nvisibility: private\n---\nPRIVATE-HTTP');
  response = await api({ action: 'input-link', basis: view(dir).basis, source: privateSource, actor: 'owner', readers: ['owner'] });
  assert.equal(response.status, 400);
  assert.doesNotMatch(await response.text(), /PRIVATE-HTTP/);
  assert.equal((await fetch(`${base}/raw/${inputLedgerPath(ref)}`)).status, 404);
});

test('stored relationships and link visibility are independent of endpoints and never assign ownership', async t => {
  const { connectInputEntity, disconnectInputEntity, inputRelationships } = await import('../src/core/input-storage.js');
  const dir = setup(t), source = note(dir), before = readInputState(dir, ref).taskBytes;
  const edge = connectInputEntity(dir, ref, source, 'owner', view(dir).basis, actor, at);
  assert.equal(inputRelationships(dir, ref).length, 1);
  assert.equal(readInputState(dir, ref).taskBytes, before);
  disconnectInputEntity(dir, ref, edge.event.operation.kind === 'relationship' ? edge.event.operation.id : '', view(dir).basis, actor, at);
  assert.equal(inputRelationships(dir, ref).length, 0);
  const access: InputAccessPolicy = { revision: 'private-edges', resolve: rel => rel.includes('#') ? { kind: 'restricted', readers: [actor] } : { kind: 'shared' } };
  connectInputEntity(dir, ref, source, 'reviewer', readInputState(dir, ref, access).basis, actor, at, access);
  linkInput(dir, ref, source, readInputState(dir, ref, access).basis, actor, at, access);
  assert.equal(inputRelationships(dir, ref).length, 0, 'Shared endpoints cannot expose a private association');
  assert.equal(inputRelationships(dir, ref, actor, access).length, 1);
  assert.equal(view(dir).pending.length, 1, 'Only the original public link is exposed');
  assert.deepEqual(validation(dir).errors, []);
});
