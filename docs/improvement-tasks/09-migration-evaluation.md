# T09: Large-project migration and continuation evaluation

Status: in-flight (partial). Progressive-disclosure direction accepted 2026-09-14; cumulative-session budget gate superseded. Synthetic flight/task demonstration verified; one fresh receiver saved 13 passing assertions but hit a usage limit before capture. Full receiver acceptance/calibration and live reconciliation remain outstanding.
Traceability: Large-project branching and checkpoint request; integration acceptance.
Owner: unassigned. Checkpoint captured: 2026-09-14 (partial; fresh receiver interrupted; parent verification/capture complete).

## Outcome

An existing large project can adopt independent task handoffs without losing history, references or the human's control.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- docs/progressive-disclosure-handoffs.md; docs/task-handoffs.md; docs/templates/task-handoff.md; docs/improvement-plan.md
- User-supplied large-project snapshot, read-only, located outside this repo
- User-selected comparison project in the current KB notes; selection and private artifact paths are in Current handoff. No separate case-study path or waiver remains required.

## Task checklist

- [x] Inventory item hierarchy, section sizes, source revisions and current/historical handoff links with bounded targeted reads.
- [x] Map existing task IDs and checklist anchors to proposed assignments; distinguish deliverables, coordination views, dependencies and historical records.
- [x] Identify contradictory scope/status/gates and require evidenced resolution. Snapshot observations must not be represented as live external state.
- [x] Draft one compact handoff for a selected assignment and show its required-read footprint.
- [x] Implement a dry-run migration manifest: old path/anchor, target role, new links, byte-preserved history, unresolved questions and rollback.
- [x] Migrate only an explicitly selected target with verified backups after the supporting contract exists. Do not modify the USB snapshot or frozen corpora.
- [x] Build synthetic regression fixtures for recursive handoffs, stale gates, competing owners, malformed links and superseded scope.
- [x] Record the user's progressive-disclosure direction and resolve the cumulative-session budget conflict.
- [x] Demonstrate flight -> next eligible task -> current T3 handoff with optional supporting pointers and separate packet/read measurements.
- [ ] Run isolated fresh-session exercises if agent execution is authorized; measure successful continuation, baseline and justified additional reads, unnecessary reads, missed constraints and stale-action prevention; report host overhead separately where available.
- [ ] Record evidence in the plan and each completed packet; reconcile lifecycle marks into the intended live KB only after its identity is resolved.

## Completion evidence

- [x] Every old ref/anchor resolves after migration or has an explicit compatible redirect.
- [ ] One assignment starts from its flight/task and current handoff without requiring an older handoff or unrelated sibling body; supporting sources are inspected only for a relevant question.
- [ ] A growing history leaves the normal continuation packet within its export budget and does not require extra startup reads. Relevant later reads are permitted within a separate startup/expansion budget and working reserve, not the packet's 10 KiB limit.
- [x] No participant claims live verification from a snapshot; rollback restores pre-migration bytes.

## Current handoff

### Repository save 2026-09-14

The user authorized committing and pushing the accumulated T07–T09 repository
work to save it for later continuation. This authorization supersedes earlier
commit/push prohibitions for this save only; it does not reset the repetition cap
or authorize another receiver, live reconciliation/adoption, or live capture/regen.
T09 remains partial. Historical references to uncommitted work describe earlier
checkpoints; the saved implementation is included in this checkpoint's commit.

Save verification: typecheck and **153/153 tests pass** after rerunning outside
the sandbox to permit localhost HTTP listeners; `npm run build` passes. Explicit
`--data` validation reports 26 files / 0 errors / 0 warnings for the frozen KB
and 23 / 0 / 1 for fixtures (the known raw-journal warning). SHA-256 comparisons
confirm all 50 tracked frozen corpus files match the pre-save HEAD. No live KB
commands or private-data evaluation ran. This verifies the repository checkpoint,
not the outstanding receiver acceptance/calibration or live reconciliation gates.
Staged whitespace review found only final blank lines in five generated examples;
their exact bytes are retained. With `blank-at-eof` excluded, staged diff checks pass.

Resume from the [current handoff](../handoffs/next-task.md) only when new authority
or evidence unlocks the relevant work; do not repeat a gate-only chaining review.

Gate-only review counter: **5 / 5; cap reached**, set after the user's
2026-09-14 cap request. The current handoff's stop rule supersedes instructions
below to repeat gate verification/capture when authority and evidence are unchanged.
Stop without checks, archive, rewrite or chaining prompt. New authority/evidence
unlocks only its relevant work; only the user may reset/increase the cap.

Authorized receiver 2026-09-14: one agent launched with no parent conversation
history, selected verification and saved 13 passing synthetic assertions. It hit a
usage limit before capture after a parent interruption/resume. Parent reconciliation
found no pending capture; parent verified results, captured waiting checkpoints
with exact prior history, and ran the five isolated probes. These later checks
are not receiver acceptance. [Receiver report](../examples/flight-continuation/receiver-evaluation.md)
records transport truncation, a logger filename collision, 67,771 logged source
bytes and incomplete reserve/host accounting. Fresh 153/153 tests/typecheck/build,
frozen validation and preservation checks pass. The single launch grant is consumed;
the gate-only counter remains 5/5. Live reconciliation/adoption remains unauthorized.

