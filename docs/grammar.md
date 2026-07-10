# Arbiter grammar — the machine-read subset

*v0.4.5 · Normative spec for the parts of arbiter-data files that tools parse, validate, and rewrite. Companion to [`arbiter-data/PROTOCOL.md`](../arbiter-data/PROTOCOL.md) (the agent-facing contract) — where the two disagree, this document wins for machines. Everything **not** matched by a production here is opaque prose: tools MUST preserve it byte-for-byte and MUST NOT derive meaning from it.*

## 1. Conformance

- **Writers** (agents following PROTOCOL.md, the normalizer, the renderer, regeneration) MUST emit the *canonical form* — exactly the productions below.
- **Readers** MUST accept canonical form, SHOULD accept the liberal variants in §12, and MUST treat any unrecognized content as opaque.
- **Normalization** maps liberal input to canonical form and is **idempotent**: `normalize(normalize(f)) = normalize(f)`.
- **Round-trip**: for any conforming file, `parse(serialize(parse(f))) = parse(f)`, and for a canonical file `serialize(parse(f)) = f`.
- Encoding: UTF-8, LF line endings, exactly one trailing newline. Two non-ASCII terminals are load-bearing: the em dash `—` (U+2014) in entry lines and the middle dot `·` (U+00B7) in pointer lines.

## 2. Notation

`::=` definition · `"x"` literal · `A B` concatenation · `A | B` alternation · `A?` optional · `A*` zero or more · `A+` one or more · `A{n}` exactly n · `( )` grouping. Character ranges as `"a".."z"`. `text` and `prose` are any characters excluding the line terminator, with disambiguation rules given where they abut other productions.

## 3. Lexical terminals

```ebnf
lower       ::= "a".."z"
digit       ::= "0".."9"
word        ::= (lower | digit)+
base-slug   ::= word ("-" word)*

year        ::= digit{4}
month       ::= "01".."12"
day         ::= "01".."31"
date        ::= year "-" month "-" day
datetime    ::= date ("T" digit{2} ":" digit{2} (":" digit{2})? tz?)?   (* ISO 8601 *)
quarter     ::= year "q" ("1" | "2" | "3" | "4")

work-id     ::= base-slug "-" quarter                     (* task, goal, accomplishment *)
meeting-id  ::= base-slug "-" date
journal-id  ::= base-slug ("-" date)?                     (* date suffix only on collision *)
doc-id      ::= base-slug
item-id     ::= work-id | meeting-id | journal-id
anchor      ::= base-slug

status      ::= "todo" | "in-flight" | "blocked" | "done" | "dropped" | "needs-review"
mark        ::= " " | "~" | "!" | "x"                     (* todo · in-flight · blocked · done *)
doc-kind    ::= "plan" | "investigation" | "report" | "note"
item-dir    ::= "tasks" | "goals" | "meetings" | "journal" | "accomplishments"

rel-path    ::= item-dir "/" path-tail
path-tail   ::= item-id ".md" | item-id "/" doc-id ".md"
object-ref  ::= item-dir "/" item-id                       (* permanent address; files never move *)
target      ::= url | rel-path ("#^" anchor)?
url         ::= "http" "s"? "://" text
md-link     ::= "[" label "](" target ")"                 (* label: text without "]" *)
blank       ::= eol                                        (* empty line *)
```

An `anchor`, once referenced from any file, is immutable. `item-id` uniqueness is per directory; `anchor` uniqueness is per file; `doc-id` uniqueness is per item.

## 4. Frontmatter

Frontmatter is a YAML document between `---` fences, restricted to a **flat mapping**: scalar values or flat sequences of scalars. Nested mappings are permitted only in type-schema files (§9). Keys and value types per item type are declared by `arbiter-data/types/<type>.md`; unknown keys are preserved but flagged by the validator.

```ebnf
frontmatter ::= "---" eol fm-line+ "---" eol
fm-line     ::= key ": " fm-value eol
fm-value    ::= scalar | "[" scalar ("," " " scalar)* "]"
```

