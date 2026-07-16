---
id: v0-5-headless-core-2026q3
type: goal
title: v0.5 headless trial
status: in-flight
created: 2026-07-09
started: 2026-07-09
eta: 2026-07-23
updated: 2026-07-15T09:44
---

# v0.5 headless trial

## Summary
Ship the headless core — library + CLI over the v0.4.4 contract — and start dogfooding: Arbiter's own development tracked in this data directory, operated by agents and the CLI only. The exit bar (repo doc docs/launch-plan.md, v0.5 section) is a week of real use, a correctly regenerating DASHBOARD.md, and the validator green in CI.

## Checklist
- [x] spec-readability test (v0.4 exit criterion, carried; fixture graduated to validator corpus)
- [x] core library: parser, serializer, normalizer, schemas-as-data, validator
- [x] conformance gates 1–7 as the property-test suite, fixture as oracle
- [x] CLI: validate, regen, triage, query, new, arbitrate, write --if-match
- [~] dogfood trial: agents + CLI only, items kept current (extended to two weeks 2026-07-10; ends 2026-07-23)
      see: [Arbiter trial](tasks/arbiter-trial-2026q3.md#^dogfood-week)
- [x] validator green in CI

## Artifacts
- repo: [YoungJonathanP/arbiter](https://github.com/YoungJonathanP/arbiter)
- ci: [ci workflow runs](https://github.com/YoungJonathanP/arbiter/actions/workflows/ci.yml)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · milestones only; child tasks carry the step-level detail -->
