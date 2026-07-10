---
id: railway-cli-gotcha
type: journal
title: Railway CLI gotcha
date: 2026-07-03
updated: 2026-07-03T18:05
normalized: 2026-07-03
---

# Railway CLI gotcha

## Summary
`railway up` from a linked directory deploys the *linked* service, not the one named in railway.json — bit me while testing the pre-deploy hook. Re-link with `railway link` per service, or pass `--service` explicitly.

## Artifacts
- task: [Railway pre-deploy hook](tasks/railway-predeploy-hook-2026q3.md)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · capture surface: append freely; structure is added lazily -->
