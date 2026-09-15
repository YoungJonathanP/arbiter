import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { initData, checkData } from '../src/cli/data.js';
import { createArbiterServer } from '../src/web/server.js';
import { personalAccessFile } from '../src/web/personal-access.js';
import { draftCheckpoint, previewHandoff, captureCheckpoint, exportHandoff } from '../src/core/handoff.js';
import { inputReviewView, readInputState, captureQuickNote, beginStoredInputReview, saveInputReview,
  setHumanTaskStatus, unlinkInput } from '../src/core/input-storage.js';
import { previewPersonalContinuation, exportPersonalContinuation } from '../src/core/personal-continuation.js';
import { stageProposal } from '../src/core/commit.js';
import { walkCorpus } from '../src/core/corpus.js';
import { validateCorpus } from '../src/core/validate.js';
import { SchemaSet } from '../src/core/schema.js';

const request = { override: { maxBytes: 16384, reason: 'Preserve complete shared and personal rules with exact synthetic input' } };
const ref = 'tasks/continue-2026q3', secret = 'synthetic-agent-secret-at-least-32-characters';
function setup(t: { after(fn: () => void | Promise<void>): void }, note = 'Private synthetic evidence Ω') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-personal-continuation-')), dir = path.join(root, 'kb');
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); initData(dir);
  fs.writeFileSync(path.join(dir, `${ref}.md`), `---\nid: continue-2026q3\ntype: task\ntitle: Continue\nstatus: in-flight\nowner: agent-session\nupdated: 2026-09-12T10:00\n---\n\n# Continue\n\n## Summary\n\nRetain RULE-42.\n\n## Checklist\n\n- [ ] Verify <!-- ^verify -->\n\n## Artifacts\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · preserve history -->\n`);
  const draft = draftCheckpoint(dir, ref, '2026-09-12T10:00').replace('branch: unknown', 'branch: main').replace('revision: unknown', 'revision: abc123')
    .replace('readiness: unprepared', 'readiness: ready').replace('state: unknown', 'state: met').replace('evidence: unknown', 'evidence: synthetic local authorization')
    .replaceAll('Unknown; record the observed facts and applicable rules.', 'Verify RULE-42; stop after local checks.');
  captureCheckpoint(dir, previewHandoff(dir, { ref, checkpoint: draft }));
  const config = { version: 1, principals: { alice: { tokenSha256: createHash('sha256').update(secret).digest('hex') }, bob: { tokenSha256: createHash('sha256').update(secret).digest('hex') } }, readers: {} as Record<string, string[]>, inherit: {} };
  const policyFile = path.join(root, 'policy.json');
  const writePolicy = () => fs.writeFileSync(policyFile, JSON.stringify(config), { mode: 0o600 }); writePolicy();
  const personal = personalAccessFile(policyFile), access = personal.policy;
  const view = () => inputReviewView(dir, ref, 'alice', access);
  const source = captureQuickNote(dir, ref, note, view().basis, 'alice', { personal: true }, access).source;
  Object.assign(config, JSON.parse(fs.readFileSync(policyFile, 'utf8')));
  const input = view().pending[0]!;
  return { root, dir, personal, access, view, source, input, config, writePolicy };
}
async function start(t: { after(fn: () => void | Promise<void>): void }, f: ReturnType<typeof setup>) {
  const server = createArbiterServer(f.dir, { personalAccess: f.personal });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>((resolve, reject) => { server.closeAllConnections(); server.close(e => e ? reject(e) : resolve()); }));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const auth = (actor: string) => `Basic ${Buffer.from(`${actor}:${secret}`).toString('base64')}`;
  assert.equal((await fetch(`${base}/personal/session`)).status, 401);
  const sessionResponse = await fetch(`${base}/personal/session`, { headers: { authorization: auth('alice') } });
  assert.equal(sessionResponse.headers.get('cache-control'), 'no-store');
  const session = await sessionResponse.json() as { token: string };
  assert.deepEqual(Object.keys(session), ['token']);
  const api = async (action: string, fields = {}, actor = 'alice', route = '/personal/api') => {
    const response = await fetch(base + route, { method: 'POST', headers: { authorization: auth(actor), 'content-type': 'application/json', 'x-arbiter-token': session.token }, body: JSON.stringify({ action, ref, ...(action === 'continuation-preview' ? { request } : {}), ...fields }) });
    return { status: response.status, body: await response.json() as any };
  };
  return { api, base };
}
const decision = (input: unknown, disposition = 'presented') => ({ input, disposition, reason: 'Read exact synthetic revision' });
function healthy(dir: string) { const files = walkCorpus(dir); assert.deepEqual(validateCorpus(dir, files, SchemaSet.fromFiles(files)).errors, []); }

