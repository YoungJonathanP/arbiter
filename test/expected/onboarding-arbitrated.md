---
id: onboarding-doc-refresh-2026q3
type: task
title: Onboarding doc refresh
status: blocked
started: 2026-07-01
due: 2026-07-20
updated: 2026-07-05T17:20
---

# Onboarding doc refresh

## Summary
Audit of the existing doc pages is complete; the quickstart rewrite is underway. Target is the new-hire start date (2026-07-20). The old wiki page comes down once the quickstart replaces it.

## Checklist
- [x] audit existing doc pages for stale content
- [!] rewrite quickstart against the current stack <!-- ^quickstart -->
      blocked-by: [Staging DB migration](tasks/staging-db-migration-2026q3.md)
- [x] retire the old wiki page

## Arbitration history
- 2026-07-05 — arbitrated 2026-07-05-agent-heron-2c91-quickstart-blocked: `mark: ^quickstart = blocked` ⇒ applied
- 2026-07-05 — arbitrated 2026-07-05-agent-kestrel-7f3a-close-out: `mark: ^quickstart = done` ⇒ overruled ([docs#87 — quickstart rewrite](https://github.com/example/docs/pull/87), [live quickstart page](https://docs.example.com/quickstart)); `mark: "retire the old wiki page" = done` ⇒ applied; `set: status = done` ⇒ overruled ([docs#87 — quickstart rewrite](https://github.com/example/docs/pull/87), [live quickstart page](https://docs.example.com/quickstart))

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · update marks in place; check <id>.staged/ before editing -->
