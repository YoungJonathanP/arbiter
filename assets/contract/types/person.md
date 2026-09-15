---
schema: person
version: "0.4.16"
extends: _base
kind: record
slug-form: "<base>"
fields:
  date: { type: date, required: true, note: "date the entity was recorded" }
sections:
  Summary: { required: true, note: "context about this person or entity" }
  Artifacts: { required: false }
  Detail docs: { required: false }
relevance: recent-first
---

# Person or entity

A stable `people/<id>` identity represents a person or organization. It is not
an account, access grant, invitation or assignment. Connections and their roles
are stored in task input ledgers and filtered independently of both endpoints.
Private cards require trusted audience policy; defaults omit them entirely.

<!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work -->
