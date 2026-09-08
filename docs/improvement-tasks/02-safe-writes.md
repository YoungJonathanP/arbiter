# T02: Verified arbitration and recoverable commits

Status: complete. Start gate: satisfied; verified 2026-09-07.
Traceability: Feedback 2, 4; no-loss and history-safety findings.
Owner: completed in local checkout. Checkpoint verified: 2026-09-07.

## Outcome

Every accepted write has a verified semantic effect or an explicit durable disposition, including contention and crash recovery.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- src/core/arbitrate.ts; src/core/triage.ts; src/cli/main.ts (all write paths)
- src/core/model.ts; src/core/parse.ts; src/core/serialize.ts
- docs/arbitration.md; docs/grammar.md sections 9 and 13; test/arbitration.test.ts

## Task checklist

- [x] Reproduce appending into an existing Detail docs section: parsing succeeds, the docs variant is unhandled, yet a resolution line says applied.
- [x] Handle every eligible section variant explicitly. Unsupported/malformed ops remain staged or receive a truthful disposition; never initialize success without verification.
- [x] Verify each op in the parsed target structure. Finding its text in a Summary resolution line is not evidence it applied.
- [x] Introduce a shared per-item commit boundary with base recheck, atomic replacement and postcondition verification for write, arbitrate, triage and normalize.
- [x] Specify which cooperating writers receive the guarantee; preserve and reconcile detected out-of-band editor changes without overstating their atomicity.
- [x] Record proposal IDs and recoverable receipts; make replay after interruption idempotent. Delete a proposal only after its durable result is verified.
- [x] Add a propose scaffold; reconcile documented object-ref versus legacy bare-id form. Isolate malformed proposals without suppressing global health diagnostics.
- [x] Move long arbitration receipts out of the continuation Summary under a versioned contract, coordinated with T05. Add history recovery before relying on proposal deletion.

## Completion evidence

- [x] Two writers using the same base cannot both silently overwrite one another.
- [x] A crash before replacement, after replacement, or before proposal cleanup preserves recoverable intent and safe replay.
- [x] Missing, malformed and multi-word target sections never produce false applied verdicts.
- [x] CLI and triage exercise the same commit implementation; tests inspect actual effects, not only verdict text.

## Current handoff

Complete in the uncommitted worktree on main, based on
`4a5e0979ec078cf492df3050b6fdc46196727093`. [Completion evidence](../handoffs/completed/t02.md)
records 50/50 passing tests, build and diff checks, and read-only validation of both
frozen corpora. The shared commit boundary, durable receipts/recovery, verified
section effects and propose scaffold are implemented. Grammar/bootstrap 0.4.8 is
specified in the [decision note](../v0.4.8-recoverable-commits.md).

Guarantees cover cooperating local writers; detected external changes preserve
snapshots for reconciliation. No atomicity claim against arbitrary external
editors, network filesystems or across a multi-item command. The live KB remains
absent; no dogfood capture or frozen-corpus mutation occurred. T01 and planning
changes remain intact and uncommitted. No commit/push was authorized or performed.

Next: launch T03 using the [current chaining packet](../handoffs/next-task.md).
T03's timestamp-only projection and review-status issues remain unchanged and
were rechecked in source. No prerequisite gap prevents synthetic regression work.

Working boundary: implement this packet's outcome and coordinate shared interfaces
with the named dependencies. Existing unrelated changes belong to their authors.
Use temporary/synthetic corpora for tests; preserve conformance fixture semantics.
Protocol changes need a version bump and decision note. Select the KB explicitly;
the shell environment currently selects the frozen in-repo corpus.

## Capture before handing off

- [x] Replace Current handoff with verified state, exact next action and remaining gate.
- [x] Link the tested revision, checks performed and material limitations.
- [x] Preserve still-applicable constraints; move detailed logs into linked history.
- [x] Update this packet and the [execution index](../improvement-plan.md).
- [x] Use the [handoff template](../templates/task-handoff.md) for a fresh session.
