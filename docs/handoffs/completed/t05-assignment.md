# Next agent: T05, then handoff

Task: [T05](../../improvement-tasks/05-handoff-contract.md).
Ready/unassigned; rechecked 2026-09-07. YoungJonathanP/arbiter; main;
HEAD 4a5e0979ec078cf492df3050b6fdc46196727093.
Checkout: /Users/jonathanyoung/Documents/Work/arbiter.

## Start

Complete T05; prepare only its successor.
Check instructions/branch/HEAD/worktree, CLAUDE.md and T05. Choose checkpoint
storage/pointer/replacement/history before its contract; readiness is separate from
status/review. Defer T06 UI/CLI. Rechecked: checkpoint roles/lifecycle absent; sizes proposed. Preserve append-only docs.

## Inputs

Read T05’s named docs/inputs; assets/contract/;
src/core/{model,schema,parse,serialize,normalize,validate}.ts. As needed: core
{section-rows,commit,arbitrate,projection,visibility,arbitrate-file}; cli {args,data}.
.claude/skills/arbiter/SKILL.md: use skill-creator for edits.
No Finance Hub/USB KB/transcript; no installed-KB changes from design alone.

T01–T04 complete/uncommitted: preserve all changes. Tests 68/68; build/diff pass.
Source validate: arbiter-data 26 files/0 errors/0 warnings; fixtures 23/0/1 existing
raw warning. Frozen hashes unchanged. [Evidence](t04.md).

Interfaces:

- args.ts owns help/schemas; invalid inputs exit 2. Hash sha256:<hex>; write accepts
  prefixed/bare hex/new; CAS mismatch shows expected/actual, exit 3.
- data.ts guards identity/init/frozen KBs; --data > ARBITER_DATA > cwd; selection
  stderr, pipeable stdout. Validate whole KB. Init: explicit --data,
  missing/empty KB. Grammar/protocol/base 0.4.10; concrete schemas 0.4; legacy
  0.4.6/0.4.8/0.4.9 accepted. new --date sets event/ID date; created/updated use
  capture time (--now override).
- commitFile serves write/new/regen/normalize/triage/arbitrateFile; stageProposal
  shares its corpus-wide local SQLite lock. Preserve CAS, atomic rename, sticky
  staging and parsed postconditions; applied ops require parsed effects.
- .arbiter/transactions/*.json is canonical history: snapshots/intent/digests/
  verdicts/replay links. Back up; never delete as cache or expose in raw/exports.
  recover resumes commits/cleanup; --dry-run inspects; conflicts retain snapshots.
  Cooperating local writers only; no external-editor/network-FS/multi-item guarantee.
  Detected external edits retain reconciliation snapshots.
- Arbitration history receives verdicts; preserve legacy Summary. Unsupported
  proposals stay staged whole. Object refs/legacy owning bare IDs work; replay is
  idempotent, changed old IDs stay staged. Pure arbitration uses input time.
- readProjection returns visible files/facts and observed-byte digest. Both regen
  modes and human/agent/raw dashboards share current facts, not timestamp invalidation.
  Digest excludes generated dashboard; age-off uses caller day; raw dates may use
  prior dated evidence. Reads are not atomic across files; refresh after edits.
- Visibility excludes private items/docs/owned files before edges/counts/rollups.
  Previews omit known private identifiers/titles, not arbitrary paraphrased secrets.
  Unverifiable carried entries/strays are omitted; regen journals retain old bytes.
  CorpusFile.sourceLines maps filtered lines to original coordinates; parseItemFile(text, sourceLines) uses that map.
- review: needed | legacy-unknown is sticky, separate from status/blockers. Legacy
  status: needs-review has unknown prior state; never infer todo. T05 readiness is
  separate. Dashboard review follows staged flag. Children of terminal, archived,
  private/missing parents and invalid cycles retain reachable routes.
- Checklist/links/docs: structured arrays + rawRows (entry indices/opaque/blanks).
  orderedRows supports edits/appends; reindex removals/reorders. rawLine is 1-based
  in input; reparse after writes. Malformed lines end continuation attachment; blanks
  do not. Annotations: labels/titles/step text before anchors. Opaque text cannot
  satisfy ops; valid ops may extend mixed sections. Preserve private-safe diagnostics.

## Gates

- [ ] T05 boundaries/identity/authority/owner/predicates/revisions/evidence/readiness
  defined; stale inputs/contradictions/unknown owner visible, no timestamp resolution.
- [ ] Total context budget: design targets/warnings/explicit override. Optional plan
  inputs before Checklist; artifact/row identifiers retained; task/goal guidance.
- [ ] Version contract/decision; synthetic replaceable checkpoints round-trip/validate,
  retain constraints/history and detect stale inputs. Update operating skill workflow.
- [ ] npm test, npm run build, git diff --check; source CLI validate both bundled corpora,
  explicit --data, read-only. Assert outcomes.

Only temporary/synthetic corpora; never alter frozen arbiter-data/ or fixtures to
pass tests. No USB import. ARBITER_DATA selects frozen data; live ../arbiter-data
is absent. Recheck; record unavailable capture and continue isolated work if unchanged.
Preserve CLI flows/profiles. Ask before committing (CLAUDE.md); no push/publish/
external messages without authority. Localhost needs escalation (npm test approved);
distinguish environment failures.

## Chain

1. Verify acceptance; mark task/index complete only with evidence and limits.
2. Create completed/t05.md here: outcome/files/tests/limits/decisions/HEAD/uncommitted
   state. Preserve this packet in unique history; never overwrite. History is optional.
3. Select next ready incomplete task in docs/improvement-plan.md (default T06);
   recheck packet/code; record gaps.
4. Replace this file: first action/inputs/verified state/gates/constraints/acceptance
   and these instructions. Carry interfaces directly; <=6 KiB UTF-8, no truncation.
5. Verify links/size/task/index agreement. Return a clickable link and prompt:
   "Open docs/handoffs/next-task.md in the Arbiter checkout.
   Complete its current assignment and, after verification, create the chaining
   handoff for a new agent exactly as instructed."
6. End; human starts next session. If incomplete retain task/progress/failed checks/
   blocker/next action; session end is not completion. If all done, no successor.