test('authenticated agent packet exports exact complete bytes and records explicit dispositions only after export', async t => {
  const f = setup(t), { api } = await start(t, f);
  const sharedBefore = exportHandoff(f.dir, previewHandoff(f.dir, { ref }));
  const preview = await api('continuation-preview', { actor: 'bob', request: { ...request, checkpoint: 'forged', actor: 'bob' } });
  assert.equal(preview.status, 200); assert.equal(preview.body.allowed, true);
  const packet = JSON.parse(preview.body.packet);
  assert.equal(packet.reviewer, 'alice'); assert.equal(packet.bytes, Buffer.byteLength(preview.body.packet));
  assert.equal(preview.body.bytes, packet.bytes); assert.ok(packet.bytes <= 16384);
  assert.equal(packet.inputs.length, 1); assert.equal(packet.inputs[0].bytes, fs.readFileSync(path.join(f.dir, `${f.source}.md`), 'utf8'));
  const shared = JSON.parse(previewHandoff(f.dir, { ref, format: 'json' }).packet);
  for (const entry of shared.manifest) for (const key of ['source', 'revision', 'purpose']) assert.ok(packet.handoff.sources[`${ref}/checkpoint.md`].includes(entry[key]), 'manifest fields retained in exact checkpoint');
  for (const [key, value] of Object.entries(shared.sources)) assert.equal(packet.handoff.sources[key], value, 'all shared source bytes preserved');
  const protocol = fs.readFileSync(path.join(f.dir, 'PROTOCOL.md'), 'utf8');
  assert.equal(packet.handoff.sources['PROTOCOL.md#authenticated-agent-input-continuation'], protocol.slice(protocol.indexOf('## Authenticated agent input continuation')));
  assert.equal(packet.inputs[0].revision, f.input.revision); assert.equal(packet.inputs[0].canIncorporate, false);
  assert.match(preview.body.packet, /RULE-42/); assert.ok(!preview.body.packet.includes(secret));
  assert.ok(!preview.body.packet.includes(f.root)); assert.equal(readInputState(f.dir, ref).state.receipts.length, 0);
  const fields = { previewId: preview.body.id, decisions: [decision(f.input)] };
  assert.equal((await api('continuation-review', fields)).status, 400);
  assert.equal((await api('continuation-export', fields, 'bob')).status, 400);
  assert.equal((await api('continuation-export', { ...fields, previewId: 'forged' })).status, 400);
  const exported = await api('continuation-export', { ...fields, packet: 'forged' });
  assert.equal(exported.status, 200); assert.equal(exported.body.packet, preview.body.packet);
  assert.equal((await api('continuation-review', { ...fields, decisions: [] })).status, 400);
  assert.equal((await api('continuation-review', { ...fields, decisions: [decision(f.input, 'incorporated')] })).status, 400);
  assert.equal((await api('continuation-review', { ...fields, decisions: [decision({ ...f.input, revision: 'sha256:' + '0'.repeat(64) })] })).status, 400);
  const saved = await api('continuation-review', fields); assert.equal(saved.status, 200); assert.equal(saved.body.receipts, 1);
  assert.equal((await api('continuation-review', fields)).status, 400, 'single use');
  assert.equal(f.view().pending[0]!.disposition, 'presented', 'presentation stays actionable');
  assert.equal(exportHandoff(f.dir, previewHandoff(f.dir, { ref })), sharedBefore, 'private receipt does not alter shared packet bytes');
  const dismissed = await api('continuation-preview'); await api('continuation-export', { previewId: dismissed.body.id });
  assert.equal((await api('continuation-review', { previewId: dismissed.body.id, decisions: [decision(f.input, 'dismissed')] })).status, 200);
  assert.equal(f.view().pending.length, 0);
  fs.writeFileSync(path.join(f.dir, `${f.source}.md`), fs.readFileSync(path.join(f.dir, `${f.source}.md`), 'utf8').replace('Private synthetic evidence', 'New synthetic evidence')); assert.equal(f.view().pending.length, 1);
  healthy(f.dir); t.diagnostic(`Complete synthetic personal packet: ${packet.bytes} UTF-8 bytes; no prior checkpoint or sibling body emitted.`);
});

