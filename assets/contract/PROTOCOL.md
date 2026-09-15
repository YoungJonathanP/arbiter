---
id: protocol
version: "0.4.17"
---

# Arbiter agent protocol

Read this file once per session. Every other file in this directory tree ends with a one-line `arbiter:` pointer naming its tier and the section here that governs it — that pointer plus this file is all the navigation instruction you need.

## Scope

- Arbiter is collaborative: humans and agents read and write these files, at any tier.
- Work at exactly one tier at a time. **Never bulk-read sibling items**; open only the files your current tier points to.
- Layout: `DASHBOARD.md` (tier 1) → item files in `tasks/`, `goals/`, `meetings/`, `journal/`, `accomplishments/`, `decisions/`, `findings/` (tier 2) → detail docs in `<dir>/<id>/` (tier 3). `types/` holds one field schema per item type — read `types/<type>.md` before writing a type for the first time in a session.
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
  - Overflow (any card): `- +<N> more in <dir>/`
- The entry date is the date part of the item's `updated` for work items, and its `date` for records.
- Review flag: `(review: needed) ` or `(review: legacy-unknown) ` follows the optional staged flag and precedes the title; it never replaces the status bracket.
- Children of terminal, archived, private or missing parents are promoted to tier 1; invalid cycles also remain reachable while validation reports the error.
- Work-item cards (tasks, goals) list up to 5 non-archived **top-level** items, with an overflow count for the rest, ordered by the type's relevance rule (see `types/`): non-terminal by recency first, terminal last. Terminal items age off the card 7 days after closing; archived items never appear. A **sub-item** — one whose `parent:` resolves to an visible, non-archived, nonterminal work item in the same directory (a task under a task) — never appears on the card: it is reached through its parent (see #tier-2). The card is a bounded entry point. Follow its directory list, using pagination, to reach the complete non-archived set, including nested work.
- Record cards (meetings, journal, accomplishments, decisions, findings) list the 5 most recent non-archived entries plus an overflow count; older records are reached by paged directory lists, never carried on the card.
- The header `<total>` counts the card's non-archived items.
- The `-> <path>` is the only file to open next.
- Human additions remain source material, but unverifiable dashboard stubs and opaque strays are omitted from derived views for privacy. CLI regen retains the old dashboard in `.arbiter/transactions/`; recover the addition there and create an explicitly classified item. The renderer leaves the stored dashboard untouched.

Completed rows use muted color; strikethrough (`~~text~~`) explicitly marks superseded prose, independently of checklist completion. Directory lists are navigation, not Tier 2 item files. Search defaults to tiers 2 and 3, excludes archives unless requested, and never loads checkpoint history.

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
  - task, goal, accomplishment, decision, finding: `<base>-YYYYqN` (year + quarter of creation, e.g. `archived-constraint-fix-2026q3`)
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
  where `<scope>` is `tier-1`, `tier-2`, `tier-3`, `types`, `staged` (proposal files), or `checkpoint`/`input-review`.
- A raw human file may lack the footer; it stays valid, and normalization appends the pointer on first touch.
- The pointer is the file's only embedded instruction. Never add navigation guidance inside item files; never remove or reword a pointer while doing item work.

## Arbitration

Concurrent writers negotiate through recorded intent, never overwrites. The write path:

