---
id: retire-dev-trial-cli-binding-at-v1-0-2026q3
type: task
title: Retire dev-trial CLI binding at v1.0
status: todo
parent: tasks/arbiter-trial-2026q3
created: 2026-07-10
updated: 2026-07-10T15:15
---

# Retire dev-trial CLI binding at v1.0

## Summary
Cleanup gated on the v1.0 install story (repo doc docs/launch-plan.md): the dogfood trial binds `arbiter` via scripts/dev-bind.sh — a ~/.local/bin wrapper hard-coded to this repo plus fenced ARBITER_DATA exports in the bash profiles. When the real one-command install lands, run the uninstall, check nothing else shadows the command, and update README/CLAUDE.md/skill references that call the binding temporary.

## Checklist
- [ ] scripts/dev-bind.sh uninstall (removes wrapper + fenced profile blocks)
- [ ] verify no npm-linked or stray `arbiter` remains on PATH
- [ ] drop the temp-binding sections from README, CLAUDE.md, and the arbiter skill

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place; check <id>.staged/ before editing -->
