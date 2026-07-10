---
id: arbiter-cli-2026q3
type: task
title: Arbiter CLI
status: in-flight
parent: goals/v0-5-headless-core-2026q3
created: 2026-07-09
started: 2026-07-09
updated: 2026-07-10T00:25
---

# Arbiter CLI

## Summary
All v0.5 commands are built and tested: validate, regen (incremental by default), triage (needs-review stamps, archive flags, 24h staged sweep), query (overdue | needs-review | staged | active | page | chain), new (slug forms + reopen rule), arbitrate (write-then-verify, deletes arbitrated proposals, removes an emptied .staged/), write --if-match (CAS, refuses while staging is sticky), normalize, hash. Repo published 2026-07-10 and CI is green on the first run (typecheck, gates 1–7, validate on both corpora). Remaining: survive the week of real dogfood use.

## Checklist
- [x] validate | regen | triage | query | new | arbitrate | write --if-match
- [x] arbitrate is write-then-verify; sticky staging enforced on the CAS path
- [~] week of dogfood use with agents + CLI only
- [x] CI runs typecheck, gates, and validate on both corpora

## Artifacts
- ci: [first green run](https://github.com/YoungJonathanP/arbiter/actions/runs/29076594662)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place; check <id>.staged/ before editing -->
