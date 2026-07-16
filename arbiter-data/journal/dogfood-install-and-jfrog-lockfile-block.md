---
id: dogfood-install-and-jfrog-lockfile-block
type: journal
title: Dogfood install and JFrog lockfile block
date: 2026-07-10
created: 2026-07-10
updated: 2026-07-10T10:59
---

# Dogfood install and JFrog lockfile block

## Summary

First real dogfood install of the dev-trial CLI binding, end to end: `npm install` → `npm run build` → `scripts/dev-bind.sh install`, then verified through the `~/.local/bin/arbiter` wrapper — `arbiter validate` reports 15 files, 0 errors, 0 warnings, and `arbiter help` prints usage. `better-sqlite3` (the only runtime dep) compiled its native binding and loads fine.

Gotcha worth remembering: a fresh `npm install` fails on Redfin's network because the committed `package-lock.json` pins `@types/node@22.20.1`, which JFrog's curation service rejects as immature (<7 days old). `npm ci` fails identically — the lockfile itself carries the blocked version. Workaround: pin `@types/node` to `22.20.0` (newest allowed under `^22.15.0`) and regenerate the lockfile. Tracked in tasks/fix-committed-lockfile-types-node-pin-blocked-by-jfrog-2026q3.

Second gotcha: `arbiter --help` does not print help — any `--`-prefixed invocation (and bare `arbiter`) is rewritten to `serve`, so it launches the renderer on 127.0.0.1. Use `arbiter help` (no dashes) for usage.

## Artifacts

- task: [Fix committed lockfile @types/node pin blocked by JFrog](tasks/fix-committed-lockfile-types-node-pin-blocked-by-jfrog-2026q3.md)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · record: capture now, structure later -->
