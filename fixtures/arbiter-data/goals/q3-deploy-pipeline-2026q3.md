---
id: q3-deploy-pipeline-2026q3
type: goal
title: Q3 deploy pipeline
status: in-flight
created: 2026-06-24
started: 2026-06-24
prev: goals/q2-deploy-spike-2026q2
due: 2026-09-30
updated: 2026-07-05T09:40
---

# Q3 deploy pipeline

## Summary
Ship a one-command deploy pipeline on Railway by end of quarter: pre-deploy migration guard, staging parity, then production cutover. Platform choice is settled; current work is the pre-deploy hook, which gates the staging migration.

## Checklist
- [x] pick deployment platform
- [~] pre-deploy hook running in CI <!-- ^railway-predeploy -->
      see: [Railway pre-deploy hook](tasks/railway-predeploy-hook-2026q3.md)
- [ ] staging environment parity
      see: [Staging DB migration](tasks/staging-db-migration-2026q3.md)
- [ ] one-command production deploy

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · milestones only; child tasks carry the step-level detail -->
