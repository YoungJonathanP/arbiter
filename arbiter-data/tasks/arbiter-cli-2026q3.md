---
id: arbiter-cli-2026q3
type: task
title: Arbiter CLI
status: in-flight
parent: goals/v0-5-headless-core-2026q3
created: 2026-07-09
started: 2026-07-09
updated: 2026-07-09T10:00
---

# Arbiter CLI

## Summary
All v0.5 commands are built and tested: validate, regen (incremental by default), triage (needs-review stamps, archive flags, 24h staged sweep), query (overdue | needs-review | staged | active | page | chain), new (slug forms + reopen rule), arbitrate (write-then-verify, deletes arbitrated proposals, removes an emptied .staged/), write --if-match (CAS, refuses while staging is sticky), normalize, hash. Remaining: survive a week of real dogfood use and land the CI wiring.

## Checklist
- [x] validate | regen | triage | query | new | arbitrate | write --if-match
- [x] arbitrate is write-then-verify; sticky staging enforced on the CAS path
- [~] week of dogfood use with agents + CLI only
- [ ] CI runs typecheck, gates, and validate on both corpora

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place; check <id>.staged/ before editing -->
