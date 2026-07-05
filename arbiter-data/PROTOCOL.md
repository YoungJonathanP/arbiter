---
id: protocol
version: "0.4"
---

# Arbiter agent protocol

Read this file once per session. Every other file in this directory tree ends with a one-line `arbiter:` pointer naming its tier and the section here that governs it — that pointer plus this file is all the navigation instruction you need.

## Scope

- Arbiter is collaborative: humans and agents read and write these files, at any tier.
- Work at exactly one tier at a time. **Never bulk-read sibling items**; open only the files your current tier points to.
- Layout: `DASHBOARD.md` (tier 1) → item files in `tasks/`, `goals/`, `meetings/`, `journal/`, `accomplishments/` (tier 2) → detail docs in `<dir>/<id>/` (tier 3). `types/` holds one field schema per item type — read `types/<type>.md` before writing a type for the first time in a session.

## Tier 1

- `DASHBOARD.md` answers "what happened recently, what should happen next" in one read.
- The index is regenerated programmatically; its `generated:` frontmatter says how fresh it is. Treat a stale index as advisory and trust the item files. Where no app is present, an agent asked to refresh the dashboard applies these same rules.
- Frontmatter: `updated` (latest item touch), `generator`, `generated`, `protocol`.
- One `## <Card> (<total>)` section per card. Entry grammar, one line per item:
  - Work items: `- [<status>] <title> — <YYYY-MM-DD> -> <path>`
  - Records (no status): `- <title> — <YYYY-MM-DD> -> <path>`
  - Pending arbitration: `- [<status>] (<N> staged) <title> — <YYYY-MM-DD> -> <path>` — the item has unresolved proposals in `<id>.staged/` (see #arbitration)
  - Overflow: `- +<N> more in <dir>/`
- At most 5 entries per card, ordered by the card type's relevance rule (see `types/`): active items by recency first, terminal items last. Terminal items age off the card 7 days after closing (they remain in their tier-2 directory).
- The `-> <path>` is the only file to open next.
- Humans may hand-add entries here (or at any tier). Regeneration reconciles hand-added lines into item stubs for normalization — never delete them.

## Tier 2

- One file per item: `<dir>/<id>.md` — everything needed to continue or update the item: frontmatter, `# <title>`, `## Summary`, then the type's other sections (`## Checklist`, `## Artifacts` or `## Evidence`, `## Detail docs`).
- Field schemas live in `types/<type>.md`. Universal fields are in `types/_base.md`: `id`, `type`, `title`, `updated`, `visibility`, `parent`, `related`, `normalized`.
- Directories page at 10 items by recency; search the current page before requesting older ones. The journal is date-segmented: tier 2 shows the last 7 days first, older entries behind pagination.
- Checklist line grammar (marks: `[ ]` todo · `[~]` in-flight · `[!]` blocked · `[x]` done):

  ```
  - [<mark>] <step text> <!-- ^<anchor> -->
        blocked-by: [<label>](<target>)
        see: [<label>](<target>)
  ```

  The trailing anchor comment and the indented `blocked-by:`/`see:` lines are each optional; a `[!]` mark **must** carry a `blocked-by:` line. Update marks in place.
- **Blocked items**: on opening an item with a `[!]` mark, check the blocker target's state first and update the mark before any other work.
- **Staged proposals**: if `<dir>/<id>.staged/` is non-empty, do not edit the item directly — read the pending proposals, stage your change, and arbitrate (see #arbitration).
- Relations: `parent:` and `related:` frontmatter name other item ids (epics, siblings, loose references). Reach for a related item **only** when the current item lacks the answer.
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
- **Reopen rule** (work items only): before creating, search the directory for the same `<base>` within ±2 quarters — if found and the work recurs, reopen that item (update status, append to checklist); beyond the window it is a new item with a new quarter suffix.

## Anchors

- A checklist step that must be referenced from elsewhere gets a trailing anchor comment: `<!-- ^railway-predeploy -->`. Reference it as `<path>#^<anchor>`, e.g. `goals/q3-deploy-pipeline-2026q3.md#^railway-predeploy`.
- Anchors are kebab-case, unique within their file, and immutable once referenced — they survive step rewording and reordering. Add an anchor only when a step actually becomes a link target.

## Pointers

- Every file except this one ends with a single footer line:
  `<!-- arbiter:<scope> · PROTOCOL.md#<section> · <one-line reminder> -->`
  where `<scope>` is `tier-1`, `tier-2`, `tier-3`, or `types`.
- The pointer is the file's only embedded instruction. Never add navigation guidance inside item files; never remove or reword a pointer while doing item work.

## Arbitration

Concurrent writers negotiate through recorded intent, never overwrites. The write path:

1. **Remember your base.** Note the item's content (hash or text) as you read it.
2. **Write, then verify.** Before writing, re-read the file (or use the app's compare-and-swap). If it is unchanged and `<id>.staged/` is empty, apply your edit directly — smallest sufficient edit: one mark, one field, one appended line. Then re-read once more: if your change is present, you are done; if it vanished (a concurrent writer landed on top of you), treat it as contention. **A write you have not observed in the file is not done.**
3. **Contention → rebase or propose.** Diff the current file against your base.
   - Your ops commute with what changed (different fields or steps; pure appends), nothing is staged, and nothing is high-stakes → rebase onto the current state and retry step 2, at most twice.
   - Otherwise — overlapping ops, anything already staged, a high-stakes edit (any transition to or from `done`/`dropped`, or reversing a change less than 48 hours old), or retries exhausted → write a proposal file: `<dir>/<id>.staged/<YYYY-MM-DD>-<author>-<base-slug>.md`, frontmatter `item`, `base` (hash of the version you merged against), `author`, `updated`, `ops` (grammar §9), body = **why**, with evidence links. The author label must be unique to your session (include a session suffix): filename uniqueness is chosen, never checked-then-created. Staging is sticky: while any proposal pends, every writer stages, so one arbitration pass sees all hands.
4. **Arbitration.** Anyone may arbitrate — the writer who discovered the conflict, a later writer, or the triage sweep. Arbitration is a **pure function of the current item plus all staged proposals**: merge commuting ops, apply the resolution rules below, recompute status from the merged structure, record a dated resolution line under `## Summary`, and write the result (step-2 verification applies). Then delete **only** those proposals whose ops the verified item now satisfies — git history keeps the audit trail. Because the function is deterministic and order-independent, concurrent arbiters compute the same result: duplicate arbitration is a harmless no-op. Irreconcilable proposals stay staged and the item gets `status: needs-review`; a human or an explicitly invoked arbiter session decides.

At every moment, each writer's intent is either observable in the item or present in `.staged/` — silent loss is structurally impossible, regardless of how many writers there are.

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
- Defaults when fields are missing: `status: todo` (work items), `updated:` file modification date, `type:` from the parent directory, `date:` from the filename or modification date (records).
- On first touch, normalize: add frontmatter, infer status from the prose, move the original text under `## Summary` **unchanged**, set `normalized: <date>`, and append the tier pointer line.
- Normalization is idempotent: normalizing an already-normalized file changes nothing. Never discard human prose. Repair, then continue with the actual task.

## Visibility

- Journal and meeting entries may carry `visibility: private`. Skip private items unless the user explicitly directs you to them, and never quote them into other contexts (dashboards, reports, other items).

## Accomplishments

- **Evidence is the driver**: every accomplishment carries at least one verifiable link — merged PR, published doc, dashboard — under `## Evidence`. Impact first, mechanism second, numbers where they exist.
- When a work item reaches `done`, distill a one-line, review-ready accomplishment into `accomplishments/` with evidence links back to the source item.
- Accomplishment files are records, not work items: no status, never reopened. They age into the archive like everything else but are **never deleted** — reports search the archive.

## Archive

- Quarterly roll: terminal items and journal entries older than a quarter move to `archive/YYYY-qN/` with paths preserved. Recency-limited views never search the archive; reports and explicit lookups do.

## Capture

- Capture is cheap: one line appended now beats a perfect entry never written. Structure is added lazily on the next touch.
- Prefer updating an existing item over creating a near-duplicate; apply the reopen rule first.
- Every externally useful link (PR, design doc, dashboard, Figma) belongs in `## Artifacts` (or `## Evidence`) of the item it serves, not in prose.