test('revoked principal, source or edge cannot export or receipt retained private context', async t => {
  const f = setup(t), { api } = await start(t, f);
  for (const resource of [`${f.source}.md`, `${ref}/input-review.md#${f.input.link}`]) {
    const p = await api('continuation-preview'); await api('continuation-export', { previewId: p.body.id });
    f.config.readers[resource] = []; f.writePolicy();
    assert.notEqual((await api('continuation-export', { previewId: p.body.id })).status, 200);
    assert.notEqual((await api('continuation-review', { previewId: p.body.id, decisions: [decision(f.input)] })).status, 200);
    const hidden = await api('continuation-preview'); assert.equal(hidden.status, 200);
    assert.equal(JSON.parse(hidden.body.packet).inputs.length, 0); assert.ok(!hidden.body.packet.includes(f.source));
    f.config.readers[resource] = ['alice']; f.writePolicy();
  }
  const p = await api('continuation-preview'); f.config.principals.alice.tokenSha256 = '0'.repeat(64); f.writePolicy();
  assert.equal((await api('continuation-export', { previewId: p.body.id })).status, 401);
  assert.equal((await api('continuation-preview', { actor: 'alice', grants: ['alice'] })).status, 401);
  assert.equal(readInputState(f.dir, ref).state.receipts.length, 0);
});

test('changed source, task status, receipts, link and checkpoint invalidate continuation', async t => {
  const f = setup(t), { api } = await start(t, f);
  const staleAfter = async (change: () => void) => {
    const p = await api('continuation-preview'); assert.equal(p.status, 200, JSON.stringify(p.body));
    assert.equal((await api('continuation-export', { previewId: p.body.id })).status, 200);
    change();
    assert.notEqual((await api('continuation-export', { previewId: p.body.id })).status, 200);
    assert.notEqual((await api('continuation-review', { previewId: p.body.id, decisions: [decision(f.view().pending[0])] })).status, 200);
  };
  await staleAfter(() => fs.writeFileSync(path.join(f.dir, `${f.source}.md`), fs.readFileSync(path.join(f.dir, `${f.source}.md`), 'utf8').replace('Private synthetic evidence', 'Changed synthetic evidence')));
  await staleAfter(() => setHumanTaskStatus(f.dir, ref, 'alice', f.view().basis, 'done', 'complete', undefined, f.access));
  await staleAfter(() => {
    const input = f.view().pending[0]!;
    saveInputReview(f.dir, ref, 'alice', beginStoredInputReview(f.dir, ref, 'alice', [input], f.access), [decision(input) as any], {}, f.access);
  });
  await staleAfter(() => fs.writeFileSync(path.join(f.dir, `${ref}/checkpoint.md`), fs.readFileSync(path.join(f.dir, `${ref}/checkpoint.md`), 'utf8').replaceAll('RULE-42', 'RULE-43')));
  await staleAfter(() => unlinkInput(f.dir, ref, f.input.link, f.view().basis, 'alice', undefined, f.access));
  assert.equal(readInputState(f.dir, ref).state.receipts.length, 1);
});

