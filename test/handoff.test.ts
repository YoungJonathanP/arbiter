import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import * as http from 'node:http';
import * as vm from 'node:vm';
import type { AddressInfo } from 'node:net';
import { initData } from '../src/cli/data.js';
import { sha256, walkCorpus } from '../src/core/corpus.js';
import { draftCheckpoint, previewHandoff, captureCheckpoint, exportHandoff, type HandoffRequest } from '../src/core/handoff.js';
import { CommitConflict, stageProposal } from '../src/core/commit.js';
import { checkpointHistoryPath } from '../src/core/checkpoint.js';
import { validateCorpus } from '../src/core/validate.js';
import { SchemaSet } from '../src/core/schema.js';
import { createArbiterServer } from '../src/web/server.js';
import { HANDOFF_JS } from '../src/web/handoff.js';

const ref = 'tasks/handoff-exercise-2026q3', cp = `${ref}/checkpoint.md`;
const at = '2026-09-08T10:00';
function setup(t: { after(fn: () => void): void }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-handoff-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  initData(dir);
  fs.writeFileSync(path.join(dir, `${ref}.md`), `---\nid: handoff-exercise-2026q3\ntype: task\ntitle: Handoff exercise\nstatus: in-flight\nowner: agent-session\nupdated: ${at}\n---\n\n# Handoff exercise\n\n## Summary\n\nKeep rule ABC-42: preserve every original byte.\n\n## Checklist\n\n- [ ] Verify ticket ABC-42 <!-- ^verify -->\n\n## Artifacts\n\n- report: [Result](https://example.test/report)\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place -->\n`);
  return dir;
}
function request(dir: string): HandoffRequest {
  return { ref, checkpoint: draftCheckpoint(dir, ref, at)
    .replace('branch: unknown', 'branch: main').replace('revision: unknown', 'revision: abc123')
    .replace('readiness: unprepared', 'readiness: ready').replace('state: unknown', 'state: met').replace('evidence: unknown', 'evidence: observed synthetic local authorization')
    .replaceAll('Unknown; record the observed facts and applicable rules.', 'Implement the selected local outcome; retain ABC-42 and stop after acceptance.'),
    owner: 'agent-session' };
}
function captured(dir: string) { const draft = previewHandoff(dir, request(dir)); captureCheckpoint(dir, draft); return previewHandoff(dir, { ref }); }
function validation(dir: string) { const files = walkCorpus(dir); return validateCorpus(dir, files, SchemaSet.fromFiles(files)); }

test('handoff capture assigns task pointer before hashing; Markdown/JSON exports match complete previews', t => {
  const dir = setup(t), draft = previewHandoff(dir, request(dir));
  assert.match(draft.taskAfter, /checkpoint: tasks\/handoff-exercise-2026q3\/checkpoint.md/);
  assert.equal(draft.assessment.readiness, 'ready');
  assert.throws(() => exportHandoff(dir, draft), /Capture the draft/);
  captureCheckpoint(dir, draft);
  const current = previewHandoff(dir, { ref });
  assert.equal(current.packet, draft.packet, 'capture does not change reviewed output');
  assert.equal(current.bytes, Buffer.byteLength(current.packet));
  assert.equal(current.allowed, true);
  assert.equal(exportHandoff(dir, current), current.packet);
  const relocated = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-receiver-'));
  t.after(() => fs.rmSync(relocated, { recursive: true, force: true }));
  fs.cpSync(dir, relocated, { recursive: true });
  assert.equal(exportHandoff(relocated, current), current.packet, 'portable identities survive relocation');
  assert.deepEqual(validation(dir).errors, []);
  const json = previewHandoff(dir, { ref, format: 'json' });
  assert.equal(JSON.parse(json.packet).bytes, Buffer.byteLength(json.packet));
  assert.equal(JSON.parse(exportHandoff(dir, json)).sources[cp], current.checkpoint);
  assert.doesNotMatch(current.packet, new RegExp(dir));
  assert.match(current.packet, /receiver-local paths/);
  assert.match(current.packet, /no publication, merge, messaging/i);
});