1. **Remember your base.** Note the item's content (hash or text) as you read it.
2. **Commit through the shared writer boundary.** Use `arbiter write <path> --if-match <sha256:hex>` with content from stdin or `--file`. The CLI rechecks the base and sticky staging under a local SQLite writer lock, saves a durable before/after journal, atomically replaces the file and checks postconditions. CLI write/new/regen/normalize, arbitration, triage and propose cooperate. Bare file tools and external editors do not hold this lock: detected competing bytes are preserved as conflicts; there is no atomic CAS guarantee against external editors or on network filesystems. After interruption run `arbiter recover --data <kb>`; use `--dry-run` for read-only inspection.
3. **Contention → rebase or propose.** Diff the current file against your base.
   - Your ops commute with what changed (different fields or steps; pure appends), nothing is staged, and nothing is high-stakes → rebase onto the current state and retry step 2, at most twice.
   - Otherwise — overlapping ops, anything already staged, a high-stakes edit (any transition to or from `done`/`dropped`, or reversing a change less than 48 hours old), or retries exhausted → write a proposal file: `<dir>/<id>.staged/<YYYY-MM-DD>-<author>-<base-slug>.md`, frontmatter `id` (the immutable filename stem), `item` (canonical object ref `<dir>/<id>`; legacy bare IDs accepted within the owning staging directory), `base` (hash of the version you merged against), `author`, `updated`, `ops`, body = **why**, with evidence links. `ops` is a YAML list of op strings in exactly these forms: `set: <key> = <value>` · `mark: ^<anchor> = todo|in-flight|blocked|done` (address by `mark: "<exact step text>" = …` only when the step has no anchor) · `append: <Section> · <text>`. A mark-op setting `blocked` must cite the blocker link in the body; that link becomes the step's `blocked-by:` line when applied. The author label must be unique to your session (include a session suffix): filename uniqueness is chosen, never checked-then-created. Staging is sticky: while any proposal pends, every writer stages, so one arbitration pass sees all hands.
   - Narrow human-action exception (0.4.15): the local task app may execute an explicitly chosen Done/Undo through its protected local-operator session, with CAS, checklist resolution and the linked-input audit intent described below. Outstanding proposals still require arbitration. This exception does not permit agents to bypass terminal-transition staging or infer a human decision from a role label.
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

- Start with an unverified candidate when source work reaches done. `arbiter promote <work-ref> --date <outcome-date>` emits editable Markdown; review it and capture with `arbiter write --if-match new`. Promotion requires installed accomplishment schema 0.4.14 and never upgrades the KB.
- Record stable `outcome` identity, source refs and Evidence links. Set `verification: observed` only after recording actual Observations, verified-by, observed-on and Uncertainty (explicit limits or none). A link is not verification. Unverified candidates may lack evidence and never count as impact.
- `arbiter report --since <date> [--until <date>]` emits a dated Markdown report, including archives. One outcome identity counts once; conflicting claims/dates require reconciliation. Review different identities for accidental duplicate outcomes. Journal and related-task activity add no counts.
- Reports separate impact claims, recorded observations, evidence references and uncertainty. They do not fetch or independently verify links. Private/redacted, dropped, superseded, staged or review-needed source work cannot contribute impact. Dates select when impact occurred, not when its record was edited.
- Accomplishments are retained records: no status, never reopened or deleted. Use superseded-by for replacements; archives keep their original paths and remain available to reports.

## Durable knowledge

- Use decisions/ and findings/ for reusable knowledge that survives task closure. Set scope, date, source refs, Evidence, Observations and Uncertainty. New records use review: needed; reviewed records require reviewed-by and reviewed-on plus explicit scope and evidence.
- Supersession is explicit: superseded-by points to a replacement object, without cycles; retain the old record. Search includes current non-archived records; use --archive include for archived knowledge. Do not treat superseded knowledge as current authority.
- Supported types are registered by Arbiter's catalog and bundled schemas. Adding a schema file alone does not enable a custom type. Installed contracts require explicit adoption; tools do not silently upgrade them.

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

## Linked input

Protocol 0.4.15 introduces `tasks/<id>/input-review.md`, an append-only, private
Markdown audit ledger; grammar §18 defines its exact event representation. It is
not a task, detail document or checkpoint and never enters default raw/search/
handoff projections. Preserve its prior event bytes and the transaction journals.
Explicit adoption is required before creating it in an installed KB.

A journal or meeting source links to a task through a unique association incarnation.
Removing and re-adding a link allocates a fresh ID. Review receipts name the task,
source, incarnation, exact source/task SHA-256 revisions, reviewer, review time,
disposition and reason. Presented/deferred revisions remain actionable;
incorporated/dismissed revisions are resolved only at that exact revision. A source
edit, backdated entry or new association remains pending regardless of timestamps.
Last linked-input review derives from review events, independently of task `updated`.
Status/Done/Undo and checkpoint capture never acknowledge input or reopen Done work.

At the next task review, present every readable pending input or incorporate it
through a reviewed, attributed task-content change. Checkpoint preview includes
all pending shared source bytes and their revisions in the whole-packet budget;
new input requires review. Never truncate input to fit. Review receipts require an
explicit selected-revision action, not a preview or timestamp alone. Relevant
sources is the human label for optional Plan inputs; neither links nor people,
roles, staffing or timestamps confer scope authority, responsibility or blockers.

