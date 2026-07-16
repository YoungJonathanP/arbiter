---
id: fix-committed-lockfile-types-node-pin-blocked-by-jfrog-2026q3
type: task
title: Fix committed lockfile @types/node pin blocked by JFrog
status: in-flight
started: 2026-07-10
created: 2026-07-10
updated: 2026-07-15T11:20
parent: tasks/arbiter-trial-2026q3
---

# Fix committed lockfile @types/node pin blocked by JFrog

## Summary

A clean `npm install`/`npm ci` fails on Redfin's network: the committed `package-lock.json` pinned `@types/node@22.20.1`, which JFrog's package-curation service blocks as immature (published <7 days ago). Fixed by pinning `@types/node` to `22.20.0` — the newest version allowed under the existing `^22.15.0` range — and regenerating the lockfile. Kept as a deliberate **local-only** change: not committed to shared history, not pushed. The pin is a per-machine workaround for Redfin's JFrog proxy and doesn't belong in the shared repo; re-apply it if the lockfile is ever regenerated from scratch. The block is a devDependency only; the sole runtime dep, `better-sqlite3`, installs and builds its native binding fine.

## Checklist

- [x] Diagnose: JFrog blocks the pinned `@types/node@22.20.1` (immature <7d) <!-- ^diagnose -->
- [x] Apply local-only fix: pin `@types/node` 22.20.0, regenerate lockfile (working tree, uncommitted)
- [~] Maintain as a per-machine workaround — re-apply if the lockfile is regenerated; do not commit/push to the shared repo

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place; check <id>.staged/ before editing -->
