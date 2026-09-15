// Synthetic acceptance exercise only. No live KB, host policy, network or agents.
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
import { parseItemFile } from '../src/core/parse.js';
import { fmGet } from '../src/core/fm.js';
import { validateCorpus } from '../src/core/validate.js';
import { SchemaSet } from '../src/core/schema.js';

const bytes = (s: string) => Buffer.byteLength(s, 'utf8');
const at = '2026-09-14T12:00';
const flight = 'tasks/search-flight-2026q3', ref = 'tasks/verify-search-2026q3';
const cp = `${ref}/checkpoint.md`, investigation = `${ref}/investigation.md`;

export function evaluateFlightContinuation(output?: string) {
  if (output && fs.existsSync(output)) throw new Error('Artifact directory must be new; preserve earlier runs');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arbiter-flight-'));
  const read = (p: string) => fs.readFileSync(path.join(dir, p), 'utf8');
  const write = (p: string, s: string) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), s); };
  const artifacts: Record<string, string> = {};
  const item = (id: string, title: string, status: string, body: string, parent?: string) =>
    `---\nid: ${id}\ntype: task\ntitle: ${title}\nstatus: ${status}\nowner: synthetic-session\nupdated: ${at}\n${parent ? `parent: ${parent}\n` : ''}---\n\n# ${title}\n\n${body}\n\n<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · preserve history -->\n`;
  const detail = (id: string, kind: string, owner: string, body: string) =>
    `---\nid: ${id}\nkind: ${kind}\nitem: ${owner}\nupdated: ${at}\n---\n\n${body}\n\n<!-- arbiter:tier-3 · PROTOCOL.md#tier-3 · append only -->\n`;
  try {
    initData(dir);
    write(`${flight}.md`, item('search-flight-2026q3', 'Search compatibility flight', 'in-flight', `## Summary

Preserve stable search anchors while verifying empty-query behavior. Design is complete;
verification is next. Release is blocked by verification. All state is synthetic.

## Plan inputs

- plan: [Larger plan: Acceptance section](${flight}/plan.md)

## Checklist

- [x] Decide empty-query behavior <!-- ^design -->
      see: [Completed design](${flight}/design.md)
- [ ] Verify empty-query behavior <!-- ^verify -->
      see: [Verification task](${ref}.md)
      see: [Current T3 handoff](${cp})
- [!] Release only after verification <!-- ^release -->
      blocked-by: [Verification evidence](${ref}.md#^verify)
      see: [Release task](tasks/release-search-2026q3.md)

## Detail docs

- [[plan]] Larger plan (plan) -> ${flight}/plan.md
- [[design]] Completed design (report) -> ${flight}/design.md`));
    write(`${flight}/plan.md`, detail('plan', 'plan', 'search-flight-2026q3', '# Larger plan\n\n## Acceptance\n\nEmpty queries return no results. Keep existing anchors. Release requires reviewed verification.\n\n## Future work\n\nRanking and highlighting are separate work.'));
    write(`${flight}/design.md`, detail('design', 'report', 'search-flight-2026q3', '# Completed design\n\n## Directive\n\nPredecessor directive: empty queries return no results; preserve stable anchors. The next task must verify both.\n\n## History\n\nSynthetic prior discussion.'));
    write(`${ref}.md`, item('verify-search-2026q3', 'Verify search compatibility', 'todo', `## Summary

Verify empty queries return no results and stable anchors survive. Design is settled.
Use the current checkpoint for execution; humans manage status and completion.

## Plan inputs

- plan: [Larger plan: Acceptance section](${flight}/plan.md)

## Checklist

- [ ] Verify empty result and stable anchors <!-- ^verify -->
      see: [Current handoff](${cp})

## Artifacts

- ticket: [Synthetic ticket: Scope section](${ref}/ticket.md)
- pr: [Synthetic PR: Changes section](${ref}/pr.md)

## Detail docs

- [[investigation]] Empty-query rationale (investigation) -> ${investigation}
- [[ticket]] Synthetic ticket (note) -> ${ref}/ticket.md
- [[pr]] Synthetic PR (note) -> ${ref}/pr.md`, flight));
    write('tasks/release-search-2026q3.md', item('release-search-2026q3', 'Release search', 'blocked', `## Summary\n\nSIBLING-BODY must not be needed for verification.\n\n## Checklist\n\n- [!] Await reviewed verification <!-- ^release -->\n      blocked-by: [Verification](${ref}.md#^verify)`, flight));
    write(investigation, detail('investigation', 'investigation', 'verify-search-2026q3', '# Empty-query investigation\n\n## Essential conclusion\n\nEmpty queries return no results; stable anchors remain unchanged.\n\n## Whitespace case\n\nQuestion: does whitespace count as empty? Yes: trim whitespace before the empty check. Include a space-only example in verification.\n\n## Background\n\nOPTIONAL-BACKGROUND is unnecessary at startup.'));
    write(`${ref}/ticket.md`, detail('ticket', 'note', 'verify-search-2026q3', '# Synthetic ticket\n\n## Scope\n\nVerify empty search only; ranking is excluded. This local stand-in makes no live ticket claim.'));
    write(`${ref}/pr.md`, detail('pr', 'note', 'verify-search-2026q3', '# Synthetic PR\n\n## Changes\n\nExpected change boundary: search guard and verification evidence. This local stand-in is not a real PR or merge approval.'));

    const sources = [flight + '.md', investigation];
    let draft = draftCheckpoint(dir, ref, at)
      .replace('repository: urn:workspace:unknown', 'repository: urn:synthetic:search')
      .replace('branch: unknown', 'branch: synthetic').replace('revision: unknown', 'revision: synthetic-fixture')
      .replace('readiness: unprepared', 'readiness: ready').replace('state: unknown', 'state: met')
      .replace('evidence: unknown', 'evidence: isolated synthetic exercise authorized')
      .replace('predicates:\n', sources.map((p, i) => `  selected-${i}: { source: kb:${p}, revision: sha256:${sha256(read(p))}, observed: ${at}, purpose: ${i ? 'essential conclusion and optional whitespace question' : 'flight design and eligibility gates'} }\n`).join('') + 'predicates:\n');
    draft = draft.slice(0, draft.indexOf('\n# Continue')) + `
# Verify search compatibility

## Assignment

Verify empty results and stable anchors at ${flight}.md#^verify. Synthetic only.
Ranking and release are outside scope. Task owns lifecycle and checklist.

## Authority

Local synthetic checks only; no agent launch or external actions. Recheck owner,
input revisions and design gate before implementation. Export grants no authority.

## Verified state

Design is complete at the observed flight revision. Predecessor directive:
empty queries return no results; preserve stable anchors. This prevents accidental
scope expansion. Provenance: ${flight}/design.md#directive.
No implementation or human acceptance is claimed.

## Constraints

Keep refs/history and human status control. Review all actionable input before work;
export acknowledges nothing. Installed protocol and base/task schemas are mandatory.
Do not infer eligibility from row order, timestamps or snapshot readiness alone.

## Next actions

1. Recheck flight design, task owner, checkpoint hashes and pending input.
2. Verify empty-query behavior and anchors locally; consult the whitespace section
   only if the meaning of empty needs clarification.
3. Record checks and replace this checkpoint; stop before release or status changes.

## Completion

Evidence covers empty queries and unchanged anchors, with limitations and current
hashes. A human reviews completion. Checkpoint before exhausting working reserve.

## Evidence

- source: [Design: Directive section](${flight}/design.md)

## Read only as needed

Startup: flight, task, current handoff, full installed protocol, base/task schemas,
and pending input. Measure before admission; reserve execution/verification room.
Host capacity is unknown; the evaluator proposes byte allowances, not token limits.

| Source | Section | Question |
|---|---|---|
| [Plan](${flight}/plan.md#acceptance) | Acceptance | Is requested work in scope? |
| [Investigation](${investigation}#whitespace-case) | Whitespace case | Does whitespace count as empty? |
| [Ticket](${ref}/ticket.md#scope) | Scope | What was requested? |
| [PR](${ref}/pr.md#changes) | Changes | What may change? |

<!-- arbiter:checkpoint · PROTOCOL.md#checkpoints · recheck inputs before resuming -->
`;
    captureCheckpoint(dir, previewHandoff(dir, { ref, checkpoint: draft }));
    const first = previewHandoff(dir, { ref });
    assert.equal(first.assessment.readiness, 'ready');
    // Export size is measured as emitted, never reduced by counting only the body.
    const request = first.allowed ? { ref } : { ref, override: {
      maxBytes: Math.ceil((first.bytes + 512) / 1024) * 1024,
      reason: 'Synthetic measurement retains essential directives and current exporter framing; no session limit implied.',
    } };
    const current = previewHandoff(dir, request);
    assert.equal(exportHandoff(dir, current), current.packet);
    assert.equal(bytes(current.packet), current.bytes);
    assert.doesNotMatch(current.packet, /SIBLING-BODY|OPTIONAL-BACKGROUND/);
    if (!first.allowed) assert.throws(() => exportHandoff(dir, first), /budget/);

    // This is a fixture-specific eligibility check, not an invented runtime scheduler.
    const eligibility = () => {
      const f = parseItemFile(read(`${flight}.md`)), t = parseItemFile(read(`${ref}.md`));
      const rows = f.sections.flatMap(s => s.kind === 'checklist' ? s.steps : []);
      const pending = inputReviewView(dir, ref).pending;
      return rows.find(s => s.anchor === 'design')?.mark === 'x'
        && rows.find(s => s.anchor === 'verify')?.mark === ' '
        && rows.find(s => s.anchor === 'release')?.mark === '!'
        && fmGet(t.fm, 'status') === 'todo' && fmGet(t.fm, 'owner') === 'synthetic-session'
        && fmGet(t.fm, 'checkpoint') === cp && pending.length === 0
        && previewHandoff(dir, request).assessment.readiness === 'ready';
    };
    assert.equal(eligibility(), true);
    const baseline = Object.fromEntries([`${flight}.md`, `${ref}.md`, cp].map(p => [p, bytes(read(p))]));
    const mandatory = Object.fromEntries(['PROTOCOL.md', 'types/_base.md', 'types/task.md'].map(p => [p, bytes(read(p))]));
    const sum = (v: Record<string, number>) => Object.values(v).reduce((a, b) => a + b, 0);
    const optional = /^## Whitespace case\n[\s\S]*?(?=^## )/m.exec(read(investigation))![0];
    assert.match(optional, /trim whitespace/);
    const rawStartupBytes = sum(baseline) + sum(mandatory);
    // Conservative transport model counts the entire packet, flight and full rules;
    // duplicate task/checkpoint rechecks are reported rather than silently deduped.
    const packetStartupBytes = current.bytes + baseline[`${flight}.md`]! + sum(mandatory);
    const recheckBytes = baseline[`${ref}.md`]! + baseline[cp]!;
    const plannedStartupBytes = packetStartupBytes + recheckBytes;
    const startupAllowance = Math.ceil(plannedStartupBytes * 1.15 / 4096) * 4096;
    const workingReserve = 24576; // proposed: 8 KiB execution + 8 KiB results + 8 KiB checkpoint
    const knownSourceEnvelope = startupAllowance + workingReserve;
    const expansion = (loaded: number, addition: number) =>
      loaded + addition <= knownSourceEnvelope - workingReserve ? 'read' : 'checkpoint/split';
    assert.equal(expansion(plannedStartupBytes, bytes(optional)), 'read');
    const expansionBytes = startupAllowance - plannedStartupBytes + 1;
    assert.equal(expansion(plannedStartupBytes, expansionBytes), 'checkpoint/split');
    assert.equal(expansion(startupAllowance, 1), 'checkpoint/split');
    assert.equal(expansion(startupAllowance, 0), 'read');

    for (const p of [...Object.keys(baseline), investigation, `${flight}/plan.md`, `${flight}/design.md`, `${ref}/ticket.md`, `${ref}/pr.md`, 'tasks/release-search-2026q3.md']) artifacts[p] = read(p);
    artifacts['packet.md'] = current.packet;
    artifacts['optional-read.md'] = optional;
    const history = read(cp).replace('<!-- arbiter:checkpoint', `## Optional history\n\n${'Historical synthetic discussion Ω.\n'.repeat(6000)}\n<!-- arbiter:checkpoint`);
    write(checkpointHistoryPath(ref, `sha256:${sha256(history)}`), history);
    assert.equal(exportHandoff(dir, current), current.packet);
    const beforeHistory = read(`${flight}/design.md`);
    write(`${flight}/design.md`, beforeHistory.replace('<!-- arbiter:', `${'Further historical detail.\n'.repeat(4000)}\n<!-- arbiter:`));
    assert.throws(() => exportHandoff(dir, current), /stale/);
    const grown = previewHandoff(dir, request);
    assert.equal(grown.packet, current.packet);
    assert.equal(exportHandoff(dir, grown), current.packet);
    assert.equal(sum(Object.fromEntries(Object.keys(baseline).map(p => [p, bytes(read(p))]))), sum(baseline));
    assert.ok(read(`${flight}/design.md`).includes(beforeHistory.split('<!-- arbiter:')[0]!));

    const oldFlight = read(`${flight}.md`);
    write(`${flight}.md`, oldFlight.replace('- [x] Decide', '- [ ] Decide'));
    assert.throws(() => exportHandoff(dir, grown), /stale/);
    assert.equal(eligibility(), false);
    const stale = previewHandoff(dir, request);
    assert.equal(stale.assessment.readiness, 'review-required');
    assert.match(stale.assessment.reasons.join('\n'), /stale revision/);
    artifacts['stale-packet.md'] = exportHandoff(dir, stale);
    // Restore only our own disposable fixture bytes for the independent next probe.
    write(`${flight}.md`, oldFlight);
    const oldTask = read(`${ref}.md`);
    write(`${ref}.md`, oldTask.replace('owner: synthetic-session', 'owner: another-session'));
    assert.equal(eligibility(), false);
    write(`${ref}.md`, oldTask);

    const priorInput = previewHandoff(dir, request);
    const note = captureQuickNote(dir, ref, 'PENDING-INPUT: whitespace must return no results; present this correction at review.', inputReviewView(dir, ref).basis, 'synthetic-session', { personal: false });
    assert.throws(() => exportHandoff(dir, priorInput), /stale/);
    const pending = previewHandoff(dir, request);
    assert.equal(pending.assessment.readiness, 'review-required');
    assert.equal(eligibility(), false);
    assert.match(pending.packet, /PENDING-INPUT/);
    // Larger pending packet may require its own explicit reviewed budget.
    const pendingRequest = pending.allowed ? request : { ...request, override: { maxBytes: Math.ceil((pending.bytes + 512) / 1024) * 1024, reason: 'Present all synthetic actionable input without truncation for review.' } };
    const presented = previewHandoff(dir, pendingRequest);
    artifacts['pending-input-packet.md'] = exportHandoff(dir, presented);
    assert.equal(inputReviewView(dir, ref).pending.length, 1, 'export acknowledges nothing');
    const notePath = `${note.source}.md`;
    const noteBefore = read(notePath);
    write(notePath, noteBefore.replace('PENDING-INPUT:', 'CHANGED-INPUT:'));
    assert.throws(() => exportHandoff(dir, presented), /stale/);
    assert.match(previewHandoff(dir, pendingRequest).packet, /CHANGED-INPUT/);
    write(notePath, read(notePath).replace('<!-- arbiter:', `${'Required correction Ω.\n'.repeat(4000)}\n<!-- arbiter:`));
    const oversized = previewHandoff(dir, pendingRequest);
    assert.equal(oversized.allowed, false);
    assert.ok(oversized.packet.includes('Required correction Ω.\n'.repeat(4000)));
    assert.throws(() => exportHandoff(dir, oversized), /budget/);
    assert.equal(expansion(plannedStartupBytes, bytes(read(notePath))), 'checkpoint/split');

    // Exercise the stop as an actual replacement checkpoint, retaining current bytes.
    const stopDraft = draftCheckpoint(dir, ref, at).replace('readiness: ready', 'readiness: waiting')
      .replace('## Next actions\n', '## Next actions\n\nSTOP: required input exceeds the reviewed export and startup allowance. Split the\nreview into an authorized bounded task or recalibrate with measured host capacity.\nDo not implement or omit pending input; no successor is launched.\n');
    captureCheckpoint(dir, previewHandoff(dir, { ref, checkpoint: stopDraft }));
    assert.equal(read(checkpointHistoryPath(ref, `sha256:${sha256(current.checkpoint)}`)), current.checkpoint);
    assert.match(read(cp), /STOP: required input/);
    assert.equal(inputReviewView(dir, ref).pending.length, 1);
    artifacts['stop-checkpoint.md'] = read(cp);
    const files = walkCorpus(dir);
    const validation = validateCorpus(dir, files, SchemaSet.fromFiles(files));
    assert.deepEqual(validation.errors, []);
    // Check synthetic local links/anchors from all authored normal sources.
    let linksChecked = 0;
    for (const [p, text] of Object.entries(artifacts).filter(([p]) => p.startsWith('tasks/'))) {
      for (const match of text.matchAll(/\[[^\]\n]*\]\(([^)]+)\)/g)) {
        const [target, anchor] = match[1]!.split('#');
        const body = read(target!);
        if (anchor?.startsWith('^')) assert.ok(body.includes(`<!-- ${anchor} -->`), `${p}: ${match[1]}`);
        else if (anchor) assert.ok(body.split('\n').some(line => line.replace(/^#+ /, '').toLowerCase().replace(/[^\w -]/g, '').replaceAll(' ', '-') === anchor), `${p}: ${match[1]}`);
        linksChecked++;
      }
    }
    const report = { experiment: 'synthetic flight continuation; no agent execution or live adoption',
      packet: { ordinaryBytes: first.bytes, ordinaryAllowed: first.allowed, targetBytes: 6144, ceilingBytes: 10240, emittedBytes: current.bytes, override: current.request.override ?? null },
      reads: { baseline, mandatory, rawStartupBytes, packetStartupBytes, duplicateRecheckBytes: recheckBytes, plannedStartupBytes,
        additional: { source: investigation + '#whitespace-case', question: 'Does whitespace count as empty?', bytes: bytes(optional) },
        unnecessaryAuthoredReads: 0, limitation: 'Planned receiver reads; harness scans are not a measured agent trace.' },
      budgetProposal: { unit: 'UTF-8 source bytes, not tokens or host capacity', startupAllowance, basis: 'measured packet route plus fresh task/checkpoint reads; 15% headroom rounded to 4 KiB',
        workingReserve, reserveBasis: 'provisional 8 KiB each for execution, results/verification, outgoing checkpoint', knownSourceEnvelope,
        stopProbeAdditionalBytes: expansionBytes, expansionResult: 'checkpoint/split', actualHostOverhead: null, actualUsableContext: null, realSessionAdmitted: false },
      history: { checkpointGrowthBytes: bytes(history), detailGrowthBytes: bytes(read(`${flight}/design.md`)) - bytes(beforeHistory), unchangedPacket: true, unchangedBaseline: true, detailGrowthRequiresRepreview: true },
      pending: { emittedBytes: presented.bytes, override: presented.request.override ?? null, oversizedBytes: oversized.bytes, pendingAfterExportAndCheckpoint: 1 },
      validation: { files: files.length, errors: validation.errors.length, warnings: validation.warnings }, linksChecked,
      checks: ['next eligible task and blocked release', 'essential predecessor directive carried', 'exact current exporter bytes', 'one justified optional section', 'history independent packet and baseline', 'same-timestamp dependency and owner changes stop execution', 'new and changed pending input presented', 'export acknowledges nothing', 'oversized input refused without truncation', 'reserve boundary stops and checkpoints', 'prior checkpoint preserved exactly', 'links and anchors resolve'],
      gaps: ['No runtime scheduler: eligibility requires receiver judgment and rechecks.', 'Whole-corpus preview basis stales on ordinary detail growth although refreshed packet is identical.', 'Exporter expands whole selected files; selected-section reads are a receiver operation.', 'Parsed artifact and Evidence links support checklist anchors, not Markdown heading fragments; use file links with section labels there.', 'No runtime startup/reserve controller or host capacity measurement; this byte policy is a harness proposal.', 'Planning exports may be review-required; successful export is not execution permission.'],
      sourceRevisions: Object.fromEntries([...Object.keys(baseline), ...Object.keys(mandatory), investigation].map(p => [p, sha256(artifacts[p] ?? read(p))])),
    };
    if (output) {
      fs.mkdirSync(output, { recursive: true });
      for (const [p, s] of Object.entries(artifacts)) { const dest = path.join(output, p); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, s); }
      fs.writeFileSync(path.join(output, 'measurements.json'), JSON.stringify(report, null, 2) + '\n');
    }
    return report;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv.length > 3) throw new Error('Usage: node --import tsx scripts/evaluate-flight-continuation.ts [new-synthetic-artifact-directory]');
  process.stdout.write(JSON.stringify(evaluateFlightContinuation(process.argv[2]), null, 2) + '\n');
}
