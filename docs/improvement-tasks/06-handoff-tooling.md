# T06: Capture, preview, copy and export handoffs

Status: complete. Start gate: verified 2026-09-08; T02–T05 interfaces preserved.
Traceability: Feedback 8, 9, 11, 12; human handoff management.
Owner: completed by T06 session. Checkpoint captured: 2026-09-08 (verified completion).

## Outcome

A person can update a compact checkpoint and inject the exact reviewed packet into a new agent session.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- docs/task-handoffs.md; docs/templates/task-handoff.md; docs/v0.4.11-checkpoints.md; docs/grammar.md §15; assets/contract/PROTOCOL.md#checkpoints
- src/core/checkpoint.ts; test/checkpoints.test.ts
- src/cli/main.ts; src/web/server.ts; T02 commit API; T03 visibility API
- T04 source locations and lossless extraction behavior

## Task checklist

- [x] Implement structured checkpoint capture through the shared commit path, with draft/preview and current-version selection.
- [x] Implement bounded Markdown and JSON handoff exports with included-source manifest, byte count, source revisions and readiness.
- [x] Add editable checkpoint fields, next action, owner and dependency status to the human task view.
- [x] Provide Copy handoff and file export using the exact previewed revision; detect intervening changes instead of copying a different packet silently.
- [x] Provide actionable row/Summary/packet-size diagnostics and previewed extraction into linked history.
- [x] Carry essential constraints directly; optional sources require explicit expansion. Never require previous handoffs to supply missing rules.
- [x] Detect stale task/decision/dependency inputs. Offline export names snapshot limitations and portable workspace mapping.
- [x] Keep credentials and excluded private material out of export. A task assignment is not new authority to publish or send messages.

## Completion evidence

- [x] A human edits, previews and copies a packet; clipboard/export bytes match the preview.
- [x] Concurrent capture cannot discard a checkpoint; stale previews trigger refresh.
- [x] Large history does not increase a normal export, and over-budget export never silently truncates.
- [x] A different machine can resolve the assignment without relying on the originating machine's absolute paths.

## Current handoff

T06 is complete. [Evidence](../handoffs/completed/t06.md) records files, acceptance
exercises and limits; [tooling decision/workflow](../v0.4.12-handoff-tooling.md)
describes the shared request/preview API, CLI and task editor. Main remains at
`4a5e0979ec078cf492df3050b6fdc46196727093`; all T01–T06 work is uncommitted.

Verified: full suite 89/89, focused handoff suite 12/12 after the final preview
before/after field, build, skill validation and diff checks. Source validation:
frozen corpus 26/0/0 and fixtures 23/0/1 existing raw warning; all 50 file hashes
unchanged. The HTTP exercise executes the actual task-view JavaScript with simulated
DOM/clipboard/download sinks and compares exact bytes; no manual browser claim.

Capture revalidates under the shared lock and separately journals extraction
history, task metadata and checkpoint. Partial capture may retain updated task
metadata with an old/missing checkpoint; refresh/re-observe and retry. Optional
source expansion is explicit. Offline packets carry full installed rules and
selected KB context, usually needing a visible larger budget; they remain planning
snapshots until live rechecks. Privacy recognition covers known tokens and common
credential syntax, not arbitrary paraphrases. Do not treat snapshot observations as
current external state or new authority.

Bootstrap protocol/base 0.4.12; concrete schemas 0.4. Older versions remain accepted;
installed KBs are untouched. CLI/profiles and both conformance corpora are preserved.
The live sibling remains absent and ARBITER_DATA selects the frozen repository
corpus; no dogfood capture was performed. A user-supplied comparison snapshot
uses unsupported protocol 0.4.7; it was inspected read-only (see completion evidence). No Finance Hub/USB/transcript edits,
commit, push, publication or external message occurred.

The only next assignment is T07; its [current packet](../handoffs/next-task.md)
starts with the shared bounded query/result contract. Do not begin T07 in this
session. Keep capture/copy/export source and byte checks intact during UI work.

## Capture before handing off

- [x] Replace Current handoff with verified state, exact next action and remaining gate.
- [x] Link the tested revision, checks performed and material limitations.
- [x] Preserve still-applicable constraints; move detailed logs into linked history.
- [x] Update this packet and the [execution index](../improvement-plan.md).
- [x] Use the [handoff template](../templates/task-handoff.md) for a fresh session.
