# Arbitration — concurrent writes with mutual context

> Historical design record. The [v0.4.9 projection/review decision](v0.4.9-projections.md) supersedes status absorption: unresolved arbitration sets separate review metadata. The v0.4.8 [commit decision](v0.4.8-recoverable-commits.md) and [grammar §9.1](grammar.md#91-verified-effects-and-recovery-v048) supersede the lock-free filesystem and Summary-receipt claims below. Pure confluence does not imply atomic persistence.

*Design proposal, 2026-07-05. Validates and extends the original PROTOCOL.md concurrency rule, which specced detection ("re-read before write") and an aspiration ("merge intent — negotiate, never blind-overwrite") but no mechanism. This doc supplies the mechanism: how two writers who touch the same item come to understand each other's context, and who resolves what. It is the feature the tool is named for.*

> **Decision (2026-07-05):** Model C (staged-on-contention) adopted, with proposals in hidden `.staged/` sibling directories, then amended the same day for N-writer convergence (§6). Specced in PROTOCOL.md#arbitration (replacing #concurrency) and grammar §9; the §7 deltas below are applied. This doc stands as the decision record.

## 1. The problem, precisely

Writers: multiple agent sessions (possibly concurrent), the human (editor, phone, hand-added dashboard lines), and later the app (regeneration, triage). The current optimistic protocol has four gaps:

1. **TOCTOU window** — re-read-then-write still races between the re-read and the write.
2. **Intent is invisible** — the second writer sees the first writer's *diff*, not its *reason*. A diff shows `status: in-flight → done`; it doesn't show "verified in prod, closing." Without the why, "merge intent" is guesswork.
3. **No disagreement protocol** — if agent A closes an item and agent B (working from staler observations) reopens it, nothing stops the ping-pong or says who decides.
4. **Duplicate creation** — two sessions capturing the same new work concurrently produce near-duplicate items; the reopen rule assumes the first is already visible.

### Conflict taxonomy

| Class | Example | Frequency | Hard? |
|---|---|---|---|
| Append + append, different targets | One adds an artifact, other appends a journal note | Common | No — commutes |
| Append + append, same section | Both add artifacts | Common | No — commutes (dedupe identical links) |
| Field write + unrelated write | Set `eta` + mark a step | Common | No — commutes |
| Same field, both write | Both set `status` | Rare | Yes |
| Same checklist step, both mark | `[~]` vs `[x]` on one step | Rare | Semi — marks have a natural order |
| Prose rewrite + prose rewrite | Both rewrite `## Summary` | Rare | Yes — prose is opaque, no auto-merge |
| Terminal reversal | Reopen what another just closed | Rare | Yes — and dangerous |

The shape of the answer follows from the taxonomy: **most writes commute** (capture etiquette is append-heavy by design), so the machinery should cost nothing on the common path and activate only on the rare contended one.

## 2. A load-bearing constraint

The only atomic, collision-free operation two uncoordinated file-tool agents share is **creating a distinctly-named file**. Editing the same file — even different sections, even an append-only "staging section" inside it — can still collide at the text level, and the staging area itself becomes the thing being raced on. So: *staged changes must be files, not sections*. (A "staging section" survives as the **presentation**: the item lists its pending proposals; the renderer shows them inline. But the on-disk unit is one file per proposal.)

This is also the Logseq lesson replayed: their file-based sync lost data precisely when two clients merged concurrent edits to one file's text. Their fix was a DB + real-time protocol; ours — with turn-based writers and no keystroke merging — is to make contended writes land as separate files carrying enough context to be merged *semantically*, not textually.

## 3. Candidate models

### A — Etiquette + conflict signal only (status quo, hardened)
Keep optimistic writes; add content-hash CAS via the app/CLI (`--if-match`), re-read-diff for bare agents. **Pro:** zero overhead, no new formats. **Con:** gaps 2–4 remain; arbitration stays vibes-based. Rejected as insufficient alone — but it is the right substrate (Layer 1 below).

### B — Stage everything
Every write to a work item is a proposal file; a mediator (app or next agent) applies them. **Pro:** total audit, perfect mutual visibility. **Con:** the item file always lags reality; every reader must also read staging (progressive-disclosure tax on *readers*, who outnumber writers); the common uncontended write pays for the rare conflict. Rejected: optimizes the wrong path.

### C — Staged-on-contention (recommended)
Direct writes on the happy path; staging + arbitration only when contention is detected or predictable. Detailed below.

## 4. Recommended design: detect cheaply, stage on contention, arbitrate with intent

**Layer 0 — commute by construction.** The protocol already prefers smallest-sufficient edits. The grammar's op vocabulary (set field, mark step, append entry) lets a writer — or the app — decide commutation mechanically. Two ops that commute are both applied; no ceremony.

**Layer 1 — detection.** Every writer remembers the content hash of the version it read. Through the app/CLI: CAS (`arbiter write --if-match <hash>`), atomic. Bare file-tool agents approximate: re-read, diff against remembered state, and if changed treat it as contention. Uncontended write → apply directly. *No intent note required on the happy path: git history is the intent journal for direct writes* (auto-commit is already planned in v1.0 hardening).

**Layer 2 — proposals (the staging).** On contention — or proactively when touching a high-stakes field (`status` transitions to/from terminal; reversing a change less than 48h old) — the write lands as a **proposal file**, not an edit:

```
tasks/<item-id>.staged/<date>-<author>-<base-slug>.md
---
id: 2026-07-05-<author>-close-webhook
item: stripe-webhook-verification-2026q3
base: sha256:9f3a…            # hash of the item version this was written against
author: <session/human label> # session-unique — filenames must not race
updated: 2026-07-05T14:02:00
ops:
  - "set: status = done"
  - "mark: ^watch-live-payment = done"
---
# Close: webhook verified in prod

Watched live payment 2026-07-05; webhook delivered, vendor_orders row and
confirmation email confirmed. Closing.
```

The body is the **intent** — the context the other writer needs. Discovery requires no edit to the contended item at all: writers check for `<id>.staged/` before writing (PROTOCOL.md#tier-2), dashboard regeneration marks affected entries with a `(<N> staged)` flag, and the sweep (Layer 3) finds orphans by listing staging directories. Proposing is therefore itself conflict-free.

**Layer 3 — arbitration.** The rule that makes it *Arbiter*: **the writer who discovers the conflict owns the merge.** The second writer reads the applied change (diff + git log) and any pending proposals *with their intents*, then:

1. **Commuting ops** → apply both, delete the applied proposal files (git history preserves them — the audit trail survives deletion).
2. **Non-commuting ops with a resolution rule** (§5) → apply the resolution, record it as a dated line in the item's Summary (`2026-07-05: closed by A, B's blocker note merged into step 3`), delete the proposals.
3. **Irreconcilable** (contradictory facts, prose vs prose, terminal reversals) → set `status: needs-review`, leave both proposals staged, surface on the dashboard. A human — or an explicitly-invoked arbiter session with both intents in front of it — decides. Silent loss is impossible by construction: nothing is overwritten, everything is either applied or still staged.

**Sweep.** Triage (already specced for 14-day staleness) also sweeps staging: any proposal older than 24h whose author never returned (crashed session) is arbitrated by the sweeping agent or escalated to `needs-review`. Proposals are crash-safe capture: a session that dies after writing its proposal has still communicated its intent.

## 5. Resolution rules (semantic merge, not textual)

| Conflict | Rule |
|---|---|
| Both set `status` | **Structure decides**: merge checklist ops first, then recompute — a `[!]` step with a live blocker ⇒ `blocked`; all steps `[x]` ⇒ candidate `done`. An explicit status that contradicts merged structure loses. |
| Same step, different marks | Lattice `todo < in-flight < done`: take the max — **unless** one mark is `[!]` with a `blocked-by:` link (evidence attached) ⇒ blocked wins. |
| Terminal reversal (`done`/`dropped` → active) | Never auto-resolved. Requires the reverser to file a proposal citing the original closer's evidence; human confirms if the original writer's session is gone. |
| Prose vs prose (same section) | No auto-merge, ever — prose is opaque (grammar §1). Both stage; needs-review. |
| Duplicate creation | Same `<base>` slug within the reopen window ⇒ later item merges into earlier (append checklist/artifacts, delete the newer file before anything references it). |
| Append vs append | Always merge; dedupe byte-identical entries. |

## 6. Convergence with N writers

"Second writer arbitrates" is two-writer shorthand; the mechanism must hold for N. Take four agents A, B, C, D, all reading base h₀: A and B's ops overlap (both resolve the item's status), while C and D merely occupy the same file — disjoint sections, commuting ops.

The run: A lands first and verifies (h₁). C's re-read finds h₁ ≠ h₀; its append commutes with A's diff, so C **rebases and retries** — writes h₂, verifies, never stages. D likewise (h₃). B's `set: status` overlaps A's change, fails the commutation test, and **stages** with intent. Whoever next touches the item (B itself, D, or the sweep) arbitrates: merge checklist ops, recompute status from structure, verify, then delete B's proposal only once the item satisfies it.

Three rules make this safe at any N — all three specced in PROTOCOL.md#arbitration:

1. **Persistence invariant (write-then-verify).** A write is complete only when its author observes it in the file; a clobbered write is detected by the post-write re-read and re-enters as contention. Intent can be delayed, never destroyed — this is what makes racing arbiters and racing rebasers harmless in the worst case.
2. **Bounded rebase-retry for commuting ops.** Disjoint writers never stage: diff against base, rebase, retry (≤2), verify. The op vocabulary is what lets a writer check commutation for itself.
3. **Confluent arbitration.** The merge is a deterministic, order-independent function of (current item, staged-proposal set). The resolution rules were chosen as N-ary joins, not pairwise tiebreaks — mark-lattice max, structure-decides recomputation, needs-review absorption — so any number of concurrent or repeated arbitrations converge on the same bytes, and delete-after-satisfaction makes duplicates no-ops. Arbitration needs no lock and no designated arbiter.

Two deliberate conservatisms: **staging is sticky** (while any proposal pends, all writers stage, so a single arbitration pass sees every intent), and **proposal filenames embed a session-unique author label** (uniqueness is chosen, never checked-then-created — four same-day "close" proposals must not race for one filename).

## 7. Spec deltas (applied 2026-07-05)

1. **PROTOCOL.md#concurrency** → rewritten as **#arbitration**: the write path (base → happy path → propose → arbitrate), the second-writer-owns-the-merge rule, the resolution table, and the 24h sweep. Tier-2 gains a "check `<id>.staged/` before writing" rule.
2. **grammar.md §9 — proposal files**: `staged-dir`/`proposal-path` productions, frontmatter keys (`id`, `item`, `base`, `author`, `updated`, `ops`), and the ops mini-grammar (`set:`, `mark:` by `^anchor` or quoted step text, `append:`). Intent body is REQUIRED.
3. **grammar.md §7**: dashboard entries gain an optional `(<N> staged)` flag; **§11**: pointer scope `staged`; **§13**: conformance gate 6 (no-loss arbitration).
4. **Triage**: sweep rule for orphaned proposals (>24h, author gone).
5. Not adopted: `## Proposals` section inside item files (staging must not edit the contended file) and tier-3 `kind: proposal` (ephemera kept out of the docs directory — proposals live in `.staged/`).
6. **N-writer amendment (same day, after review):** write-then-verify persistence invariant; bounded rebase-retry for commuting ops (disjoint writers never stage); arbitration as a confluent pure function, open to any arbiter, with delete-after-satisfaction; sticky staging; author-unique proposal filenames (`<date>-<author>-<slug>.md`). Grammar: gate 6 hardened, gate 7 (confluence) added.

## 8. Trade-offs owned

- Contended items briefly show stale canonical state + visible proposals. This is honest: the disagreement *is* the state, and hiding it (last-write-wins) is how data dies.
- Bare-agent CAS is approximate; the TOCTOU window shrinks to milliseconds but only the app closes it fully. Acceptable: worst case is two proposal files instead of one clean write — degradation is toward *more* staging, never toward loss.
- One more concept for agents. Mitigated: the happy path is unchanged (write like before), and the proposal format is one frontmatter block + prose — the same shape as everything else in Arbiter.
