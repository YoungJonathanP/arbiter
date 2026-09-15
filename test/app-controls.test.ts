import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';
import type { AddressInfo } from 'node:net';
import { initData } from '../src/cli/data.js';
import { createArbiterServer } from '../src/web/server.js';
import { personalAccessFile } from '../src/web/personal-access.js';
import { INPUT_REVIEW_JS } from '../src/web/input-review.js';
import { inputReviewView, readInputState, captureQuickNote, saveAppointment, createConnectedPerson,
  previewInputIncorporation, applyInputIncorporation, inputRelationships, inputSourcePreview, beginStoredInputReview, saveInputReview } from '../src/core/input-storage.js';
import { walkCorpus } from '../src/core/corpus.js';
import { validateCorpus } from '../src/core/validate.js';
import { SchemaSet } from '../src/core/schema.js';
import { readProjection } from '../src/core/projection.js';

const ref = 'tasks/app-2026q3', actor = 'local-operator';
function setup(t: { after(fn: () => void): void }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-app-controls-')), dir = path.join(root, 'kb');
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); initData(dir);
  fs.writeFileSync(path.join(dir, `${ref}.md`), `---\nid: app-2026q3\ntype: task\ntitle: App\nstatus: in-flight\nupdated: 2026-09-12T10:00\n---\n\n# App\n\n## Summary\n\nOriginal [ticket](https://example.test/T-42).\n\n## Checklist\n\n- [ ] Preserve this <!-- ^keep -->\n\n## Artifacts\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · preserve history -->\n`);
  return { root, dir };
}
const view = (dir: string) => inputReviewView(dir, ref, actor);
function health(dir: string) { const files = walkCorpus(dir); assert.deepEqual(validateCorpus(dir, files, SchemaSet.fromFiles(files)).errors, []); }
async function start(t: { after(fn: () => void | Promise<void>): void }, dir: string, options = {}) {
  const server = createArbiterServer(dir, options);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(e => e ? reject(e) : resolve()); }));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test('incorporation previews exact bytes, refuses stale source and preserves attribution and anchors', t => {
  const { dir } = setup(t), before = readInputState(dir, ref).taskBytes;
  const source = captureQuickNote(dir, ref, 'Reviewed evidence', view(dir).basis, actor).source;
  let current = view(dir);
  const preview = previewInputIncorporation(dir, ref, actor, current.pending[0]!, current.basis, 'Implement the evidenced change.', 'Relevant to this task');
  assert.equal(preview.before, before); assert.equal(readInputState(dir, ref).taskBytes, before);
  assert.match(preview.after, /Original \[ticket\]/); assert.match(preview.after, /<!-- \^keep -->/);
  applyInputIncorporation(dir, ref, actor, preview);
  assert.equal(readInputState(dir, ref).taskBytes, preview.after); assert.equal(view(dir).pending.length, 0);
  assert.match(preview.after, new RegExp(source));
  fs.writeFileSync(path.join(dir, `${source}.md`), fs.readFileSync(path.join(dir, `${source}.md`), 'utf8').replace('Reviewed evidence', 'Later evidence'));
  current = view(dir);
  const stale = previewInputIncorporation(dir, ref, actor, current.pending[0]!, current.basis, 'Another addition.', 'New revision');
  captureQuickNote(dir, ref, 'Concurrent input', current.basis, actor);
  assert.throws(() => applyInputIncorporation(dir, ref, actor, stale), /changed/);
  assert.equal(view(dir).pending.length, 2); health(dir);
});

