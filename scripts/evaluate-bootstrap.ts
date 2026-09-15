// Synthetic T09 experiment, not a supported exporter or replacement protocol.
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { initData } from '../src/cli/data.js';
import { draftCheckpoint, previewHandoff, captureCheckpoint, exportHandoff } from '../src/core/handoff.js';
import { checkpointHistoryPath } from '../src/core/checkpoint.js';
import { sha256, walkCorpus } from '../src/core/corpus.js';
import { captureQuickNote, inputReviewView } from '../src/core/input-storage.js';
import { validateCorpus } from '../src/core/validate.js';
import { SchemaSet } from '../src/core/schema.js';

export const contextSlots = ['system', 'developer', 'tools', 'client', 'user', 'conversation', 'workspace', 'rechecks'] as const;
type Slot = typeof contextSlots[number];
type Context = Partial<Record<Slot, string | null>>;
type Override = { maxBytes: number; reason: string };
const bytes = (text: string) => Buffer.byteLength(text, 'utf8');

/** Count exact emitted occurrences, including this receipt. No semantic dedup,
 * token estimate, inferred empty slots, runtime introspection or authorization.
 * The caller must inventory every source of context in these slots. */
export function auditBootstrap(packet: string, context: Context, override?: Override) {
  if (override && (!Number.isSafeInteger(override.maxBytes) || override.maxBytes <= 10240 || !override.reason.trim()))
    throw new Error('Override requires a maximum above 10240 and a reason');
  if (Object.keys(context).some(key => !contextSlots.includes(key as Slot))) throw new Error('Unknown context slot');
  const unknown = contextSlots.filter(key => typeof context[key] !== 'string');
  const components = { packet: bytes(packet), ...Object.fromEntries(contextSlots.map(key => [key, typeof context[key] === 'string' ? bytes(context[key]) : null])) };
  const knownBytes = Object.values(components).reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const maxBytes = override?.maxBytes ?? 10240;
  const render = (total: number) => JSON.stringify({ experiment: 'synthetic-bootstrap-v1', unit: 'UTF-8 bytes; not model tokens',
    components, unknown, override: override ?? null, knownBytesIncludingReceipt: total,
    complete: unknown.length === 0, withinTarget: unknown.length === 0 && total <= 6144,
    ordinary: unknown.length === 0 && total <= 10240,
    allowed: unknown.length === 0 && total <= maxBytes,
    limitation: 'Caller-supplied inventory only; no agent execution, comprehension or authority evidence.' })
    // Equal-width booleans prevent a one-byte admit/refuse oscillation at the ceiling.
    .replace(/"(withinTarget|ordinary|allowed)":true/g, '"$1":true ') + '\n';
  let receipt = render(0);
  for (let i = 0; i < 20; i++) {
    const next = render(knownBytes + bytes(receipt));
    if (next === receipt) return { ...JSON.parse(receipt) as {
      knownBytesIncludingReceipt: number; complete: boolean; withinTarget: boolean; ordinary: boolean; allowed: boolean;
    }, receipt };
    receipt = next;
  }
  throw new Error('Measurement receipt did not converge');
}

