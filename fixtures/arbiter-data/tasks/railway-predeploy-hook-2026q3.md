---
id: railway-predeploy-hook-2026q3
type: task
title: Railway pre-deploy hook
status: in-flight
parent: goals/q3-deploy-pipeline-2026q3
started: 2026-06-26
eta: 2026-07-10
updated: 2026-07-05T09:40
---

# Railway pre-deploy hook

## Summary
Migration guard script is written and merged; wiring it into the Railway pre-deploy command is in progress. Rollback verification remains before the goal milestone can be marked done.

## Checklist
- [x] spike: confirm Railway runs pre-deploy commands per service
- [x] write migration guard script
- [~] wire guard into railway.json pre-deploy
- [ ] verify rollback path on failed migration

## Artifacts
- pr: [platform#214 — migration guard script](https://github.com/example/platform/pull/214)

## Detail docs
- [[rollout-plan]] Rollout plan (plan) -> tasks/railway-predeploy-hook-2026q3/rollout-plan.md

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place; check <id>.staged/ before editing -->
