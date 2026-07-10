---
id: rollout-plan
kind: plan
item: railway-predeploy-hook-2026q3
updated: 2026-07-05T09:40
---

# Rollout plan

The guard script runs as a Railway pre-deploy command per service: it applies pending migrations inside a transaction, and any failure aborts the deploy before new code boots — old code keeps serving against the un-migrated schema.

Order of operations per deploy: snapshot → migrate (transactional) → deploy → verify. The snapshot step exists purely for the rollback path; it is cheap on staging and we will measure its cost before enabling it on production.

## 2026-07-05 — rollback verification notes

Simulated a failing migration on staging: the deploy aborted as designed and the service kept serving on old code. Remaining question is snapshot restore time at production scale — measure before the goal milestone closes.

<!-- arbiter:tier-3 · PROTOCOL.md#tier-3 · read-mostly: append under a dated heading; do not rewrite history -->
