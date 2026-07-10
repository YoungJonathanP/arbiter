---
id: sso-timeout-fix-2026q3
type: accomplishment
title: SSO session timeout fix shipped
date: 2026-06-30
source: [tasks/sso-timeout-fix-2026q3]
updated: 2026-06-30T16:10
---

# SSO session timeout fix shipped

## Summary
Eliminated forced logouts that hit every SSO user roughly hourly: auth error rate dropped from ~40/hr to baseline (<2/hr) within an hour of deploy. Root cause was a cached 401 on the keepalive route; the fix exempts that route from the auth cache.

## Evidence
- pr: [platform#198 — keepalive cache exemption](https://github.com/example/platform/pull/198)
- dashboard: [auth error rate, week of 2026-06-29](https://grafana.example.com/d/auth-errors)

<!-- arbiter:tier-2 · PROTOCOL.md#accomplishments · record: no status, never reopened; evidence links are required -->
