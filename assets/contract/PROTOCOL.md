---
id: protocol
version: "0.4.12"
---

# Arbiter agent protocol

Read this file once per session. Every other file in this directory tree ends with a one-line `arbiter:` pointer naming its tier and the section here that governs it — that pointer plus this file is all the navigation instruction you need.

## Scope

- Arbiter is collaborative: humans and agents read and write these files, at any tier.
- Work at exactly one tier at a time. **Never bulk-read sibling items**; open only the files your current tier points to.
- Layout: `DASHBOARD.md` (tier 1) → item files in `tasks/`, `goals/`, `meetings/`, `journal/`, `accomplishments/` (tier 2) → detail docs in `<dir>/<id>/` (tier 3). `types/` holds one field schema per item type — read `types/<type>.md` before writing a type for the first time in a session.
- Every link target, in every file, is a path from the data-directory root (`tasks/<id>.md` works from anywhere), optionally suffixed `#^<anchor>`. Never write file-relative paths.

## Tier 1

- `DASHBOARD.md` answers "what happened recently, what should happen next" in one read.
- The index is regenerated from current file facts. `generated:` is a display time; `inputs:` identifies verified visible source inputs. Treat an unverified stored index as advisory and trust current item files.
- Both regeneration modes scan current files and use the same projection. Never use `updated` versus `generated` to decide content freshness: edits can share a minute or apply older arbitration evidence. Private files are excluded before deriving entries, counts and relationships.
- Frontmatter: `updated` (latest item touch; staged proposal files do not count as touches), `generator`, `generated`, `protocol`. `inputs: sha256:<hex>` records the visible source digest (legacy dashboards may omit it).
- One `## <Card> (<total>)` section per card. Entry grammar, one line per item:
  - Work items: `- [<status>] <title> — <YYYY-MM-DD> -> <path>`
  - Records (no status): `- <title> — <YYYY-MM-DD> -> <path>`
  - Pending arbitration: `- [<status>] (<N> staged) <title> — <YYYY-MM-DD> -> <path>` — unresolved proposals in `<id>.staged/` (see #arbitration); for work items `<N>` also counts proposals staged on the item's sub-items, which have no entry of their own. This flag is the most urgent thing on a card: arbitrate before other work.
  - Overflow (record cards only): `- +<N> more in <dir>/`
- The entry date is the date part of the item's `updated` for work items, and its `date` for records.
- Review flag: `(review: needed) ` or `(review: legacy-unknown) ` follows the optional staged flag and precedes the title; it never replaces the status bracket.
- Children of terminal, archived, private or missing parents are promoted to tier 1; invalid cycles also remain reachable while validation reports the error.
- Work-item cards (tasks, goals) list every non-archived **top-level** item, ordered by the type's relevance rule (see `types/`): non-terminal by recency first, terminal last. Terminal items age off the card 7 days after closing; archived items never appear. A **sub-item** — one whose `parent:` resolves to an visible, non-archived, nonterminal work item in the same directory (a task under a task) — never appears on the card: it is reached through its parent (see #tier-2). The card is the complete active set of top-level work — a session initializes from this one read, never by searching directories.
- Record cards (meetings, journal, accomplishments) list the 5 most recent non-archived entries plus an overflow count; older records are reached by recency paging at tier 2, never carried on the card.
- The header `<total>` counts the card's non-archived items.
- The `-> <path>` is the only file to open next.
- Human additions remain source material, but unverifiable dashboard stubs and opaque strays are omitted from derived views for privacy. CLI regen retains the old dashboard in `.arbiter/transactions/`; recover the addition there and create an explicitly classified item. The renderer leaves the stored dashboard untouched.

## Tier 2

- One file per item: `<dir>/<id>.md` — everything needed to continue or update the item: frontmatter, `# <title>`, `## Summary`, then the type's other sections (`## Plan inputs`, `## Checklist`, `## Artifacts` or `## Evidence`, `## Detail docs`).
- Field schemas live in `types/<type>.md`. Universal fields are in `types/_base.md`: `id`, `type`, `title`, `updated`, `visibility`, `parent`, `related`, `normalized`.
- Directories page at 10 items by recency; search the current page before requesting older ones. Recency views skip archived objects (see #archive). The journal is date-segmented: tier 2 shows the last 7 days first, older entries behind pagination.
- Checklist line grammar (marks: `[ ]` todo · `[~]` in-flight · `[!]` blocked · `[x]` done):

  ```
  - [<mark>] <step text> <!-- ^<anchor> -->
        blocked-by: [<label>](<target>)
        see: [<label>](<target>)
  ```

  Checklist rows carry the work, current state, next action and standing constraints. Put detailed history and verification narratives in a tier-3 doc linked by `see:` and `Detail docs`; relocate existing detail verbatim under a dated heading.

  The trailing anchor comment and the indented `blocked-by:`/`see:` lines are each optional; continuation lines are indented exactly six spaces. A `[!]` mark **must** carry a `blocked-by:` line. Update marks in place.
- **Blocked items**: on opening an item with a `[!]` mark, check the blocker target's state first and update the mark before any other work (a still-live blocker means no change — leave the `[!]` in place).
- **Staged proposals**: if `<dir>/<id>.staged/` is non-empty, do not edit the item directly — read the pending proposals, stage your change, and arbitrate (see #arbitration).
- Relations: `parent:`, `related:`, `source:`, and `prev:` frontmatter name other objects by permanent object ref `<dir>/<id>` (e.g. `goals/q3-deploy-pipeline-2026q3`) — epics, siblings, sources, predecessors. Reach for a related item **only** when the current item lacks the answer.
- **Nesting**: `parent:` may name an item of the same type — a task whose parent is a task is a **sub-task** (goals likewise). Sub-items stay off tier 1 (see #tier-1); a parent's rendered view nests its children as summary entries (status dot, title, one-line summary, -> link), each opening the child's own full view. The child list is **derived from the children's `parent` refs** — like prev-chains, the forward pointer is computed, never stored; nothing is added to the parent file. With file tools, find children via `arbiter query children <dir>/<id>`; a parent SHOULD carry a `see:` link to a load-bearing child from the checklist step it serves. Keep nesting to one level — the validator flags deeper chains.
- Follow a `## Detail docs` pointer only when the summary and checklist do not answer the question. Do not open unlinked siblings.
- Optional `## Plan inputs` appears before Checklist and uses the same link-entry grammar as Artifacts. It names selected plans/reference inputs; produced artifacts remain in Artifacts, and row anchors, external ticket/PR links and `see:` targets remain accessible.
- Artifact/Evidence entries: `- <kind>: [<label>](<target>)`; Detail-doc entries: `- [[<doc-id>]] <title> (<kind>) -> <path>`. Local targets and paths start at the KB root (for example `tasks/example-2026q3/plan.md`); external links use HTTP(S).
- Annotations go inside the label (`[Plan (draft)](...)`), inside the doc title (`Plan (draft) (plan) -> ...`), or in step text before its optional anchor. Trailing annotations/comments after the target, doc path or anchor are malformed; put longer explanations in Summary or a detail doc.
- A malformed entry stays verbatim in its original position; valid neighbors still navigate and normalize. `validate` reports its source line and expected syntax separately from broken targets. Repair that line explicitly. A malformed checklist line ends continuation attachment until a new valid step; blanks alone do not. Arbitration accepts only parsed effects, even in mixed sections.

## Tier 3

- `<dir>/<id>/<doc-id>.md` — plans, investigations, reports, notes: the full-context material, linked explicitly from the item's `## Detail docs`.
- Frontmatter: `id`, `kind` (`plan` | `investigation` | `report` | `note`), `item` (owning item id), `updated`. `inputs: sha256:<hex>` records the visible source digest (legacy dashboards may omit it).
- Read-mostly. Append new findings under a dated heading; do not rewrite history.

## Statuses

- `todo` · `in-flight` · `blocked` · `done` · `dropped` · `needs-review`. Only work items (tasks, goals) carry status; meetings, journal entries, and accomplishments are records.
- `done` and `dropped` are terminal. Dropped work is excluded from accomplishments.
- `status: blocked` requires at least one `[!]` checklist step with a `blocked-by:` link (or a `blocked-by:` line directly under `## Summary` when there is no checklist).
- Triage sets `review: needed` on nonterminal work untouched for 14+ days, preserving execution status and blockers. Arbitration also flags unresolved proposals with review metadata. Review stays until explicitly resolved; remove the field after review. Legacy `status: needs-review` has unknown prior execution state and projects as `review: legacy-unknown`; choose a real execution status from evidence, never guess todo. Checkpoint readiness is separate; see #checkpoints.

## Slugs

- The `id` is the filename and is an **immutable address**: once created it never changes, even when the title does.
- Forms, by type:
  - task, goal, accomplishment: `<base>-YYYYqN` (year + quarter of creation, e.g. `archived-constraint-fix-2026q3`)
  - meeting: `<base>-YYYY-MM-DD` (meeting date, e.g. `standup-2026-07-03`)
  - journal: free kebab-case `<base>`; suffix with `-YYYY-MM-DD` only on collision
- `<base>` is lowercase kebab-case, descriptive, stable under retitling.
- Ids are unique within their directory only; sibling directories may reuse one (a done task and the accomplishment distilled from it often share base and quarter).
- **Reopen rule** (work items only): before creating, search the directory for the same `<base>` within ±2 quarters — if found and the work recurs, reopen that item (update status, append to checklist); beyond the window it is a new item with a new quarter suffix.
- The **object ref** `<dir>/<id>` is the permanent address used by every ref field (`parent`, `related`, `source`, `prev`). Files never move (see #archive), so an object ref never breaks.
- **Iteration chains**: work continuing beyond the reopen window becomes a new item carrying `prev: <dir>/<id>` of its predecessor. `prev` is written once, at creation, and never contended; the forward pointer is derived by the index and regeneration, never stored. Reports walk chains to reconstruct arcs that span quarters or years.

## Anchors

- A checklist step that must be referenced from elsewhere gets a trailing anchor comment: `<!-- ^railway-predeploy -->`. Reference it as `<path>#^<anchor>`, e.g. `goals/q3-deploy-pipeline-2026q3.md#^railway-predeploy`.
- Anchors are kebab-case, unique within their file, and immutable once referenced — they survive step rewording and reordering. Add an anchor only when a step actually becomes a link target.

## Pointers

- Every file except this one ends with a single footer line:
  `<!-- arbiter:<scope> · PROTOCOL.md#<section> · <one-line reminder> -->`
  where `<scope>` is `tier-1`, `tier-2`, `tier-3`, `types`, `staged` (proposal files), or `checkpoint`.
- A raw human file may lack the footer; it stays valid, and normalization appends the pointer on first touch.
- The pointer is the file's only embedded instruction. Never add navigation guidance inside item files; never remove or reword a pointer while doing item work.

## Arbitration

Concurrent writers negotiate through recorded intent, never overwrites. The write path:

1. **Remember your base.** Note the item's content (hash or text) as you read it.
2. **Commit through the shared writer boundary.** Use `arbiter write <path> --if-match <sha256:hex>` with content from stdin or `--file`. The CLI rechecks the base and sticky staging under a local SQLite writer lock, saves a durable before/after journal, atomically replaces the file and checks postconditions. CLI write/new/regen/normalize, arbitration, triage and propose cooperate. Bare file tools and external editors do not hold this lock: detected competing bytes are preserved as conflicts; there is no atomic CAS guarantee against external editors or on network filesystems. After interruption run `arbiter recover --data <kb>`; use `--dry-run` for read-only inspection.
3. **Contention → rebase or propose.** Diff the current file against your base.
   - Your ops commute with what changed (different fields or steps; pure appends), nothing is staged, and nothing is high-stakes → rebase onto the current state and retry step 2, at most twice.
   - Otherwise — overlapping ops, anything already staged, a high-stakes edit (any transition to or from `done`/`dropped`, or reversing a change less than 48 hours old), or retries exhausted → write a proposal file: `<dir>/<id>.staged/<YYYY-MM-DD>-<author>-<base-slug>.md`, frontmatter `id` (the immutable filename stem), `item` (canonical object ref `<dir>/<id>`; legacy bare IDs accepted within the owning staging directory), `base` (hash of the version you merged against), `author`, `updated`, `ops`, body = **why**, with evidence links. `ops` is a YAML list of op strings in exactly these forms: `set: <key> = <value>` · `mark: ^<anchor> = todo|in-flight|blocked|done` (address by `mark: "<exact step text>" = …` only when the step has no anchor) · `append: <Section> · <text>`. A mark-op setting `blocked` must cite the blocker link in the body; that link becomes the step's `blocked-by:` line when applied. The author label must be unique to your session (include a session suffix): filename uniqueness is chosen, never checked-then-created. Staging is sticky: while any proposal pends, every writer stages, so one arbitration pass sees all hands.
4. **Arbitration.** Anyone may invoke `arbiter arbitrate <dir>/<id>`. The resolver is deterministic over current bytes and fresh staged proposals. Applied operations must be verified in the parsed target structure; malformed/unsupported proposals remain staged whole. Explicitly overruled operations retain evidence and a durable disposition. New resolution lines go in `## Arbitration history`, after operational sections; preserve historical Summary prose and legacy resolution lines in place. `updated` remains the maximum input timestamp, never wall clock. A durable receipt in `.arbiter/transactions/<transaction-id>.json` binds each immutable proposal ID to its SHA-256 digest, original intent, verdicts and before/after item bytes. Delete staged intent only after the replacement and receipt are durable and verified. Identical proposal replay is a no-op; reusing an ID for different bytes remains staged. Use `arbiter propose <dir>/<id> --op '<op>' --intent '<why>'` for a unique scaffold; edit its ops list before first arbitration if needed.

The `.arbiter/transactions/` history is canonical recovery data, not an index cache: retain and back it up with the KB. Recovery replays prepared writes when the base still matches, finalizes observed replacements, and preserves conflicting external bytes without overwriting them. Conflict journals are durable dispositions; read their before/after/observed bytes, reconcile into the current item with a fresh-base write (or new proposal when staging is sticky), and retain the journal as evidence. Receipt history is independent of the bounded current checkpoint and its retained versions (see #checkpoints).

Resolution rules:

| Conflict | Rule |
|---|---|
| Both set `status` | Structure decides: merge checklist ops first, recompute status from marks (`[!]` with a live blocker ⇒ `blocked`; all `[x]` ⇒ `done` candidate). An explicit status that contradicts the merged structure loses. |
| Same step, different marks | Take the further mark (`todo < in-flight < done`) — unless one is `[!]` with a `blocked-by:` link: blocked wins. |
| Terminal reversal | Never auto-resolved. Propose, citing the closer's evidence; a human confirms if the closer's session is gone. |
| Prose vs prose (same section) | No auto-merge, ever. Both stage; `review: needed`, with execution status preserved. |
| Duplicate creation | Later item merges into the earlier one (reopen rule), then is deleted before anything references it. |
| Append vs append | Always merge; dedupe byte-identical entries. |

**Sweep:** triage arbitrates or escalates any proposal older than 24 hours whose author never returned. A crashed session's proposal still speaks for it.

## Normalization

- Humans may drop minimal entries anywhere: a title line plus prose is a **valid** file. Do not reject or block on format.
- Defaults when fields are missing: `status: todo` (work items), `updated:` file modification date, `type:` from the parent directory, `date:` from the filename or modification date (records), `created:` from the slug's quarter (work items) or `date` (records). Prefer dated evidence (a dashboard entry, git history) over the filesystem mtime when they disagree — checkouts falsify mtimes.
- A bare ref (an id without its directory) is liberal input: qualify it to `<dir>/<id>` when exactly one object bears that id; when two do, flag it — never guess.
- On first touch, normalize: add frontmatter, infer status from the prose, move the original text under `## Summary` **unchanged**, set `normalized: <date>`, and append the tier pointer line.
- Normalization is idempotent: normalizing an already-normalized file changes nothing. Never discard human prose. Repair, then continue with the actual task.

## Visibility

- Any item may carry `visibility: private`; owned documents/proposals inherit that exclusion. Private documents are also excluded. Default dashboards, queries, previews, human/agent views and future exports exclude private titles, relationships and counts. Explicit direction to inspect a private file does not authorize quoting it into another context.

## Accomplishments

- **Evidence is the driver**: every accomplishment carries at least one verifiable link — merged PR, published doc, dashboard — under `## Evidence`. Impact first, mechanism second, numbers where they exist.
- When a work item reaches `done`, distill a one-line, review-ready accomplishment into `accomplishments/` with evidence links back to the source item.
- Accomplishment files are records, not work items: no status, never reopened. They age into the archive like everything else but are **never deleted** — reports search the archive.

## Archive

- Archival is a **flag, never a move**: triage stamps `archived: <YYYY-MM-DD>` on terminal work items and on records older than a quarter. Files stay where they are forever — every path and object ref is permanent.
- Archived objects leave all recency views (dashboard cards, tier-2 pages); reports and explicit lookups still read them. Un-archiving is deleting the field.
- Archival never deletes; accomplishments in particular survive indefinitely for review-season reports.

## Capture

- Capture is cheap: one line appended now beats a perfect entry never written. Structure is added lazily on the next touch.
- Prefer updating an existing item over creating a near-duplicate; apply the reopen rule first.
- Every externally useful link (PR, design doc, dashboard, Figma) belongs in `## Artifacts` (or `## Evidence`) of the item it serves, not in prose.


## Checkpoints

A task is one independently assignable, verifiable outcome. Split independent
outcomes into child or related tasks, keeping their original ticket links. A long
row that only explains the same outcome gets a detail document, not a new task.
Goals coordinate broader outcomes, usually across tasks/weeks; duration alone is
not a rule for creating one. Coordinators select work and maintain shared choices;
they do not own every implementation log. Optional task `phase` groups work without
implying blocking or permission. Keep nesting shallow and blockers explicit.

A task may have one accountable `owner` (or `unassigned`) and optional `checkpoint:
tasks/<id>/checkpoint.md`. The fixed file is a replaceable current continuation
view, a distinct role from append-only tier-3 history. Required frontmatter:
`role: checkpoint`, `task` object ref, `kb` matching this protocol's `kb-id` UUID
URN, `repository` URL/logical URN, observed `branch` and `revision`, observed
`owner`, `readiness`, `captured`, `verified`, and `previous` (none or SHA-256).
End with `<!-- arbiter:checkpoint · PROTOCOL.md#checkpoints · recheck inputs before resuming -->`.

Required body sections: Assignment (outcome/scope/exclusions), Authority (actions
and authorization source), Verified state (observed result/stopping point),
Constraints (current rules with provenance), Next actions (1–3 and stopping
condition), Completion (acceptance), Evidence (ordinary typed Markdown links).
Distinguish facts, user decisions, proposals and unknowns. Carry all essential
constraints directly, citing history only as optional support.

Use nonempty `inputs` and `predicates` nested mappings; keys are stable kebab-case
record IDs. Each value is a flat flow mapping, as in type schemas:

```yaml
inputs:
  task: { source: kb:tasks/example-2026q3.md, revision: sha256:<hex>, observed: 2026-09-07T12:00, purpose: assignment and current owner }
predicates:
  start: { state: met, owner: agent-session, condition: workspace and authorization verified, evidence: current session observation }
conflicts: []
```

Inputs require source, revision, observed time and purpose/selected section.
Include the task, PROTOCOL.md, types/_base.md, types/task.md and selected code,
decision/dependency inputs. KB/repo relative paths use `kb:`/`repo:` and byte hashes;
external HTTP(S) sources use immutable observed revisions or `unknown`. Exclude
checkpoints, dashboard and transaction/history expansion. Predicates require
state (`met | unmet | unknown`), owner, condition and evidence. Record unresolved
decisions with provenance in `conflicts`; leave an explicit empty sequence only
when resolved. New timestamps never settle contradictory decisions.

Readiness (`unprepared | ready | waiting | review-required`) is independent of
execution status and sticky review. Missing content is unprepared; changed or
unverified inputs, conflicting decisions, unknown owners/gates, identity mismatch,
pending task proposals or task review require review; an unmet predicate is
waiting. Observations can downgrade readiness but never silently promote it.
Unknown/absent task owner is not a claim of ownership. Receivers check source
revisions, branch/worktree, authority and live predicates before implementation.
Static validation cannot prove authored prose or external state.

Replacement uses the shared write path with explicit CAS. The writer archives
old exact bytes to `tasks/<id>/checkpoints/<sha256-hex>.md` under the local writer
lock before installing current bytes; `previous` must match that hash. It refuses
pending owning-task proposals and overwriting legacy detail at the reserved path.
History is immutable and may retain extra versions from interrupted captures.
Retain it and `.arbiter/transactions/` in backups. Ordinary detail remains
append-only; the checkpoint role is its explicit exception. Normal reads do not
follow previous versions; history is omitted from default projections/raw HTTP.

Bootstrap a receiving session with this installed protocol once, the selected
task and its current checkpoint, then only named relevant sections. No recursive
handoffs or sibling bulk reads. Resolve portable KB/repository identities to local
paths. An offline packet includes applicable protocol excerpts and essential
constraints, labels snapshot limits and missing capabilities, and supports only
planning until workspace/authority/live predicates are checked. A handoff does
not grant publication, messaging, merge or external-system authority.

Initial size targets: overview 4 KiB UTF-8, task Summary 1 KiB, full checklist row
400 Unicode code points, complete handoff 6 KiB. Warn at these targets; suggest
scoped splitting or verbatim detail extraction, retaining anchors and identifiers.
Normal export ceiling is 10 KiB; require an explicit larger byte maximum and reason
recorded in the preview above it. Count ALL emitted context: metadata, manifests,
protocol excerpts, constraints and inlined sources, including the override itself.
Never truncate. Larger budgets do not override privacy, readiness or authority.
Use checkpoint draft/preview/capture and handoff preview/export tooling or the local
task editor. Capture and export recheck reviewed source bytes; refresh stale previews.

Installed upgrades are explicit. Older manual packets remain ordinary documents;
retain their bytes when importing. Init assigns a fresh `kb-id: urn:uuid:<uuid>`;
replicas preserve it, independent forks deliberately change it. Never copy the
bootstrap protocol over an installed KB to adopt a design without authorization.
