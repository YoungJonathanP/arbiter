---
schema: goal
version: "0.4"
extends: _base
kind: work-item
slug-form: "<base>-YYYYqN"
fields:
  status:  { type: enum, required: true,  values: [todo, in-flight, blocked, done, dropped, needs-review], default: todo }
  started: { type: date, required: false }
  eta:     { type: date, required: false }
  due:     { type: date, required: false, note: "target date — typically the quarter boundary" }
sections:
  Summary:     { required: true,  note: "the outcome sought and why it matters, then current state" }
  Checklist:   { required: false, note: "milestones; steps that are tracked tasks link them via see: lines, and referenced steps carry ^anchors" }
  Artifacts:   { required: false }
  Detail docs: { required: false }
relevance: active-first
---

# Goal

An outcome spanning multiple tasks, usually scoped to a quarter. Same fields
and lifecycle as a task; the difference is altitude.

- Child tasks declare `parent: <goal-id>` in their frontmatter; the goal's
  checklist holds milestones, not task-level steps. A milestone that a task's
  `blocked-by:` points at must carry a `^anchor` (PROTOCOL.md#anchors).
- Keep the goal's status honest against its children: a goal with all children
  terminal should itself be closed or re-scoped, and triage will flag it
  otherwise.

<!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work -->
