---
id: staging-db-migration-2026q3
type: task
title: Staging DB migration
status: blocked
parent: goals/q3-deploy-pipeline-2026q3
started: 2026-06-30
updated: 2026-07-04T14:10
---

# Staging DB migration

## Summary
Migration SQL is drafted and reviewed. Running it against staging is blocked on the pre-deploy hook milestone — the hook is what executes migrations, and running it by hand would diverge staging from the pipeline we are trying to prove.

## Checklist
- [x] draft and review migration SQL
- [!] run migration against staging via the hook
      blocked-by: [pre-deploy hook milestone](goals/q3-deploy-pipeline-2026q3.md#^railway-predeploy)
- [ ] verify row counts and index health post-migration

## Artifacts
- pr: [platform#221 — migration SQL](https://github.com/example/platform/pull/221)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · blocked: check the blocker target's state before any other work -->