test('appointment edits preserve prior bytes and link identity while introducing a new pending revision', t => {
  const { dir } = setup(t), taskBefore = readInputState(dir, ref).taskBytes;
  const appointment = { title: 'Design review', date: '2026-09-14', time: '10:00 America/Los_Angeles', details: 'Discuss the candidate.' };
  assert.throws(() => saveAppointment(dir, ref, actor, view(dir).basis, { ...appointment, date: '2026-02-30' }), /Invalid appointment/);
  const { source } = saveAppointment(dir, ref, actor, view(dir).basis, appointment);
  const original = fs.readFileSync(path.join(dir, `${source}.md`), 'utf8'), input = view(dir).pending[0]!;
  const review = beginStoredInputReview(dir, ref, actor, [input]);
  saveInputReview(dir, ref, actor, review, [{ input, disposition: 'dismissed', reason: 'Scheduling observed' }]);
  assert.equal(view(dir).pending.length, 0);
  assert.equal(inputSourcePreview(dir, ref, actor, source).bytes, original);
  saveAppointment(dir, ref, actor, view(dir).basis, { ...appointment, date: '2026-09-15', details: 'Rescheduled by the organizer.', source, revision: input.revision });
  const next = view(dir).pending[0]!;
  assert.equal(next.link, input.link); assert.notEqual(next.revision, input.revision); assert.equal(next.disposition, 'new');
  assert.match(next.bytes, /Discuss the candidate/); assert.match(next.bytes, /Rescheduled by the organizer/);
  assert.equal(readInputState(dir, ref).taskBytes, taskBefore);
  assert.throws(() => saveAppointment(dir, ref, actor, view(dir).basis, { ...appointment, source, revision: input.revision }), /changed/);
  assert.ok(original.includes('2026-09-14')); health(dir);
});

test('person creation and both card directions express relationships without task assignment', async t => {
  const { dir } = setup(t), before = readInputState(dir, ref).taskBytes;
  const { entity } = createConnectedPerson(dir, ref, actor, view(dir).basis, 'Synthetic Reviewer', 'owner');
  assert.equal(readInputState(dir, ref).taskBytes, before);
  assert.deepEqual(inputRelationships(dir, ref).map(r => [r.entity, r.title, r.role]), [[entity, 'Synthetic Reviewer', 'owner']]);
  const base = await start(t, dir);
  const card = await (await fetch(`${base}/item/${entity}`)).text();
  assert.match(card, /Connected work/); assert.match(card, /App<\/a> · owner/);
  const task = await (await fetch(`${base}/item/${ref}`)).text(); assert.match(task, /Connected people and entities/);
  health(dir);
});

