---
id: platform-sync-2026-07-02
type: meeting
title: Platform sync
date: 2026-07-02
updated: 2026-07-02T11:30
---

# Platform sync

## Summary
Decided: the staging migration waits for the pre-deploy hook rather than running by hand — staging must exercise the same path production will. Also agreed the onboarding doc refresh should land before the next hire starts on 2026-07-20. Discussion: rollback-verification approach for failed migrations (see the rollout plan).

## Artifacts
- task: [Staging DB migration](tasks/staging-db-migration-2026q3.md)
- task: [Onboarding doc refresh](tasks/onboarding-doc-refresh-2026q3.md)
- doc: [Rollout plan](tasks/railway-predeploy-hook-2026q3/rollout-plan.md)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · record: decisions live here; action items are promoted to tasks/ -->
