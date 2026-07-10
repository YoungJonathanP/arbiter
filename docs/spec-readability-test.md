# Spec-readability test — v0.4 exit criterion

*Run 2026-07-06. Design per [launch-plan.md](launch-plan.md) v0.5 item 1: a small arbiter-data directory hand-written from the spec alone (including one `.staged/` conflict with two overlapping proposals); two independent fresh agent sessions, given only the directory, judge validity and arbitrate the conflict. Divergent verdicts are spec bugs to fix before code.*

## Setup

- Fixture: [`fixtures/arbiter-data/`](../fixtures/arbiter-data/) — self-contained (PROTOCOL.md + `types/` copied in), 13 content files: dashboard; one goal with an anchored milestone; four tasks (in-flight with a tier-3 plan doc, blocked via `blocked-by:` into the goal anchor, done with a distilled accomplishment, and one contended); a meeting; two journal entries (one deliberately raw: no frontmatter, no pointer); two staged proposals against the contended task sharing a verified `base` hash — one closing the task (`set: status = done`, staged as high-stakes), one marking the same step `blocked` (staged because staging is sticky).
- Judges: two independent sessions, identical prompts, hard-restricted to reading only the fixture directory. The test author pre-committed an answer key (including predicted spec gaps) before reading either report.
- Tasks: orientation from one dashboard read; per-file validity sweep; blocked-item check; a contended write (draft the proposal file byte-exact); full arbitration of the two proposals as the pure function; normalization of the raw journal entry; an ambiguity report.

## Verdict

**Validity: PASS.** 13/13 identical verdicts (all valid, same oddities flagged). Navigation, the blocked check (blocker live → change nothing), the contended-write procedure (sticky staging → propose, never edit), and normalization all came out the same — including both judges independently preferring the dashboard's date over the checkout-falsified mtime.

**Arbitration confluence: one fork, exactly where the answer key predicted.** Both judges produced *byte-identical merged checklists* (blocked-wins over evidenced done on the contested step, including the same synthesized `blocked-by:` line lifted from the proposal body; the uncontested done op merged; explicit `status: done` overruled by structure) and both deleted the satisfied proposal. They split on the overruled proposal's consequences: Judge A → item `status: blocked`, loser stays staged for the sweep; Judge B → item `status: needs-review`, loser escalated. The spec defines deletion only by satisfaction and escalation only by irreconcilability; a proposal *reconciled against* by a rule is neither.

Notable: both judges, unable to see grammar §9 (it lives outside the data directory), independently invented the **same wrong ops syntax** (`append: checklist = "…"`). Agents converge on plausible-but-noncanonical forms when the spec is silent — silence does not produce diversity, it produces confident uniformity in the wrong dialect.

## Fixed in v0.4.2 (applied 2026-07-06)

PROTOCOL.md:

1. Ops grammar inlined into #arbitration (was a dangling "grammar §9" reference — PROTOCOL was not self-contained for proposal writing); `id` added to the proposal frontmatter list; mark-op-blocked body-link rule stated.
2. `staged` added to the #pointers scope enum; raw human files explicitly exempt from the footer until normalization (was a flat contradiction with #normalization).
3. Link targets declared data-directory-root-relative (every fixture link depended on this; it was stated nowhere).
4. Id uniqueness declared per-directory (#slugs).
5. Tier-1 entry-date semantics stated (`updated` date for work items, `date` for records); staged proposal files declared not item touches; `(N staged)` declared most-urgent on a card.
6. Continuation-line indent (six spaces) stated in prose; blocked-check no-op case stated; normalization told to prefer dated evidence over falsifiable mtimes.

grammar.md (v0.4.2): §5 now permits and canonicalizes exactly one blank line between sections and before the pointer line (the v0.4 productions forced unreadably cramped canonical files — found while hand-authoring, invisible to the judges); §7 gains the entry-date and dashboard-`updated` semantics.

## Decisions (2026-07-08)

1. **Fate of an overruled proposal — decided: delete on overrule** (option a, as recommended). Arbitration is terminal: every op of an arbitrated proposal ends applied or overruled; the resolution line records each overruled op with the proposal's evidence links (loss is recorded, never silent); the proposal is deleted. Only a proposal containing an op *no rule decides* (prose vs prose, terminal reversal) stays staged whole, flagging the item `needs-review`. Item status stays structural. Applied in PROTOCOL.md#arbitration step 4 + grammar §9/§13 gate 6, protocol v0.4.3.
2. **Gate-7 determinism — decided**: resolution-line grammar added to grammar §9 (backtick-quoted ops, `⇒ applied`/`⇒ overruled (links)`, filename-ordered); arbitration's `updated` is the **max** `updated` across the item and arbitrated proposals, and the resolution line's date derives from it — no wall-clock input anywhere. Applied in v0.4.3.
3. **Bare-ref ambiguity — decided: the object model** (Jonathan's proposal, refined jointly; applied as protocol v0.4.4). The exploration surfaced that the ref question was really the addressing model: identity was entangled with location, and the archive roll — the only thing that ever moved a file — was the sole source of address rot. Decided:
   - **Archival is a flag, never a move**: `archived: <date>` in frontmatter; files never move; directory = type = an immutable facet of identity. The `archive/` path form is deleted from the grammar.
   - **Refs are permanent object refs `<dir>/<id>`** (grammar `object-ref`); bare ids are liberal input, qualified by normalization when unambiguous, flagged never guessed otherwise. Body links stay rel-paths — under no-move semantics the two currencies coincide.
   - **`_base` gains `created:`, `prev:`, `archived:`**. `prev` chains iterations across quarters (written once at creation, never contended); the forward pointer is derived, never stored. Reports walk chains for multi-quarter arcs.
   - **Tier 1 is the active-set checkpoint** (Jonathan's added requirement: no search on initialization): work-item cards list *every* non-archived item; record cards keep top-5 + overflow; regeneration is incremental — previous entries + items updated since `generated`, entries leave only via observed transitions — so nothing active is ever lost by going unseen, and no full scan ever happens except rebuilding a deleted dashboard (gate 5 extended to require incremental ≡ full rebuild).
   - Fixture extended: `goals/q2-deploy-spike-2026q2.md` (archived, in place) with the live Q3 goal chaining to it via `prev:`; all fixture refs qualified.

Deferred as cosmetic: resolution-line placement within Summary, author-label format (inherently session-chosen), proposal-filename `<base-slug>` semantics, whether arbitration refreshes the dashboard unasked (current reading: no, regeneration is programmatic or on request).

## Regression

After the open decisions land in PROTOCOL/grammar: re-run one fresh judge on the arbitration task only, against the same fixture; its answer must match the decided semantics byte-for-byte on status, checklist, and proposal fates. Then this fixture graduates to the v0.5 validator corpus (gates 1–7) and the dogfood seed.