test('actual HTTP preview requires its retained token and rechecks concurrency before applying', async t => {
  const { dir } = setup(t), base = await start(t, dir);
  new Script(INPUT_REVIEW_JS);
  const page = await (await fetch(`${base}/item/${ref}`)).text(), token = /data-token="([a-f0-9]+)"/.exec(page)![1]!;
  const api = async (action: string, fields = {}) => {
    const response = await fetch(`${base}/api/handoff`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-arbiter-token': token }, body: JSON.stringify({ action, ref, ...fields }) });
    return { status: response.status, body: await response.json() as any };
  };
  let current = (await api('input-view')).body;
  current = (await api('input-note', { basis: current.basis, note: 'HTTP source' })).body;
  const preview = await api('input-incorporation-preview', { basis: current.basis, input: current.pending[0], incorporation: 'HTTP reviewed addition', reason: 'Relevant' });
  assert.equal(preview.status, 200); assert.ok(preview.body.after.includes('HTTP reviewed addition'));
  assert.equal((await api('input-incorporation-apply', { previewId: 'forged', after: preview.body.after })).status, 400);
  const applied = await api('input-incorporation-apply', { previewId: preview.body.id, incorporation: 'Injected replacement' });
  assert.equal(applied.status, 200); assert.equal(readInputState(dir, ref).taskBytes, preview.body.after);
  assert.equal(applied.body.pending.length, 0); health(dir);
});

test('active-work overview reaches all nested and old active work, filtering before totals and paging', async t => {
  const { dir } = setup(t), original = readInputState(dir, ref).taskBytes;
  for (let i = 0; i < 24; i++) fs.writeFileSync(path.join(dir, `tasks/child-${i}-2026q3.md`), original.replaceAll('app-2026q3', `child-${i}-2026q3`).replace('title: App', `title: Child ${i}`).replace('status: in-flight', `status: todo\nparent: ${ref}`).replace('2026-09-12T10:00', '2025-01-01T00:00'));
  fs.writeFileSync(path.join(dir, 'tasks/secret-2026q3.md'), original.replaceAll('app-2026q3', 'secret-2026q3').replace('title: App', 'title: Hidden identity\nvisibility: private'));
  fs.writeFileSync(path.join(dir, 'tasks/closed-2026q3.md'), original.replaceAll('app-2026q3', 'closed-2026q3').replace('status: in-flight', 'status: done'));
  const base = await start(t, dir);
  const first = await (await fetch(`${base}/active?format=json`)).json() as any;
  const next = await (await fetch(`${base}/active?format=json&page=1`)).json() as any;
  assert.equal(first.total, 25); assert.equal(first.results.length, 20); assert.equal(first.nextPage, 1);
  assert.equal(next.results.length, 5); assert.equal(next.nextPage, null);
  assert.equal(new Set([...first.results, ...next.results].map(r => r.ref)).size, 25);
  assert.ok(!JSON.stringify([first, next]).includes('Hidden identity'));
});

test('trusted personal review authenticates principals, revokes previews, and keeps restricted input out of shared views', async t => {
  const { dir, root } = setup(t), source = captureQuickNote(dir, ref, 'Private reflection', view(dir).basis, actor).source;
  const file = path.join(dir, `${source}.md`);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('type: journal', 'type: journal\nvisibility: private'));
  const link = readInputState(dir, ref).state.links[0]!.id;
  const secret = 'synthetic-test-token-with-at-least-32-characters';
  const config = { version: 1, principals: { alice: { tokenSha256: createHash('sha256').update(secret).digest('hex') } },
    readers: { [`${source}.md`]: ['alice'], [`${ref}/input-review.md#${link}`]: ['alice'] }, inherit: {} };
  const policyFile = path.join(root, 'personal.json'); fs.writeFileSync(policyFile, JSON.stringify(config), { mode: 0o600 });
  const personal = personalAccessFile(policyFile), base = await start(t, dir, { personalAccess: personal });
  const auth = `Basic ${Buffer.from(`alice:${secret}`).toString('base64')}`;
  assert.equal((await fetch(`${base}/personal/${ref}`)).status, 401);
  const page = await (await fetch(`${base}/personal/${ref}`, { headers: { authorization: auth } })).text();
  const token = /data-token="([a-f0-9]+)"/.exec(page)![1]!;
  const api = async (action: string, fields = {}, authorization = auth) => {
    const response = await fetch(`${base}/personal/api`, { method: 'POST', headers: { authorization, 'content-type': 'application/json', 'x-arbiter-token': token }, body: JSON.stringify({ action, ref, ...fields }) });
    return { status: response.status, body: await response.json() as any };
  };
  const current = (await api('input-view')).body;
  assert.equal(current.pending.length, 1); assert.equal(current.pending[0].canIncorporate, false);
  assert.equal((await api('input-view', { actor: 'alice', grants: ['alice'] }, 'Basic invalid')).status, 401);
  assert.equal((await api('input-incorporation-preview', { basis: current.basis, input: current.pending[0], incorporation: 'Private reflection', reason: 'Share it' })).status, 400);
  assert.equal(view(dir).pending.length, 0); assert.ok(!JSON.stringify(readProjection(dir)).includes('Private reflection'));
  const captured = await api('input-note', { basis: current.basis, note: 'New personal capture' });
  assert.equal(captured.status, 200); assert.equal(captured.body.pending.length, 2);
  const capturedSource = captured.body.pending.find((i: any) => i.bytes.includes('New personal capture'));
  assert.ok(capturedSource); assert.equal(capturedSource.canIncorporate, false);
  assert.match(fs.readFileSync(path.join(dir, `${capturedSource.source}.md`), 'utf8'), /visibility: private/);
  const person = await api('input-person', { basis: captured.body.basis, title: 'Personal collaborator', role: 'reviewer' });
  assert.equal(person.status, 200); assert.equal(person.body.relationships.length, 1);
  assert.equal(inputRelationships(dir, ref).length, 0);
  const card = await fetch(`${base}/personal/${person.body.relationships[0].entity}`, { headers: { authorization: auth } });
  assert.equal(card.status, 200); assert.match(await card.text(), /Connected work/);
  assert.ok(!JSON.stringify(readProjection(dir)).includes('Personal collaborator'));
  assert.ok(fs.readdirSync(root).some(n => n.startsWith('personal.json.history-')));
  const appointment = await api('input-appointment', { basis: person.body.basis, appointment: { title: 'Private appointment', date: '2026-09-15', time: '09:00 UTC', details: 'Personal scheduling context' } });
  assert.equal(appointment.status, 200); assert.ok(appointment.body.pending.some((i: any) => i.bytes.includes('Private appointment')));
  const done = await api('input-status', { basis: appointment.body.basis, status: 'done', checklist: 'complete' });
  assert.equal(done.status, 200); assert.equal(done.body.pending.length, 3);
  const undone = await api('input-undo', { basis: done.body.basis }); assert.equal(undone.status, 200);
  assert.match(readInputState(dir, ref).taskBytes, /status: in-flight/);
  const active = await (await fetch(`${base}/personal/active`, { headers: { authorization: auth } })).text();
  assert.match(active, /1 accessible active goals and tasks/);
  health(dir);
  config.readers[`${source}.md`] = []; fs.writeFileSync(policyFile, JSON.stringify(config));
  assert.equal((await api('input-review', { basis: current.basis, input: current.pending[0], disposition: 'presented', reason: 'Observed' })).status, 400);
  assert.equal((await api('input-view')).body.pending.length, 0);
  assert.equal(readInputState(dir, ref).state.receipts.length, 0);
  fs.writeFileSync(policyFile, '{broken'); assert.throws(() => personal.policy.resolve(`${source}.md`, ''), /JSON/);
});

