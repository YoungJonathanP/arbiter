# Task handoffs and continuation checkpoints

Design adopted by T05, 2026-09-07. The normative storage/metadata contract is
[grammar §15](grammar.md#15-current-task-checkpoints-v0411) and the bootstrap
[protocol](../assets/contract/PROTOCOL.md#checkpoints); see the
[decision](v0.4.11-checkpoints.md). T05 implements file roles, validation and generic
write lifecycle. Capture/preview/export UX is implemented in [T06 tooling](v0.4.12-handoff-tooling.md). Installed KBs
require explicit adoption; this document alone never authorizes their mutation.

## Product contract

A human selects one task, reviews its current checkpoint, and copies a bounded
handoff into a new agent session. That agent can state the outcome, next action,
dependencies, constraints and completion evidence without reconstructing earlier
sessions. The handoff carries a work assignment; it does not confer new authority
to publish, merge, send messages, or change external systems.

Project overview -> independently assignable task -> current checkpoint -> selected
reference or historical section. A checkpoint is the current continuation view,
not another ever-growing chronological document.

The task holds durable identity, scope, relationships and lifecycle. Its checkpoint
holds volatile execution state: what is verified, where work stopped, and what to
do next. Generate repeated identity/status/link fields from their canonical sources.
Author only the short continuation judgment that cannot be derived safely.

The [2026-09-14 product clarification](progressive-disclosure-handoffs.md) makes
progressive disclosure the continuation criterion. For larger work, a flight is a
manageable group represented with existing goal/parent-task links: inspect its
summary/checklist, the next eligible task, then that task's current T3 handoff.
A direct task URL/path starts at the task; load its parent or larger plan only as
needed for alignment. Each checklist step retains its description, status and
relevant task/handoff pointer. Order does not override blockers or assignment.

The handoff carries essential decisions, rationale, constraints and completion
criteria so that investigations and previous handoffs need not be read by default.
Keep specific, labelled pointers to those sources, tickets, PRs and the larger
plan for questions that arise. Carry a preceding task's next-task directive into
the receiving task's current handoff; do not create a recursive history dependency.
Required linked-input review and operating rules remain mandatory.

## Assignment boundaries

- Group by an independently reviewable outcome and the code or artifact boundary.
- Use an owning project/goal plus optional phase labels and explicit dependency
  edges. Phase order is not automatically a blocking dependency.
- A coordinator selects work and maintains shared decisions. It does not carry
  every implementation log or automatically instruct an agent to take over
  another person's work.
- A document becomes a task only when producing or maintaining it is an actual
  deliverable with completion criteria.
- A long task can have several sequential checkpoints without gaining new task IDs.
- Split a task when outcomes can be assigned, verified and completed independently.
  Combine external tickets in one packet when their implementation cannot be
  separated cleanly. Preserve every original ticket link and anchor.
- A task has one accountable owner; optional session claims and dependency gates
  are distinct from status. Concurrent claim attempts use the shared commit path.

## Current checkpoint content

Use [the template](templates/task-handoff.md). Required content:

1. Task and project identity; bounded assignment and explicit scope exclusions.
2. Workspace/repository identity, portable path resolution and revision/branch
   observations when relevant. Never assume another machine's absolute paths work.
3. Current execution state, readiness, last verification time and source revision.
4. Short immutable constraints/decisions needed for this assignment, with provenance.
5. Start gates expressed as predicates with evidence and responsible owner.
6. The next 1–3 actions, each concrete enough to begin, and the stopping condition.
7. Completion criteria and what evidence will demonstrate them.
8. A small explicit reading list: source, relevant section, and reason to open it.
9. Open questions that materially affect this assignment.
10. A capture checklist for the outgoing session.

Separate observed facts, user decisions, proposed choices and unknowns. A newer
timestamp alone does not resolve contradictory instructions. Mark unresolved
contradictions as review-required and identify the exact choice.

Historical handoffs are references, never a mandatory recursive reading chain.
Carry forward applicable constraints into the current checkpoint with citations.
Replace outdated next actions; preserve prior versions as history. Superseded
does not mean completed.

## Adopted initial size policy

Initial design defaults adopted in 0.4.11, still to evaluate on real work; not
measured universal token limits:

| Surface | Target | Behavior when exceeded |
|---|---|---|
| Project overview | 4 KiB UTF-8 | Warn; show bounded task groups with counts and paging |
| Task Summary | 1 KiB UTF-8 | Warn with section location; suggest detail extraction |
| Checklist row | 400 Unicode code points | Warn with anchor; preserve identifiers and essential rules |
| Current handoff including exported context | 6 KiB UTF-8 | Warn; offer a scoped split or explicit larger budget |
| Normal handoff export ceiling | 10 KiB UTF-8 | Refuse ordinary export; allow a deliberate recorded override |

Bytes are a deterministic storage/output measure, not an exact token count. If a
token estimate is displayed, label its method. Budget includes inlined constraints,
references, protocol excerpts and metadata, not just the author's prose.

Never silently truncate a constraint, gate or next action. Oversized packets remain
editable and readable; only the normal export operation is gated. Humans may choose
a larger budget with a visible reason. Test defaults on real work before hardening.

These limits apply to the complete emitted handoff packet, not cumulative session
context or subsequent relevant working reads. Session loading has a separate
task-scoped startup allowance and working reserve; calibrate numeric values to the
receiving client. Optional pointers are not a background loading list. Bound later
expansions and narrow/split/checkpoint before consuming room needed to finish.
Report packet bytes, task/source reads and available host overhead separately.
Unknown host overhead remains
unknown; it does not turn a measured packet into an unmeasured export. Count full
protocol content when it is inlined, and retain installed mandatory-read duties
when it is not. The [T09 decision](progressive-disclosure-handoffs.md#budget-scope-and-conflict-resolution)
explicitly supersedes the proposed cumulative session gate.

## Capture and export lifecycle

1. Capture current work into a draft checkpoint: verified result, next action,
   relevant constraints, gates, exact evidence and source revisions.
2. Preview the diff from the current checkpoint. The human can edit the same small
   form; agents can supply structured fields through a command.
3. Validate required fields, links, visibility, size and unresolved contradictions.
   Use the shared commit path to save a new version and advance the current pointer.
4. The task/board shows checkpoint readiness, owner, next action and age. Readiness
   is separate from execution status: unprepared, ready, waiting, review-required.
5. Copy or export the exact previewed bytes. Show included sources, byte count,
   last verified time, and omitted optional material.
6. The receiving session checks the task/checkpoint revision and live start gates
   before mutation. It resumes only this assignment.
7. On completion or pause, save the replacement checkpoint and evidence; the old
   version becomes history. Handoff history does not enter normal bootstrap reads.

Implemented commands: `arbiter checkpoint <ref>` emits a draft; `--file` previews
a JSON draft request and `--capture` saves a reviewed preview. `arbiter handoff
<ref> --format markdown|json` previews the current version; `--export` emits its
exact reviewed packet. The local task editor offers the same lifecycle. See the
[tooling workflow and limits](v0.4.12-handoff-tooling.md).

## Freshness and portability

Track hashes/revisions of the task and selected decision/dependency inputs at
checkpoint capture. Relevant changes mark the checkpoint stale. Rechecking a
source or dependency is a targeted operation, not a reason to inline its history.
Do not recursively hash/include all descendants; define the explicit input set.

External evidence records its URL and last observed revision/time. An offline USB
snapshot cannot establish current PR, ticket, branch or approval state. Offline
exports must label that limitation and give the receiving session a recheck step.

A portable packet resolves a logical KB and repository identity to local paths.
With the KB available, bootstrapping follows its protocol once and then selected
inputs. Without it, export the applicable operational instructions and essential
context within the stated budget, mark missing capabilities, and state whether
the packet supports implementation or only planning. Do not instruct blind writes
from an offline packet. No credentials or unrelated private records are exported.

## Preservation and compatibility

Keep Markdown canonical. The task field `checkpoint` names `tasks/<id>/checkpoint.md`; exact prior bytes
live in `tasks/<id>/checkpoints/<sha256-hex>.md`. The current file is a distinct
replaceable role; history is immutable and excluded from normal projections.
The shared commit boundary archives before replacement under its local lock,
requires CAS and correct `previous`, and refuses owning-task staging. See grammar
§15 for required fields and migration. Manual packets stay ordinary documents
until explicitly imported; no installed KB changes are implicit.

The tier-3 append-only rule remains for historical evidence. Protocol 0.4.11
defines the checkpoint role as the explicit replacement exception. The writer
refuses to repurpose a legacy detail file at the reserved path; migrate its bytes
and compatibility links explicitly before adoption.

Moving history out of Summary must preserve its bytes and original anchors through
resolving compatibility links. Keep durable PR/ticket links at the row and detail
levels when useful. Avoid multiplying authoritative copies of status or decisions.

## Acceptance exercises

- A session resumes one task without reading an older checkpoint or sibling body.
- An old packet detects a changed dependency before implementation.
- Two sessions capturing the same task do not overwrite either checkpoint silently.
- A person edits a checkpoint and copies exactly the previewed bytes.
- A copied packet remains intelligible on another machine with different paths.
- A large history can grow without increasing normal continuation context.
- An unresolved contradiction or missing permission is visible before export/use.
- Private sources do not leak through text, titles, counts or automatic expansion.
