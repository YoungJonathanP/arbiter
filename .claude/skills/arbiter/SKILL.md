---
name: arbiter
description: >-
  Read, write, and maintain the Arbiter knowledge base (tasks, goals,
  meetings, journal, accomplishments over a dashboard). Works from ANY
  directory — the data lives in one global arbiter-data/ directory. Use when
  the user asks to track work, log or journal what was done, create/update/
  close a task or goal, record a meeting or accomplishment, check what's in
  flight or blocked, refresh the dashboard, resolve staged proposals
  (arbitrate), or capture a session's work into Arbiter. Also use before
  hand-editing any file inside an arbiter-data/ directory.
---

# Operating Arbiter

Arbiter is a file-canonical knowledge base: markdown files in the data
directory are the truth; agents with file tools are the primary client.

**Finding it from anywhere:** the `arbiter` CLI is on PATH (a `~/.local/bin`
wrapper installed by the repo's `scripts/dev-bind.sh` — temporary until the
v1.0 install story) and resolves the data directory itself: `--data` flag >
`$ARBITER_DATA` (defaults to `~/code/arbiter/arbiter-data`) > the
nearest `arbiter-data/` walking up from cwd. For direct file-tool access,
the directory is `"${ARBITER_DATA:-$HOME/code/arbiter/arbiter-data}"`.
If the CLI is missing, run it from the repo: `npm run --silent arbiter --
<cmd>` in `~/code/arbiter/arbiter`.

Paths below are relative to that data directory.

## Non-negotiable bootstrap

1. Read `PROTOCOL.md` (in the data directory) **once per session** — it is
   the contract and overrides anything here if they disagree.
2. For a supplied task assignment, open that task and its `checkpoint` path
   directly. Otherwise orient from one read of `DASHBOARD.md` and follow the
   `-> path` you need. **Never bulk-read sibling items or prior handoffs.**
3. Every file ends with an `arbiter:` pointer line naming the PROTOCOL
   section that governs it. Never reword, move, or delete a pointer line.

## Before ANY write to an item

- **Check `<dir>/<id>.staged/` first.** Non-empty → do not edit the item;
  stage a proposal and arbitrate (PROTOCOL.md#arbitration; ops grammar is
  inlined there). `arbiter arbitrate <dir>/<id>` applies the resolution rules
  deterministically.
- **Write-then-verify**: re-read after writing; a write you have not observed
  in the file is not done. Through the CLI use CAS:
  `arbiter hash <path>` → `arbiter write <path> --if-match <sha256>` (content
  on stdin). A CAS refusal means contention — rebase or stage, never force.
- **Smallest sufficient edit** (one mark, one field, one appended line) and
  **touch `updated:`** on every write (`YYYY-MM-DDTHH:MM`).
