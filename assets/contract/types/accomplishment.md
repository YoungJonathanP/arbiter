---
schema: accomplishment
version: "0.4"
extends: _base
kind: record
slug-form: "<base>-YYYYqN"
fields:
  date:   { type: date,     required: true, note: "when the impact landed (merge date, ship date)" }
  source: { type: ref-list, required: true, note: "the work item(s) this was distilled from" }
sections:
  Summary:  { required: true, note: "one review-ready impact statement: impact first, mechanism second, numbers where they exist" }
  Evidence: { required: true, note: "- <kind>: [<label>](<url>) — at least one verifiable link: merged PR, published doc, dashboard" }
relevance: recent-first
---

# Accomplishment

A review-ready impact record, built for performance-review inspection by humans
and agents alike. Not a work item: no status, never reopened, never deleted
(archived items remain searchable by reports).

- **Evidence is the driver** (PROTOCOL.md#accomplishments): an accomplishment
  without a verifiable link under `## Evidence` is invalid — the validator
  flags it, and reports exclude it.
- Written when a source item reaches `done`; `source:` points back so an
  auditor can walk from the claim to the work.
- Dropped work never becomes an accomplishment.

<!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work -->
