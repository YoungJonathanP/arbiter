# T09: Large-project migration and continuation evaluation

Status: todo. Start gate: Analysis ready; mutation only after T05–T07 are implemented and a target KB is explicitly selected.
Traceability: Large-project branching and checkpoint request; integration acceptance.
Owner: unassigned. Checkpoint captured: 2026-09-06 (planning only).

## Outcome

An existing large project can adopt independent task handoffs without losing history, references or the human's control.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- docs/task-handoffs.md; docs/templates/task-handoff.md; docs/improvement-plan.md
- User-supplied large-project snapshot, read-only, located outside this repo
- Local case study outside this repo; request its location if it is unavailable rather than substituting the frozen corpus

## Task checklist

- [ ] Inventory item hierarchy, section sizes, source revisions and current/historical handoff links with bounded targeted reads.
- [ ] Map existing task IDs and checklist anchors to proposed assignments; distinguish deliverables, coordination views, dependencies and historical records.
- [ ] Identify contradictory scope/status/gates and require evidenced resolution. Snapshot observations must not be represented as live external state.
- [ ] Draft one compact handoff for a selected assignment and show its required-read footprint.
- [ ] Implement a dry-run migration manifest: old path/anchor, target role, new links, byte-preserved history, unresolved questions and rollback.
- [ ] Migrate only an explicitly selected target with verified backups after the supporting contract exists. Do not modify the USB snapshot or frozen corpora.
- [ ] Build synthetic regression fixtures for recursive handoffs, stale gates, competing owners, malformed links and superseded scope.
- [ ] Run isolated fresh-session exercises if agent execution is authorized; measure successful continuation, total context emitted, unnecessary reads, missed constraints and stale-action prevention.
- [ ] Record evidence in the plan and each completed packet; reconcile lifecycle marks into the intended live KB only after its identity is resolved.

## Completion evidence

- [ ] Every old ref/anchor resolves after migration or has an explicit compatible redirect.
- [ ] One assignment starts without opening an older handoff or an unrelated sibling body.
- [ ] A growing history leaves the normal continuation packet within its budget.
- [ ] No participant claims live verification from a snapshot; rollback restores pre-migration bytes.

## Current handoff

No implementation has started. Use the local case study to draft the migration manifest first. Work in this packet does not authorize external ticket changes or employer-data publication.

Working boundary: implement this packet's outcome and coordinate shared interfaces
with the named dependencies. Existing unrelated changes belong to their authors.
Use temporary/synthetic corpora for tests; preserve conformance fixture semantics.
Protocol changes need a version bump and decision note. Select the KB explicitly;
the shell environment currently selects the frozen in-repo corpus.

## Capture before handing off

- [ ] Replace Current handoff with verified state, exact next action and remaining gate.
- [ ] Link the tested revision, checks performed and material limitations.
- [ ] Preserve still-applicable constraints; move detailed logs into linked history.
- [ ] Update this packet and the [execution index](../improvement-plan.md).
- [ ] Use the [handoff template](../templates/task-handoff.md) for a fresh session.
