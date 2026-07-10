---
schema: _base
version: "0.4.6"
fields:
  id:         { type: slug,     required: true,  note: "equals the filename; with its directory it forms the permanent object ref <dir>/<id> — see PROTOCOL.md#slugs" }
  type:       { type: enum,     required: true,  values: [task, goal, meeting, journal, accomplishment], default: "singular of the parent directory" }
  title:      { type: text,     required: true,  note: "mirrors the H1; may change freely, the id never does" }
  updated:    { type: datetime, required: true,  default: "file modification time", note: "touch on every write" }
  created:    { type: date,     required: false, default: "the slug's quarter (work items) or date (records)", note: "when the object came into being" }
  visibility: { type: enum,     required: false, values: [private], note: "see PROTOCOL.md#visibility" }
  parent:     { type: ref,      required: false, note: "object ref of an owning item — a goal this task serves, or a parent task (sub-tasks stay off tier 1; see PROTOCOL.md#tier-1)" }
  related:    { type: ref-list, required: false, note: "object refs of loose siblings; follow only when the current item lacks the answer" }
  prev:       { type: ref,      required: false, note: "object ref of the predecessor iteration — see PROTOCOL.md#slugs; the forward pointer is derived, never stored" }
  archived:   { type: date,     required: false, note: "set by triage; archived objects leave recency views, reports still see them — see PROTOCOL.md#archive" }
  normalized: { type: date,     required: false, note: "set once by repair — see PROTOCOL.md#normalization" }
---

# Base schema

Universal frontmatter carried by every item, of every type. Concrete types
(`task`, `goal`, `meeting`, `journal`, `accomplishment`) extend this schema and
declare only their own fields, sections, and relevance rule.

Field types used across schemas: `text`, `slug`, `date` (`YYYY-MM-DD`),
`datetime` (ISO 8601), `enum`, `url`, `ref` (the permanent object ref
`<dir>/<id>` of another item), `ref-list`.

<!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work -->
