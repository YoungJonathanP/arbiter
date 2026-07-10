---
id: visual-inspection-scaffold-2026q3
type: task
title: Visual inspection scaffold
status: done
parent: tasks/arbiter-trial-2026q3
created: 2026-07-10
started: 2026-07-10
updated: 2026-07-10T15:15
---

# Visual inspection scaffold

## Summary
Done. `arbiter serve` — a read-only, zero-dependency local web renderer over the live data directory, pulled forward from v0.6 so the dogfood trial can validate inputs visually. Renders all three tiers through the same core parser the CLI and validator use (one normalization path): dashboard cards with status colors and staged flags, item pages with checklists, blocker links, artifacts, and pending proposals inline (ops + intent), tier-3 docs, directory listings with archived items flagged, and a view-as-agent link on every page showing exact file bytes. Privacy: binds 127.0.0.1 only, no write path, every request re-reads files fresh. The full v0.6 renderer (file watcher, write path with conflict signal) replaces this.

## Checklist
- [x] serve command: dashboard, item, doc, dir, protocol, raw routes
- [x] staged proposals surface on the contended item with their intents
- [x] HTML escaped; path traversal refused; localhost-only bind
- [x] route tests green in the suite
- [x] visual alignment with the v0 prototype: tokens + dark mode, topbar (hamburger, wordmark seal, status legend), card board, sidenav, item blocks, collapsible view-as-agent

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · terminal: distill an accomplishment with evidence when closing -->
