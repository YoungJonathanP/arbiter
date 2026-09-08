---
schema: meeting
version: "0.4"
extends: _base
kind: record
slug-form: "<base>-YYYY-MM-DD"
fields:
  date: { type: date, required: true, default: "from the id's date suffix", note: "when the meeting occurred/occurs" }
sections:
  Summary:     { required: true,  note: "decisions and outcomes first, discussion second" }
  Artifacts:   { required: false, note: "items and documents the meeting touched — link tasks/goals it advanced or blocked" }
  Detail docs: { required: false, note: "full minutes as a tier-3 note, when they exist" }
relevance: recent-first
---

# Meeting

A record of a conversation — no status, no checklist. What a meeting *decides*
lives here; what it *creates* does not: promote action items into `tasks/`
(one line each is enough — see PROTOCOL.md#capture) and link them under
`## Artifacts` rather than keeping a to-do list inside the meeting file.

- `relevance: recent-first` — tier-1 ordering by `date` descending.
- 1:1s and sensitive conversations take `visibility: private`
  (PROTOCOL.md#visibility).

<!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work -->
