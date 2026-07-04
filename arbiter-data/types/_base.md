---
schema: _base
version: "0.4"
fields:
  id:         { type: slug,     required: true,  note: "equals the filename; immutable address — see PROTOCOL.md#slugs" }
  type:       { type: enum,     required: true,  values: [task, goal, meeting, journal, accomplishment], default: "singular of the parent directory" }
  title:      { type: text,     required: true,  note: "mirrors the H1; may change freely, the id never does" }
  updated:    { type: datetime, required: true,  default: "file modification time", note: "touch on every write" }
  visibility: { type: enum,     required: false, values: [private], note: "see PROTOCOL.md#visibility" }
  parent:     { type: ref,      required: false, note: "id of an owning item, e.g. a goal this task serves" }
  related:    { type: ref-list, required: false, note: "loose sibling references; follow only when the current item lacks the answer" }
  normalized: { type: date,     required: false, note: "set once by repair — see PROTOCOL.md#normalization" }
---

# Base schema

Universal frontmatter carried by every item, of every type. Concrete types
(`task`, `goal`, `meeting`, `journal`, `accomplishment`) extend this schema and
declare only their own fields, sections, and relevance rule.

Field types used across schemas: `text`, `slug`, `date` (`YYYY-MM-DD`),
`datetime` (ISO 8601), `enum`, `url`, `ref` (the id of another item),
`ref-list`.

<!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work -->
