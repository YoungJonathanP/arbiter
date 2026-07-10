---
id: protocol-0-4-6-task-nesting
type: journal
title: Protocol 0.4.6 — task nesting and tier-1 membership
date: 2026-07-10
created: 2026-07-10
updated: 2026-07-10T15:19
---

# Protocol 0.4.6 — task nesting and tier-1 membership

## Summary
Core directive fix applied with full change control (decision note: repo doc docs/v0.4.6-task-nesting.md): `parent:` naming a same-directory item now makes a sub-item that never appears on tier 1 — reached through its parent, whose rendered view derives the child list from the children's parent refs (forward pointers computed, never stored). Staged counts roll up onto the top-level ancestor's card entry so hidden proposals stay arbitrate-first visible; statuses do not roll up. One nesting level supported (validator warns deeper, errors on parent cycles). Gate 5 extended: re-parenting is an observed transition — entry leaves and returns with nothing lost or duplicated, incremental byte-identical to full. Fixture corpus gained a nested sub-task with its own staged proposal; suite is 25 tests green. Live corpus restructured to match: Arbiter trial umbrella task under the v0.5 goal now parents the trial-support tasks.

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · capture surface: append freely; structure is added lazily -->
