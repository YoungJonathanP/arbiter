# Next agent: implement T02, then prepare the next handoff

Current task: [T02 — verified arbitration and recoverable commits](../../improvement-tasks/02-safe-writes.md).
Ready; unassigned; not started. Verified: 2026-09-06.
Repo: YoungJonathanP/arbiter; main; HEAD 4a5e0979ec078cf492df3050b6fdc46196727093.
Checkout: /Users/jonathanyoung/Documents/Work/arbiter; resolve locally elsewhere.

## Assignment and first action

Complete all of T02: verified effects or durable dispositions under contention
and crashes. Prepare the successor; do not execute it or start another session.

First inspect instructions, branch, HEAD and worktree; read CLAUDE.md and T02.
Add a temporary-corpus regression for append into an existing Detail docs section,
checking parsed effects and proposal survival. Design the shared commit boundary
and receipt recovery before broad refactoring.

## Verified starting state and required inputs

T01 is complete, uncommitted. Preserve it and planning changes in README.md,
HANDOFF.md and docs/. Tests: 36/36; build passes. Source CLI validation:
arbiter-data 26 files/0 errors/0 warnings; fixtures 23 files/0 errors/1 warning.
[T01 completion](t01.md) is optional history.

Read T02's named inputs as needed: src/core/{arbitrate,triage,model,parse,serialize}.ts;
src/cli/main.ts; docs/arbitration.md; docs/grammar.md sections 9/13;
test/arbitration.test.ts. Consult T05 only for receipt/history coordination.
No Finance Hub material, USB KB or prior transcript is needed.

Verified: default applied verdicts, unhandled docs/malformed appends, direct
CLI/triage writes/deletion. No prerequisite gap; receipts/recovery/T05 coordination
are T02 design work.

Carry these T01 interfaces forward:
- src/cli/args.ts owns schemas/help; register propose there. Unknown options,
  missing values and ignored positionals exit 2.
- hash prints sha256:<hex>; write accepts prefixed/bare hex or new. Format errors
  exit 2; real mismatch labels expected/actual and exits 3. No atomic CAS yet.
- src/cli/data.ts owns selection, identity, init and frozen guards. Selection
  (--data > ARBITER_DATA > cwd walk) goes to stderr; stdout stays pipeable.
- validate rejects scoped paths. Empty bootstrap is reported uninitialized;
  missing/malformed KBs fail. init requires explicit --data and missing/empty
  destination. doctor checks identity plus corpus health.
- Supported protocol/base: 0.4.6; concrete schemas: 0.4. Versioned work must update
  compatibility/bootstrap assets without altering frozen bytes. new --date sets
  event date and ID date/quarter; created/updated use capture time (--now override).

## Acceptance and constraints

- [ ] Handle all eligible sections; unsupported/malformed ops stay staged or get
  truthful durable dispositions. Verify parsed effects.
- [ ] Share base recheck, atomic replacement and postconditions across write,
  arbitrate, triage and normalize; specify cooperating writers.
- [ ] Same-base writers cannot silently overwrite; preserve/reconcile detected
  external edits without overstating atomicity against external editors.
- [ ] Durable proposal IDs/receipts, history recovery and idempotent replay survive
  crashes before replacement, after replacement and before proposal cleanup.
- [ ] Propose scaffold reconciles object-ref/legacy item IDs; malformed proposals
  are isolated without hiding global diagnostics. Version receipt placement away
  from continuation Summary, coordinated with T05; preserve historical prose.
- [ ] npm test, npm run build, git diff --check; both bundled corpora validated
  explicitly with source CLI as read-only checks. Tests assert effects, not verdicts.

Mutate only temporary/synthetic corpora; never alter frozen arbiter-data/ or fixture
bytes to pass tests. No USB import. ARBITER_DATA selects the frozen corpus; live
../arbiter-data is absent. Recheck and use explicit --data; record live capture
unavailable if unchanged. Isolated work is not blocked. Protocol/grammar changes
need a version bump and decision note. Preserve supported CLI flows and profiles.
Ask before committing (CLAUDE.md); no push, publish or external messages without
authority. Localhost tests may need sandbox approval; separate environment failures
from product failures. T01 digest parsing does not establish write safety.

## Chain the handoff after completion

Preserve these instructions in every successor. Replace current state here;
keep session history in completion records.

1. Verify every required task/acceptance checkbox. Mark the task and execution-index
   checkbox complete only with evidence; record supported fallbacks and limits.
2. Write docs/handoffs/completed/t02.md (use the completed task ID thereafter):
   outcome, changed files, tests, limitations, decisions, HEAD and uncommitted state.
   Preserve the outgoing packet there or in unique history. Never silently
   overwrite an existing completion record.
3. Select the next incomplete task with a satisfied start gate in
   docs/improvement-plan.md. Default after T02 is T03. Recheck its packet/current
   implementation before declaring readiness; record prerequisite gaps explicitly.
4. Replace this file with a self-contained packet: outcome, exact first action,
   inputs, verified state, gates, constraints, acceptance checks and these chaining
   instructions. Carry interface changes directly; earlier handoffs are optional.
   Stay within 6 KiB UTF-8 without silently truncating constraints.
5. Verify local links, size, task identity and agreement with the execution index.
   Return a clickable link and this copyable launch prompt:
   "Open docs/handoffs/next-task.md in the Arbiter checkout. Complete its current
   assignment and, after verification, create the chaining handoff for a new
   agent exactly as instructed."
6. End the session after delivering that handoff. A human opens the new session.

If incomplete, keep this task here with verified progress, failed checks, blocker
and exact next action; never mark complete because the session is ending.
If all tasks are complete, record verified completion and no pending successor.
