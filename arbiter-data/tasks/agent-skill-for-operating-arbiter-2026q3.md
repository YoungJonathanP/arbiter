---
id: agent-skill-for-operating-arbiter-2026q3
type: task
title: Agent skill for operating Arbiter
status: done
parent: tasks/arbiter-trial-2026q3
created: 2026-07-10
started: 2026-07-10
updated: 2026-07-10T15:15
---

# Agent skill for operating Arbiter

## Summary
Done. Project skill at .claude/skills/arbiter/SKILL.md teaching agent sessions how to write and interact with Arbiter: PROTOCOL.md-first bootstrap, staged-check + write-then-verify before any item write, smallest-sufficient-edit and updated-touch rules, arbiter new for slug forms and the reopen rule, session-end capture etiquette (update touched items, journal findings, evidence-backed accomplishments, finish validator-green), and the never-list (pointer lines, human prose, private items, ambiguous bare refs). The skill defers to PROTOCOL.md as the contract — wiring and guardrails only, no duplicated semantics. CLAUDE.md added so every session in the repo is routed to the skill and the dogfood obligation. Hook-driven automatic capture (no instruction needed at all) remains v0.7 scope.

## Checklist
- [x] SKILL.md: bootstrap, write path, creation, capture etiquette, never-list
- [x] trigger description covers track/log/journal/close/arbitrate phrasings
- [x] CLAUDE.md routes repo sessions to the skill and the dogfood rule
- [x] skill abstracted to user level: symlinked to ~/.claude/skills/arbiter (repo copy is source of truth); content made location-independent
- [x] global CLI entry: ~/.local/bin/arbiter wrapper + ARBITER_DATA export; CLI resolves data dir from any cwd (--data > env > upward walk)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · terminal: distill an accomplishment with evidence when closing -->