test('whole personal packet budget refuses overflow without truncation and records deliberate override', async t => {
  const f = setup(t, 'Ω'.repeat(4000)), { api } = await start(t, f);
  const p = await api('continuation-preview', { request: {} }); assert.equal(p.status, 200); assert.equal(p.body.allowed, false);
  assert.ok(p.body.bytes > 10240); assert.equal(p.body.bytes, Buffer.byteLength(p.body.packet));
  assert.ok(p.body.packet.includes('Ω'.repeat(4000)));
  assert.equal((await api('continuation-export', { previewId: p.body.id })).status, 400);
  assert.equal((await api('continuation-preview', { request: { override: { maxBytes: 30000, reason: '' } } })).status, 400);
  const larger = await api('continuation-preview', { request: { override: { maxBytes: 30000, reason: 'Read full synthetic source and all constraints together' } } });
  assert.equal(larger.body.allowed, true); assert.equal(larger.body.warning, true);
  assert.equal(JSON.parse(larger.body.packet).bytes, Buffer.byteLength(larger.body.packet));
  assert.match(larger.body.packet, /Read full synthetic source and all constraints together/);
  assert.equal((await api('continuation-export', { previewId: larger.body.id })).body.packet, larger.body.packet);
  assert.ok(!previewHandoff(f.dir, { ref }).packet.includes('Ω')); t.diagnostic(`Oversized synthetic packet: ${p.body.bytes}; explicit override packet: ${larger.body.bytes} UTF-8 bytes.`);
});

test('personal continuation excludes inaccessible input identities, counts, prose, history and siblings', t => {
  const f = setup(t), first = previewPersonalContinuation(f.dir, { ref, ...request }, 'alice', f.access, 'synthetic-session');
  const source = captureQuickNote(f.dir, ref, 'Bob hidden narrative', inputReviewView(f.dir, ref, 'bob', f.access).basis, 'bob', { personal: true }, f.access).source;
  fs.writeFileSync(path.join(f.dir, 'tasks/unrelated-2026q3.md'), fs.readFileSync(path.join(f.dir, `${ref}.md`), 'utf8').replaceAll('continue-2026q3', 'unrelated-2026q3').replace('Retain RULE-42.', 'Unrelated sibling body'));
  fs.mkdirSync(path.join(f.dir, ref, 'checkpoints'), { recursive: true });
  fs.writeFileSync(path.join(f.dir, ref, 'checkpoints', 'a'.repeat(64) + '.md'), 'Historical private narrative'.repeat(10000));
  const next = previewPersonalContinuation(f.dir, { ref, ...request }, 'alice', f.access, 'synthetic-session');
  assert.equal(next.packet, first.packet); assert.equal(JSON.parse(next.packet).inputs.length, 1);
  for (const excluded of [source, 'Bob hidden narrative', 'Unrelated sibling body', 'Historical private narrative']) assert.ok(!next.packet.includes(excluded));
  assert.equal(exportPersonalContinuation(f.dir, next, 'alice', f.access), next.packet);
  assert.ok(!previewHandoff(f.dir, { ref }).packet.includes(f.source));
});

test('incomplete intent, staged proposals, legacy protocol and restricted checkpoints fail closed', t => {
  const f = setup(t);
  assert.throws(() => captureQuickNote(f.dir, ref, 'Interrupted', f.view().basis, 'alice', { personal: true, afterContent: () => { throw new Error('Injected interruption'); } }, f.access), /Injected/);
  assert.throws(() => previewPersonalContinuation(f.dir, { ref, ...request }, 'alice', f.access, 'session'), /Reconcile/);
  const g = setup(t);
  stageProposal(g.dir, `${ref}.md`, { filename: 'pending.md', text: '# Concurrent proposal\n' });
  assert.throws(() => previewPersonalContinuation(g.dir, { ref }, 'alice', g.access, 'session'), /Reconcile/);
  const h = setup(t), protocol = path.join(h.dir, 'PROTOCOL.md');
  fs.writeFileSync(protocol, fs.readFileSync(protocol, 'utf8').replace('version: "0.4.17"', 'version: "0.4.16"'));
  assert.equal(checkData(h.dir), 'ready');
  assert.throws(() => previewPersonalContinuation(h.dir, { ref }, 'alice', h.access, 'session'), /0.4.17/);
  const j = setup(t), task = path.join(j.dir, `${ref}.md`);
  fs.writeFileSync(task, fs.readFileSync(task, 'utf8').replace('type: task', 'type: task\nvisibility: private'));
  j.config.readers[`${ref}.md`] = ['alice']; j.writePolicy();
  assert.throws(() => previewPersonalContinuation(j.dir, { ref }, 'alice', j.access, 'session'), /unavailable or excluded/);
});
