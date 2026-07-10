---
id: agent-skill-for-operating-arbiter-2026q3
type: accomplishment
title: Agent skill makes every Claude session an Arbiter-native client
date: 2026-07-10
source: [tasks/agent-skill-for-operating-arbiter-2026q3]
updated: 2026-07-10T15:18
---

# Agent skill makes every Claude session an Arbiter-native client

## Summary
Turned agent sessions into first-class Arbiter clients from any directory: a user-level skill (repo copy as source of truth) that routes sessions through the PROTOCOL.md contract — staged-check and write-then-verify before any write, slug/reopen enforcement via the CLI, session-end capture etiquette — so dogfooding needs no per-session instruction.

## Evidence
- commit: [agent skill: how sessions write and interact with Arbiter](https://github.com/YoungJonathanP/arbiter/commit/8ff5cc1)
- commit: [global CLI entry + user-level skill: arbiter works from any directory](https://github.com/YoungJonathanP/arbiter/commit/310e5c6)

<!-- arbiter:tier-2 · PROTOCOL.md#accomplishments · record: no status, never reopened; evidence links are required -->
