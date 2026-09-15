---
schema: decision
version: "0.4.14"
extends: _base
kind: record
slug-form: "<base>-YYYYqN"
fields:
  date: { type: date, required: true }
  scope: { type: text, required: true, default: unassigned, note: "where this knowledge applies; unassigned needs review" }
  source: { type: ref-list, required: true, note: "provenance; supplement with Evidence links" }
  review: { type: enum, required: true, values: [needed, reviewed], default: needed }
  reviewed-by: { type: text, required: false }
  reviewed-on: { type: date, required: false }
sections:
  Summary: { required: true, note: "decision with rationale or reusable finding; bound the claim to scope" }
  Evidence: { required: true, note: "source links do not establish independent verification" }
  Observations: { required: true, note: "what was actually observed, by whom and how" }
  Uncertainty: { required: true, note: "unresolved assumptions or limitations; explicit none if resolved" }
relevance: recent-first
---

# Decision

Durable knowledge outlives its originating task. Keep scope, provenance and review
explicit. Use inherited superseded-by for a replacement and retain the old file.
Archived and superseded versions remain searchable with explicit archive selection.
A new skeleton needs review; only record reviewed after inspecting its evidence.

<!-- arbiter:types · PROTOCOL.md#tier-2 · consult before writing -->
