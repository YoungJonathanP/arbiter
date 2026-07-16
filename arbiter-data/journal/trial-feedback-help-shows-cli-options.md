---
id: trial-feedback-help-shows-cli-options
type: journal
title: Trial feedback help shows cli options
date: 2026-07-15
created: 2026-07-15
updated: 2026-07-15T11:20
---

# Trial feedback help shows cli options

## Summary

Feedback (2026-07-15): `arbiter --help` doesn't print help — bare `arbiter` and any `--`-prefixed invocation are rewritten to `serve` (`src/cli/main.ts`), so `--help` launches the renderer instead. Requested: `arbiter --help` (and `-h`) should print the CLI usage/options — the same text as `arbiter help` — and exit, without starting a server. Not yet implemented.

## Artifacts

- task: [Trial feedback](tasks/trial-feedback-2026q3.md)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · record: capture now, structure later -->