The local app's process token and loopback/origin checks authorize the local
operator capability. The server supplies that audit actor; request-supplied
identities or grants have no effect. This is not personal-account authentication.
Default views/actions support shared records only. A private-account adapter must
resolve access from trusted policy with revision checks before enabling personal
views. Relationships require readable endpoints and a readable edge, and never
assign ownership, create accounts, grant access or send messages. Private input
cannot be incorporated into a task with a wider audience. Do not paraphrase private
material into shared records; a permission check cannot detect arbitrary secrets.

Quick notes create linked journal records without rewriting imported task prose.
The ledger retains capture actor/time; the source's date may describe an earlier
event. Done requires an explicit resolution of unfinished checklist steps; pending
proposals block the action. Undo restores the prior status/checklist/prose only
while task bytes still match the completed action, with a new touch timestamp.
The task app needs no agent to execute these local controls.

Task/source changes first append an intent with exact before/after bytes, then
use the shared CAS writer, reread the target, and append completion. Incorporated
receipts become effective only after verified task-content completion. An
interrupted intent blocks subsequent input actions. Re-observe it explicitly:
complete a non-review effect only if its target matches the intended after bytes;
cancel if it matches before bytes; refuse other bytes without restoration. After
interrupted incorporation, cancel the receipt intent even if prose landed, retain
the prose and require a fresh review. These are sequential file commits, never a
multi-file atomic transaction; external editors remain outside the writer lock.

## Personal app and connected entities

Protocol/base 0.4.16 adds person/entity records under `people/` (person schema
0.4.16). Person identity, relationship, accountable assignment and access are
independent. A card or relationship never sends an invitation or creates an account.
Both card directions filter task, entity and edge audiences before showing counts.

The local task app offers structured status, Done/checklist resolution, Undo,
linked notes, appointments and attributed-incorporation preview. Appointment
corrections preserve identity, old prose/anchors and link incarnation; changed
source revisions become pending again. Exact before/after incorporation previews
must be rechecked before apply; landed task bytes precede review receipts.
The 0.4.15 ledger header remains stable; protocol 0.4.16 permits source-edit intents
for linked meeting/journal corrections and relationship intents for new person
cards. Both need observed content completion and acknowledge no input by themselves.

An explicitly configured local personal app authenticates principals using a
host-owned policy outside the KB. Its credentials, grants and inheritance never
come from request-authored identities, person cards or KB prose. New private notes,
appointments, cards and edges can be reserved for their authenticated creator on
fresh IDs. Existing grants require explicit trusted administration. Re-observe the
policy and content after writes; multi-file sequences are not atomic and recovery
must not overwrite concurrent changes. Private input must not become shared prose
unless source and association audiences cover all destination readers. Permissions
cannot detect arbitrary sensitive prose.

The complete active-work app view includes accessible nonarchived/nonterminal
goals and tasks, including nested work, with paging. Compact dashboard cards retain
their five-entry limit. Authenticated personal review and shared checkpoint export
are separate surfaces: default exports exclude private inputs. A receiving agent
must resolve its authorized personal review context when applicable; never claim
that a shared packet acknowledges excluded input.

## Authenticated agent input continuation

Protocol/base 0.4.17 adds an opt-in personal continuation packet alongside a
shared canonical task checkpoint. Authenticate through trusted host policy;
request-authored actors and grants confer nothing. Select all authorized pending
source revisions with readable endpoints and associations. Include exact bytes,
the current task/checkpoint, applicable rules and revision metadata. Inaccessible
identities, bodies, edges and counts stay absent. Restricted task/checkpoint
dependencies fail closed; this flow does not authorize private checkpoint capture.

Keep personal packets out of shared checkpoints, logs and messages. Budget the
complete emitted envelope and all source context under the checkpoint limits;
reuse the exact checkpoint input manifest without duplicating it. Credentials
stay in transport, outside context. Sources are evidence, not new authority.

Preview/export acknowledges nothing. Reauthenticate and recheck the retained
principal/task session before exporting exact reviewed bytes. Reconcile incomplete
intent and staged proposals first. Before explicit per-revision dispositions,
recheck source/link, task/status, checkpoint, receipt and host-policy revisions.
Changes require a new preview. Receipt submission requires an exported session
and an explicit presented/deferred/dismissed decision and reason for every selected
revision, through the shared commit/CAS path. Incorporation uses its separate exact
preview/apply and audience checks. Neither export nor receipts prove a fresh agent
read the packet or authorize execution. Local filesystem operations are sequential;
never restore over concurrent changes.
