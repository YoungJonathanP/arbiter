# T05: Bounded task and checkpoint contract

Status: complete. Start gate: Complete; verified 2026-09-07.
Traceability: Feedback 8–13; large-task handoff request.
Owner: Codex T05 session. Checkpoint captured: 2026-09-07 (verified).

## Outcome

One independently assignable task has one current, bounded handoff a fresh agent can use without older session context.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- docs/task-handoffs.md; docs/templates/task-handoff.md
- docs/v0.4.7-checklist-progressive-disclosure.md; docs/v0.4.6-task-nesting.md
- docs/grammar.md; src/core/model.ts; src/core/schema.ts; type schema conventions

## Task checklist

- [x] Define task versus coordinator versus detail-document boundaries; phase grouping is independent of ownership and blocking dependencies.
- [x] Specify a current-checkpoint file role, stable pointer, history/replacement lifecycle and portable repository/KB identity.
- [x] Specify outcome, owner, authority boundary, verified state, next action, start predicates, constraints, input revisions and evidence.
- [x] Define separate checkpoint readiness and execution status. Stale input revisions or conflicting decisions require review, not automatic latest-timestamp selection.
- [x] Adopt initial size targets from the design with warnings and deliberate export override; budget total emitted context.
- [x] Give plan inputs an optional visible section before Checklist; keep produced artifacts and row-level identifiers accessible.
- [x] Publish task/goal scope guidance and explicit handling of rows that need detail versus independently assignable child tasks.
- [x] Version the normative contract with a decision note; provide a canonical bootstrap source independent of frozen corpora.
- [x] Update operating guidance through its applicable skill-editing workflow after the contract settles; include compact protocol bootstrapping without recursive history reads.

## Completion evidence

- [x] A synthetic task can be handed to another session with its assignment and essential constraints intact.
- [x] A current checkpoint can be replaced without violating the historical-detail append-only rule.
- [x] A stale dependency, unresolved contradiction and unknown owner are visible before implementation starts.
- [x] All new file roles round-trip and validate; old corpora remain valid or have an explicit migration path.

## Current handoff

T05 complete at HEAD `4a5e0979ec078cf492df3050b6fdc46196727093`, main, with
T01–T05 uncommitted. [Completion evidence](../handoffs/completed/t05.md) records
77/77 tests, build, skill validation and unchanged frozen corpora. The
[decision](../v0.4.11-checkpoints.md) and [grammar §15](../grammar.md#15-current-task-checkpoints-v0411)
define the implemented contract; bootstrap protocol/base are 0.4.11.

Current path: `tasks/<id>/checkpoint.md`, linked by task `checkpoint`; exact prior
bytes: `tasks/<id>/checkpoints/<sha256-hex>.md`. Generic commit requires explicit
CAS, correct `previous` and no owning proposals, and retains old bytes before
replacement. History is immutable and omitted from default projections. Existing
ordinary detail stays append-only. Explicit installed upgrade is required.

`assessCheckpoint` exposes required-input checks, typed inputs/predicates, reasons
and effective readiness without changing task status/review. Callers supply observed
repo/external revisions; unavailable observations require review. Whole-KB validation
checks historical digests/previous links; normal assessment does not traverse them.
`contextBudget` measures full emitted bytes and explicit larger maximum/reason;
T06 must wire it to the exact preview/export and enforce visibility/readiness.

T06 is now ready and assigned by the [chaining handoff](../handoffs/next-task.md).
No capture/export commands or editable UI have been implemented. T06 must settle
those shapes, recheck selected source revisions within its capture boundary, handle
task-plus-checkpoint creation without assuming a multi-file transaction, and bind
copy/export to previewed bytes. T02–T04 CAS, staging, lossless rows and visibility
interfaces remain intact. The live sibling KB is still absent; no frozen capture.

## Capture before handing off

- [x] Replace Current handoff with verified state, exact next action and remaining gate.
- [x] Link the tested revision, checks performed and material limitations.
- [x] Preserve still-applicable constraints; move detailed logs into linked history.
- [x] Update this packet and the [execution index](../improvement-plan.md).
- [x] Use the [handoff template](../templates/task-handoff.md) for a fresh session.
