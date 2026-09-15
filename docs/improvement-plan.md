# Arbiter improvement checklist

Status: T01–T08 complete; T01–T06 committed (`cd0e2a5`), T07–T08 included in the user-authorized repository save with partial T09 work ([save checkpoint](improvement-tasks/09-migration-evaluation.md#repository-save-2026-09-14)). T09: progressive-disclosure direction accepted 2026-09-14; cumulative-session budget gate superseded. Synthetic flight/task demonstration verified; one fresh receiver saved 13 passing assertions but hit a usage limit before capture. Full receiver acceptance/calibration and live reconciliation remain outstanding. Protocol/base 0.4.17, accomplishment 0.4.18 and original 71 source hashes are unchanged; 153 tests/typecheck/build now pass. This is the execution index for the architecture
review and the requested task handoffs. The checkboxes below track implementation,
not agreement with the recommendations. No runtime behavior or protocol changed
when this plan was written.

Objective: capture work and durable knowledge, let a fresh agent continue one
bounded assignment with relevant context, give humans inspectable navigation and
handoffs, and produce evidence-backed impact reports.

Agreement update 2026-09-10: the user explicitly agrees with connected-entity
visibility and Relevant sources/linked-input review. Prioritize a user-facing app
with structured status actions, linked human notes and agent review of newer tagged
input. See [app direction](user-app-direction.md) and the [tested candidate](app-review-candidate.md).
The pure model has twelve synthetic tests; thirteen additional storage/app tests
verify durable capture/review and shared local controls. Personal app integration,
installed adoption and remaining T09 acceptance are not marked complete.

## Pick one task

Gate-only review counter: **5 / 5; cap reached**, set after the user's
2026-09-14 cap request. The current handoff's stop rule supersedes instructions
below to repeat gate verification/capture when authority and evidence are unchanged.
Stop without checks, archive, rewrite or chaining prompt. New authority/evidence
unlocks only its relevant work; only the user may reset/increase the cap.

The [2026-09-14 fresh receiver evaluation](examples/flight-continuation/receiver-evaluation.md)
records 13 passing synthetic assertions before a usage-limit failure prevented
receiver capture. Parent reconciliation, capture and isolated probes pass; they
do not complete receiver acceptance. The one-shot launch grant is consumed.
Full receiver acceptance/calibration and live reconciliation remain gated. Fresh
153/153 tests/typecheck/build, explicit frozen validation and preservation pass.

For a fresh implementation session, open the
[current chaining handoff](handoffs/next-task.md). It assigns unfinished T09. T09 is the final task; on complete acceptance, replace
the current packet with completion/no-successor rather than inventing T10.
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
| [T07](improvement-tasks/07-discovery-navigation.md) | Search and consistent human/agent navigation | Complete; [evidence](handoffs/completed/t07.md) | 14–16; discovery gaps |
| [T08](improvement-tasks/08-knowledge-evidence.md) | Discoverable knowledge and useful impact reports | Complete; [evidence](handoffs/completed/t08.md) | Original attestation objective |
| [T09](improvement-tasks/09-migration-evaluation.md) | Safe large-project migration and continuation evaluation | Partial: [evidence](handoffs/completed/t09.md); one receiver interrupted after 13 passing assertions; full acceptance/calibration and live reconciliation gated | New handoff request; integration |

## Implementation checklist

- [x] T01: CLI inputs, date semantics and data-directory diagnostics are trustworthy.
- [x] T02: Every acknowledged op has a verified effect or durable explicit disposition.
- [x] T03: Current files determine current views; private content is excluded by policy.
- [x] T04: Valid entries stay navigable beside malformed text; diagnostics locate errors.
- [x] T05: One bounded current checkpoint per task, with explicit dependencies and provenance.
- [x] T06: A human can capture, inspect and copy the exact next-session handoff.
- [x] T07: A user can find relevant active or archived work without reading sibling histories.
- [x] T08: Durable findings and evidence survive task closure and support useful reports.
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

The shell selects the frozen corpus; always use explicit --data. User-confirmed
live KB identity is resolved, while protocol 0.4.7/base 0.4.6 remains unsupported.
On 2026-09-09 the user selected another project from existing notes for comparison,
authorized a current-KB copy with local tests/iterations, and requested individual
contract review plus deeper attention to question scope. Copy authorization and
case-study selection are settled; contract adoption remains under review.

Two private copies match all 730 live file hashes, including Git. Six local checks
cover exact copying, compatibility refusal, visible pagination, selected refs/anchors,
same-timestamp freshness and full-byte restoration. No live or installed contract
mutation occurred. The earlier dashboard proposal keeps five of 18 task-card entries;
the revised review now incorporates the user's app direction. Four scoped-answer examples distinguish
recorded-state answers from execution gates. These are not fresh-agent metrics.

The prior selected-link audit and seven-file candidate retain their limitations.
The 2026-09-11 protocol/grammar 0.4.15 candidate adds durable private input ledgers,
shared local task controls, independent association visibility and checkpoint input
presentation. Full verification is 133/133 tests plus typecheck/build; frozen CLI
validations remain 26/0/0 and 23/0/1, and all 50 frozen hashes are unchanged.
All 730 live/backup/baseline/working inventories and hashes match. See
[prior storage evidence](handoffs/completed/t09.md#continuation-2026-09-11-durable-input-storage-and-local-app-actions).

The ten-file candidate remains protocol/base 0.4.17 and accomplishment 0.4.18.
**152/152 tests/typecheck, build and diff checks pass**; the four new tests and
synthetic evaluator change no runtime/contract bytes. Protected originals, forks,
backups and candidate bundles remain unchanged; all 50 frozen hashes still match.
Frozen validation remains 26/0/0 and 23/0/1 (existing raw-journal warning).

The preceding isolated compaction remains verified: task 5,424 bytes/Summary 593,
32 marks/18 anchors/52 refs preserved, exact capture/export/history and rollback.
Its packet measured 18,505 reviewed, 59,146 with full rules, 71,423 offline before
unmeasured client context. No new real-corpus iteration occurred.

The historical [synthetic whole-bootstrap evaluation](bootstrap-budget-evaluation.md)
measured 46,497 bytes under a synthetic 65,536 maximum, including declared overhead;
raw sources were 43,126 bytes. Its history/privacy/input results remain harness
evidence. The [clause map](compact-contract-map.md) preserved 81 protocol ranges and
201 schema ranges across 10 files / 50,572 bytes. Its raw module lower bounds were
22,383 shared review, 21,563 edit and 25,937 personal review. These measurements
remain valid historical observations; the cumulative-session admission proposal
has been explicitly superseded, not adopted or re-measured.

The [2026-09-14 user decision](progressive-disclosure-handoffs.md) specifies
progressive disclosure: a flight summary/checklist leads to the next eligible task
and its current T3 handoff, with essential decisions already present. Larger plans,
investigations, tickets, PRs and previous handoffs are supporting pointers to inspect
for a relevant question. Retain the existing packet export limits; measure baseline
and later source reads and available host overhead separately. A fixed cumulative
10 KiB session cap and mandatory compact-contract rewrite are not T09 requirements.
The user also requires bounded session loading: calibrate a separate startup
allowance and working reserve, with controlled expansion and split/checkpoint before
context exhaustion. Numeric values are not yet selected. Installed rule/schema
reads and actionable linked-input review remain mandatory.

The [synthetic flight continuation](examples/flight-continuation/README.md) now
verifies the authored flight/task/current-handoff route, essential predecessor
directives, labelled optional pointers and one justified 154-byte investigation
read. The current exporter refuses the ordinary 13,327-byte packet; an explicit
14 KiB maximum emits 13,459 bytes. Baseline task reads are 6,516 bytes and mandatory
rules 40,641; the conservative packet route including fresh task/checkpoint reads
is 60,616 bytes. A provisional 72 KiB startup allowance and separate 24 KiB working
reserve are fixture proposals, not measured host capacity or selected defaults.

History growth leaves packet/baseline sizes unchanged, though ordinary detail
changes require repreview. Stale dependencies/owners stop eligibility; pending
input remains actionable after export/capture. Overflow refuses without truncation;
reserve exhaustion saves a stop checkpoint and preserves the exact prior version.
No runtime eligibility scheduler, selected-section exporter or startup controller
is introduced. Receiver behavior was unmeasured at this harness capture; the current receiver report above supersedes that observation.

**153/153 tests/typecheck and build pass** (localhost tests required sandbox
escalation). Explicit frozen validations are 26/0/0 and 23/0/1; all 50 frozen hashes,
14 protected inventories and the original 71 source hashes remain unchanged.
Diff, example links, incoming archive and chaining-packet checks pass. See
[current evidence](handoffs/completed/t09.md#continuation-2026-09-14-synthetic-flight-continuation).

Next: with new explicit receiver authority and available quota, finish an
instrumented acceptance sample using bounded mandatory reads, unique output logs,
selected writer guidance and measured reserve. The first grant is consumed; full
receiver capture and stale/reserve probes remain unmeasured. Parent-run probes
are separate evidence. Live adoption/reconciliation retains separate identity,
backup, contract and authorization gates. Without new authority/evidence, apply
the 5/5 cap and stop without review/capture. No repeated migration or invented
successor. Employer content and preservation manifests remain private; no live
capture/regen, commit, push, publication, messages or external change occurred.
T09 stays partial and final, no successor.

## Completing a packet

Update only the selected packet and this index, record validation evidence, and
leave a short current checkpoint for any unfinished work. Do not append a session
transcript to the task. Keep old rationale in linked details or history. A checked
box requires completed behavior and evidence, not a drafted design.
