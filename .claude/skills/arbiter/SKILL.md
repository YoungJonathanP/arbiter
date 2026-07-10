---
name: arbiter
description: >-
  Read, write, and maintain the Arbiter knowledge base (arbiter-data/ —
  dashboard, tasks, goals, meetings, journal, accomplishments). Use when the
  user asks to track work, log or journal what was done, create/update/close a
  task or goal, record a meeting or accomplishment, check what's in flight or
  blocked, refresh the dashboard, resolve staged proposals (arbitrate), or at
  the END of any session in this repo whose work should be captured. Also use
  before hand-editing any file under arbiter-data/.
---

# Operating Arbiter

Arbiter is a file-canonical knowledge base: markdown files under `arbiter-data/`
are the truth; agents with file tools are the primary client. The CLI
(`arbiter`, or `npm run --silent arbiter --` if unbuilt) is a convenience over
the same files, never a requirement.

## Non-negotiable bootstrap

1. Read `arbiter-data/PROTOCOL.md` **once per session** — it is the contract
   and overrides anything here if they disagree.
2. Orient from one read of `arbiter-data/DASHBOARD.md`; follow only the
   `-> path` you need. **Never bulk-read sibling items.**
3. Every file ends with an `arbiter:` pointer line naming the PROTOCOL section
   that governs it. Never reword, move, or delete a pointer line.

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
Read `arbiter-data/types/<type>.md` before writing a type for the first time
in a session.

## Session-end capture (do this without being asked)

Work in this repo is dogfooded. Before ending a session that did meaningful
work:

1. Update every item the session touched: checklist marks in place, honest
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