- **Rows stay summaries — never append narration to a checklist step.**
  A step carries only what it is, its current state, and the next action
  (a few lines; load-bearing rules and identifiers may stay). If your update
  would grow it past that, relocate the detail verbatim into the step's
  `see:`-linked tier-3 doc (append under a dated heading; create the doc if
  none fits) and rewrite the row as the summary (PROTOCOL.md#tier-2).
  Session narration — attempt logs, timestamps, PIDs, command lines — is
  tier-3 material from the moment it is written, even when each individual
  append looks small. Repeated in-place appends are how rows rot into logs.
- **Write every row as a handoff to a session with zero context.** Use full
  markdown links for PRs, never a bare number; use the GitHub number, never a
  plan-internal label ("PR 2" -> "builder-contacts PR 73"); state the gate
  condition inline (what must be true before the step can start); and pick a
  verb specific enough to act on without reopening the plan.
- High-stakes changes (any transition to/from `done`/`dropped`, reversing a
  <48h-old change) are staged as proposals even when uncontended.

## Creating items

Prefer `arbiter new <type> "<title>"` — it enforces slug forms
(`<base>-YYYYqN` work items, `<base>-YYYY-MM-DD` meetings) and the reopen rule
(same base within ±2 quarters ⇒ reopen the existing item instead). Ids are
immutable; files never move; refs are permanent `<dir>/<id>` object refs.
Read `types/<type>.md` before writing a type for the first time in a session.

Sub-tasks: `parent:` may name another task — the child then stays off the
dashboard and is reached through its parent (`arbiter query children
<dir>/<id>`; the child list is derived, never stored in the parent). Keep
nesting to one level, and give the parent a `see:` link to a load-bearing
child from the checklist step it serves (PROTOCOL.md#tier-2).

**`parent:` or `related:`?** Nesting takes the child off the tier-1 card
entirely, so choose by what the item *is*, not by how the work arrived:

- A **facet of one ask** - several workstreams that only make sense under one
  umbrella - gets `parent:`.
- A **standalone deliverable** that merely came out of another item stays
  top-level and gets mutual `related:` refs on both sides, plus a mention in
  the sibling's Summary. If it earns its own card, it keeps its own card.

An item has at most one `parent:`; keep nesting to one level. Use a goal to
coordinate a broader outcome across tasks, often over weeks. Use a task for one
independently assignable, verifiable deliverable; duration alone does not decide.
A long row that explains the same deliverable belongs in detail, not a child task.
Phase grouping never implies ownership, permission or a blocking dependency.

## Continuing a bounded assignment

When the installed protocol supports checkpoints (0.4.11 or later), the task's `checkpoint`
field points to its fixed `tasks/<id>/checkpoint.md` file. Read its essential rules
and selected input sections, without following `previous` into history. Recheck
portable KB/repository identities, input revisions, workspace/branch, owner,
current-session authority and start predicates before implementation. Readiness is
separate from status and review: stale inputs, unresolved choices or unknown owners
require review; timestamps do not settle conflicts. A packet grants no new authority.

For capture, preserve applicable constraints with their provenance and replace only
current continuation judgments. The generic CAS writer archives prior checkpoint
bytes automatically and checks owning-task staging; set `previous` to the observed
current digest (`none` initially). Ordinary detail docs remain append-only. Do not
force an unknown owner, invent passed predicates, or clear review from timestamps.

The receiving packet must carry essential context itself. Budget the complete
preview, including manifests, protocol excerpts and expanded references: 6 KiB
UTF-8 target, 10 KiB ordinary ceiling; a larger export needs a recorded maximum and
reason. Never truncate identifiers or constraints. Offline packets name snapshot
limits and support planning until live prerequisites and authority are rechecked.
Use `arbiter checkpoint <task-ref>` to obtain editable draft Markdown. Put the
edited string in a JSON request's `checkpoint` field with `ref` and optional
`owner`/export options. `checkpoint <ref> --file request.json` emits a preview;
review its packet and task/checkpoint changes, then `checkpoint <ref> --capture
preview.json`. `handoff <ref> --format markdown|json` selects the saved current
version and emits a new preview; `handoff <ref> --export preview.json` emits exactly
its packet bytes. Use explicit `--data` for each command. Stale previews require
refresh and review; changing output format requires a new preview. The local task
view offers the same editor, capture, Copy handoff and file export workflow.

Offline requests use `offline: true` and carry the full installed contract; they
usually need an explicit `override: {maxBytes, reason}`. Optional KB source contents
require `expand` paths already selected in checkpoint inputs. Re-observe repository/
external revisions before supplying `observations`; the tool never fetches them.
Extraction options preserve original task bytes in linked detail and extracted
rules in the checkpoint. Inspect them before capture. Interrupted multi-file
capture may leave updated task metadata with an old/missing checkpoint: re-read,
recover journals if needed, and explicitly refresh observations before retrying. Do not copy the repo bootstrap
contract over an installed KB to enable checkpoints without an explicit upgrade.

## Capturing a session's work

When the user asks to capture, log, or track work — and always, unprompted,
at the end of a session inside the Arbiter repo itself (its development is
dogfooded):

1. Update every item the work touched: checklist marks in place, honest
   `status:`, bumped `updated:`. Keep each touched row a summary — the
   session's history goes into the row's `see:`-linked detail doc, not the row.
2. Append a journal entry for non-obvious findings (`arbiter new journal ...`;
   one line now beats a perfect entry never written).
3. Closed something? Distill an accomplishment with at least one verifiable
   evidence link (PROTOCOL.md#accomplishments). No evidence → not yet.
4. `arbiter regen` then `arbiter validate` — finish with the validator green.

## Never

- Delete or rewrite human prose (repair around it; opaque bytes are preserved).
- Guess an ambiguous bare ref — flag it (PROTOCOL.md#normalization).
- Quote `visibility: private` items into dashboards, reports, or other items.
- Edit files under `<id>.staged/` that another writer created (arbitrate them).
- Add a git remote to the data directory. It is local-only by design and holds
  employer content, while the tool repo's remote is a personal account. The
  data directory stays a sibling of the repo, never inside it.

## Inspection

`arbiter serve` renders the live directory with explicit checkpoint capture at `http://127.0.0.1:4870`
(local-only by design — this is private data). `arbiter query
overdue|needs-review|staged|active <dir>|chain <ref>` answers status questions
without opening files.