export function evaluateSyntheticBootstrap() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-bootstrap-'));
  const ref = 'tasks/bootstrap-2026q3', cp = `${ref}/checkpoint.md`, at = '2026-09-13T10:00';
  const read = (rel: string) => fs.readFileSync(path.join(dir, rel), 'utf8');
  const write = (rel: string, text: string) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
  const override = { maxBytes: 65536, reason: 'Synthetic experiment retains full installed rules and accounts for all declared client context.' };
  try {
    initData(dir);
    write(`${ref}.md`, `---\nid: bootstrap-2026q3\ntype: task\ntitle: Bootstrap experiment\nstatus: in-flight\nowner: synthetic-session\nupdated: ${at}\n---\n\n# Bootstrap experiment\n\n## Summary\n\nVerify RULE-42 locally. Preserve history and Ω.\n\n## Checklist\n\n- [ ] Verify RULE-42 <!-- ^verify -->\n\n## Artifacts\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · preserve history -->\n`);
    const draft = () => draftCheckpoint(dir, ref, at)
      .replace('branch: unknown', 'branch: main').replace('revision: unknown', 'revision: synthetic-revision')
      .replace('readiness: unprepared', 'readiness: ready').replace('state: unknown', 'state: met')
      .replace('evidence: unknown', 'evidence: synthetic local test only')
      .replaceAll('Unknown; record the observed facts and applicable rules.', 'Verify RULE-42 locally; preserve history. Stop after synthetic checks.');
    captureCheckpoint(dir, previewHandoff(dir, { ref, checkpoint: draft() }));
    const first = previewHandoff(dir, { ref });
    assert.equal(exportHandoff(dir, first), first.packet);
    captureCheckpoint(dir, previewHandoff(dir, { ref, checkpoint: draft().replace('## Verified state\n', '## Verified state\n\nFirst capture verified.\n') }));
    assert.equal(read(checkpointHistoryPath(ref, `sha256:${sha256(first.checkpoint)}`)), first.checkpoint);
    assert.throws(() => exportHandoff(dir, first), /stale/);
    const linked = previewHandoff(dir, { ref, format: 'json' });
    assert.equal(exportHandoff(dir, linked), linked.packet);
    const offline = previewHandoff(dir, { ref, format: 'json', offline: true });
    assert.equal(offline.allowed, false);
    assert.throws(() => exportHandoff(dir, offline), /budget/);
    const reviewed = previewHandoff(dir, { ref, format: 'json', offline: true, override });
    assert.equal(exportHandoff(dir, reviewed), reviewed.packet);
    const included = JSON.parse(reviewed.packet).sources as Record<string, string>;
    const required = ['PROTOCOL.md', 'types/_base.md', 'types/task.md', `${ref}.md`, cp];
    assert.deepEqual(Object.keys(included).sort(), [...required].sort());
    for (const source of required) assert.equal(included[source], read(source));
    const sourceBytes = Object.fromEntries(required.map(source => [source, bytes(read(source))]));
    const rawSourceFloor = Object.values(sourceBytes).reduce((a, b) => a + b, 0);
    // Best possible removal of framing/duplicate manifests still retains these
    // exact sources. This lower bound is NOT a usable or approved new renderer.
    assert.ok(rawSourceFloor > 10240);
    const history = 'Optional synthetic history Ω.\n'.repeat(5000);
    const expandedHistory = first.checkpoint.replace('<!-- arbiter:checkpoint', `## Optional history\n\n${history}\n<!-- arbiter:checkpoint`);
    write(checkpointHistoryPath(ref, `sha256:${sha256(expandedHistory)}`), expandedHistory);
    assert.equal(exportHandoff(dir, reviewed), reviewed.packet);
    const optionalHistory = `---\nid: optional-history\nkind: note\nitem: bootstrap-2026q3\nupdated: ${at}\n---\n\n# Optional history\n\n${history}\n<!-- arbiter:tier-3 · PROTOCOL.md#tier-3 · append only -->\n`;
    write(`${ref}/optional-history.md`, optionalHistory);
    assert.throws(() => exportHandoff(dir, reviewed), /stale/);
    assert.equal(previewHandoff(dir, reviewed.request).packet, reviewed.packet);
    const beforePrivate = previewHandoff(dir, reviewed.request);
    write('tasks/private-canary-2026q3.md', `---\nid: private-canary-2026q3\ntype: task\ntitle: Private canary\nvisibility: private\nstatus: todo\nupdated: ${at}\n---\n\n# Private canary\n\n## Summary\n\nDO-NOT-EXPORT-CANARY\n\n## Checklist\n\n## Artifacts\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · preserve history -->\n`);
    assert.throws(() => exportHandoff(dir, beforePrivate), /stale/);
    const safe = previewHandoff(dir, reviewed.request);
    assert.equal(safe.packet, reviewed.packet, 'private body, identity and counts stay excluded');
    assert.doesNotMatch(safe.packet, /private-canary|Private canary|DO-NOT-EXPORT-CANARY/);
    const bad = draft().replace('predicates:\n', `  secret: { source: kb:tasks/private-canary-2026q3.md, revision: sha256:${sha256(read('tasks/private-canary-2026q3.md'))}, observed: ${at}, purpose: excluded input }\npredicates:\n`);
    assert.throws(() => previewHandoff(dir, { ref, checkpoint: bad, override }), /private|excluded|unavailable/i);
    const view = inputReviewView(dir, ref);
    const note = captureQuickNote(dir, ref, 'NEW-SHARED-INPUT Ω must be reviewed.', view.basis, 'synthetic-session', { personal: false });
    assert.throws(() => exportHandoff(dir, safe), /stale/);
    const withInput = previewHandoff(dir, reviewed.request);
    assert.match(withInput.packet, /NEW-SHARED-INPUT Ω/);
    assert.equal(withInput.assessment.readiness, 'review-required');
    assert.equal(exportHandoff(dir, withInput), withInput.packet, 'planning export does not waive review');
    assert.equal(inputReviewView(dir, ref).pending.length, 1, 'export acknowledges nothing');
    write(`${note.source}.md`, read(`${note.source}.md`).replace('<!-- arbiter:', 'New source revision.\n\n<!-- arbiter:'));
    assert.throws(() => exportHandoff(dir, withInput), /stale/);
    write(`${note.source}.md`, read(`${note.source}.md`).replace('<!-- arbiter:', `${'Required linked evidence Ω.\n'.repeat(3000)}\n<!-- arbiter:`));
    const oversizedInput = previewHandoff(dir, reviewed.request);
    assert.equal(oversizedInput.allowed, false);
    assert.ok(oversizedInput.packet.includes('Required linked evidence Ω.\n'.repeat(3000).trim().split('\n').join('\\n')));
    assert.throws(() => exportHandoff(dir, oversizedInput), /budget/);
    const files = walkCorpus(dir);
    assert.deepEqual(validateCorpus(dir, files, SchemaSet.fromFiles(files)).errors, []);
    const context = Object.fromEntries(contextSlots.map(key => [key, ''])) as Context;
    context.system = 'Synthetic harness only. Do not execute an agent.\n';
    context.client = 'Pass the exact reviewed offline packet once. Planning only; recheck before writes.\n';
    context.user = 'Verify RULE-42 in the synthetic workspace only.\n';
    context.rechecks = 'Synthetic capture/export, history, privacy and revision assertions passed.\n';
    const measured = auditBootstrap(reviewed.packet, context, override);
    assert.equal(measured.allowed, true);
    assert.equal(measured.ordinary, false);
    const ordinary = auditBootstrap(reviewed.packet, context);
    assert.equal(ordinary.allowed, false);
    const unmeasured = auditBootstrap(reviewed.packet, { ...context, system: null, developer: null, tools: null }, override);
    assert.equal(unmeasured.allowed, false);
    const linkedSources = JSON.parse(linked.packet).sources as Record<string, string>;
    const checkpointRules = linkedSources['PROTOCOL.md#checkpoints']!;
    assert.ok(read('PROTOCOL.md').includes(checkpointRules));
    return {
      experiment: 'synthetic only; no real-data iteration or agent execution',
      sourceBytes, sourceRevisions: Object.fromEntries(required.map(source => [source, `sha256:${sha256(included[source]!)}`])),
      rawSourceFloor, linkedPacketBytes: linked.bytes, ordinaryOfflineBytes: offline.bytes, reviewedOfflineBytes: reviewed.bytes,
      duplicateCheckpointExcerptBytes: bytes(checkpointRules),
      linkedPlusFullRulesBytes: linked.bytes + sourceBytes['PROTOCOL.md']! + sourceBytes['types/_base.md']! + sourceBytes['types/task.md']!,
      offlineFramingAndEscapingBytes: reviewed.bytes - rawSourceFloor,
      historyGrowthBytes: bytes(expandedHistory) + bytes(optionalHistory),
      newLinkedInputPacketBytes: withInput.bytes, oversizedLinkedInputPacketBytes: oversizedInput.bytes,
      measured, ordinary, unmeasured,
      checks: ['two captures', 'exact immutable prior checkpoint', 'exact reviewed export', 'ordinary refusal',
        'all required source bytes retained once offline', 'history-independent emission', 'stale previews refused',
        'private source excluded even with override', 'new linked input forces review', 'oversized required input refuses without truncation',
        'export acknowledges nothing', 'validation'],
      gate: 'Ordinary complete bootstrap exceeds 10 KiB even without framing. Actual host context remains unmeasured; design review and fresh-agent authority are separate gates.',
    };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length !== 2) throw new Error('No arguments: this evaluator creates only disposable synthetic data');
  process.stdout.write(JSON.stringify(evaluateSyntheticBootstrap(), null, 2) + '\n');
}
