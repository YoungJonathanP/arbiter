# Arbiter grammar — the machine-read subset

*v0.4.12 · Normative spec for the parts of arbiter-data files that tools parse, validate, and rewrite. Companion to [`assets/contract/PROTOCOL.md`](../assets/contract/PROTOCOL.md) (the agent-facing contract) — where the two disagree, this document wins for machines. Everything **not** matched by a production here is opaque prose: tools MUST preserve it byte-for-byte and MUST NOT derive meaning from it.*

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

Frontmatter is a YAML document between `---` fences, restricted to a **flat mapping**: scalar values or flat sequences of scalars. Nested mappings are permitted in type-schema files (§9) and checkpoint inputs/predicates (§15). Keys and value types per item type are declared by `arbiter-data/types/<type>.md`; unknown keys are preserved but flagged by the validator.

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
known-section::= summary | plan-inputs | checklist | artifacts | evidence | detail-docs
plan-inputs  ::= "## Plan inputs" eol link-entry+ blank?
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

**Entry recovery (v0.4.10)**: Checklist, Artifacts, Evidence and Detail docs are
ordered mixtures of recognized entries, blank lines and opaque malformed lines.
One malformed line MUST NOT hide recognized neighbors. Preserve opaque line bytes
(including indentation and trailing spaces) and internal blanks in place; normal
LF conversion and canonical inter-section separators still apply. Valid entries
normalize independently. A malformed checklist line ends continuation attachment;
a subsequent continuation without a new recognized step is opaque and diagnosed.
Blank lines alone do not end attachment and retain their position.

Diagnostics MUST identify the 1-based line in the input snapshot, including
frontmatter and blank offsets, and name the expected `step`/`continuation`,
`link-entry` or `docs-entry` production. Malformed entries are warnings; recognized
links to missing files/anchors are distinct broken-target errors. Raw files remain
valid with warnings. Reparse after normalization to obtain new source coordinates.
Visibility-filtered previews carry a mapping to original source lines so visible
diagnostics keep source coordinates; hidden text never enters diagnostic messages.