Canonical form of a `ref-list` is a YAML flow sequence of `object-ref`s: `related: [goals/q3-deploy-pipeline-2026q3]`. All `ref` and `ref-list` values are `object-ref`s (§3); a bare id is liberal input (§12).

## 5. Item files (tier 2)

```ebnf
item-file    ::= frontmatter blank title-line blank section* pointer-line eol
title-line   ::= "# " text
section      ::= known-section | opaque-section
known-section::= summary | checklist | artifacts | evidence | detail-docs
summary      ::= "## Summary" eol prose-block
checklist    ::= "## Checklist" eol step+ blank?
artifacts    ::= "## Artifacts" eol link-entry+ blank?
evidence     ::= "## Evidence" eol link-entry+ blank?
detail-docs  ::= "## Detail docs" eol docs-entry+ blank?
link-entry   ::= "- " kind-label ": " md-link eol         (* kind-label: text without ":" *)
docs-entry   ::= "- [[" doc-id "]] " text " (" doc-kind ") -> " rel-path eol
opaque-section ::= "## " text eol prose-block             (* preserved verbatim *)
prose-block  ::= (any line not starting "## " and not a pointer-line)*
```

Section order in canonical form: Summary, Checklist, Artifacts/Evidence, Detail docs, then opaque sections in original order. `## Evidence` appears only in accomplishments; `## Artifacts` in all other types. Which sections are required is declared per type schema.

Canonical form separates consecutive sections, and the final section from the pointer line, with exactly one blank line — in every file kind (item, doc, proposal); for prose-ending sections that blank is the last line of the `prose-block`. Readers accept zero or more blank lines there; the normalizer emits exactly one.

## 6. Checklist steps

```ebnf
step         ::= "- [" mark "] " step-text anchor-c? eol continuation*
anchor-c     ::= " <!-- ^" anchor " -->"
continuation ::= indent ("blocked-by" | "see") ": " md-link eol
indent       ::= " "{6}                                    (* aligns under step text *)
step-text    ::= text                                      (* MUST NOT contain "<!--" *)
```

Structural constraints (validator-enforced, beyond the grammar):

- A `[!]` step MUST have ≥1 `blocked-by:` continuation.
- An item with `status: blocked` MUST contain a `[!]` step, or (when it has no checklist) a `blocked-by:` link-entry line directly under `## Summary`.
- A `blocked-by:` target of form `rel-path "#^" anchor` MUST resolve to an existing anchor.

## 7. Dashboard (tier 1)

```ebnf
dashboard    ::= frontmatter blank "# Dashboard" eol blank card-section+ pointer-line eol
card-section ::= "## " card-label " (" count ")" eol entry* overflow? blank
card-label   ::= text                                      (* no "(" *)
count        ::= digit+
entry        ::= "- " ("[" status "] ")? staged-flag? entry-title " — " date " -> " rel-path eol
staged-flag  ::= "(" count " staged) "
overflow     ::= "- +" count " more in " item-dir "/" eol
entry-title  ::= text
```

Disambiguation: an entry line is split at its **last** `" -> "` (path), then at the **last** `" — "` before that (date); a `staged-flag` is recognized only immediately after the status bracket. `entry-title` may therefore contain any of these sequences. The `staged-flag` marks items with unresolved proposals (§9). Work items carry the `[status]` prefix; record types (meetings, journal, accomplishments) omit it. The entry `date` is the date part of the item's `updated` for work items and the item's `date` for records. Work-item cards list every non-archived item and carry no `overflow`; record cards list at most 5 entries plus an `overflow` line; the header `count` is the card's non-archived total. Dashboard frontmatter keys: `updated` (datetime; staged proposal files are not item touches), `generator`, `generated` (datetime), `protocol`.

## 8. Detail documents (tier 3)

```ebnf
doc-file     ::= frontmatter blank title-line blank doc-body pointer-line eol
doc-body     ::= prose-block (dated-heading prose-block)*
dated-heading::= "## " date " — " text eol
```

