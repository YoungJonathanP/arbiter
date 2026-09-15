# T09: persist and integrate the app-review candidate

## Assignment

Continue [T09](../../improvement-tasks/09-migration-evaluation.md) under the
[plan](../../improvement-plan.md). Status: partial; owner: unassigned;
readiness: review-required. T09 is final; no successor. Repository handoff only.

## Authority

Read CLAUDE.md/T09. Resolve YoungJonathanP/arbiter; recheck workspace. Observed
2026-09-10: main,
`bfdc5519cc730fb0e23bb840b5ac83d6c7bddb66`, prior T07/T08/T09 edits uncommitted.
Preserve them. Ask before committing; no push, publication, messages or external
project/ticket/transcript/profile changes.

Live KB:
`/Users/jonathanyoung/Documents/arbiter-data-2026-09-06-jonathan-young-nhw4ydwv2p`.
Always use explicit --data; environment selects frozen data. Records do not verify
current external state. Live adoption/rollout is a separate decision.

User decisions supersede prior gates:
- 2026-09-09: use Empiricist notes for comparison; no separate case-study path/waiver.
  Current-KB copy and local tests/iterations authorized and completed.
- Review directives individually; scope answers to the question. Recorded-state
  analysis does not require an implementation owner.
- 2026-09-10: items 5/6 agreed: connected people with separate access/assignment,
  optional Relevant sources, and revision-based linked-input review. Do not ask again.
- Near-term app: structured human status/Done actions, linked quick notes/journals
  and appointments; agent-managed task overview, implementation and continuation.
  New tagged input must inform or be presented at the next task review.

## Verified state

Private root: `/Users/jonathanyoung/Documents/arbiter-t09-local-review/`.
Evaluation copies: `intent-evaluation-20260909-ggl3R8/`.
Latest manifests: `app-review-20260910/`.
All 730 live, backup, baseline and working-copy file hashes/inventories match.
Protocol 0.4.7/base 0.4.6 remains unadopted. Fresh UUID required for independent
adoption. No live capture/regen or installed mutation occurred.

[Candidate design](../../app-review-candidate.md) maps agreed behavior to
`src/core/input-review.ts` and twelve synthetic tests. Per-task revision receipts keep
presented/deferred input actionable. Later status changes never acknowledge notes.
Concurrent input stays pending; stale tasks/competing reviews require reconciliation.
Relationships confer no responsibility/access; private input cannot become shared prose.

Pure evaluation API: schemas, persistence, authentication, UI and checkpoint intake
are absent. The CAS test verifies note capture, Done/stale-write/Undo primitives,
not app controls. Candidate design specifies remaining contract/integration work.

120/120 tests/typecheck and build passed after permitted localhost rerun. Frozen: 26/0/0 and 23/0/1 (existing raw
journal warning); all 50 frozen hashes unchanged. See [latest evidence](t09.md#continuation-2026-09-10-executable-app-review-candidate).
No bounded-bootstrap/fresh-agent result is claimed.

## Constraints and remaining gates

- Preserve live KB, USB, both frozen corpora and concurrent work. Employer content
  and manifests stay outside this repository; synthetic fixtures only here.
  No private subagent inputs. Fresh-session execution is not yet authorized/measured.
- Revise exact candidates before adopting. The seven-file bundle in
  `continuation-20260909-2/` is historical and insufficient. New storage/adapters
  need a version bump/decision. Recheck source/backup/candidate hashes.
- Audience resolution must come from trusted access policy, not viewer-supplied
  grants. Association is not assignment/access; private prose stays protected.
- Human task actions use structured controls; notes go to linked records. Preserve
  imported prose/history. Done works without an agent; stale agents must observe it.
  Conflicting checklist/proposal state requires explicit resolution. Amend terminal
  staging narrowly for authorized human actions; preserve agent staging safeguards.
- Relevant sources confer no authority/blockers. Staffing/timestamps do not resolve
  scope. Recorded corrections support scoped analysis; execution needs evidence.
- Persist through CAS/staging/checkpoint capture; verify incorporation before its
  receipt. Retain transaction intent, exact history and old refs/anchors or redirects.
  Re-observe partial writes; no multi-file atomicity. Never restore over concurrent work.
- Normal continuation excludes history: whole-packet 6 KiB target/10 KiB ceiling;
  larger maximum/reason explicit. Never truncate constraints or override privacy.

## Next actions

1. Recheck workspace/copies. Implement candidate receipt/link storage,
   validation and version decision; keep last input review separate from updated.
2. Connect CAS persistence and structured app/checkpoint review to the candidate.
   Test actual capture, stale human actions, interruption and restricted exports;
   revise exact adoption candidates to the agreed outcomes in app direction.
3. Only with a compatible candidate, migrate the selected evaluation target with
   verified backups/fresh UUID. Verify refs/history, capture/export and rollback;
   perform authorized synthetic-only fresh-session evaluation and measure results.

## Completion and outgoing capture

Complete only with T09 migration/fresh-session evidence. Live reconciliation
requires compatible adoption. After code changes run npm test (escalate localhost
sandbox failures), npm run build and git diff --check. Explicitly validate both
frozen corpora and hashes. Do not label pure-model results as installed app behavior.

Update T09/index/evidence. Archive incoming packet uniquely with rebased links.
Follow [template](../../templates/task-handoff.md)/[design](../../task-handoffs.md).
Verify links, size and task/index agreement.
If gated retain T09; after full completion replace with completion/no successor.

Return this file link and prompt:
"Open docs/handoffs/next-task.md in the Arbiter checkout.
Complete its current assignment and, after verification, create the chaining
handoff for a new agent exactly as instructed."
End; the human starts the next session.
