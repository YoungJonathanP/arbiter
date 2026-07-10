---
id: core-library-and-conformance-gates-2026q3
type: task
title: Core library and conformance gates
status: done
parent: goals/v0-5-headless-core-2026q3
created: 2026-07-09
started: 2026-07-09
updated: 2026-07-09T10:00
---

# Core library and conformance gates

## Summary
Done. TypeScript core under src/core/: parser + canonical serializer + idempotent normalizer implementing grammar.md exactly (everything off-grammar preserved byte-for-byte), type schemas parsed as data, validator, better-sqlite3 derived index (a cache, never truth), relevance/overdue/age-off/needs-review/prev-chain queries, incremental dashboard regeneration, and the pure confluent arbitration function. Grammar §13 gates 1–7 run as the property-test suite against fixtures/arbiter-data/; the staged 2-proposal conflict arbitrates to the spec-derived expected bytes.

## Checklist
- [x] parser, serializer, normalizer per grammar.md (liberal in, canonical out)
- [x] type schemas parsed from types/*.md, never hardcoded
- [x] validator: schema fields, structural constraints, link and anchor resolution
- [x] derived index + queries; dashboard regen incremental ≡ full rebuild
- [x] arbitration as a pure function; fixture conflict matches the answer key byte-for-byte
- [x] gates 1–7 green (17 tests)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · terminal: distill an accomplishment with evidence when closing -->
