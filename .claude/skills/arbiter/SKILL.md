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
wrapper) and resolves the data directory itself: `--data` flag >
`$ARBITER_DATA` (defaults to `~/Documents/Work/arbiter/arbiter-data`) > the
nearest `arbiter-data/` walking up from cwd. For direct file-tool access,
the directory is `"${ARBITER_DATA:-$HOME/Documents/Work/arbiter/arbiter-data}"`.
If the CLI is missing, run it from the repo: `npm run --silent arbiter --
<cmd>` in `~/Documents/Work/arbiter`.

Paths below are relative to that data directory.

## Non-negotiable bootstrap

1. Read `PROTOCOL.md` (in the data directory) **once per session** — it is
   the contract and overrides anything here if they disagree.
2. Orient from one read of `DASHBOARD.md`; follow only the `-> path` you
   need. **Never bulk-read sibling items.**
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
- High-stakes changes (any transition to/from `done`/`dropped`, reversing a
  <48h-old change) are staged as proposals even when uncontended.

## Creating items

Prefer `arbiter new <type> "<title>"` — it enforces slug forms
(`<base>-YYYYqN` work items, `<base>-YYYY-MM-DD` meetings) and the reopen rule
(same base within ±2 quarters ⇒ reopen the existing item instead). Ids are
immutable; files never move; refs are permanent `<dir>/<id>` object refs.
Read `types/<type>.md` before writing a type for the first time in a session.

## Capturing a session's work

When the user asks to capture, log, or track work — and always, unprompted,
at the end of a session inside the Arbiter repo itself (its development is
dogfooded):

1. Update every item the work touched: checklist marks in place, honest
   `status:`, bumped `updated:`.
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

## Inspection

`arbiter serve` renders the live directory read-only at `http://127.0.0.1:4870`
(local-only by design — this is private data). `arbiter query
overdue|needs-review|staged|active <dir>|chain <ref>` answers status questions
without opening files.
