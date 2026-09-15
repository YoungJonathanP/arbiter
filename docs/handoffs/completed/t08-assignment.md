# Next agent: T08, then handoff

Task: [T08](../../improvement-tasks/08-knowledge-evidence.md). Ready, 2026-09-08.
main; HEAD bfdc5519cc730fb0e23bb840b5ac83d6c7bddb66. Preserve UNCOMMITTED T07.

## Start and acceptance

Complete T08 only. Check instructions/branch/HEAD/worktree, CLAUDE.md/T08. Read T08
inputs + discovery.ts/v0.4.13-discovery.md. Start with one synthetic workstream/report.
Use skill-creator for skill edits.

No report/promotion or durable decision/finding model. Integrate registration across
model/corpus/classification/facts/CLI/cards/web; discovery adds no registry.
Acceptance: durable types with scope/provenance/review/supersession; working schema
capture/query/render or narrowed promise; honest accomplishment candidates; dated
Markdown impact reports deduplicating outcomes, separating evidence/uncertainty and
linking archives. Private/dropped/superseded work cannot inflate impact.

T07 tests 95/95, focused 18/18, build/diff/skill pass. Frozen 26/0/0 and 23/0/1
(existing raw warning), 50 hashes unchanged. [Evidence](t07.md).

## Interfaces

- args.ts owns help/schemas. Invalid exit 2, CAS conflict 3. Hash sha256:<hex>;
  write accepts prefixed/bare hex/new. --data > ARBITER_DATA > cwd; diagnostics stderr,
  data stdout. Preserve frozen/init/UUID guards. Protocol/base 0.4.13, concrete 0.4;
  legacy 0.4.6/8/9/10/11/12 accepted. No scoped validation.
- commitFile/stageProposal share SQLite lock. Preserve CAS/staging/parsed effects.
  Back up .arbiter/transactions, never export/delete as cache. Recovery retains
  intent; unsupported ops stay staged, replay idempotent, Summary preserved.
- readProjection: visible files/facts + byte digest. Current facts drive views;
  caller day age-off; digest excludes dashboard. Reads aren't atomic. Exclude
  private owned material before edges/counts; token redaction misses paraphrases.
  Projections skip checkpoint history; whole-KB validation checks it.
- Review needed|legacy-unknown differs from status/readiness; never infer old status.
  Invalid parents mustn't hide children. Preserve rawRows/orderedRows; reindex edits.
  rawLine 1-based, sourceLines maps filtered lines. Reparse writes; malformed lines
  end continuations, blanks don't.
- discover(snapshot, options, now?) serves CLI search/web lists/children. Defaults:
  tiers 2,3; archives excluded (include|only explicit); page 0; size 10/max 50;
  title 160/preview 240 chars. JSON options/total/page/pageSize/nextPage/results.
  Literal AND scan; order title hits/nonterminal/recency/path. Tier 1 regenerated;
  no history/proposal/schema/protocol/transaction search. Pages are fresh reads.
  Cards/sidenav max 5 + totals/routes to all non-archived work. Preserve same-dir
  nesting/staged rollups; goal-task children via parent filter, dependencies separate.
  Legacy queries unchanged. Done muted; ~~text~~ means superseded prose only.

## Checkpoints/export

Task owns owner; phase only groups. Checkpoint replacement: CAS/previous/role/task/
staging checks + immutable history. Detail append-only; never repurpose legacy detail
or normalize checkpoint/history bytes. assessCheckpoint returns inputs/predicates/
errors/reasons/readiness. Require task/protocol/base/task-schema + selected decisions/
dependencies/code. Missing/stale inputs, unknown owner/gates, conflicts/review/staging
prevent ready. Caller observes repo/external state; no timestamp precedence. Normal assessment skips history; filtered validation: { verifyHistory: false }.

core/handoff owns draft/preview/capture/export. Preserve HandoffRequest/Preview,
reconstruction on use, token/loopback Host/peer/port/Origin checks, JSON-only/1 MiB cap.
withCommitSession rechecks under lock; journals history/task/checkpoint separately.
Pointer/owner precede task hash; partial failure needs refresh/re-observation.
Preserve untouched body/input bytes. Extraction retains original task in linked
detail and rules in checkpoint, keeping IDs/anchors/artifacts. No multi-file atomicity
or external-editor/network-FS guarantee.

Export current versions only; Copy/download recheck exact preview bytes, format fixed
at preview. Basis excludes dashboard/history. Include task/checkpoint/installed rules;
expand selected inputs explicitly, purpose as reason. No recursive relations/history.
Offline includes full protocol/selected KB inputs, never fetches repo/network;
planning-only until live identity/workspace/authority/gate checks. Packet: 6 KiB target, 10 KiB ceiling; larger maxBytes/reason IN packet. Never truncate or override
readiness/authority/privacy. Refuse redaction/credential-bearing context.

## Boundaries and chain

Use temporary KBs. ARBITER_DATA selects frozen data; live sibling absent. Supplied
snapshot: unsupported 0.4.7 (T06 evidence). Preserve it; live capture needs selected
working copy + explicit compatibility resolution, not a version-string edit. No
installed upgrades or Finance Hub/USB/transcript/profile edits. Ask before commit
(CLAUDE.md); no push/publish/messages.
Protocol/grammar changes need bump + decision. Localhost tests need escalation.

1. Verify T08: npm test/build, git diff --check, skill validator if edited. Source
   CLI validate both frozen corpora with explicit --data; assert outcomes/hashes.
   Mark task/index complete only with evidence.
2. Create completed/t08.md: outcome/files/tests/limits/decisions/HEAD/dirty state.
   Archive incoming packet uniquely.
3. Pick next ready incomplete task in docs/improvement-plan.md (default T09). Recheck
   code/packet/gaps; prepare only that successor. Replace this file with first action,
   inputs/state/gates/constraints/acceptance/chain, <=6 KiB UTF-8. Carry interfaces
   directly; history optional.
4. Verify links/size/task/index agreement. Return a clickable link and prompt:
   "Open docs/handoffs/next-task.md in the Arbiter checkout.
   Complete its current assignment and, after verification, create the chaining
   handoff for a new agent exactly as instructed."
5. End; human starts next session. If incomplete retain progress/checks/blocker/next
   action; session end is not completion. If all done, no successor.