Annotations belong inside link labels, document titles or step text (before the
optional anchor), e.g. `- note: [Plan (draft)](tasks/example-2026q3/plan.md)` or
`- [[plan]] Plan (draft) (plan) -> tasks/example-2026q3/plan.md`. No trailing
annotation or comment is accepted after a link target, docs path or step anchor.
Put longer notes in Summary or a detail document. External link targets use
HTTP(S); local links and docs paths start at the KB root. Opaque text MUST NOT
satisfy an arbitration op; a valid append may extend a mixed section while keeping
its opaque material. Source positions/layout do not affect entry deduplication.

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
entry        ::= "- " ("[" status "] ")? staged-flag? review-flag? entry-title " — " date " -> " rel-path eol
staged-flag  ::= "(" count " staged) "
review-flag  ::= "(review: " ("needed" | "legacy-unknown") ") "
overflow     ::= "- +" count " more in " item-dir "/" eol
entry-title  ::= text
```

Disambiguation: an entry line is split at its **last** `" -> "` (path), then at the **last** `" — "` before that (date); a `staged-flag` is recognized only immediately after the status bracket. `entry-title` may therefore contain any of these sequences. The `staged-flag` marks items with unresolved proposals (§9); on a work-item entry its `count` is the sum over the item **and its sub-item descendants** (which have no entries of their own). Work items carry the `[status]` prefix; record types (meetings, journal, accomplishments) omit it. The entry `date` is the date part of the item's `updated` for work items and the item's `date` for records. Work-item cards list every non-archived **top-level** item and carry no `overflow`; record cards list at most 5 entries plus an `overflow` line; the header `count` is the card's entry total. Dashboard frontmatter keys: `updated` (datetime; staged proposal files are not item touches), `generator`, `generated` (datetime), `protocol`, `inputs` (`sha256:<hex>` over verified visible inputs; legacy dashboards may omit it).

**Current projections (v0.4.9)**: every regeneration reads current facts; `updated`
is event/touch metadata, never a content-invalidation watermark. Same-minute,
quoted and delayed timestamps cannot retain stale status, title or relationships.
Incremental and full entry points use the same projection. `generated` is a display
time, not proof of freshness. CLI and renderer use `readProjection` to read source
bytes and compute `inputs`; it covers visible files, schemas, protocol and staged
bytes (excluding the generated dashboard). Pure callers without source bytes get
a fact digest instead. Compare digests only from the same producer. The renderer
regenerates on each request and labels the inputs read; it does not claim an atomic
multi-file snapshot. Age-off also depends on the caller's date. Raw items can retain
a previous entry's date as historical evidence; that fallback is not a content revision.

**Visibility (v0.4.9)**: default derived views exclude private items, private documents
and files owned by private items, before computing navigation, relationships, counts,
staged rollups or overflow. Only relationships to visible existing objects survive.
Public previews omit lines containing known private identifiers or titles, including
raw/agent previews; original source bytes are unchanged. This is conservative literal
redaction, not classification of arbitrary copied or paraphrased secrets. Authors must
still keep private material out of public prose. Unresolved carried dashboard entries
and opaque dashboard strays cannot prove visibility and are omitted from derived
output. A CLI regeneration retains the previous dashboard in its commit journal;
recover human additions from that snapshot and create an explicitly classified item.
No automatic public stub is created. The read-only renderer retains the stored file.

**Review (v0.4.9)**: optional universal `review: needed | legacy-unknown` is independent
of execution `status`. Triage sets `review: needed` on stale nonterminal work without
changing its status, checklist or blockers. Arbitration sets review on unresolved
proposals without absorbing the resulting execution state. Review is sticky until
explicitly resolved; a successful write or arbitration does not silently clear it.
Remove the field after review. Legacy `status: needs-review` remains accepted and
projects as `review: legacy-unknown` when no explicit review field exists: the prior
execution state is unknown. A reviewer must choose a supported execution status from
evidence and explicitly resolve/remove review; never infer todo from an old timestamp.
T05 must use a separate checkpoint readiness field, not reuse `status` or `review`.

**Membership (v0.4.9)**: a work item is a **sub-item** iff its `parent` resolves to a
visible, non-archived, nonterminal work item in the same `item-dir`; otherwise it is
**top-level**. Children of terminal parents are promoted immediately, before parent
age-off. Sub-items stay off tier 1; their child list is derived from parent refs.
Structural validation still flags unsupported multi-level nesting and cycles.
Projection breaks cyclic hiding so invalid cycles also retain a reachable route.

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

Frontmatter keys: `id` (immutable filename stem), `item` (canonical object-ref `<dir>/<id>`; legacy bare item-id accepted only when it matches the owning staging directory), `base` (`sha256:` + hex of the item version read), `author` (session or human label), `updated` (datetime), `ops` (YAML sequence of op strings). A `mark-op` addresses a step by `^anchor` when one exists, otherwise by exact quoted step text.

Structural constraints:

- The prose body (the **intent** — why, with evidence links) is REQUIRED: an op without a why cannot be arbitrated.
- The `author-slug` MUST be unique to the writing session (e.g. carry a session suffix): filename uniqueness is chosen at write time, never checked-then-created — concurrent proposers must be unable to race for one name.
- A `mark-op` setting `blocked` MUST cite a blocker link in the body; it becomes the step's `blocked-by:` continuation when applied.
- An `append-op`'s `section-name` MUST be a known section of the item's type.
- Op strings MUST NOT contain a backtick (they are backtick-quoted in resolution lines).
- Arbitrated proposals are deleted — every op either applied or overruled on the record (resolution lines below). A proposal containing any op no resolution rule decides stays staged whole with the item flagged `review: needed`, or is swept per PROTOCOL.md#arbitration.

Arbitration writes new resolution lines in the prose section `## Arbitration history`, after operational sections. Historical prose and legacy Summary resolution blocks MUST remain in place. The Summary is reserved for current continuation context. This placement is a v0.4.8 writer contract; legacy 0.4.6 corpora remain readable, with the new history heading treated as opaque prose by older readers:

```ebnf
resolution-line ::= "- " date " — arbitrated " proposal-stem ": " verdict ("; " verdict)* eol
proposal-stem   ::= date "-" author-slug "-" base-slug
verdict         ::= "`" op "` ⇒ " ("applied" | "overruled" evidence?)
evidence        ::= " (" md-link (", " md-link)* ")"
```

