# Launch plan

*Drafted 2026-07-04, alongside [`logseq-investigation.md`](logseq-investigation.md), whose adoptions this plan sequences.*

**Launch (v1.0) means:** Arbiter is Jonathan's daily driver — a real `arbiter-data/` directory tracked in git, operated every working day by both agents (file tools) and the web renderer, that can produce a review-ready attestation report on demand. Not launched: hosting for other users, real-time collaboration, mobile.

**Ordering principle:** the file contract before the code, the headless core before the app, dogfooding before polish. Agents are the primary client, so Arbiter becomes usable at v0.5 (files + CLI) — the renderer is a lens added afterward, not the gate.

---

## v0.4 — The contract (spec, no code) ✅

*Phase closed 2026-07-05 (commits `e5f17e6` + v0.4.1). The exit-criteria test is carried into v0.5 as its first item, where the test directory does double duty as validator fixture and dogfood seed.*

The machine-read surface of arbiter-data, specified precisely enough that a validator can pass/fail a directory. Everything later depends on this being stable.

- [x] **Write the real `PROTOCOL.md`** — done: [`arbiter-data/PROTOCOL.md`](../arbiter-data/PROTOCOL.md), promoted from the prototype's rendered mock: per-tier read/write rules, checklist mark semantics, tier-1 ordering rule, capture etiquette, conflict etiquette.
- [x] **Formal grammar for the machine-read subset** — done: [`docs/grammar.md`](grammar.md) — frontmatter, checklist marks, pointer lines, tier-1 entries, plus liberal→canonical normalization table and the v0.5 conformance tests. Everything outside the grammar is opaque prose, never parsed, never rewritten.
- [x] **Card-type schemas as data** — done: [`arbiter-data/types/`](../arbiter-data/types/) — one schema per card declaring typed fields, defaults, and its relevance rule; shared `_base` via `extends`. Adding a card type = adding a schema file, not code. (Decision: per-type slug forms — work items and accomplishments `-YYYYqN`, meetings `-YYYY-MM-DD`, journal free.)
- [x] **Stable checklist anchors** — done: `<!-- ^anchor -->` trailing comments, referenced as `path#^anchor`; PROTOCOL.md#anchors.
- [x] **Normalization rules, written down** — done: PROTOCOL.md#normalization + grammar §12; fixpoint requirement is conformance test 1.
- [x] **Arbitration protocol** — added 2026-07-05 after spec review: [`docs/arbitration.md`](arbitration.md) (decision record), PROTOCOL.md#arbitration, grammar §9. Staged-on-contention: contended/high-stakes writes become intent-carrying proposal files in `<id>.staged/`; second writer owns the merge; semantic resolution rules; 24h orphan sweep.

**Exit criteria:** a hand-written arbiter-data directory can be judged valid/invalid by reading the spec alone; two people (or two agents) reach the same verdict. *→ Carried into v0.5 (first item below) so the test artifacts feed directly into the validator and seed.*

## v0.5 — Headless core: library + CLI *(usable milestone — dogfooding starts)*

- [x] **Spec-readability test** (v0.4 exit criterion, carried) — done 2026-07-06/08: [`spec-readability-test.md`](spec-readability-test.md); the fixture graduated to `fixtures/arbiter-data/` as validator corpus and regression oracle.
- [x] **Stack decision** — as recommended: TypeScript throughout; `better-sqlite3` for the derived index; one package with `src/core/` and `src/cli/` ([`v0.5-decisions.md`](v0.5-decisions.md)). The renderer consumes the same core later.
- [x] **Parser + validator** implementing the grammar (now v0.4.5 — writer-determinism patches only). Property tests = grammar §13 gates 1–7, including fixpoint, byte-stable canonical files, index-is-cache, and byte-exact confluent arbitration of the fixture conflict.
- [x] **Derived index + queries** — relevance ordering, overdue flagging, 7-day age-off, 14-day needs-review, pagination windows, prev-chain forward pointers. Consequences (needs-review, archived) are written back to markdown by triage.
- [x] **CLI**: `validate`, `regen` (incremental by default), `triage`, `query`, `new <type>`, `arbitrate <item>`, `write --if-match <hash>`, plus `normalize` and `hash`.
- [x] **Seed real data** — `arbiter-data/` now tracks v0.5 itself (goal + tasks + journal + regenerated DASHBOARD.md); replace/extend with Jonathan's actual current work as the dogfood week proceeds.
- [ ] **Dogfood from day one** — in progress: Arbiter's own development is tracked in arbiter-data; agent sessions in this repo read PROTOCOL.md and keep items current. Exit: a week of real use.

