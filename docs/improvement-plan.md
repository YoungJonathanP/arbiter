# Arbiter improvement checklist

Status: T01–T06 complete; T07 next and ready, 2026-09-08. This is the execution index for the architecture
review and the requested task handoffs. The checkboxes below track implementation,
not agreement with the recommendations. No runtime behavior or protocol changed
when this plan was written.

Objective: capture work and durable knowledge, let a fresh agent continue one
bounded assignment with relevant context, give humans inspectable navigation and
handoffs, and produce evidence-backed impact reports.

## Pick one task

For a fresh implementation session, open the
[current chaining handoff](handoffs/next-task.md). It now assigns T07 and requires
the completing agent to prepare the next ready task's packet at that same path.
Completed evidence stays in optional history; each new agent gets one current
assignment without reading the preceding sessions.

Each linked packet is a separate assignment written for an agent with no previous
session context. Read the selected packet first; it names its required inputs.
Do not load every packet or the entire feedback backlog to start one task.

| Task | Outcome | Start gate | Feedback |
|---|---|---|---|
| [T01](improvement-tasks/01-cli-contract.md) | Honest CLI inputs and KB selection | Complete; [evidence](handoffs/completed/t01.md) | 1, 6, 7, 17 |
| [T02](improvement-tasks/02-safe-writes.md) | Recoverable, verified writes and arbitration | Complete; [evidence](handoffs/completed/t02.md) | 2, 4; foundation for 3 |
| [T03](improvement-tasks/03-derived-state.md) | Fresh, visibility-aware projections | Complete; [evidence](handoffs/completed/t03.md) | 3; new review findings |
| [T04](improvement-tasks/04-parser-recovery.md) | Useful navigation despite malformed lines | Complete; [evidence](handoffs/completed/t04.md) | 5 |
| [T05](improvement-tasks/05-handoff-contract.md) | Bounded task and checkpoint contract | Complete; [evidence](handoffs/completed/t05.md) | 8–13; new handoff request |
| [T06](improvement-tasks/06-handoff-tooling.md) | Capture, preview, copy and export a handoff | Complete; [evidence](handoffs/completed/t06.md) | 8, 9, 11, 12 |
| [T07](improvement-tasks/07-discovery-navigation.md) | Search and consistent human/agent navigation | Ready; T03–T06 settled | 14–16; discovery gaps |
| [T08](improvement-tasks/08-knowledge-evidence.md) | Discoverable knowledge and useful impact reports | T03, T04; coordinate registry with T07 | Original attestation objective |
| [T09](improvement-tasks/09-migration-evaluation.md) | Safe large-project migration and continuation evaluation | Analysis ready; migration after T05–T07 | New handoff request; integration |

## Implementation checklist

- [x] T01: CLI inputs, date semantics and data-directory diagnostics are trustworthy.
- [x] T02: Every acknowledged op has a verified effect or durable explicit disposition.
- [x] T03: Current files determine current views; private content is excluded by policy.
- [x] T04: Valid entries stay navigable beside malformed text; diagnostics locate errors.
- [x] T05: One bounded current checkpoint per task, with explicit dependencies and provenance.
- [x] T06: A human can capture, inspect and copy the exact next-session handoff.
- [ ] T07: A user can find relevant active or archived work without reading sibling histories.
- [ ] T08: Durable findings and evidence survive task closure and support useful reports.
- [ ] T09: A representative large project passes migration and fresh-session exercises.

Recommended delivery order: fix T01–T04, settle T05 early, then ship T06 and T07.
T08 restores the original attestation deliverable. T09 supplies migration evidence
and a release gate throughout; its analysis can begin immediately.

## Handoff design

[Design and lifecycle](task-handoffs.md) records the adopted T05 contract and
implemented T06 product work. The [authoring template](templates/task-handoff.md)
uses the validated 0.4.11 checkpoint file role. Capture/export commands and task UI
are implemented; see the [workflow and limits](v0.4.12-handoff-tooling.md). Installed KBs require explicit contract adoption.

Separate project coordination, executable tasks, and historical documents.
Each executable task has one bounded outcome, one current owner or unassigned
state, a start gate, a current checkpoint, and verifiable completion criteria.
Several external tickets can belong to one assignment when they share a change
boundary. A phase or document name alone does not establish an assignment.

## Review evidence and boundaries

The 2026-09-06 review ran all 29 tests successfully and validated both bundled
corpora. Isolated probes nevertheless reproduced an unapplied Detail docs append
reported as applied, same-minute stale dashboard status, private-record dashboard
inclusion, section-wide artifact fallback, and missing-directory validation success.
These are regression targets, not claims that the existing suite failed.

The [trial feedback](v0.5-trial-feedback-backlog.md) remains the detailed historical
brief. Use its stable item IDs in commits and acceptance evidence. The handoff
proposal supersedes the suggestion to manufacture a child task for every long row:
choose a task for an independent deliverable, a document for explanatory detail.

The external large-project example was inspected read-only. Its identifying data,
source paths, measurements and example packet are in a separate local review outside
this repository. Shared regression fixtures must be synthetic.

The current shell points ARBITER_DATA at the frozen in-repo corpus; the live sibling
KB is absent. A user-supplied comparison snapshot was found during T06; its
protocol 0.4.7 is unsupported and it was not migrated/adopted (see T06 evidence). Do not capture here by relying on the environment fallback. Planning
is recorded in these documents; mirroring lifecycle marks awaits an explicitly
selected live KB. Never modify either conformance corpus to track implementation.

## Completing a packet

Update only the selected packet and this index, record validation evidence, and
leave a short current checkpoint for any unfinished work. Do not append a session
transcript to the task. Keep old rationale in linked details or history. A checked
box requires completed behavior and evidence, not a drafted design.
