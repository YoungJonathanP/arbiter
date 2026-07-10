---
id: v0-5-headless-core-2026q3
type: goal
title: v0.5 headless core
status: in-flight
created: 2026-07-09
started: 2026-07-09
updated: 2026-07-09T10:00
---

# v0.5 headless core

## Summary
Ship the headless core — library + CLI over the v0.4.4 contract — and start dogfooding: Arbiter's own development tracked in this data directory, operated by agents and the CLI only. The exit bar (repo doc docs/launch-plan.md, v0.5 section) is a week of real use, a correctly regenerating DASHBOARD.md, and the validator green in CI.

## Checklist
- [x] spec-readability test (v0.4 exit criterion, carried; fixture graduated to validator corpus)
- [x] core library: parser, serializer, normalizer, schemas-as-data, validator
- [x] conformance gates 1–7 as the property-test suite, fixture as oracle
- [x] CLI: validate, regen, triage, query, new, arbitrate, write --if-match
- [~] dogfood week: agents + CLI only, items kept current
- [ ] validator green in CI

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · milestones only; child tasks carry the step-level detail -->
