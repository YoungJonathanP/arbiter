---
schema: accomplishment
version: "0.4.18"
extends: _base
kind: record
slug-form: "<base>-YYYYqN"
fields:
  date:   { type: date,     required: true, note: "when the impact landed (merge date, ship date)" }
  source: { type: ref-list, required: true, note: "the work item(s) this was distilled from" }
  outcome: { type: text, required: false, note: "stable identity shared by all records of the same outcome; required for counted impact" }
  verification: { type: enum, required: false, values: [unverified, observed], default: unverified }
  verified-by: { type: text, required: false, note: "person or agent that performed the recorded observation" }
  observed-on: { type: date, required: false }
sections:
  Summary:  { required: true, note: "one review-ready impact statement: impact first, mechanism second, numbers where they exist" }
  Evidence: { required: true, note: "- <kind>: [<label>](<url>) — at least one verifiable link: merged PR, published doc, dashboard" }
  Observations: { required: false, note: "what was observed and how; links alone are not verification" }
  Uncertainty: { required: false, note: "remaining verification and limits; explicit none if resolved" }
relevance: recent-first
---

# Accomplishment

An impact candidate or observed outcome, retained after source task archival.
Unverified candidates may have no evidence links and never count as impact.
Observed records require an outcome identity, reviewer, observation date, evidence,
nonempty Observations and Uncertainty, and completed eligible source work. Reports
label this recorded attestation; tools do not independently verify external links.
Duplicate records sharing an outcome count once; conflicting claims need review.
Source work that is private, dropped or superseded cannot contribute impact.

Legacy records may retain absent verification, Observations and Uncertainty
without rewriting any claims, history or links. Missing verification means
unverified, with an advisory diagnostic; it is not a claim about the record's age.
The existing Evidence section/link rule still applies to these legacy-shaped
records. New skeletons and promotion candidates explicitly set unverified and
include both sections. Validation and reports never fill in an attestation.

<!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work -->
