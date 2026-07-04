---
schema: journal
version: "0.4"
extends: _base
kind: record
slug-form: "<base>"
fields:
  date: { type: date, required: true, default: "file modification date", note: "the day the entry is about" }
sections:
  Summary:     { required: false, note: "human raw entries are valid without it; normalization adds it on first touch" }
  Artifacts:   { required: false, note: "items or docs this entry feeds — link the goal/task it informs" }
  Detail docs: { required: false }
relevance: recent-first
---

# Journal entry

The capture surface: findings, gotchas, decisions, raw notes from Slack or a
terminal — one entry per topic, dated. This is the type where
human-friendliness matters most: a title and a few lines of prose is a
complete, valid entry (PROTOCOL.md#normalization does the rest later).

- `relevance: recent-first` — by `date` descending; the tier-2 page shows the
  last 7 days first, older entries behind pagination.
- An entry that turns out to be *work* gets promoted: create the task, link it
  under `## Artifacts`, leave the entry as the record of where it came from.
- Personal reflections take `visibility: private`.

<!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work -->