**Exit criteria:** a week of real use with agents + CLI only; DASHBOARD.md regenerates correctly; validator green in CI.

## v0.6 — Renderer (web app MVP)

- [ ] **Local web server over the data directory** rendering all three tiers; replaces the embedded-sample prototype. Reuses the prototype's visual design and the core library's parser — one normalization path shared with the CLI (Logseq's clobbering bugs came from having two).
- [ ] **File watcher + reconcile** — agents keep writing files while the app runs; the app re-indexes on change.
- [ ] **Write path with conflict signal** — app edits (status ticks, checklist marks) go through the core normalizer; concurrent-write detection via content hash so agents can negotiate as PROTOCOL.md prescribes.
- [ ] **View-as-agent toggle** over the real files (carried over from the prototype).

**Exit criteria:** the prototype is deleted; daily use happens in the renderer with agents writing underneath it.

## v0.7 — Capture pipeline

- [ ] **Agent-session capture** — a Claude Code skill/hook so sessions in any repo append journal entries and update touched items in arbiter-data without being asked.
- [ ] **"Note for later" inbox** — lowest-friction capture for work done outside agentic workflows; inbox items normalize into typed items on next agent touch.
- [ ] **Raw-entry reconciliation** — hand-added entries at any tier (including DASHBOARD.md) survive regeneration as stubs, per the README's human-friendliness guarantee.

**Exit criteria:** a normal work week produces a substantially complete journal with no manual bookkeeping.

## v0.8 — Attestation & search

- [ ] **Accomplishment promotion flow** — turn done items with evidence into review-ready accomplishment records; flag evidence-less candidates.
- [ ] **Timeline / impact report generation** — date-ranged attestation reports (markdown out) built from accomplishments + journal; the review-season deliverable.
- [ ] **Search** across all tiers (index-backed; likely SQLite FTS).
- [ ] **Archive rolls** — quarterly roll of aged-out items, keeping the hot set small and tier-1 fast.

**Exit criteria:** `arbiter report --since 2026-01-01` produces something usable in an actual performance review.

## v1.0 — Hardening & launch

- [ ] **Concurrency tests** — N writers (agents + app) on one item: write-then-verify, rebase-retry, sticky staging, and confluent arbitration exercised end-to-end against grammar gates 6–7; no silent loss under any interleaving.
- [ ] **History safety net** — auto-commit of arbiter-data on regen/triage so every programmatic mutation is one `git revert` from undone.
- [ ] **Install story** — one command to set up the CLI + renderer against a fresh or existing data directory. Cleanup items: retire the v0.5 dev-trial binding (`scripts/dev-bind.sh uninstall` — wrapper + fenced profile exports) and any lingering `npm link`; the real install replaces both.
- [ ] **Docs pass** — README, PROTOCOL.md, and type schemas current; investigation and plan docs archived as decided/done.

---

## Cross-cutting decisions (settle in v0.4–v0.5, revisit only with cause)

| Decision | Recommendation |
|---|---|
| Canonical store | Markdown files, permanently; index is disposable cache (see investigation) |
| Stack | TypeScript; better-sqlite3 index; plain local web server — no hosted deployment in v1 |
| History | Git is the transaction log; no bespoke journal format |
| Collaboration boundary | Turn-based negotiation only; RTC is explicitly out of scope until the files-as-truth boundary is actually hit |
