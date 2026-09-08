# T07: Bounded discovery and consistent navigation

Status: todo. Start gate: Ready; T03–T06 contracts settled, rechecked 2026-09-08.
Traceability: Feedback 14–16; search and bounded-navigation findings.
Owner: unassigned. Checkpoint captured: 2026-09-08 (readiness recheck).

## Outcome

Humans and agents can find the relevant task, decision or archived evidence through small, consistent views.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- src/core/queries.ts; src/core/indexdb.ts; src/core/dashboard.ts; src/core/facts.ts
- src/web/server.ts; src/web/handoff.ts; src/core/handoff.ts; docs/task-handoffs.md
- docs/v0.4.12-handoff-tooling.md; test/handoff.test.ts (preserve exact preview/export behavior)
- docs/launch-plan.md (search and archive objectives)

## Task checklist

- [ ] Add search over selected tiers with small previews, source links, filters and explicit archive inclusion.
- [ ] Bound dashboard task/goal groups and page directory listings while preserving a route to the complete active set.
- [ ] Render goal-to-task children and explicit parent affiliation consistently; expose dependencies separately from hierarchy.
- [ ] Show current checkpoint readiness and next action without embedding history.
- [ ] Share result selection, ordering and visibility between human pages and agent output.
- [ ] Render completed rows in muted color; reserve strikethrough for superseded content. Define an explicit superseded representation if needed.
- [ ] Relabel expanded directory lists as lists, not item Tier 2 pages.
- [ ] Expose selected context expansion with a reason per source; never recursively load all relations or older handoffs.

## Completion evidence

- [ ] A relevant archived decision is discoverable without knowing its exact filename.
- [ ] A goal's tasks appear to both human and agent clients under the same visibility rules.
- [ ] Large task counts yield bounded pages with truthful totals and no unreachable active work.
- [ ] Done and superseded content are distinguishable and copied handoffs include only selected inputs.

## Current handoff

No T07 implementation has started. Start with a shared bounded query/result
contract for selected-tier search, archive filters, pagination, stable order and
source previews. Search may scan/index internally; its output must remain bounded.

Reinspection after [T06 completion](../handoffs/completed/t06.md): `queries.ts` has
no search; `recordPage` paginates records but `activeSet` is unbounded. Dashboard
limits apply only to record cards. Directory and sidenav lists remain unbounded;
`renderItem` filters children to the parent's directory, omitting goal-to-task
children. Done checklist labels still use strikethrough; directory labels say
Tier 2. Checkpoint details/next actions exist inside the handoff panel, but no shared
compact current-checkpoint summary is exposed in discovery results.

Preserve T06's `HandoffRequest`/`HandoffPreview` and reconstructed export bytes,
CAS/staging/input checks, local API protections, owner editing and explicit source
expansion. Add small checkpoint assessments to discovery without reading history;
unknown external/repo observations remain review-required. Source selection and
ordering must be shared by CLI and human pages. Archive inclusion is explicit;
private materials stay excluded before results/counts. Do not invent a new canonical
source registry in isolation from the deferred T08 task.

T01–T06 implementation is committed on main at `cd0e2a51cc726031308f8197f4d4eeea0b88bb35`.
The following commit updates handoff documentation only; verify HEAD/worktree before starting. Bootstrap protocol/base 0.4.12; concrete schemas
0.4, legacy 0.4.6/8/9/10/11 accepted. Full tests 89/89, final handoff tests 12/12,
build/skill/diff checks passed. Frozen corpora validated 26/0/0 and 23/0/1 with all
50 hashes unchanged. Use synthetic/temporary KBs. Live sibling remains absent.
A user-supplied comparison snapshot was inspected read-only during T06; protocol
0.4.7 is unsupported. Do not migrate/adopt it within T07 without new user direction;
see completion evidence for its path and compatibility finding.

Complete T07 only, then prepare T08 if its readiness still holds. Follow the
[current chaining handoff](../handoffs/next-task.md) for successor evidence,
packet sizing and session-end requirements.

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
