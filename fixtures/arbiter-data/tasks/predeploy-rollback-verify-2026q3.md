---
id: predeploy-rollback-verify-2026q3
type: task
title: Pre-deploy rollback verification
status: in-flight
parent: tasks/railway-predeploy-hook-2026q3
started: 2026-07-05
updated: 2026-07-05T15:10
---

# Pre-deploy rollback verification

## Summary
Sub-task split out of the pre-deploy hook's last step: force a failing migration in staging and confirm the guard halts the deploy with the schema untouched. In progress — the failing migration reproduces; abort behavior is being verified.

## Checklist
- [x] provoke a failing migration in staging
- [~] confirm the hook aborts the deploy and leaves the schema untouched
- [ ] document the rollback runbook in the rollout plan

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place; check <id>.staged/ before editing -->