Determinism constraints (these make gate 7 satisfiable):

- One resolution line per deleted proposal, appended in bytewise proposal-filename order; verdicts follow the proposal's `ops` order.
- New resolution lines form a contiguous block at the end of `## Arbitration history`; when its last line is not a resolution line, exactly one blank line precedes the block. Legacy Summary blocks are preserved. *(v0.4.8)*
- An `overruled` verdict MUST carry the proposal's evidence: the distinct md-links of its body, in body order.
- A `blocked` mark-op applied by arbitration synthesizes the step's `blocked-by:` continuation from the **first** distinct md-link of its proposal's body. *(v0.4.5)*
- The item's post-arbitration `updated` is the **maximum** `updated` across the item and the arbitrated proposals — never wall clock; `resolution-line`'s `date` is that value's date part. The pure resolver takes the item, fresh staged proposals and optional resolved type schema. Durable completed receipts filter identical replays before resolution; receipt timestamps never enter item `updated`.
- An arbitration that deletes the last staged proposal SHOULD remove the emptied `.staged/` directory; leaving it in place is equally conforming — an empty staging directory means nothing is pending. *(v0.4.5)*

### 9.1 Verified effects and recovery (v0.4.8)

- Parse every append using its target production: Summary text, Checklist step text without the bullet/mark prefix, Artifacts/Evidence link entry without the bullet, or Detail docs entry without the bullet. Missing eligible sections are created in their actual AST variant. Unknown headings, malformed entries/sections, duplicate target headings and ambiguous marks stay staged. Schema-aware callers restrict fields/sections to the item's resolved type. Identity and capture metadata (`id`, `type`, `created`, `updated`) are protected from set ops.
- `applied` is assigned only after serialization and verification in the parsed field/step/entry. A receipt's own text is never proof of an effect. Structurally superseded marks/statuses get explicit `overruled` receipts with retained intent/evidence. No-op satisfaction is an applied effect. Unsupported proposals remain staged whole; terminal status is preserved on escalation, so repeated attempts cannot bypass terminal-reversal protection. Unresolved proposals set separate sticky review metadata; execution status and blockers survive.
- Every cooperating writer uses `commitFile` (including CLI write/new/regen/normalize, arbitrate and triage); `stageProposal` uses the same lock. A local SQLite `BEGIN IMMEDIATE` transaction serializes the corpus, a stronger guarantee than a per-item mutex, and releases on process death. SQLite contains only the lock, never recovery truth. Network/shared filesystem locking is outside this guarantee.
- Before replacement, fsync `.arbiter/transactions/<UUID>.json` (format version 1) with `id`, `target`, `before` (string or null), `after`, `state`, full `proposals` and `receipts`. Each receipt contains immutable proposal `id`, `filename`, content `digest` (bare SHA-256), and ordered `ops` (`raw`, `verdict`, `reason`). `committedIn` identifies the original transaction snapshot; `replayed: true` marks duplicate cleanup without claiming a fresh effect. Recheck the base, fsync a same-directory temporary file, rename atomically and fsync the parent. Verify observed bytes and parsed postconditions, then durably mark `complete` before deleting matching proposal bytes. Mark `cleaned` after cleanup. Never delete a changed proposal using an old digest.
- Recovery runs under the same lock, explicitly with `recover` or before writing a target. A prepared journal whose current file equals `before` is replayed; equality with `after` finalizes the observed replacement. Divergence records `conflict`, `observed`, and `reason` and retains staged proposals. Unfinished cleanup also checks the current file before proceeding. Complete, cleaned receipts remain durable history and make identical proposal replay a no-op even if later writes supersede the effect. ID reuse with different bytes stays staged. Conflicts remain readable evidence; reconcile against current bytes with a new base/proposal. The old journal is never erased to claim success.
- `.arbiter/transactions/` is canonical history, MUST be backed up with the KB and MUST NOT be deleted as an index cache. `recover --dry-run` inspects it without writes; validate/doctor report pending/conflicted journals. Its retention is independent of future current-checkpoint replacement (T05). Bulk history pruning, automatic three-way conflict resolution and checkpoint schemas are deferred.
- Base checks and postconditions detect many external-editor races, preserving before/after/observed bytes. External editors and bare file tools do not acquire the lock: no atomic CAS guarantee can be made for edits in the check-to-rename window or after final verification. The protocol requires these writers to use the shared boundary for the cooperating guarantee. A corpus scan or multi-item triage is not a multi-file transaction.

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
scope        ::= "tier-1" | "tier-2" | "tier-3" | "types" | "staged" | "checkpoint"
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
5. **Index-is-cache**: index rebuilt twice from the same files is identical; deleting the index loses nothing. Incremental dashboard regeneration from current facts is byte-identical to a full rebuild, including same-minute and older-timestamp edits. Visibility applies before all derived counts and relationships. Re-parenting is an observed transition: a `parent` change that makes an item a sub-item removes its card entry, and one that makes it top-level restores the entry — in both directions nothing is lost or duplicated by going unseen. *(v0.4.6)*
6. **No-loss arbitration**: after arbitrating any set of proposals in any order, every op is either reflected in the item, recorded as `overruled` in a resolution line (with its proposal's evidence links), or its proposal is still staged — none silently discarded. For cooperating filesystem writers, proposals may be deleted only after verified replacement and durable intent/receipts. Crash replay and external-editor limitations are specified in §9.1; pure merge confluence alone does not establish filesystem CAS.
7. **Confluence**: from the same (item, staged-proposal set), arbitration in any order, by any arbiter, including concurrent duplicates, yields byte-identical items — achievable because arbitration's `updated`, resolution lines, and ordering are pure functions of the inputs (§9), with no wall-clock values.

## 15. Current task checkpoints (v0.4.11)

A task may carry optional scalar `owner`, `phase`, and `checkpoint`. Owner is one
accountable identity or `unassigned`; omission means unknown. Phase groups tasks
and implies neither ownership nor blocking. `checkpoint`, when present, MUST equal
`tasks/<id>/checkpoint.md` and resolve. It is a stable path, not a version hash.
Goals coordinate tasks and use ordinary detail documents for their own narrative.

Two new path roles precede ordinary detail classification:

```ebnf
current-checkpoint ::= "tasks/" work-id "/checkpoint.md"
checkpoint-history ::= "tasks/" work-id "/checkpoints/" hex{64} ".md"
checkpoint-file    ::= frontmatter blank title-line blank prose-block pointer-line eol
```

Checkpoint syntax reuses the document AST and serializer; body headings stay
opaque except `## Evidence`, which uses §5 link entries. Checkpoint normalization
is byte-preserving: versioned bytes are changed only by explicit replacement.
Both roles carry `role: checkpoint` and the same pointer:
`<!-- arbiter:checkpoint · PROTOCOL.md#checkpoints · recheck inputs before resuming -->`.
A history file MUST equal the SHA-256 digest in its filename; it retains its old
body and metadata unchanged. It is not an ordinary tier-3 document. History MUST
be omitted from normal projections, raw HTTP views and handoff context.

Required scalar frontmatter:

| Field | Meaning |
|---|---|
| role | Literal `checkpoint` |
| task | Owning task object ref matching path |
| kb | `urn:uuid:<lowercase UUID>` matching installed PROTOCOL.md `kb-id` |
| repository | HTTP(S) repository identity or logical `urn:...`; local path mapping is receiver-owned |
| branch, revision | Observed workspace branch and revision, or explicit `unknown`/`not-applicable`; recheck through a start predicate before implementation |
| owner | Observation of task owner; differs/unknown means review |
| readiness | `unprepared`, `ready`, `waiting`, `review-required` |
| captured, verified | Datetimes including time; observations, never conflict precedence |
| previous | `none` for first capture, otherwise exact prior `sha256:<hex>` |

Optional `visibility: private` and unknown keys are preserved (unknown keys warn).
Duplicate keys are errors. `conflicts` is a required flat sequence: `[]` when
explicitly resolved, otherwise each entry identifies a decision conflict and its
source evidence. Required nonempty, unique body sections: Assignment (outcome,
scope and exclusions), Authority (authorized actions and source), Verified state
(observation and stopping point), Constraints (rules/decisions with provenance),
Next actions (one to three actions and stopping condition), Completion (observable
acceptance), Evidence (one or more §5 link entries). Optional sections may hold
questions, scoped readings and offline limitations. Required meaning is authored
and reviewed; machines do not infer that arbitrary prose proves authority.

Nested mappings (§4 exception) are permitted for exactly two checkpoint fields.
Each mapping is nonempty, keyed by unique kebab-case record IDs; values are flat
flow mappings with exactly the following scalar fields:

```yaml
inputs:
  decision: { source: kb:tasks/example-2026q3/plan.md, revision: sha256:<hex>, observed: 2026-09-07T12:00, purpose: governing decision }
predicates:
  dependency: { state: met, owner: agent-session, condition: prerequisite accepted, evidence: "https://example.test/review at revision abc" }
conflicts: []
```

Input `source` is `kb:<KB-root-relative-file>`, `repo:<repository-relative-file>`,
or an HTTP(S) URL. Local inputs use exact UTF-8 byte SHA-256 revisions; external
inputs use an immutable observed revision or `unknown`. `observed` is a datetime;
`purpose` selects why this file is needed, including the relevant section/anchor.
Hashes cover whole files, even when reading only the named section. No absolute,
empty-component, dot/traversal, backslash, or transaction paths are accepted.
Dashboard, checkpoints and checkpoint history cannot be KB input authority.
Required inputs are the owning task, PROTOCOL.md, types/_base.md and types/task.md;
add the assignment's selected dependency/decision/code inputs. No recursive
expansion of descendants or history. Evidence and source URLs do not trigger I/O.

Predicate `state` is `met | unmet | unknown`; `owner`, `condition` and `evidence`
are nonempty scalars. `unknown`, `unassigned` or `none` in owner/evidence marks a
predicate unresolved. At least one predicate is required, including receiver
workspace/authority verification where implementation depends on it. Predicates
must name checks and evidence, not merely phase labels or timestamps.

Effective readiness is conservative: malformed/missing required content ⇒
unprepared; otherwise stale/missing/unverified inputs, unknown owner/gates,
explicit conflicts, KB mismatch, pending owning proposals or task review ⇒
review-required; otherwise an unmet predicate ⇒ waiting; otherwise retain the
authored readiness. A new observation may downgrade readiness, never promote it
automatically. Capturing resolved evidence is an explicit new version. None of
these changes execution status or clears review. A newer timestamp cannot resolve
contradictory decisions. `unknown` branch/revision cannot support implementation
until the receiver checks the workspace; `not-applicable` requires an explanatory
scope/predicate. Static validation cannot prove external systems or prose claims.

All successful current-file replacements MUST require CAS, reject pending owning
task proposals, verify `previous` against current bytes, and retain those bytes
at the history path under the cooperating writer lock BEFORE journal/install.
History writes are immutable (identical replay is allowed). An interrupted write
may leave an extra snapshot; preserve it. The shared journal recovers current
replacement; no multi-file transaction or external-editor guarantee is implied.
Whole-KB validation verifies history digests and previous links; normal checkpoint
assessment does not read history. Preserve applicable constraints in the current
body so the receiver never needs a recursive history chain.

The v0.4.11 size policy is §Checkpoints in the bootstrap protocol and the
[decision](v0.4.11-checkpoints.md): warnings, not content loss. A normal export
MUST refuse more than 10 KiB UTF-8 unless an explicit larger maximum and reason
are recorded in the previewed packet. Measure the ENTIRE output including headers,
manifest, protocol excerpts, override record and inlined references. A size override
never grants authority or overrides readiness/visibility restrictions. Capture/export tooling implements this policy through the shared preview contract;
see [the tooling decision](v0.4.12-handoff-tooling.md).

Legacy KB versions remain valid without checkpoint fields or identity. Explicit
adoption adds the installed protocol/schema contract and UUID; old manual packets
are not implicitly checkpoints. Never overwrite a historical detail document to
create this file role. Bootstrap templates have no shared KB UUID; init creates
one per KB. Independent forks change identity explicitly; replicas preserve it.
