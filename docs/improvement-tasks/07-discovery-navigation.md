# T07: Bounded discovery and consistent navigation

Status: complete. Verified 2026-09-08; implementation is uncommitted on main.
Traceability: Feedback 14–16; search and bounded-navigation findings.
Owner: completed session. Checkpoint captured: 2026-09-08 (verified completion).

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

- [x] Add search over selected tiers with small previews, source links, filters and explicit archive inclusion.
- [x] Bound dashboard task/goal groups and page directory listings while preserving a route to the complete active set.
- [x] Render goal-to-task children and explicit parent affiliation consistently; expose dependencies separately from hierarchy.
- [x] Show current checkpoint readiness and next action without embedding history.
- [x] Share result selection, ordering and visibility between human pages and agent output.
- [x] Render completed rows in muted color; reserve strikethrough for superseded content. Define an explicit superseded representation if needed.
- [x] Relabel expanded directory lists as lists, not item Tier 2 pages.
- [x] Expose selected context expansion with a reason per source; never recursively load all relations or older handoffs.

## Completion evidence

- [x] A relevant archived decision is discoverable without knowing its exact filename.
- [x] A goal's tasks appear to both human and agent clients under the same visibility rules.
- [x] Large task counts yield bounded pages with truthful totals and no unreachable active work.
- [x] Done and superseded content are distinguishable and copied handoffs include only selected inputs.

## Current handoff

T07 is complete. Shared `src/core/discovery.ts` powers CLI search, web directory
and search pages, and direct-child results. Five-entry cards/sidenav, paged lists,
explicit archive selection, current-checkpoint summaries and source-purpose display
are implemented. Completion evidence includes archived content discovery, 123-task
pagination/CLI-web parity, private exclusion, done/superseded rendering and exact
selected-context export. See [T07 evidence](../handoffs/completed/t07.md) and the
[0.4.13 decision](../v0.4.13-discovery.md) for interfaces, checks and limitations.

Tested base HEAD: `bfdc5519cc730fb0e23bb840b5ac83d6c7bddb66`; T07 changes are
uncommitted on `main`. Full tests 95/95, final focused checks and build passed.
The frozen corpora remain byte-identical and validate 26/0/0 and 23/0/1.
No live capture: the environment selects the frozen corpus and the live sibling
is absent. No comparison-snapshot migration, profile edits or external actions.

Next action: open the [current chaining handoff](../handoffs/next-task.md), which
assigns T08 only. It must settle durable record types and registry integration
before reporting; T07 adds no independent canonical type registry. Legacy index
queries retain existing output contracts; bounded navigation uses `search`.

## Capture before handing off

- [x] Replace Current handoff with verified state, exact next action and remaining gate.
- [x] Link the tested revision, checks performed and material limitations.
- [x] Preserve still-applicable constraints; move detailed logs into linked history.
- [x] Update this packet and the [execution index](../improvement-plan.md).
- [x] Use the [handoff template](../templates/task-handoff.md) for a fresh session.
