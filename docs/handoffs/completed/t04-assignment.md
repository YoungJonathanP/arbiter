# Next agent: T04, then handoff

Task: [T04 — parser recovery](../../improvement-tasks/04-parser-recovery.md).
Ready/unassigned; rechecked 2026-09-07.
YoungJonathanP/arbiter; main; HEAD 4a5e0979ec078cf492df3050b6fdc46196727093.
Checkout: /Users/jonathanyoung/Documents/Work/arbiter.

## First action

Complete T04; prepare, but do not execute, the successor.

Inspect instructions/branch/HEAD/worktree; read CLAUDE.md and T04. Design ordered
mixed entries/source locations, then synthetic Artifacts/Detail docs/checklist
regressions: malformed lines must not erase neighbors. Preserve T02 parsed-effect
checks/T03 privacy. Defer T05 checkpoints.

## Inputs

T01–T03 complete/uncommitted; preserve code/tests/assets/docs. Tests 64/64; build/diff pass. Source CLI validations:
arbiter-data 26 files/0 errors/0 warnings; fixtures 23/0/1 existing raw warning.
Frozen bytes unchanged. [Evidence](t03.md) (optional).

Inputs: src/core/{parse,model,serialize,normalize,validate}.ts; src/web/server.ts;
test/gates.test.ts; docs/grammar.md (opacity, sections, gates). Interfaces as needed:
src/core/{arbitrate,arbitrate-file,commit,facts,projection,visibility}.ts;
docs/v0.4.8-recoverable-commits.md; docs/v0.4.9-projections.md; assets/contract/.
No Finance Hub/USB KB/transcript.

Rechecked: checklist/link/docs parsers fail whole sections on one invalid line.
Normalize/validate omit line positions; renderer shows opaque text.

Interfaces:
- args.ts owns help/schemas; invalid inputs exit 2. Hash sha256:<hex>; write
  accepts prefixed/bare hex or new. CAS mismatch reports expected/actual, exit 3.
- data.ts guards identity/init/frozen KBs; --data > ARBITER_DATA > cwd, selection
  on stderr, pipeable stdout. Validate whole KB; init explicit --data, missing/empty
  KB. Grammar/bootstrap protocol/base 0.4.9; concrete schemas 0.4. Legacy 0.4.6/0.4.8
  accepted unchanged. new --date sets event/ID date; created/updated use capture
  time (--now override).
- commitFile serves write/new/regen/normalize/triage/arbitrateFile; stageProposal
  shares its corpus-wide local SQLite lock. Preserve CAS, atomic rename, sticky
  staging and parsed postconditions; applied ops require parsed effects.
- .arbiter/transactions/*.json is canonical history: snapshots/intent/digests/
  verdicts/replay links. Back up; never delete as cache or expose in raw/exports.
  recover resumes commits/cleanup; --dry-run inspects. Conflicts retain snapshots.
  Guarantees: cooperating local writers, not external editors/network FS/multi-item
  transactions; detected external edits retain snapshots for reconciliation.
- Arbitration history receives verdicts; preserve legacy Summary. Unsupported
  proposals stay staged whole. Object refs/legacy owning bare IDs work; replay
  is idempotent, changed old IDs stay staged. Pure arbitration uses input time.
- readProjection returns visible files/facts and input digest from observed bytes.
  Incremental/full regen and renderer human/agent/raw dashboards share current facts,
  never timestamp invalidation. Digest excludes generated dashboard; age-off uses
  caller day; raw dates may use previous dated evidence. Reads are not atomic
  across files; refresh after concurrent external edits.
- Visibility excludes private items/docs/owned files before edges/counts/rollups.
  Previews omit lines with known private identifiers/titles; literal filtering
  cannot classify arbitrary copied/paraphrased secrets. Unverifiable carried
  entries/strays are omitted; regen journals preserve old bytes for recovery.
- review: needed | legacy-unknown is sticky, separate from status/blockers. Legacy
  status: needs-review has unknown prior state; never infer todo. T05 readiness
  must be separate. Dashboard review flag follows staged flag. Children of terminal,
  archived/private/missing parents and invalid cycles retain reachable routes.

## Gates

- [ ] Valid links/docs/steps coexist with malformed lines in original order;
  repeated normalization/round trips lose no content.
- [ ] Diagnostics locate actual lines (FM/blank offsets included), name expected
  productions, and distinguish malformed input from broken targets.
- [ ] Render valid navigation and actionable diagnostics; arbitration must never
  count opaque text as an applied structured op.
- [ ] Version contract changes; add a decision note.
- [ ] npm test, npm run build, git diff --check; source CLI validate both bundled
  corpora with explicit --data, read-only. Assert outcomes, not implementation.

Only temporary/synthetic corpora; never change frozen arbiter-data/ or fixtures
bytes to pass tests. No USB import. ARBITER_DATA selects frozen data; live
../arbiter-data is absent. Recheck; record unavailable capture if unchanged, but
continue isolated work. Preserve CLI flows/profiles. Ask before committing
(CLAUDE.md); no push/publish/external messages without authority.
Localhost tests need escalation (npm test approved); distinguish environment failures.

## Chain the handoff after completion

1. Verify acceptance; mark task/index complete only with evidence and limits.
2. Create docs/handoffs/completed/t04.md: outcome, files, tests, limits, decisions,
   HEAD/uncommitted state. Preserve this packet in unique history; never overwrite
   records. Old history stays optional.
3. Select next ready incomplete task from docs/improvement-plan.md (default T05);
   recheck packet/implementation and record gaps.
4. Replace this file: first action, inputs, verified
   state, gates, constraints, acceptance and these instructions. Carry changed
   interfaces directly; keep within 6 KiB UTF-8 without truncating constraints.
5. Verify links/size/task/index agreement. Return a clickable link and this prompt: "Open docs/handoffs/next-task.md in the Arbiter checkout.
   Complete its current assignment and, after verification, create the chaining
   handoff for a new agent exactly as instructed."
6. End; human opens next session. If incomplete, retain this task with
   progress, failed checks, blocker and exact next action; never mark complete
   because the session is ending. If all complete, record no pending successor.
