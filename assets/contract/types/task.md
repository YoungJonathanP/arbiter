---
schema: task
version: "0.4"
extends: _base
kind: work-item
slug-form: "<base>-YYYYqN"
fields:
  owner: { type: text, required: false, note: "one accountable owner or unassigned; absence is unknown" }
  checkpoint: { type: text, required: false, note: "fixed KB-root path tasks/<id>/checkpoint.md; see PROTOCOL.md#checkpoints" }
  phase: { type: text, required: false, note: "optional grouping only; does not imply ownership or blockers" }
  status:  { type: enum, required: true,  values: [todo, in-flight, blocked, done, dropped, needs-review], default: todo }
  started: { type: date, required: false, note: "when work actually began" }
  eta:     { type: date, required: false, note: "estimated completion" }
  due:     { type: date, required: false, note: "external deadline; overdue = due < today while status is non-terminal" }
sections:
  Summary:     { required: true,  note: "2–5 sentences: current state first, then context" }
  Plan inputs: { required: false, note: "optional reference links before Checklist; produced outputs remain in Artifacts" }
  Checklist:   { required: false, note: "steps with marks — grammar in PROTOCOL.md#tier-2; blocked steps carry blocked-by links" }
  Artifacts:   { required: false, note: "- <kind>: [<label>](<url>) — PRs, docs, dashboards this task produced or uses" }
  Detail docs: { required: false, note: "links into tier 3 — plans, investigations" }
relevance: active-first
---

# Task

A unit of work with a lifecycle. Status is the load-bearing field: keep it and
the checklist marks true on every touch — the dashboard, triage, and
accomplishments all derive from them.

- `relevance: active-first` — tier-1 ordering: non-terminal (blocked, in-flight,
  todo, needs-review) by `updated` descending, then terminal (done, dropped)
  last; terminal items age off the card 7 days after closing.
- When a task reaches `done`, distill an accomplishment with evidence
  (PROTOCOL.md#accomplishments). When it is `dropped`, it never becomes one.
- Recurring work: apply the reopen rule (PROTOCOL.md#slugs) before creating a
  near-duplicate.

<!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work -->
