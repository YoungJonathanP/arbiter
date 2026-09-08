# Next agent: T03, then handoff

Task: [T03 — fresh projections, privacy and review state](../improvement-tasks/03-derived-state.md).
Ready/unassigned/not started; verified 2026-09-07.
Repo: YoungJonathanP/arbiter; main; HEAD 4a5e0979ec078cf492df3050b6fdc46196727093.
Checkout: /Users/jonathanyoung/Documents/Work/arbiter; resolve locally elsewhere.

## First action

Complete T03: fresh projections, visibility, review without status loss.
Prepare the successor; do not execute it or start another session.

First inspect instructions/branch/HEAD/worktree; read CLAUDE.md and T03. Add pure
same-minute status and delayed-arbitration regressions: incremental/full outputs
must agree despite older updated timestamps. Settle invalidation before caches
or timestamps. Coordinate fields with T05; defer its checkpoint product.

## State and inputs

T01–T02 complete, uncommitted: preserve code/tests/assets and README/HANDOFF/docs
edits. Tests 50/50, build/diff pass. Source CLI: arbiter-data 26 files/0 errors/0
warnings; fixtures 23/0/1 existing raw warning. Frozen bytes unchanged.
[T02 evidence](completed/t02.md) is optional.

Read as needed: src/core/{dashboard,facts,indexdb,queries,triage}.ts;
src/web/server.ts; docs/grammar.md sections 7/9/13; docs/v0.5-decisions.md.
Interfaces: src/core/{commit,arbitrate-file,arbitrate}.ts; src/cli/{main,args,data}.ts;
assets/contract/; docs/v0.4.8-recoverable-commits.md. Coordinate with
docs/improvement-tasks/05-handoff-contract.md. No Finance Hub, USB KB or transcript.

Rechecked: timestamp-only refresh retains stale statuses; visibility lacks shared
filtering; triage overwrites nonterminal status with needs-review. No start gap.

Carry interfaces forward:
- args.ts owns help/schemas (propose/recover included); bad inputs exit 2. Hash:
  sha256:<hex>; write: prefixed/bare hex or new. CAS mismatch: expected/actual, exit 3.
- data.ts: identity/init/frozen guards; --data > ARBITER_DATA > cwd selection on
  stderr, pipeable stdout. Validate whole KB; init explicit --data, missing/empty KB.
- Grammar/bootstrap protocol/base 0.4.8: assets/contract/; concrete schemas 0.4.
  Legacy 0.4.6 accepted without rewriting. new --date sets event/ID date;
  created/updated use capture time (--now override).
- commitFile handles write/new/regen/normalize, triage and arbitrateFile;
  stageProposal shares its corpus-wide local SQLite lock. Preserve base checks,
  atomic rename, postconditions and sticky staging.
- .arbiter/transactions/*.json is canonical history: snapshots, intent, IDs/digests,
  verdicts/replay links. Back up with KB; never delete as index cache. recover
  resumes commits/cleanup; --dry-run inspects. Conflicts retain snapshots for
  fresh-base reconciliation.
- Verdicts use Arbitration history; preserve legacy Summary. Applied ops require
  parsed effects; unsupported proposals stay staged. Object-ref/legacy owning
  bare IDs work. Replay is idempotent; changed old IDs stay staged. T05 checkpoint
  replacement stays separate from receipts.
- Guarantees cover cooperating local writers, not external editors, network
  filesystems or multi-item transactions. Detected external edits retain snapshots.
  Pure arbitration uses input timestamps, never wall clock.

## Acceptance and constraints

- [ ] Same-minute, older/delayed and quoted-timestamp edits refresh current marks;
  incremental and full outputs agree, including cache rebuild.
- [ ] Share visibility across dashboard/query/preview/human-agent views and future
  exports; exclude private titles, relationships, counts and carried entries.
- [ ] Review metadata preserves execution status and blockers. Specify migration
  of legacy needs-review with unknown prior state; coordinate fields with T05.
- [ ] Active children remain reachable when parents age off/archive/fail to resolve.
  CLI/renderer share projection rules and verified freshness inputs.
- [ ] npm test, npm run build, git diff --check; validate both bundled corpora
  explicitly with source CLI, read-only. Tests assert outcomes.

Write only temporary/synthetic corpora; never change frozen arbiter-data/ or
fixtures bytes to pass tests. No USB import. ARBITER_DATA selects frozen data;
live ../arbiter-data is absent. Recheck, use explicit --data, record unavailable
live capture if unchanged; isolated work is not blocked. Contract changes need
a version bump/decision note. Preserve CLI flows/profiles. Ask before committing
(CLAUDE.md); no push/publish/external messages without authority. Localhost tests
need sandbox escalation (npm test prefix approved); distinguish environment failures.

## Chain the handoff after completion

Preserve these instructions; keep session history in completion records.

1. Verify task/acceptance checks; mark task/index complete only with evidence.
   Record fallbacks and limits.
2. Create docs/handoffs/completed/t03.md (use the completed task ID thereafter):
   outcome, files, tests, limits, decisions, HEAD/uncommitted state. Preserve this
   outgoing packet there or in unique history; never overwrite an existing record.
3. Select the next incomplete ready task in docs/improvement-plan.md (default:
   T04). Recheck its packet/implementation before declaring readiness; record gaps.
4. Replace this file with a self-contained packet: outcome, exact first action,
   inputs, verified state, gates, constraints, acceptance and these instructions.
   Carry changed interfaces directly; old handoffs are optional. Keep within
   6 KiB UTF-8 without silently truncating constraints.
5. Verify links, size, task identity and index agreement. Return a clickable link
   and this copyable launch prompt:
   "Open docs/handoffs/next-task.md in the Arbiter checkout. Complete its current
   assignment and, after verification, create the chaining handoff for a new
   agent exactly as instructed."
6. End after delivering the handoff. A human opens the new session.

If incomplete, retain this task with verified progress, failed checks, blocker
and exact next action; never mark complete because the session is ending.
If all tasks are complete, record verified completion and no pending successor.