Doc frontmatter keys: `id` (doc-id), `kind` (doc-kind), `item` (item-id), `updated` (datetime). Appends go under a `dated-heading`; everything else in `doc-body` is opaque.

## 9. Proposal files (staging)

Contended or high-stakes writes land as proposal files (PROTOCOL.md#arbitration): one write, one file, in a hidden sibling staging directory of the item. Distinct filenames are the collision-free primitive; creating a proposal touches nothing contended.

```ebnf
staged-dir    ::= item-dir "/" item-id ".staged"
proposal-path ::= staged-dir "/" date "-" author-slug "-" base-slug ".md"
author-slug   ::= base-slug                                (* unique per writing session *)
proposal-file ::= frontmatter blank title-line blank prose-block pointer-line eol

op            ::= set-op | mark-op | append-op
set-op        ::= "set: " key " = " scalar
mark-op       ::= "mark: " ("^" anchor | quoted-text) " = " mark-name
mark-name     ::= "todo" | "in-flight" | "blocked" | "done"
append-op     ::= "append: " section-name " · " text
```

Frontmatter keys: `id` (the filename stem), `item` (item-id), `base` (`sha256:` + hex of the item version read), `author` (session or human label), `updated` (datetime), `ops` (YAML sequence of op strings). A `mark-op` addresses a step by `^anchor` when one exists, otherwise by exact quoted step text.

Structural constraints:

- The prose body (the **intent** — why, with evidence links) is REQUIRED: an op without a why cannot be arbitrated.
- The `author-slug` MUST be unique to the writing session (e.g. carry a session suffix): filename uniqueness is chosen at write time, never checked-then-created — concurrent proposers must be unable to race for one name.
- A `mark-op` setting `blocked` MUST cite a blocker link in the body; it becomes the step's `blocked-by:` continuation when applied.
- An `append-op`'s `section-name` MUST be a known section of the item's type.
- Op strings MUST NOT contain a backtick (they are backtick-quoted in resolution lines).
- Arbitrated proposals are deleted — every op either applied or overruled on the record (resolution lines below). A proposal containing any op no resolution rule decides stays staged whole with the item flagged `needs-review`, or is swept per PROTOCOL.md#arbitration.

Arbitration writes its outcome as resolution lines at the end of `## Summary` (recognized inside the summary's `prose-block`):

```ebnf
resolution-line ::= "- " date " — arbitrated " proposal-stem ": " verdict ("; " verdict)* eol
proposal-stem   ::= date "-" author-slug "-" base-slug
verdict         ::= "`" op "` ⇒ " ("applied" | "overruled" evidence?)
evidence        ::= " (" md-link (", " md-link)* ")"
```

Determinism constraints (these make gate 7 satisfiable):

- One resolution line per deleted proposal, appended in bytewise proposal-filename order; verdicts follow the proposal's `ops` order.
- Resolution lines form one contiguous block at the end of `## Summary`; when the summary's last line is not already a resolution line, exactly one blank line precedes the block. *(v0.4.5)*
- An `overruled` verdict MUST carry the proposal's evidence: the distinct md-links of its body, in body order.
- A `blocked` mark-op applied by arbitration synthesizes the step's `blocked-by:` continuation from the **first** distinct md-link of its proposal's body. *(v0.4.5)*
- The item's post-arbitration `updated` is the **maximum** `updated` across the item and the arbitrated proposals — never wall clock; `resolution-line`'s `date` is that value's date part. Arbitration takes no input beyond the item and its staged proposals.
- An arbitration that deletes the last staged proposal SHOULD remove the emptied `.staged/` directory; leaving it in place is equally conforming — an empty staging directory means nothing is pending. *(v0.4.5)*

## 10. Type schemas (`types/*.md`)

Frontmatter here allows one level of nesting for `fields` and `sections`:

```ebnf
schema-fm    ::= "schema" | "version" | "extends" | "kind" | "slug-form"
               | "fields" | "sections" | "relevance"
field-def    ::= name ": { type: " field-type (", required: " bool)?
                 (", values: [" scalar-list "]")? (", default: " scalar)?
                 (", note: " quoted )? " }"
field-type   ::= "text" | "slug" | "date" | "datetime" | "enum" | "url" | "ref" | "ref-list"
relevance    ::= "active-first" | "recent-first"
kind-value   ::= "work-item" | "record"
```

`extends` resolution is single-inheritance to `_base`; a type's effective field set is base fields ∪ own fields, own fields winning on collision. `relevance` names one of two ordering strategies: `active-first` (non-terminal by `updated` desc, then terminal, 7-day age-off from tier 1) and `recent-first` (by `date` desc).

## 11. Pointer lines

```ebnf
pointer-line ::= "<!-- arbiter:" scope " · PROTOCOL.md#" section " · " reminder " -->"
scope        ::= "tier-1" | "tier-2" | "tier-3" | "types" | "staged"
section      ::= base-slug                                 (* a heading anchor in PROTOCOL.md *)
reminder     ::= text                                      (* no "-->" *)
```

Exactly one pointer line per file (except `PROTOCOL.md` itself), as the final non-empty line. Tools MUST NOT reflow, reword, or relocate it; the normalizer appends a missing one.

## 12. Liberal input → canonical form (normalization)

Readers SHOULD accept these variants; the normalizer maps them canonically. Anything else is opaque prose, preserved unchanged (moved under `## Summary` on first touch — see PROTOCOL.md#normalization).

| Liberal input | Canonical result |
|---|---|
| Missing frontmatter / missing fields | Defaults per type schema (`status: todo`, `updated:` from mtime, `type:` from directory, `date:` from filename or mtime) |
| `* ` or `+ ` list bullets in known sections | `- ` |
| `- [X]`, `- [DONE]` | `- [x]` |
| `- [/]`, `- [WIP]` | `- [~]` |
| `ref-list` as comma-separated string (`related: a, b`) | Flow sequence (`related: [a, b]`) |
| Bare ref (`parent: q3-deploy-pipeline-2026q3`) | Qualified `object-ref` (`parent: goals/q3-deploy-pipeline-2026q3`) when exactly one object bears the id; flagged, never guessed, when ambiguous |
| Continuation lines with 2–8 spaces of indent | 6-space indent |
| Hyphen `-` or en dash `–` as entry separator | Em dash `—` |
| CRLF, missing trailing newline | LF, single trailing newline |
| Missing pointer line | Appended per file's tier |
| Un-slugged filename on a human entry | File renamed to slug form **only if never referenced**; otherwise kept and flagged |

## 13. Conformance tests (v0.5 gates)

1. **Fixpoint**: `normalize(normalize(f)) = normalize(f)` over the whole corpus.
2. **Reparse identity**: `parse(serialize(parse(f))) = parse(f)`.
3. **Canonical stability**: for canonical `f`, `serialize(parse(f)) = f` byte-for-byte.
4. **Opacity**: mutating any opaque region and re-normalizing preserves the mutation exactly.
5. **Index-is-cache**: index rebuilt twice from the same files is identical; deleting the index loses nothing. Incremental dashboard regeneration (previous dashboard's entries + items whose `updated` is newer than its `generated`) is byte-identical to a full rebuild.
6. **No-loss arbitration**: after arbitrating any set of proposals in any order, every op is either reflected in the item, recorded as `overruled` in a resolution line (with its proposal's evidence links), or its proposal is still staged — none silently discarded. Holds under clobbered writes: a proposal may be deleted only once the current item applies or records every one of its ops.
7. **Confluence**: from the same (item, staged-proposal set), arbitration in any order, by any arbiter, including concurrent duplicates, yields byte-identical items — achievable because arbitration's `updated`, resolution lines, and ordering are pure functions of the inputs (§9), with no wall-clock values.
