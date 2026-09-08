# Next agent: T06, then handoff

Task: [T06](../../improvement-tasks/06-handoff-tooling.md). Ready; unassigned.
2026-09-07. YoungJonathanP/arbiter; main;
HEAD 4a5e0979ec078cf492df3050b6fdc46196727093.

## Start/inputs

Complete T06 only; prepare its successor. Check instructions/branch/HEAD/worktree,
CLAUDE.md/T06. First settle shared capture/preview/export shapes; bind copy/export
to preview bytes. No capture/export UX exists.
Read T06's inputs, grammar §15, docs/v0.4.11-checkpoints.md, bootstrap #checkpoints,
src/core/checkpoint.ts and test/checkpoints.test.ts. Use skill-creator for operating
skill edits. No Finance Hub/USB/transcript/installed-KB edits.

Preserve uncommitted T01–T05. Tests 77/77, build/diff/skill pass. Source validate: arbiter-data 26/0/0; fixtures 23/0/1 existing raw warning
(files/errors/warnings). Frozen hashes unchanged. [Evidence](t05.md).

## Interfaces

- args.ts owns help/schemas; invalid exit 2. Hash sha256:<hex>; write accepts
  prefixed/bare hex/new; CAS expected/actual, exit 3. data.ts guards frozen/identity/init. --data > ARBITER_DATA > cwd; selection stderr, data stdout.
  Init: explicit --data, missing/empty KB, unique kb-id UUID; protocol/base 0.4.11;
  concrete 0.4; legacy 0.4.6/8/9/10 accepted. new --date sets event/ID date;
  capture time uses --now. Validate whole KB.
- commitFile: write/new/regen/normalize/triage/arbitrateFile; stageProposal shares
  SQLite lock. Preserve CAS/atomic rename/sticky staging/parsed postconditions.
  .arbiter/transactions/*.json: canonical snapshots/intent/digests/verdicts/replay;
  back up, never delete as cache or expose in raw/export. recover resumes; --dry-run
  inspects; conflicts retain snapshots. No external-editor/network-FS/multi-item
  guarantee. Arbitration preserves Summary; unsupported ops stay staged whole.
  Object refs/owning bare IDs work; replay idempotent, changed old IDs
  stay staged; pure arbitration uses input time.
- readProjection: visible files/facts and observed-byte digest. Regen/dashboard use
  current facts, not time; digest excludes dashboard; caller day drives age-off.
  Reads are not atomic. Private items/docs/owned files excluded before edges/counts;
  previews remove known private IDs/titles, not paraphrased secrets. Unverifiable
  carried entries/strays omitted; regen journals retain old bytes.
- Sticky review needed|legacy-unknown differs from status/blockers/readiness. Legacy
  needs-review has unknown prior status; never infer todo. Invalid/terminal/archived/
  private/missing parents retain reachable children. Sections: arrays + rawRows
  indices/opaque/blanks; orderedRows for edits/appends, reindex removals/reorders.
  rawLine is 1-based; sourceLines maps filtered lines. Reparse writes. Malformed
  lines end continuation attachment; blanks do not. Annotations inside labels/titles
  or before anchors; opaque text cannot satisfy ops.

## Checkpoints (T05)

Task checkpoint: tasks/<id>/checkpoint.md; task owns owner, phase only groups.
History: tasks/<id>/checkpoints/<hash>.md. Writes require CAS, matching
previous (none initially), role/task and no owning proposals; archive under lock
before journal/install. History immutable, excluded from projections/raw HTTP;
retain extra failed-capture snapshots. Detail stays append-only; normalization
leaves checkpoints/history unchanged; legacy detail cannot be repurposed.

assessCheckpoint returns inputs/predicates/errors/reasons/readiness. Required inputs:
task/protocol/base/task-schema plus selected decisions/dependencies/code. Caller
supplies repo/external observations. Missing/stale inputs, unknown owner/workspace/
gates, conflicts or task review/staging prevent ready; no timestamp precedence.
Assessment skips history; whole-KB validation checks it; filtered validation:
{ verifyHistory: false }. Reject packets whose redaction removes essential rules.

Capture rechecks revisions; generic commit does not check all inputs or
atomically update task+checkpoint. Set task pointer before hashing it. contextBudget
measures COMPLETE emitted bytes: 6 KiB target, 10 KiB ceiling, explicit larger
maxBytes/reason recorded IN preview. Count manifest/protocol/inlined material;
no truncation/history expansion. Plan inputs precedes Checklist; retain Artifacts/IDs.

## Gates

- [ ] Capture/edit/preview through shared writer; contention preserves checkpoints.
- [ ] Markdown/JSON and Copy match preview bytes; reject stale previews; include
  revisions/manifest/readiness/size/omissions. Preview extraction preserves rules/IDs.
- [ ] Portable/offline packets carry essential rules, limits/rechecks; exclude private
  material. Assignment grants no new authority.
- [ ] npm test, npm run build, git diff --check; source CLI validate both frozen
  corpora read-only with explicit --data; assert outcomes and unchanged hashes.

Only synthetic/temporary KBs. ARBITER_DATA selects frozen data; live ../arbiter-data
absent. Recheck; record unavailable capture if unchanged. Preserve CLI/profiles.
Ask before commit (CLAUDE.md); no push/publish/external messages without authority.
Localhost needs escalation (npm test approved); distinguish environment failures.

## Chain

1. Verify acceptance; mark task/index complete with evidence/limits.
2. Create completed/t06.md: outcome/files/tests/limits/decisions/HEAD/dirty state.
   Preserve this packet in unique history; never overwrite. History is optional.
3. Pick next ready incomplete task in docs/improvement-plan.md (default T07);
   recheck packet/code/gaps. Prepare only that successor.
4. Replace this file: first action/inputs/state/gates/constraints/acceptance and
   these instructions. Carry interfaces directly; <=6 KiB UTF-8.
5. Verify links/size/task/index agreement. Return a clickable link and prompt:
   "Open docs/handoffs/next-task.md in the Arbiter checkout.
   Complete its current assignment and, after verification, create the chaining
   handoff for a new agent exactly as instructed."
6. End; human starts next session. If incomplete retain task/progress/failed checks/
   blocker/next action; session end is not completion. If all done, no successor.
