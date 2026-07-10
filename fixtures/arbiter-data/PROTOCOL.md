---
id: protocol
version: "0.4.4"
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
- The index is regenerated programmatically; its `generated:` frontmatter says how fresh it is. Treat a stale index as advisory and trust the item files. Where no app is present, an agent asked to refresh the dashboard applies these same rules.
- Regeneration is **incremental, never a full scan**: start from the previous dashboard's entries, fold in every item whose `updated` is newer than the previous `generated`, and drop an entry only on an observed transition (archived, or terminal past its 7-day age-off). An entry can never be lost by going unseen. Only rebuilding a deleted dashboard reads everything (grammar gate 5 guarantees the results match).
- Frontmatter: `updated` (latest item touch; staged proposal files do not count as touches), `generator`, `generated`, `protocol`.
- One `## <Card> (<total>)` section per card. Entry grammar, one line per item:
  - Work items: `- [<status>] <title> — <YYYY-MM-DD> -> <path>`
  - Records (no status): `- <title> — <YYYY-MM-DD> -> <path>`
  - Pending arbitration: `- [<status>] (<N> staged) <title> — <YYYY-MM-DD> -> <path>` — the item has unresolved proposals in `<id>.staged/` (see #arbitration). This flag is the most urgent thing on a card: arbitrate before other work.
  - Overflow (record cards only): `- +<N> more in <dir>/`
- The entry date is the date part of the item's `updated` for work items, and its `date` for records.
- Work-item cards (tasks, goals) list **every** non-archived item, ordered by the type's relevance rule (see `types/`): non-terminal by recency first, terminal last. Terminal items age off the card 7 days after closing; archived items never appear. The card is the complete active set — a session initializes from this one read, never by searching directories.
- Record cards (meetings, journal, accomplishments) list the 5 most recent non-archived entries plus an overflow count; older records are reached by recency paging at tier 2, never carried on the card.
- The header `<total>` counts the card's non-archived items.
- The `-> <path>` is the only file to open next.
- Humans may hand-add entries here (or at any tier). Regeneration reconciles hand-added lines into item stubs for normalization — never delete them.

## Tier 2

- One file per item: `<dir>/<id>.md` — everything needed to continue or update the item: frontmatter, `# <title>`, `## Summary`, then the type's other sections (`## Checklist`, `## Artifacts` or `## Evidence`, `## Detail docs`).
- Field schemas live in `types/<type>.md`. Universal fields are in `types/_base.md`: `id`, `type`, `title`, `updated`, `visibility`, `parent`, `related`, `normalized`.
- Directories page at 10 items by recency; search the current page before requesting older ones. Recency views skip archived objects (see #archive). The journal is date-segmented: tier 2 shows the last 7 days first, older entries behind pagination.
- Checklist line grammar (marks: `[ ]` todo · `[~]` in-flight · `[!]` blocked · `[x]` done):

  ```
  - [<mark>] <step text> <!-- ^<anchor> -->
        blocked-by: [<label>](<target>)
        see: [<label>](<target>)
  ```

  The trailing anchor comment and the indented `blocked-by:`/`see:` lines are each optional; continuation lines are indented exactly six spaces. A `[!]` mark **must** carry a `blocked-by:` line. Update marks in place.
- **Blocked items**: on opening an item with a `[!]` mark, check the blocker target's state first and update the mark before any other work (a still-live blocker means no change — leave the `[!]` in place).
- **Staged proposals**: if `<dir>/<id>.staged/` is non-empty, do not edit the item directly — read the pending proposals, stage your change, and arbitrate (see #arbitration).
- Relations: `parent:`, `related:`, `source:`, and `prev:` frontmatter name other objects by permanent object ref `<dir>/<id>` (e.g. `goals/q3-deploy-pipeline-2026q3`) — epics, siblings, sources, predecessors. Reach for a related item **only** when the current item lacks the answer.
- Follow a `## Detail docs` pointer only when the summary and checklist do not answer the question. Do not open unlinked siblings.
- Detail-doc list entries: `- [[<doc-id>]] <title> (<kind>) -> <path>`.

## Tier 3

- `<dir>/<id>/<doc-id>.md` — plans, investigations, reports, notes: the full-context material, linked explicitly from the item's `## Detail docs`.
- Frontmatter: `id`, `kind` (`plan` | `investigation` | `report` | `note`), `item` (owning item id), `updated`.
- Read-mostly. Append new findings under a dated heading; do not rewrite history.

## Statuses

- `todo` · `in-flight` · `blocked` · `done` · `dropped` · `needs-review`. Only work items (tasks, goals) carry status; meetings, journal entries, and accomplishments are records.
- `done` and `dropped` are terminal. Dropped work is excluded from accomplishments.
- `status: blocked` requires at least one `[!]` checklist step with a `blocked-by:` link (or a `blocked-by:` line directly under `## Summary` when there is no checklist).
- `needs-review` is set by **triage**: any non-terminal item untouched for 14+ days. Resolve it by updating, dropping, or re-scoping the item.

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
  where `<scope>` is `tier-1`, `tier-2`, `tier-3`, `types`, or `staged` (proposal files).
- A raw human file may lack the footer; it stays valid, and normalization appends the pointer on first touch.
- The pointer is the file's only embedded instruction. Never add navigation guidance inside item files; never remove or reword a pointer while doing item work.

## Arbitration

Concurrent writers negotiate through recorded intent, never overwrites. The write path:

1. **Remember your base.** Note the item's content (hash or text) as you read it.
2. **Write, then verify.** Before writing, re-read the file (or use the app's compare-and-swap). If it is unchanged and `<id>.staged/` is empty, apply your edit directly — smallest sufficient edit: one mark, one field, one appended line. Then re-read once more: if your change is present, you are done; if it vanished (a concurrent writer landed on top of you), treat it as contention. **A write you have not observed in the file is not done.**
3. **Contention → rebase or propose.** Diff the current file against your base.
   - Your ops commute with what changed (different fields or steps; pure appends), nothing is staged, and nothing is high-stakes → rebase onto the current state and retry step 2, at most twice.
   - Otherwise — overlapping ops, anything already staged, a high-stakes edit (any transition to or from `done`/`dropped`, or reversing a change less than 48 hours old), or retries exhausted → write a proposal file: `<dir>/<id>.staged/<YYYY-MM-DD>-<author>-<base-slug>.md`, frontmatter `id` (the filename stem), `item`, `base` (hash of the version you merged against), `author`, `updated`, `ops`, body = **why**, with evidence links. `ops` is a YAML list of op strings in exactly these forms: `set: <key> = <value>` · `mark: ^<anchor> = todo|in-flight|blocked|done` (address by `mark: "<exact step text>" = …` only when the step has no anchor) · `append: <Section> · <text>`. A mark-op setting `blocked` must cite the blocker link in the body; that link becomes the step's `blocked-by:` line when applied. The author label must be unique to your session (include a session suffix): filename uniqueness is chosen, never checked-then-created. Staging is sticky: while any proposal pends, every writer stages, so one arbitration pass sees all hands.
4. **Arbitration.** Anyone may arbitrate — the writer who discovered the conflict, a later writer, or the triage sweep. Arbitration is a **pure function of the current item plus all staged proposals** — no wall-clock input, so concurrent arbiters compute byte-identical results and duplicate arbitration is a harmless no-op. Merge commuting ops, apply the resolution rules below, recompute status from the merged structure, and set the item's `updated` to the **maximum** `updated` across the item and the arbitrated proposals. Every op then stands **applied** or **overruled**. Append one resolution line per arbitrated proposal at the end of `## Summary`, in proposal-filename order: `- <date> — arbitrated <proposal-filename-stem>:` followed by per-op verdicts separated by `; ` — each op backtick-quoted, then `⇒ applied`, or `⇒ overruled (…)` carrying the proposal's evidence links; `<date>` is the new `updated`'s date. Write the result (step-2 verification applies), then delete every arbitrated proposal: its intent now lives in the item — applied in the structure, or overruled on the record with its evidence — and git history keeps the audit trail. A proposal containing any op **no rule decides** (prose vs prose, terminal reversal) is not arbitrated at all: it stays staged whole, the item gets `status: needs-review`, and a human or an explicitly invoked arbiter session decides.

At every moment, each writer's intent is either observable in the item (as applied structure or a recorded overruled verdict) or present in `.staged/` — silent loss is structurally impossible, regardless of how many writers there are.

Resolution rules:

| Conflict | Rule |
|---|---|
| Both set `status` | Structure decides: merge checklist ops first, recompute status from marks (`[!]` with a live blocker ⇒ `blocked`; all `[x]` ⇒ `done` candidate). An explicit status that contradicts the merged structure loses. |
| Same step, different marks | Take the further mark (`todo < in-flight < done`) — unless one is `[!]` with a `blocked-by:` link: blocked wins. |
| Terminal reversal | Never auto-resolved. Propose, citing the closer's evidence; a human confirms if the closer's session is gone. |
| Prose vs prose (same section) | No auto-merge, ever. Both stage; `needs-review`. |
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

- Journal and meeting entries may carry `visibility: private`. Skip private items unless the user explicitly directs you to them, and never quote them into other contexts (dashboards, reports, other items).

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