test('trusted policy validates inheritance, refuses stale provisioning and preserves exact prior policy', t => {
  const { root } = setup(t), file = path.join(root, 'policy.json');
  const config = { version: 1, principals: { alice: { tokenSha256: 'a'.repeat(64) } }, readers: { 'tasks/one.md': ['alice'] }, inherit: { 'journal/one.md': 'tasks/one.md' } };
  const before = JSON.stringify(config); fs.writeFileSync(file, before, { mode: 0o600 });
  const access = personalAccessFile(file).policy;
  assert.deepEqual(access.resolve('journal/one.md', '---\nvisibility: private\n---\n'), { kind: 'restricted', readers: ['alice'] });
  assert.deepEqual(access.resolve('journal/missing.md', '---\nvisibility: private\n---\n'), { kind: 'restricted', readers: [] });
  assert.deepEqual(access.resolve('tasks/one.md', '---\nvisibility: shared\n---\n'), { kind: 'shared' }, 'Personal grants cannot narrow the audience of shared canonical prose');
  const revision = access.revision;
  access.provision!('alice', ['journal/new.md'], revision);
  assert.equal(fs.readFileSync(`${file}.history-${revision}`, 'utf8'), before);
  const after = fs.readFileSync(file, 'utf8');
  assert.throws(() => access.provision!('alice', ['journal/other.md'], revision), /changed/);
  assert.equal(fs.readFileSync(file, 'utf8'), after);
  fs.writeFileSync(file, JSON.stringify({ ...config, inherit: { 'journal/one.md': 'journal/two.md', 'journal/two.md': 'journal/one.md' } }));
  assert.throws(() => access.resolve('journal/one.md', '---\nvisibility: private\n---\n'), /Cyclic/);
  fs.chmodSync(file, 0o644); assert.throws(() => personalAccessFile(file), /owner-only/);
});
