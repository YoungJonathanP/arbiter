---
id: arbiter-trial-2026q3
type: task
title: Arbiter trial
status: in-flight
parent: goals/v0-5-headless-core-2026q3
created: 2026-07-10
started: 2026-07-09
eta: 2026-07-23
updated: 2026-07-10T15:35
---

# Arbiter trial

## Summary
Umbrella for the v0.5 dogfood trial (started 2026-07-09; extended to two weeks on 2026-07-10, ending 2026-07-23): real use with agents + the CLI only, items kept current, feedback processed as it lands. The trial-support work hangs off this task as sub-tasks (visual inspection scaffold, agent skill, dev-bind retirement) — they stay off tier 1 and are reached here, per PROTOCOL.md#tier-2 nesting. Exit bar is the v0.5 goal's: DASHBOARD.md regenerating correctly and CI green after a week.

## Checklist
- [~] two weeks of real use: agents + CLI only, items kept current <!-- ^dogfood-week -->
- [ ] process trial feedback as it lands (renderer/CLI bugs → fix with a test; spec friction → propose with a decision note; workflow gaps → skill/CLAUDE.md)
- [ ] exit check on 2026-07-23: dashboard regen correct, CI green — then close the v0.5 goal

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place; check <id>.staged/ before editing -->
