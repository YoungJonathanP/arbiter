---
id: sso-timeout-fix-2026q3
type: task
title: SSO session timeout fix
status: done
started: 2026-06-27
updated: 2026-06-30T15:45
---

# SSO session timeout fix

## Summary
Done. Sessions were expiring at 15 minutes regardless of activity because the keepalive ping hit a cached 401. Fixed by exempting the keepalive route from the auth cache; auth error rate returned to baseline within an hour of deploy.

## Checklist
- [x] reproduce the forced logout against a stale keepalive
- [x] exempt keepalive route from the auth cache
- [x] deploy and watch auth error rate for 24h

## Artifacts
- pr: [platform#198 — keepalive cache exemption](https://github.com/example/platform/pull/198)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · terminal: distill an accomplishment with evidence when closing -->