test('stale/tampered previews and contending captures retain current and archived bytes', t => {
  const dir = setup(t), first = captured(dir), old = first.checkpoint;
  const next = previewHandoff(dir, request(dir));
  const contender = previewHandoff(dir, { ...request(dir), checkpoint: request(dir).checkpoint!.replace('Implement the selected local outcome', 'Inspect different work') });
  captureCheckpoint(dir, next);
  assert.throws(() => captureCheckpoint(dir, contender), CommitConflict);
  assert.equal(fs.readFileSync(path.join(dir, checkpointHistoryPath(ref, `sha256:${sha256(old)}`)), 'utf8'), old);
  assert.throws(() => exportHandoff(dir, first), /stale/);
  const current = previewHandoff(dir, { ref });
  assert.throws(() => exportHandoff(dir, { ...current, packet: current.packet + 'tampered' }), /changed/);
  assert.equal(exportHandoff(dir, { ...current, taskAfter: 'forged mutation', checkpoint: 'forged mutation' }), current.packet, 'derived fields never trusted');
  fs.appendFileSync(path.join(dir, `${ref}.md`), '\nChanged dependency without timestamp.\n');
  assert.throws(() => exportHandoff(dir, current), /stale/);
  assert.equal(previewHandoff(dir, { ref }).assessment.readiness, 'review-required');
});

test('staging and selected dependency revisions prevent capture; external observations remain explicit', t => {
  const dir = setup(t);
  const dep = `${ref}/decision.md`;
  fs.mkdirSync(path.join(dir, ref));
  fs.writeFileSync(path.join(dir, dep), '# Selected decision\n\nPreserve ABC-42.\n');
  const req = request(dir);
  req.checkpoint = req.checkpoint!.replace('predicates:\n', `  decision: { source: kb:${dep}, revision: sha256:${sha256(fs.readFileSync(path.join(dir, dep), 'utf8'))}, observed: ${at}, purpose: decision rules }\npredicates:\n`);
  const preview = previewHandoff(dir, req);
  fs.appendFileSync(path.join(dir, dep), '\nChanged.\n');
  assert.throws(() => captureCheckpoint(dir, preview), /stale/);
  const stale = previewHandoff(dir, req);
  assert.throws(() => captureCheckpoint(dir, stale), /stale/);
  const pending = previewHandoff(dir, request(dir));
  stageProposal(dir, `${ref}.md`, { filename: 'pending.md', text: '# Pending intent\n' });
  assert.throws(() => captureCheckpoint(dir, pending), /stale/);
  assert.throws(() => captureCheckpoint(dir, previewHandoff(dir, request(dir))), /pending proposals/);
  assert.equal(fs.existsSync(path.join(dir, cp)), false);
});

test('offline packet carries installed rules; budget overrides are inside both formats and never truncate', t => {
  const dir = setup(t); captured(dir);
  for (const format of ['markdown', 'json'] as const) {
    const tooLarge = previewHandoff(dir, { ref, format, offline: true });
    assert.equal(tooLarge.allowed, false);
    assert.throws(() => exportHandoff(dir, tooLarge), /budget/);
    const packet = previewHandoff(dir, { ref, format, offline: true, override: { maxBytes: 100000, reason: 'Carry full installed rules for offline planning' } });
    assert.equal(packet.bytes, Buffer.byteLength(packet.packet));
    assert.equal(exportHandoff(dir, packet), packet.packet);
    const protocol = fs.readFileSync(path.join(dir, 'PROTOCOL.md'), 'utf8');
    if (format === 'json') assert.equal(JSON.parse(packet.packet).sources['PROTOCOL.md'], protocol);
    else assert.ok(packet.packet.includes(protocol));
    assert.match(packet.packet, /offline planning snapshot/);
    assert.match(packet.packet, /100000/);
  }
  assert.throws(() => previewHandoff(dir, { ref, override: { maxBytes: 50000, reason: '' } }), /reason/);
  assert.throws(() => previewHandoff(dir, { ref, expand: ['not-selected.md'] }), /explicitly selected/);
  const before = previewHandoff(dir, { ref });
  fs.mkdirSync(path.join(dir, ref, 'checkpoints'));
  fs.writeFileSync(path.join(dir, ref, 'checkpoints', 'unreadable-history.md'), 'x'.repeat(200000));
  assert.equal(exportHandoff(dir, before), before.packet, 'history growth never expands or stales normal output');
});

