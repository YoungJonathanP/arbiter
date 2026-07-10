---
id: agent-skill-for-operating-arbiter-2026q3
type: task
title: Agent skill for operating Arbiter
status: done
parent: goals/v0-5-headless-core-2026q3
created: 2026-07-10
started: 2026-07-10
updated: 2026-07-10T01:05
---

# Agent skill for operating Arbiter

## Summary
Done. Project skill at .claude/skills/arbiter/SKILL.md teaching agent sessions how to write and interact with Arbiter: PROTOCOL.md-first bootstrap, staged-check + write-then-verify before any item write, smallest-sufficient-edit and updated-touch rules, arbiter new for slug forms and the reopen rule, session-end capture etiquette (update touched items, journal findings, evidence-backed accomplishments, finish validator-green), and the never-list (pointer lines, human prose, private items, ambiguous bare refs). The skill defers to PROTOCOL.md as the contract — wiring and guardrails only, no duplicated semantics. CLAUDE.md added so every session in the repo is routed to the skill and the dogfood obligation. Hook-driven automatic capture (no instruction needed at all) remains v0.7 scope.

## Checklist
- [x] SKILL.md: bootstrap, write path, creation, capture etiquette, never-list
- [x] trigger description covers track/log/journal/close/arbitrate phrasings
- [x] CLAUDE.md routes repo sessions to the skill and the dogfood rule

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · terminal: distill an accomplishment with evidence when closing -->
