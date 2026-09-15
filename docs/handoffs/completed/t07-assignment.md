# Next agent: T07, then handoff

Task: [T07](../../improvement-tasks/07-discovery-navigation.md). Ready.
2026-09-08; main;
Code cd0e2a51cc726031308f8197f4d4eeea0b88bb35; HEAD adds handoff docs.

## Start

Complete T07 only; prepare its successor. Check instructions/branch/HEAD/worktree,
CLAUDE.md/T07. Define shared bounded search/results: tiers, archives, pages, order,
previews. Read T07 inputs and core/web handoff modules. Use skill-creator for operating-skill edits.
No Finance Hub/USB/transcript edits.

T01–T06 committed. Tests 89/89 + final handoff 12/12; build/diff/skill pass.
Frozen validation 26/0/0 and 23/0/1 existing raw warning; all 50 hashes unchanged.
[Evidence](t06.md).

## Rechecked gaps

No search; only record cards/pages are bounded. Directory/sidenav lists grow without
limits. renderItem's same-directory child filter hides goal-to-task children.
Done labels have strikethrough; directories say Tier 2. Shared compact checkpoint
summaries are absent. Coordinate registry choices with deferred T08; don't add reports.

## Interfaces

- args.ts owns schemas/help; invalid exit 2, CAS conflict exit 3. Hash sha256:<hex>;
  write accepts prefixed/bare hex/new. --data > ARBITER_DATA > cwd; diagnostics stderr,
  data stdout. Preserve frozen/init/UUID guards. Protocol/base 0.4.12, concrete 0.4;
  legacy 0.4.6/8/9/10/11 accepted. No scoped validation.
- commitFile/stageProposal share SQLite lock. Preserve CAS, staging and parsed
  effects. Back up .arbiter/transactions; never export/delete as cache. Recovery
  retains intent; unsupported ops stay staged, replay idempotent, Summary preserved.
- readProjection returns visible files/facts + byte digest. Current facts drive
  views, caller day age-off; digest excludes dashboard. Reads aren't atomic. Exclude
  private owned material before edges/counts; known-token redaction cannot detect
  paraphrases. Projections skip checkpoint history; whole-KB validation verifies it.
- Review needed|legacy-unknown differs from status/readiness; never infer prior
  status. Invalid parents mustn't hide reachable children. Preserve rawRows with
  orderedRows; reindex removals/reorders. rawLine is 1-based, sourceLines maps filtered
  lines. Reparse writes; malformed lines end continuations, blanks don't.

## Checkpoints/export

Task owns owner; phase only groups. Current checkpoint replacement requires CAS,
previous/role/task/staging checks and automatic immutable history. Detail remains
append-only; never repurpose legacy detail or normalize checkpoint/history bytes.

assessCheckpoint reports inputs/predicates/errors/reasons/readiness. Required sources:
task/protocol/base/task-schema + selected decisions/dependencies/code. Missing or stale
inputs, unknown owner/gates, conflicts/review/staging prevent ready. Caller observes
repo/external state; no timestamp precedence. Skip history in normal assessment;
filtered validation uses { verifyHistory: false }.

core/handoff owns draft/preview/capture/export. Request: ref/draft/owner/format/
offline/expand/observations/extraction/override. Preview: before/after bytes, packet,
manifest/readiness/size/omissions/token. Reconstruct on use. Preserve API token,
loopback Host/peer/port and Origin checks, JSON-only requests and 1 MiB cap.

withCommitSession rechecks under lock; journals history/task/checkpoint separately.
Pointer/owner precede task hash. Partial failure: refresh/re-observe before retry.
Preserve untouched body/input bytes. Extraction retains original task in linked
detail and rules in checkpoint, preserving IDs/anchors/artifacts. No multi-file
atomicity or external-editor/network-FS guarantee.

Export current versions only; Copy/download recheck and emit exact preview bytes.
Format fixed at preview. Basis excludes dashboard/history. Include task/checkpoint/
installed checkpoint rules; optional expansion explicit. Offline includes full
protocol/selected KB inputs, never fetches repo/network; planning-only until live
identity/workspace/authority/gate checks. Full packet: 6 KiB target, 10 KiB ceiling;
larger maxBytes/reason IN packet. Never truncate or override readiness/authority/
privacy. Refuse redaction/credential-bearing context.

## Boundaries and chain

Use synthetic/temporary KBs. ARBITER_DATA selects frozen data; live sibling absent.
User supplied a comparison snapshot; doctor rejected protocol 0.4.7. Local path is
in T06 evidence. Preserve it; live capture needs a selected working copy and explicit
compatibility resolution, not a version-string edit. No installed-KB upgrades in T07
without new direction. Preserve CLI/profiles. Ask before commit (CLAUDE.md); no
push/publish/messages. Protocol/grammar edits need bump + decision. Localhost tests
need sandbox escalation; distinguish environment failures.

1. Verify T07: bounded shared search/pages/totals, explicit archives, goal-task
   children, separate dependencies, checkpoint summaries without history, done vs
   superseded, selected expansion with reasons/privacy.
2. npm test, npm run build, git diff --check; skill validator if edited. Source CLI
   validate both frozen corpora with explicit --data; assert outcomes/unchanged hashes.
   Mark task/index complete only with evidence.
3. Create completed/t07.md with outcome/files/tests/limits/decisions/HEAD/dirty state;
   archive this incoming packet at a unique path, never overwrite history.
4. Pick next ready incomplete task in docs/improvement-plan.md (default T08);
   recheck packet/code/gaps. Prepare only that successor. Replace this file with
   first action/inputs/state/gates/constraints/acceptance and this chain, <=6 KiB
   UTF-8. Carry interfaces directly; previous handoffs remain optional.
5. Verify links/size/task/index agreement. Return a clickable link and prompt:
   "Open docs/handoffs/next-task.md in the Arbiter checkout.
   Complete its current assignment and, after verification, create the chaining
   handoff for a new agent exactly as instructed."
6. End; human starts next session. If incomplete retain progress/failed checks/
   blocker/next action; session end isn't completion. If all done, no successor.