### Prior harness and gate observations

The observations below predate the authorized receiver. They remain harness
history, with current receiver outcomes and limitations in the report above.

Verified 2026-09-14: main at `bfdc5519cc730fb0e23bb840b5ac83d6c7bddb66`.
Earlier uncommitted T07/T08/T09 work is preserved. The preceding implementation added a
synthetic evaluator, one integration test and review artifacts; runtime, grammar
and schemas are unchanged. Protocol/base remain 0.4.17, accomplishment 0.4.18.

The [synthetic example](../examples/flight-continuation/README.md) verifies flight
summary/checklist -> next eligible task -> current T3 handoff using existing parent
relationships. Essential conclusions and the predecessor directive are in the
handoff. Labelled larger-plan, investigation and synthetic ticket/PR pointers
support selected questions; the optional whitespace section adds 154 bytes.
Canonical lifecycle/checklist stay on tasks. No sibling body or old handoff is
required by the authored startup route. Receiver behavior was unmeasured at this harness capture; see the current report above.

The current exporter refuses the ordinary 13,327-byte packet, then emits exactly
13,459 bytes with an explicit 14,336-byte maximum and reason. Baseline flight/task/
checkpoint reads are 6,516 bytes; mandatory full rules/schemas add 40,641. The
conservative packet route with fresh task/checkpoint rereads totals 60,616 bytes.
These are separate observations, not a cumulative 10 KiB session test.

A provisional 72 KiB startup allowance derives from that route plus 15% headroom
rounded to 4 KiB. A separate 24 KiB reserve allocates 8 KiB each to execution,
results/verification and outgoing checkpoint. These are source-byte proposals for
this fixture; no host token capacity, real-session admission or product default is
claimed. Boundary probes permit the small relevant read and require checkpoint/
split when the next read consumes the reserve. Required oversized input triggers
an actual replacement checkpoint; exact prior bytes remain archived and input
remains actionable. No agent is launched.

Adding 220,150 bytes of checkpoint history and 108,001 bytes of ordinary design
history leaves packet/baseline bytes unchanged. Ordinary detail growth invalidates
the old preview's whole-corpus basis, but refreshed output is identical. Same-time
flight gate and owner changes stop eligibility. New/changed input is fully presented;
export acknowledges nothing. The oversized 110,297-byte packet refuses export
without truncation. Sixteen links/anchors resolve. The fixture's final validation
has zero errors and three intentional warnings (large source/history, waiting).

Gaps: eligibility is receiver judgment, selected-section reads happen outside
exporter whole-file expansion, and no runtime startup/reserve controller or host
capacity measurement exists. Parsed Artifacts/Evidence links support checklist
anchors; heading selection uses file links plus section labels. Planning exports
can require review and never authorize execution. These are measured boundaries,
not permission to rewrite the contract or omit required rules/input.

Verification: **153/153 tests and typecheck pass**, plus build, explicit frozen
validation 26/0/0 and 23/0/1 (existing raw-journal warning), diff/link/size/archive
checks. The first test attempt encountered localhost sandbox EPERM; the escalated
rerun passes. All original 71 source hashes, 50 frozen hashes and 14 protected
inventories are unchanged. Prior evidence remains append-only.

Private root: `/Users/jonathanyoung/Documents/arbiter-t09-local-review/`;
current evidence `flight-continuation-20260914/`. Prior map, synthetic bootstrap and
isolated compaction evidence are retained. Before any further adoption read private
reconciliation and the [adoption gates](../v0.4.17-personal-continuation.md#adoption-gates).
No real-data iteration, installed adoption, live capture/regen, commit, push,
messages or external changes. Explicit `--data` is required: the environment
selects the frozen corpus.

**Next assignment:** T09 remains gated on full receiver acceptance/calibration
and live reconciliation. The one-shot launch grant is consumed. With new authority
and available quota, use bounded mandatory reads, unique output filenames, selected
writer guidance and complete output/reserve accounting; finish receiver capture
and stale/input/reserve probes. Without new authority/evidence, apply the 5/5 cap
and stop without checks/capture. Live adoption needs separate gates. No repeated
migration or invented T10. Humans manage lifecycle/status/notes; agents maintain
the plan and continuation.

See [current evidence](../handoffs/completed/t09.md#continuation-2026-09-14-synthetic-flight-continuation)
and the [current chaining packet](../handoffs/next-task.md).

## Capture before handing off

- [x] Replace Current handoff with verified state, exact next action and remaining gate.
- [x] Link the tested revision, checks performed and material limitations.
- [x] Preserve still-applicable constraints; move detailed logs into linked history.
- [x] Update this packet and the [execution index](../improvement-plan.md).
- [x] Use the [handoff template](../templates/task-handoff.md) for a fresh session.