test('extraction preserves original bytes, anchors, artifacts and rules in current packets', t => {
  for (const surface of ['Summary', '^verify']) {
    const dir = setup(t), original = fs.readFileSync(path.join(dir, `${ref}.md`), 'utf8');
    const draft = previewHandoff(dir, { ...request(dir), extraction: { surface, replacement: 'Continue the bounded assignment.' } });
    assert.ok(draft.history!.text.includes(original));
    assert.match(draft.taskAfter, /<!-- \^verify -->/);
    assert.match(draft.taskAfter, /https:\/\/example.test\/report/);
    captureCheckpoint(dir, draft);
    const current = previewHandoff(dir, { ref });
    assert.equal(current.packet, draft.packet);
    assert.match(current.packet, /ABC-42/);
    assert.match(current.packet, /Preserved extraction context/);
    assert.deepEqual(validation(dir).errors, []);
  }
});

test('private references and credentials fail closed; history/transactions cannot be expanded', t => {
  const dir = setup(t); captured(dir);
  fs.writeFileSync(path.join(dir, 'tasks/private-design-2026q3.md'), '---\nid: private-design-2026q3\ntype: task\ntitle: Secret design\nvisibility: private\nstatus: todo\n---\n\n# Secret design\n');
  const safe = previewHandoff(dir, { ref });
  assert.doesNotMatch(safe.packet, /Secret design|private-design/);
  for (const bad of ['Secret design', 'api_key: abcdef123', 'https://user:pass@example.test/path']) {
    const req = request(dir); req.checkpoint = req.checkpoint!.replace('## Constraints\n', `## Constraints\n\n${bad}\n`);
    assert.throws(() => previewHandoff(dir, req), /private material or credential/);
  }
  for (const p of ['.arbiter/transactions/a.json', `${ref}/checkpoints/a.md`]) assert.throws(() => previewHandoff(dir, { ref, expand: [p] }), /explicitly selected/);
});

test('CLI draft, capture, current preview and export keep stdout bytes exact and conflicts exit 3', t => {
  const dir = setup(t);
  const cli = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'src/cli/main.ts', ...args, '--data', dir], { encoding: 'utf8' });
  const requestPath = path.join(dir, 'request.json'), previewPath = path.join(dir, 'preview.json');
  fs.writeFileSync(requestPath, JSON.stringify(request(dir)));
  assert.equal(cli('checkpoint', ref).status, 0);
  const draft = cli('checkpoint', ref, '--file', requestPath);
  assert.equal(draft.status, 0, draft.stderr);
  fs.writeFileSync(previewPath, draft.stdout);
  assert.equal(cli('checkpoint', ref, '--capture', previewPath).status, 0);
  const current = cli('handoff', ref, '--format', 'json');
  assert.equal(current.status, 0, current.stderr);
  fs.writeFileSync(previewPath, current.stdout);
  assert.equal(cli('handoff', ref, '--export', previewPath).stdout, JSON.parse(current.stdout).packet);
  fs.appendFileSync(path.join(dir, `${ref}.md`), '\nChanged.\n');
  assert.equal(cli('handoff', ref, '--export', previewPath).status, 3);
  assert.equal(cli('handoff', ref, '--format', 'xml').status, 2);
  assert.equal(cli('checkpoint', ref, '--file', requestPath, '--capture', previewPath).status, 2);
});

