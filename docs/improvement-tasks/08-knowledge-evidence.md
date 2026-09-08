# T08: Durable knowledge and evidence-backed reports

Status: todo. Start gate: T03 and T04 complete; coordinate type registry with T07.
Traceability: Original knowledge/attestation objective; schema extensibility finding.
Owner: unassigned. Checkpoint captured: 2026-09-06 (planning only).

## Outcome

Reusable decisions and findings remain discoverable after task closure, and reports explain impact with traceable evidence.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- README.md (mission); docs/launch-plan.md (attestation and search)
- src/core/model.ts; src/core/schema.ts; src/core/corpus.ts; src/core/facts.ts
- src/core/indexdb.ts; src/core/dashboard.ts; accomplishment/type schema conventions

## Task checklist

- [ ] Define durable decision/finding records with scope, provenance, supersession and review state; start with the smallest useful type set.
- [ ] Make promised schema extensibility real across directory enumeration, creation, validation, index and cards, or explicitly narrow the supported promise.
- [ ] Promote completed work into accomplishment candidates without inventing outcomes or treating a link as verification.
- [ ] Record observed evidence and unresolved verification separately; preserve sources and archived records.
- [ ] Implement date-ranged Markdown reports with impact, evidence and uncertainty; deduplicate repeated reporting of the same outcome.
- [ ] Apply the shared visibility policy to all report text and source discovery.
- [ ] Verify dropped/superseded work is not reported as completed impact.

## Completion evidence

- [ ] An added supported schema works through capture, queries and rendering without another hardcoded type table.
- [ ] A report reconstructs an outcome from archived evidence with clear source links.
- [ ] Unverified claims are distinguishable from verified outcomes.
- [ ] Private material is excluded and the same accomplishment is not counted repeatedly through related tasks.

## Current handoff

No implementation has started. Begin with one synthetic completed workstream and its expected report. Avoid a broad ontology before that example works.

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