test('human edit/preview/capture/copy/download uses exact bytes; local API rejects cross-origin writes', async t => {
  const dir = setup(t), server = createArbiterServer(dir);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const page = await (await fetch(`${base}/item/${ref}`)).text();
  const token = /data-token="([a-f0-9]+)"/.exec(page)![1]!;
  const api = async (body: unknown, extra: Record<string, string> = {}) => fetch(`${base}/api/handoff`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-arbiter-token': token, ...extra }, body: JSON.stringify(body) });
  assert.equal((await api({ action: 'draft', ref }, { origin: 'https://attacker.test' })).status, 403);
  assert.equal((await api({ action: 'draft', ref }, { 'x-arbiter-token': 'wrong' })).status, 403);
  const rebinding = await new Promise<number>(resolve => {
    const req = http.request(base + '/api/handoff', { method: 'POST', headers: { host: 'attacker.test', 'content-type': 'application/json', 'x-arbiter-token': token } }, res => { res.resume(); resolve(res.statusCode!); });
    req.end(JSON.stringify({ action: 'draft', ref }));
  });
  assert.equal(rebinding, 403);
  assert.equal((await fetch(`${base}/api/handoff`)).status, 405);
  const nodes = new Map<string, any>();
  for (const id of ['handoff', ...['current', 'draft', 'editor', 'owner', 'next', 'text', 'options', 'preview', 'capture', 'copy', 'download', 'status', 'result', 'changes', 'packet'].map(s => `handoff-${s}`)]) nodes.set(id, { value: '', textContent: '', hidden: false, disabled: false, getAttribute: (name: string) => name === 'data-ref' ? ref : token });
  nodes.get('handoff-owner').value = 'agent-session'; nodes.get('handoff-options').value = '{"format":"markdown"}';
  let clipboard = '', download: Blob | undefined;
  vm.runInNewContext(HANDOFF_JS, {
    document: { getElementById: (id: string) => nodes.get(id), createElement: () => ({ click() {} }) },
    fetch: (url: string, options: any) => fetch(base + url, options),
    navigator: { clipboard: { writeText: async (text: string) => { clipboard = text; } } },
    Blob, URL: { createObjectURL: (blob: Blob) => { download = blob; return 'blob:test'; }, revokeObjectURL() {} }, setTimeout,
  });
  const click = async (name: string, done: () => boolean) => {
    nodes.get(`handoff-${name}`).onclick();
    for (let i = 0; i < 150 && !done(); i++) await new Promise(r => setTimeout(r, 10));
    assert.ok(done(), nodes.get('handoff-status').textContent);
  };
  await click('draft', () => nodes.get('handoff-text').value.includes('role: checkpoint'));
  nodes.get('handoff-text').value = request(dir).checkpoint;
  nodes.get('handoff-text').oninput();
  nodes.get('handoff-next').value = 'Run acceptance for ticket ABC-42, then stop.';
  nodes.get('handoff-next').oninput();
  await click('preview', () => !nodes.get('handoff-capture').disabled);
  const reviewed = nodes.get('handoff-packet').textContent;
  assert.match(reviewed, /Run acceptance for ticket ABC-42/);
  await click('capture', () => !nodes.get('handoff-copy').disabled);
  assert.equal(nodes.get('handoff-packet').textContent, reviewed);
  await click('copy', () => !!clipboard);
  assert.equal(clipboard, reviewed);
  await click('download', () => !!download);
  assert.equal(await download!.text(), reviewed);
  fs.appendFileSync(path.join(dir, `${ref}.md`), '\nIntervening edit.\n');
  clipboard = '';
  await click('copy', () => nodes.get('handoff-status').textContent.includes('stale'));
  assert.equal(clipboard, '');
  assert.equal(nodes.get('handoff-copy').disabled, true);
});


test('interrupted first capture retains task intent and retries from fresh observations', t => {
  const dir = setup(t), preview = previewHandoff(dir, request(dir));
  assert.throws(() => captureCheckpoint(dir, preview, { afterTask() { throw new Error('interrupted after task'); } }), /interrupted/);
  assert.equal(fs.readFileSync(path.join(dir, `${ref}.md`), 'utf8'), preview.taskAfter);
  assert.equal(fs.existsSync(path.join(dir, cp)), false);
  assert.throws(() => captureCheckpoint(dir, preview), /stale/);
  captureCheckpoint(dir, previewHandoff(dir, request(dir)));
  assert.deepEqual(validation(dir).errors, []);
});

test('capture changes only intended frontmatter and preserves untouched nested input bytes', t => {
  const dir = setup(t), file = path.join(dir, `${ref}.md`);
  fs.appendFileSync(file, '\n  opaque trailing spacing  \n');
  const before = fs.readFileSync(file, 'utf8');
  const req = request(dir);
  req.checkpoint = req.checkpoint!.replace("purpose: 'required assignment input'", "purpose: 'task observation'");
  const untouched = req.checkpoint!.split('\n').find(line => line.includes('kb:PROTOCOL.md'))!;
  const draft = previewHandoff(dir, req);
  assert.ok(draft.checkpoint.includes(untouched));
  assert.equal(draft.taskAfter.slice(draft.taskAfter.indexOf('\n# Handoff')), before.slice(before.indexOf('\n# Handoff')));
  captureCheckpoint(dir, draft);
  const next = previewHandoff(dir, request(dir));
  assert.equal(next.taskAfter, next.taskBefore);
});

test('two independent CLI processes cannot discard the competing checkpoint', async t => {
  const dir = setup(t); captured(dir);
  const a = previewHandoff(dir, request(dir));
  const b = previewHandoff(dir, { ...request(dir), checkpoint: request(dir).checkpoint!.replace('## Next actions\n', '## Next actions\n\nInspect competing intent.\n') });
  const run = (name: string, preview: unknown) => new Promise<number | null>(resolve => {
    const file = path.join(dir, name + '.json'); fs.writeFileSync(file, JSON.stringify(preview));
    const child = spawn(process.execPath, ['--import', 'tsx', 'src/cli/main.ts', 'checkpoint', ref, '--capture', file, '--data', dir], { stdio: 'ignore' });
    child.on('exit', resolve);
  });
  const results = await Promise.all([run('first', a), run('second', b)]);
  assert.deepEqual(results.sort(), [0, 3]);
  const bytes = fs.readFileSync(path.join(dir, cp), 'utf8');
  assert.ok(bytes === a.checkpoint || bytes === b.checkpoint);
  assert.deepEqual(validation(dir).errors, []);
});

test('repository/external observations cannot silently become verified or change reviewed export', t => {
  const dir = setup(t), req = request(dir), revision = 'sha256:' + 'a'.repeat(64);
  req.checkpoint = req.checkpoint!.replace('predicates:\n', `  code: { source: repo:src/change.ts, revision: ${revision}, observed: ${at}, purpose: selected implementation }\npredicates:\n`);
  assert.equal(previewHandoff(dir, req).assessment.readiness, 'review-required');
  const observed = { ...req, observations: { 'repo:src/change.ts': revision } };
  assert.equal(previewHandoff(dir, observed).assessment.readiness, 'ready');
  captureCheckpoint(dir, previewHandoff(dir, observed));
  const snapshot = previewHandoff(dir, { ref, observations: observed.observations });
  assert.throws(() => exportHandoff(dir, { ...snapshot, request: { ...snapshot.request, observations: { 'repo:src/change.ts': 'sha256:' + 'b'.repeat(64) } } }), /stale/);
  assert.equal(previewHandoff(dir, { ref }).assessment.readiness, 'review-required');
});
