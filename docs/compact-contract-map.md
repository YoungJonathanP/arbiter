# Compact operational contract: clause-preservation proposal

> Historical evaluation/proposal. The user's [2026-09-14 decision](progressive-disclosure-handoffs.md#budget-scope-and-conflict-resolution)
> supersedes the cumulative-session budget and the unresolved either/or gate below.
> Preserve these measurements and mappings as evidence; they do not require a
> compact protocol rewrite or a larger whole-session maximum for T09 continuation.
> The remaining original text records the 2026-09-13 proposal, not current policy.

2026-09-13. **Review-required design only.** No contract, grammar, runtime, installed
KB or acceptance policy changes. The larger-budget versus compact-contract choice
is still undecided. This completes the bounded mapping assignment, not T09's
fresh-session acceptance. It is not an operating substitute for the current
[protocol](../assets/contract/PROTOCOL.md).

## Review decision

The [budget evaluation](bootstrap-budget-evaluation.md#design-decision-gate) found
43,126 required raw source bytes and 46,497 total declared synthetic bytes. The
latter fits only an explicitly justified 65,536 maximum. Actual host context is
unknown. Choose either a measured larger whole-context allowance with an explicit
acceptance decision, or a versioned compact contract/client design. This proposal
explores the second choice without selecting it.

The proposed structure is a small mandatory global contract plus operation-specific
required reads. Every destination below is mandatory when activated. The original
source text, including qualifications and examples, remains the proposed operation
module content for this first preservation review. The table's short labels are
review aids, not replacements for those clauses. A later reviewed rewrite may
reduce wording; this map itself establishes no savings or semantic equivalence.

## Budget client overhead first

Let B be the selected whole-context ceiling (ordinary 10,240 bytes; target 6,144).
First measure H: system, developer, tools and schemas, client/message framing,
workspace instructions, user input, prior conversation and repeated injected text.
Then reserve R for the actual self-counting receipt, manifests, required rechecks
and tool output, and S for task/current checkpoint, selected assignment sources
and all pending readable input required for the chosen surface. Only
`B - H - R - S` is available for global rules G and activated modules M. Admission
requires `H + R + S + G + M <= B`, counting UTF-8 bytes of every emitted occurrence.
Unknown H/R/S is a refusal, not zero or a guessed allocation. No numeric contract
allocation is currently available. Model tokens are a separate measurement.

Measure the full cumulative receiving-session context again before loading a module
or returning tool results. Loading later does not reset the budget. The dispatch
registry, schema rules, receipts and any included map text cost bytes too. Known
oversize required sources refuse whole; never truncate rules or pending input.
An explicit larger maximum/reason is counted and never overrides other gates.
History stays outside ordinary continuation. An optional historical investigation
must be separately scoped and counted; it cannot be smuggled into normal bootstrap.

A client must know the proposed operation and classify the required surface before
returning source content. If it cannot establish authorized scope or detect required
modules without a hidden read, stop and retain that unknown in the inventory. Do
not fetch private content first and filter its model-visible result afterwards.
Operation detection, complete context instrumentation and refusal enforcement are
proposed client requirements, not existing verified features.

## Proposed mandatory global contract

The following G rules describe required retained behavior; they are not adopted
wording. The detailed dispatcher and source clauses remain required context too.

- **G1 — Identity and authority.** Resolve installed KB/repository/worktree and
  current rules. Bind exact revisions; distinguish observations, decisions,
  proposals and unknowns. Recheck authority and live predicates before dependent
  work. Evidence, relationships and handoffs grant no execution, ownership,
  publication or messaging power. Offline starts are planning-only until checked.
  Installed adoption and this selective-read change require explicit decisions.
- **G2 — Bounded navigation and dispatch.** One tier and assignment at a time;
  navigate DASHBOARD to item to linked detail; open only selected pointers/relevant
  unanswered sources, never bulk siblings
  or recursive handoffs/history. Preserve footer guidance and root-relative refs.
  Before every operation, load the union of its required modules and inherited
  schema clauses at observed revisions. Unknown operation, missing module,
  unsupported contract or unavailable measurement stops that operation.
- **G3 — Privacy and independent access.** Exclude private/inaccessible bodies,
  identities, edges and counts before any default projection or output. Owned
  documents/proposals inherit private exclusion; private documents are excluded too. Inspection
  does not authorize redistribution. Authenticate personal access with trusted
  host policy; endpoints and edge each need access. Relationships neither assign
  nor grant. No private incorporation into a wider audience; do not narrow shared
  readers to make it pass. Permissions cannot detect sensitive prose. Personal
  packets stay ephemeral and out of shared stores/logs/messages; credentials stay
  in transport. Fresh private IDs grant only their creator; existing grants need
  trusted administration. Restricted checkpoints require a reviewed extension.
- **G4 — Preservation.** Keep human prose, intent, immutable IDs/refs/anchors and
  historical bytes. Raw human entries remain valid. Normalize idempotently without
  discarding malformed neighbors; historical detail gets dated appends. Archive
  by flag. Checkpoint replacement archives exact previous bytes; retain checkpoints,
  ledgers and transaction journals in backups. Never restore over concurrent edits.
  The unreferenced duplicate-creation exception requires C/W before deletion.
- **G5 — Freshness and writes.** On blocked work inspect its blocker first; pending
  proposals take priority. Retain the read base, use the shared CAS writer and
  verify observed effects/receipts. Sticky staging, agent terminal transitions and
  reversals retain W's rules; only explicit protected human actions get A's narrow
  exception. Reconcile interruption first. Interrupted incorporation cancels its
  receipt intent even if prose landed, preserves prose and requires fresh review.
  Policy/KB writes are sequential; the lock does not control external editors.
- **G6 — Whole-context budget.** Apply the accounting above before emission and
  each added operation. Keep 6 KiB target/10 KiB ceiling or explicit maximum/reason.
  Count all emitted rules, sources, metadata, duplicates and receipts; no silent
  zeros, truncation or privacy/authority override. Digests bind bytes, not reading.
- **G7 — Evidence and input review.** New, changed or backdated linked revisions
  remain actionable regardless of timestamps. At next task review present every
  readable pending input or explicitly incorporate it with attribution. Shared
  preview includes all pending shared bytes; resolve authorized personal review
  separately when applicable. Export, status changes and checkpoint capture
  acknowledge nothing. Explicit revision dispositions require the correct reviewed
  session and I/P gates. A link, receipt or test is not proof of live impact or
  agent comprehension; retain eligibility, attestation and uncertainty rules in K.

## Required-read dispatcher

Each row activates **before** the named operation, including its first read/output.
G1–G7 always apply. A module consists of all protocol ranges assigned its letter
below, plus the schema/source dependencies here. Load the union, deduplicate only
identical emitted occurrences actually shared by the client, and count it. An
unmet prerequisite stops the dependent action; independently authorized recorded
analysis may continue. A link or hash alone never satisfies a required read.

| Module | Activation and required dependencies | Stop gate before operation |
|---|---|---|
| N — navigation/projection | Dashboard, directory/search, hierarchy, archive or active-work view; relevant schemas for interpreted fields/relevance; A for personal views | Unverified indexes stay advisory; enforce visibility before entries/counts; select pointed/paged scope, omit checkpoint history |
| E — item/detail editing and interpretation | Interpret item fields, blockers, checklist or section syntax; any item/detail write; full base + selected type, W for writes, C for create/reopen | Missing schema/unknown type, unresolved blocker, malformed target effect or staged target prevents dependent edit; preserve raw neighbors |
| C — capture/identity | Create, promote, reopen, deduplicate, iterate or assign outcome boundaries; E/W and selected schemas; K for impact/knowledge | Reopen search and identity/anchor checks first; terminal reopening stages; no duplicate deletion after references exist |
| W — write/arbitration/recovery | Every KB mutation including normalize, regen, triage, proposal, archive or recovery; E for item syntax, H/I/A/P when those roles activate | Observe base/staging/intents, exact parsed effect and durable receipt; never overwrite conflicts; staging and retry limits apply |
| H — checkpoint/continuation | Receive, author, preview, capture or export checkpoint/handoff; E + base/task, I on task review/pending input, W on capture, P if personal | All required source/gate revisions known/current, exact reviewed bytes and budget; unresolved readiness stays review/waiting; restricted dependencies refuse |
| I — linked input | Task review, linked-input presentation/disposition, association or source mutation, status/Done/Undo and checkpoint input presentation; E + journal/meeting as relevant, W for effects, A for app, P for personal | Reconcile intents first; exact incarnation/revisions; every pending readable input presented/incorporated; explicit action and verified content before receipts |
| A — app and access | Local status/Done/Undo, notes/appointments/entity cards, relationships or authenticated personal view/write; I/W and E + affected schemas on writes | Protected operator or trusted personal policy, independent endpoint/edge/destination audiences; explicit human choice/checklist resolution, exact Undo bytes, reobserve policy/content |
| P — personal agent continuation | Resolve applicable personal review, preview/export/disposition/incorporation; H/I/A; W for receipt/content effect | Authenticate retained session, recheck all revisions and staged/interrupted work; exact exported session required for dispositions; no restricted checkpoint capture |
| K — impact/durable knowledge | Interpret, generate, review or report accomplishment/decision/finding claims; full selected schema + base, N for discovery, E/C/W for capture | Source eligibility, attestation, outcome deduplication, evidence/scope/uncertainty and supersession reviewed; never infer observed from absent verification |
| U — adoption/type registration | Initialize, fork, import, upgrade or extend catalog/contract; all affected schemas and modules plus grammar/decision | Explicit adoption/version decision, supported catalog, identity and backup/compatibility reconciliation; no installed mutation from this proposal |

I's durable event writes additionally require [grammar §18](grammar.md#18-linked-input-audit-storage-0415)
and H's storage requires [grammar §15](grammar.md#15-current-task-checkpoints-v0411).
The dispatcher does not waive other applicable grammar sections. Grammar is outside
this bundled-source map: an implementation proposal must inventory its actual
required sections and count their bytes, as well as repository/host instructions.
Dependencies are a union/fixed point, not a recursive reread loop. A personal review
activates H/I/A/P even if the original assignment was described as a shared task.

## Review issues that must remain explicit

1. **Full read versus dispatch.** Protocol line 8 and lines 233–239 require reading
   the installed protocol once; lines 206–213 bind full protocol/base/task inputs.
   Replacing that obligation is a normative change, not an interpretation of
   “relevant sections.” Retain full input hashes unless a reviewed versioned
   decision changes the manifest; scoped loaded bytes require their own binding.
2. **Meaning versus syntax.** Base/type fields cannot be deferred until writing
   if the agent uses them to judge status, access, evidence or blockers while
   reading. E/K activate for interpretation. Privacy and authority apply before
   any read. No source clause becomes an optional reference merely to save bytes.
3. **Compound operations.** Checkpoint review already activates input handling;
   personal continuation adds access and receipt rules. Module overlap can still
   exceed 10 KiB. The map is a completeness review, not a claim of compactness.
4. **Existing clause tensions.** Goal schema's bare `parent: <goal-id>` example
   coexists with canonical directory-qualified refs; current normalization accepts
   only uniquely resolvable bare refs. Tier-3 `inputs` note mentions legacy dashboards;
   preserve the text pending clarification. Promotion's “schema 0.4.14” wording
   coexists with bundled accomplishment 0.4.18; retain the current supported-version
   behavior and legacy Evidence exception, never downgrade installed schema.
   Any cleanup needs explicit wording review, not timestamp precedence.
5. **No incidental policy changes.** Retain exact human Done/Undo exception,
   never-auto terminal reversal, unreferenced duplicate deletion exception,
   two-retry ceiling and 24-hour/14-day/7-day/quarter thresholds. Keep optional
   Relevant sources, independent assignment/access and recorded-answer scope.
6. **Next gate.** Review this map and choose the budget/contract route. If compact
   is chosen, authorize the normative design/version decision and measure client
   inventory before allocating bytes or implementing dispatch. Fresh-agent launch
   and live rollout each need their separate authority. If no decision arrives,
   checkpoint the same gate; do not regenerate this map, trim prose or migrate again.

## Measured preservation baseline

The source map covers **81 protocol ranges and 201 schema ranges**, all **10 files /
50,572 bytes**. Source ranges retain full clauses; the proposed global prose and
registry have not been accepted as equivalent replacement wording.

Even operation scoping alone remains too large with these lossless modules:

| Illustrative activated union | Protocol range bytes | Full base/task schemas | Raw subtotal |
|---|---:|---:|---:|
| Shared receive/review: E + H + I | 17,034 | 5,349 | 22,383 |
| Task edit: E + W, without checkpoint/input effects | 16,214 | 5,349 | 21,563 |
| Personal continuation review: E + H + I + A + P | 20,588 | 5,349 | 25,937 |

These count each selected exact source line once and omit blank separators outside
mapped ranges. They exclude G, the dispatcher, grammar, host context, task/checkpoint,
source bodies, receipts and output framing. They are **lower bounds**, not complete
admission totals or permission to omit dependencies. Extra types/effects add their
required modules. All three already exceed 10,240 bytes. A compact route therefore
needs reviewed rewriting as well as dispatch; moving unchanged sections behind
required links cannot meet acceptance. Do not reuse these figures as a client budget.

Manual route review checked: shared resume includes pending-input rules; blocked or
staged edits stop before work; terminal transitions activate W rather than acquiring
the human exception; personal review activates A/P before exposing content; changed
source or association invalidates dispositions; interrupted incorporation preserves
landed prose and cancels receipt intent; legacy accomplishment interpretation loads
K and retains missing-verification/Evidence rules; oversized or unknown context
refuses before emission. These are design checks, not executed client behavior or
fresh-agent comprehension measurements. Existing tests do not test this dispatcher.

## Clause inventory and coverage

The source inventory below hashes exact bundled bytes at main
`bfdc5519cc730fb0e23bb840b5ac83d6c7bddb66` plus the preserved uncommitted work.
Line ranges are inclusive and bound to those file hashes. Every nonblank line,
including metadata, examples and footers, has a destination; a compound paragraph
retains **all** its clauses in every named required module. Global mappings retain
only the behavior stated in G; where a row also names a module, its full source
text is required upon activation. Structural lines travel with their source clause.
Schema rows separately inventory each field/section and every remaining prose
block. Exact schema metadata/defaults/requiredness/notes are retained, not inferred
from review labels. The source hashes and coverage audit establish no omitted
source lines; semantic equivalence of future rewritten rules still needs review.

| Bundled source | Bytes | SHA-256 |
|---|---:|---|
| [PROTOCOL.md](../assets/contract/PROTOCOL.md) | 35239 | `7003d18f5441334d70b7f0b21b9a9c9c9ffb8bc9bf5e65085c550c700abe8093` |
| [_base.md](../assets/contract/types/_base.md) | 3119 | `67c8f74d3ae6d5bb2f065de56c098bdb5bb1433a27d34c1ceaad021045931a29` |
| [accomplishment.md](../assets/contract/types/accomplishment.md) | 2394 | `25501b85aacf33822a002bddf553f8bb8607a269b26a31cc7817d615488a279a` |
| [decision.md](../assets/contract/types/decision.md) | 1394 | `54be6ddfabfdb9521fc1bdd669a6b79ca51064ce1434b36e93c2e42cf8e179af` |
| [finding.md](../assets/contract/types/finding.md) | 1392 | `5f8b3b8e909cd4052a20b6ffa94dbde6d8d94ae8942683608f3f50cb7e8219bb` |
| [goal.md](../assets/contract/types/goal.md) | 1544 | `f0e16a3eb856a2fb6fafc4c105ddccfb45422817cd5b4d76da6c06c60755eae4` |
| [journal.md](../assets/contract/types/journal.md) | 1274 | `46c7ae2e01761a238d88cad1f6c17891f4e47a9148cb58bfc2a276c9cd812c36` |
| [meeting.md](../assets/contract/types/meeting.md) | 1173 | `c1b8c1caf9f635158a639ab97175eea3f0d365db0ae1f389eb19ec79785a4f66` |
| [person.md](../assets/contract/types/person.md) | 813 | `38e2252fff98af1bc75b324f45f8950f3690568d8b3f7f685281d19069f489ce` |
| [task.md](../assets/contract/types/task.md) | 2230 | `a3e7ba965f628e2c918ba710d3c7dd35ef678073a0115b262a4d6b04e7cad10f` |

### Protocol directives

| Source lines | Destination | Preserved directive or compound clause |
|---|---|---|
| P001: 1–8 | G1 | Protocol identity/version and full-file read-once bootstrap; selective loading is a proposed change requiring review. |
| P010: 10–15 | G1, G2, G3 | Collaborative tiers; no sibling bulk reads; schema-before-write; root-relative links and stable refs. |
| P017: 17–25 | N | Dashboard purpose, current-fact freshness, private filtering, frontmatter and work/record entry grammars. |
| P026: 26 | G5, N, W | Pending proposals include sub-items and take priority before other work. |
| P027: 27–33 | N | Overflow, dates, review flags, promoted children/cycles, five-entry caps, seven-day terminal aging and nonarchived totals. |
| P034: 34 | G2, N | Open only the selected arrow target. |
| P035: 35 | G3, N, W | Omit opaque dashboard additions for privacy; retain old dashboard journal and recover to classified items; renderer does not write. |
| P037: 37 | N | Muted completion versus supersession; directory navigation; tier-2/3 search, explicit archives, no checkpoint history. |
| P039: 39–43 | N, E | Item layout, schema inheritance, ten-entry pages, current-page-first search and seven-day journal view. |
| P044: 44–50 | E | Exact checklist marks, anchor and blocked-by/see syntax, including the fenced example. |
| P052: 52 | G4, E | Rows hold current action/constraints; detailed history moves verbatim under dated heading with both links. |
| P054: 54 | E | Optional anchors and continuations, exactly six spaces, mandatory blocker for blocked marks, in-place mark updates. |
| P055: 55 | G5, E | On opening blocked work, check blocker first; only evidenced resolution changes the mark. |
| P056: 56 | G5, W | Pending staging forbids direct item edits; read proposals and stage/arbitrate. |
| P057: 57 | G2, E | Permanent object refs; follow relations only for an unanswered question. |
| P058: 58 | N, E | Same-type nesting, derived child summaries/forward edges, children query, load-bearing see links and one-level limit. |
| P059: 59 | G2 | Detail only for unanswered summary/checklist questions; no unlinked siblings. |
| P060: 60 | E | Optional Plan inputs precedes Checklist; output artifacts, anchors and ticket/PR/see targets remain accessible. |
| P061: 61–62 | E | Typed Artifact/Evidence and Detail-doc grammar, KB-root versus HTTP(S) links, annotations inside labels/titles or before anchors. |
| P063: 63 | G4, E, W | Preserve malformed lines and valid neighbors; diagnose syntax separately; continuation reset; arbitration verifies parsed effects. |
| P065: 65–68 | E | Detail path, owning item, kind/id/updated/inputs frontmatter and explicit Detail-doc linkage. |
| P069: 69 | G4, E | Dated appends; no history rewriting. |
| P071: 71–76 | E, N | Work-only status enum, terminal semantics, blocked evidence, 14-day triage and sticky review independent of execution/readiness; never guess legacy state. |
| P078: 78–86 | G4, C | Immutable filename IDs, type-specific slugs, stable lowercase kebab bases and directory-local uniqueness. |
| P087: 87 | C | Search same base within plus/minus two quarters; reopen recurring work or create beyond window. |
| P088: 88 | G4, C | Permanent directory-qualified object addresses; files never move. |
| P089: 89 | C, N | Beyond-window predecessor written once at creation; forward pointer derived; reports walk chains. |
| P091: 91–94 | G4, E | Referenced checklist anchors use exact comment/fragment syntax, unique kebab IDs, immutable after reference, added only as needed. |
| P096: 96–102 | G2, E | Single footer and allowed scopes; raw files valid without footer; normalize on first touch; no extra navigation guidance or pointer edits during item work. |
| P104: 104–108 | G5, W | Concurrent intent, no overwrite; retain read base. |
| P109: 109 | G5, W | Shared CAS writer, lock/journal/replace/postconditions, cooperating commands, external-editor limits and recovery/dry-run. |
| P110: 110–111 | W | Diff against base; commute only without staging or high stakes; rebase at most twice. |
| P112: 112 | G5, W | Stage overlap, sticky/high-stakes/recent reversal or exhausted retries; retain complete proposal metadata, exact op forms, blocker evidence and session-unique chosen IDs. |
| P113: 113 | G5, A, W | Only explicit protected human Done/Undo exception with CAS/checklist/audit; proposals still block and agents still stage terminal transitions. |
| P114: 114 | W | Deterministic arbitration; whole malformed proposals retained, parsed-effect verification, evidence/dispositions, history placement and timestamps, receipt identity/hash/bytes, durable deletion gate and replay rules. |
| P116: 116 | G4, G5, W | Canonical transaction backups; recover matching bases or observed writes, retain conflicting bytes and reconcile fresh-base/sticky proposals; receipts independent of checkpoints. |
| P118: 118–121 | W | Resolution table header and interpretation. |
| P122: 122 | W | Merge checklist before status; live blocker wins and contradictory explicit status loses. |
| P123: 123 | W | Further mark wins except evidenced blocked mark. |
| P124: 124 | W | Terminal reversal never automatic; cite closer evidence; human confirmation when closer gone. |
| P125: 125 | W | Same-section prose never auto-merges; stage both with review and preserved execution status. |
| P126: 126 | C, W | Duplicate creation merges later into earlier, deleting later only before references exist; explicit narrow exception to address preservation. |
| P127: 127 | W | Merge appends; deduplicate only byte-identical entries. |
| P129: 129 | W | Triage arbitrates/escalates abandoned proposals older than 24 hours; intent survives session. |
| P131: 131–133 | G4, E | Raw title/prose valid; format alone does not block. |
| P134: 134 | E | Missing-field defaults and dated-evidence precedence over unreliable checkout mtimes. |
| P135: 135 | E | Qualify bare refs only if unique; ambiguity flagged without guessing. |
| P136: 136–137 | G4, E | First-touch frontmatter/status inference, unchanged Summary prose, normalized date/footer; idempotent repair preserves human prose. |
| P139: 139–141 | G3 | Private item/owned document/proposal exclusion before titles/relationships/counts; inspection never authorizes redistribution. |
| P143: 143–145 | K, C | Done work yields unverified editable promotion, reviewed new write and installed schema gate; never implicit upgrade. |
| P146: 146 | G7, K | Observed requires outcome/evidence/actual observations/actor/date/uncertainty; unverified may lack links and never counts impact. |
| P147: 147–148 | G7, K | Dated archived-inclusive reports, outcome deduplication and conflict review, no activity counts, separate attestation/evidence/limits, eligible sources only and impact date selection. |
| P149: 149 | G4, K | Accomplishments have no status, reopening or deletion; supersede retained records at original paths. |
| P151: 151–153 | K, C | Decision/finding scope/date/provenance and evidence/observations/uncertainty; new needs-review, reviewed requires actor/date/scope/evidence. |
| P154: 154 | G7, K, N | Explicit acyclic retained supersession; default current nonarchived knowledge, explicit archive search; superseded records confer no current authority. |
| P155: 155 | G1, U | Catalog plus schema define supported types; adding a schema is insufficient; installed adoption explicit. |
| P157: 157–161 | G4, N, W | Archive by dated flag for terminal work/old records, never move/delete; omit from recency, retain reports/lookups, unarchive by removing flag. |
| P163: 163–167 | C, E | Cheap minimal capture, prefer existing/reopen, externally useful links in serving item's Artifacts/Evidence. |
| P170: 170–178 | E, H | Independent verifiable outcomes versus detail, goals/coordination, preserved tickets, phase has no blockers/authority and shallow nesting. |
| P180: 180–186 | H | One owner or unassigned; fixed replaceable checkpoint role, required identity/revision/time/previous metadata and exact footer. |
| P188: 188–193 | G1, H | Required body sections, one to three next actions/stop, factual distinctions and essential constraints inline; history optional. |
| P195: 195–204 | H | Nonempty nested inputs/predicates, stable kebab keys/flat flow maps and complete YAML example. |
| P206: 206–213 | G1, G7, H | Required protocol/base/task and selected inputs, source/hash/observation/purpose and namespaces; excluded expansion; predicates/conflicts carry provenance, timestamps resolve nothing. |
| P215: 215–222 | G1, G5, H | Exact readiness states/triggers and downgrade-only observation, no implied ownership, recheck workspace/revisions/authority/live gates, static validation limits. |
| P224: 224–231 | G4, G5, H, W | CAS archive exact prior checkpoint before replacement, previous hash, owning staging/legacy-path refusal, immutable backup history and no default history reads/HTTP. |
| P233: 233–239 | G1, G2, H | Installed full protocol once plus selected task/current checkpoint; portable identity and offline planning limits; no authority from handoff. Scoped bootstrap is a proposed change. |
| P241: 241–249 | G6, H | 4 KiB overview/1 KiB Summary/400-code-point row/6 KiB handoff targets, 10 KiB ceiling or explicit maximum/reason, all context counted, no truncation or gate override, preview lifecycle and freshness. |
| P251: 251–254 | G1, U | Explicit installed upgrades; preserve imported manual packet bytes; fresh initialization UUID, replica identity retained, fork identity changed; no unauthorized copy adoption. |
| P256: 256–262 | G3, G4, I, U | 0.4.15 private append-only input ledger role and grammar 18; no default raw/search/handoff exposure, retain event/journal bytes, explicit adoption. |
| P264: 264–271 | G7, I | Fresh association incarnation on relink, exact receipt identities/revisions/reviewer/time/reason, disposition semantics, changed/backdated input pending, review event clock independent, no implicit acknowledgment/reopening. |
| P273: 273–279 | G1, G6, G7, I, H | Next review presents/incorporates all readable pending input; shared preview includes exact source bytes/revisions, new input review, no truncation; explicit receipts, optional Relevant sources and no relationship-derived authority/blockers. |
| P281: 281–289 | G3, A | Local operator process-token/loopback/origin trust versus authenticated personal policy, independent endpoint/edge access, no inferred grants/assignment/messages, no wider-audience private incorporation or secret-detection claim. |
| P291: 291–296 | A, I | Quick notes retain imported task prose and capture actor/time versus event date; Done resolves steps/no staging, Undo exact completed bytes/new touch; no agent needed. |
| P298: 298–306 | G5, I, W | Intent-before-CAS and observed completion-before-receipt; interrupted actions block, after completes/before cancels/other refuses, incorporation always cancels receipt intent while retaining landed prose and fresh review; sequential external-editor limits. |
| P308: 308–313 | G3, A | 0.4.16 person/entity identity independent of assignment/access/account; filter both card directions' endpoints and edges before counts. |
| P315: 315–322 | A, I | Status/notes/appointments/incorporation controls; corrections preserve identity/prose/anchors/incarnation and renew pending revision; exact preview and landed bytes before receipt; stable ledger header and new intent kinds acknowledge nothing. |
| P324: 324–332 | G3, G5, A | Host policy outside KB; trusted principal/grants/inheritance, creator-only fresh private IDs versus trusted existing grants, observe policy/content, sequential recovery no overwrite and whole-destination audience coverage. |
| P334: 334–339 | G2, G3, N, A, P | Paged complete accessible active work including nested versus five dashboard entries; personal review separate from shared export, resolve personal review context and never acknowledge excluded inputs. |
| P341: 341–349 | G3, P | Opt-in 0.4.17 trusted personal continuation with all authorized pending endpoints/edges and exact sources/task/checkpoint/rules/revisions; exclude inaccessible metadata/counts, fail closed restricted dependencies, no private checkpoint capture. |
| P351: 351–354 | G1, G3, G6, P | Personal packets stay out of shared stores/logs/messages; budget full envelope with single exact manifest, credentials only in transport, evidence conveys no authority. |
| P356: 356–365 | G5, G7, P, I | Export acknowledges nothing; reauthenticate retained session, reconcile interruptions/staging; recheck every source/link/task/status/checkpoint/receipt/policy revision; new preview on change, exported-session prerequisite and explicit per-revision disposition/reason, separate incorporation path; no reading/execution claim, no concurrent restore. |

### Schema _base

Required by E (every interpreted/written type). Base inheritance is mandatory for every concrete type; W
applies to every write. G rules apply throughout. Read the complete schema on
activation, including all rows below.

| Source lines | Preserved exact clause |
|---|---|
| 1 | --- |
| 2 | schema: _base |
| 3 | version: "0.4.17" |
| 4 | fields: |
| 5 | id:         { type: slug,     required: true,  note: "equals the filename; with its directory it forms the permanent object ref &lt;dir&gt;/&lt;id&gt; — see PROTOCOL.md#slugs" } |
| 6 | type:       { type: enum,     required: true,  values: &#91;task, goal, meeting, journal, accomplishment, decision, finding, person&#93;, default: "singular of the parent directory" } |
| 7 | title:      { type: text,     required: true,  note: "mirrors the H1; may change freely, the id never does" } |
| 8 | updated:    { type: datetime, required: true,  default: "file modification time", note: "touch on every write" } |
| 9 | created:    { type: date,     required: false, default: "the slug's quarter (work items) or date (records)", note: "when the object came into being" } |
| 10 | review:     { type: enum,     required: false, values: &#91;needed, legacy-unknown&#93;, note: "independent of execution status; remove after explicit review; legacy needs-review has unknown prior state" } |
| 11 | visibility: { type: enum,     required: false, values: &#91;private&#93;, note: "see PROTOCOL.md#visibility" } |
| 12 | parent:     { type: ref,      required: false, note: "object ref of an owning item — a goal this task serves, or a parent task (sub-tasks stay off tier 1; see PROTOCOL.md#tier-1)" } |
| 13 | related:    { type: ref-list, required: false, note: "object refs of loose siblings; follow only when the current item lacks the answer" } |
| 14 | prev:       { type: ref,      required: false, note: "object ref of the predecessor iteration — see PROTOCOL.md#slugs; the forward pointer is derived, never stored" } |
| 15 | superseded-by: { type: ref, required: false, note: "explicit replacement; superseded work and records never count as current impact" } |
| 16 | archived:   { type: date,     required: false, note: "set by triage; archived objects leave recency views, reports still see them — see PROTOCOL.md#archive" } |
| 17 | normalized: { type: date,     required: false, note: "set once by repair — see PROTOCOL.md#normalization" } |
| 18 | --- |
| 20 | # Base schema |
| 22–24 | Universal frontmatter carried by every item, of every type. Concrete types (`task`, `goal`, `meeting`, `journal`, `accomplishment`, `decision`, `finding`, `person`) extend this schema and declare only their own fields, sections, and relevance rule. |
| 26–32 | All concrete types inherit the v0.4.14 section-writing contract in PROTOCOL.md#tier-2: Artifacts/Evidence use `- &lt;kind&gt;: &#91;&lt;label&gt;&#93;(&lt;target&gt;)`; Detail docs use `- &#91;&#91;&lt;doc-id&gt;&#93;&#93; &lt;title&gt; (&lt;kind&gt;) -&gt; &lt;data-root-relative-path&gt;`. Keep annotations inside labels or titles, and step annotations before the anchor. Trailing annotations are opaque; repair only the diagnosed line and preserve its neighbors. Checklist continuations follow a recognized step; malformed text ends attachment. These rules change no concrete type's fields or section requirements. |
| 34–36 | Field types used across schemas: `text`, `slug`, `date` (`YYYY-MM-DD`), `datetime` (ISO 8601), `enum`, `url`, `ref` (the permanent object ref `&lt;dir&gt;/&lt;id&gt;` of another item), `ref-list`. |
| 38 | &lt;!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work --&gt; |

### Schema accomplishment

Required by E, K, C, N. Base inheritance is mandatory for every concrete type; W
applies to every write. G rules apply throughout. Read the complete schema on
activation, including all rows below.

| Source lines | Preserved exact clause |
|---|---|
| 1 | --- |
| 2 | schema: accomplishment |
| 3 | version: "0.4.18" |
| 4 | extends: _base |
| 5 | kind: record |
| 6 | slug-form: "&lt;base&gt;-YYYYqN" |
| 7 | fields: |
| 8 | date:   { type: date,     required: true, note: "when the impact landed (merge date, ship date)" } |
| 9 | source: { type: ref-list, required: true, note: "the work item(s) this was distilled from" } |
| 10 | outcome: { type: text, required: false, note: "stable identity shared by all records of the same outcome; required for counted impact" } |
| 11 | verification: { type: enum, required: false, values: &#91;unverified, observed&#93;, default: unverified } |
| 12 | verified-by: { type: text, required: false, note: "person or agent that performed the recorded observation" } |
| 13 | observed-on: { type: date, required: false } |
| 14 | sections: |
| 15 | Summary:  { required: true, note: "one review-ready impact statement: impact first, mechanism second, numbers where they exist" } |
| 16 | Evidence: { required: true, note: "- &lt;kind&gt;: &#91;&lt;label&gt;&#93;(&lt;url&gt;) — at least one verifiable link: merged PR, published doc, dashboard" } |
| 17 | Observations: { required: false, note: "what was observed and how; links alone are not verification" } |
| 18 | Uncertainty: { required: false, note: "remaining verification and limits; explicit none if resolved" } |
| 19 | relevance: recent-first |
| 20 | --- |
| 22 | # Accomplishment |
| 24–30 | An impact candidate or observed outcome, retained after source task archival. Unverified candidates may have no evidence links and never count as impact. Observed records require an outcome identity, reviewer, observation date, evidence, nonempty Observations and Uncertainty, and completed eligible source work. Reports label this recorded attestation; tools do not independently verify external links. Duplicate records sharing an outcome count once; conflicting claims need review. Source work that is private, dropped or superseded cannot contribute impact. |
| 32–37 | Legacy records may retain absent verification, Observations and Uncertainty without rewriting any claims, history or links. Missing verification means unverified, with an advisory diagnostic; it is not a claim about the record's age. The existing Evidence section/link rule still applies to these legacy-shaped records. New skeletons and promotion candidates explicitly set unverified and include both sections. Validation and reports never fill in an attestation. |
| 39 | &lt;!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work --&gt; |

### Schema decision

Required by E, K, C, N. Base inheritance is mandatory for every concrete type; W
applies to every write. G rules apply throughout. Read the complete schema on
activation, including all rows below.

| Source lines | Preserved exact clause |
|---|---|
| 1 | --- |
| 2 | schema: decision |
| 3 | version: "0.4.14" |
| 4 | extends: _base |
| 5 | kind: record |
| 6 | slug-form: "&lt;base&gt;-YYYYqN" |
| 7 | fields: |
| 8 | date: { type: date, required: true } |
| 9 | scope: { type: text, required: true, default: unassigned, note: "where this knowledge applies; unassigned needs review" } |
| 10 | source: { type: ref-list, required: true, note: "provenance; supplement with Evidence links" } |
| 11 | review: { type: enum, required: true, values: &#91;needed, reviewed&#93;, default: needed } |
| 12 | reviewed-by: { type: text, required: false } |
| 13 | reviewed-on: { type: date, required: false } |
| 14 | sections: |
| 15 | Summary: { required: true, note: "decision with rationale or reusable finding; bound the claim to scope" } |
| 16 | Evidence: { required: true, note: "source links do not establish independent verification" } |
| 17 | Observations: { required: true, note: "what was actually observed, by whom and how" } |
| 18 | Uncertainty: { required: true, note: "unresolved assumptions or limitations; explicit none if resolved" } |
| 19 | relevance: recent-first |
| 20 | --- |
| 22 | # Decision |
| 24–27 | Durable knowledge outlives its originating task. Keep scope, provenance and review explicit. Use inherited superseded-by for a replacement and retain the old file. Archived and superseded versions remain searchable with explicit archive selection. A new skeleton needs review; only record reviewed after inspecting its evidence. |
| 29 | &lt;!-- arbiter:types · PROTOCOL.md#tier-2 · consult before writing --&gt; |

### Schema finding

Required by E, K, C, N. Base inheritance is mandatory for every concrete type; W
applies to every write. G rules apply throughout. Read the complete schema on
activation, including all rows below.

| Source lines | Preserved exact clause |
|---|---|
| 1 | --- |
| 2 | schema: finding |
| 3 | version: "0.4.14" |
| 4 | extends: _base |
| 5 | kind: record |
| 6 | slug-form: "&lt;base&gt;-YYYYqN" |
| 7 | fields: |
| 8 | date: { type: date, required: true } |
| 9 | scope: { type: text, required: true, default: unassigned, note: "where this knowledge applies; unassigned needs review" } |
| 10 | source: { type: ref-list, required: true, note: "provenance; supplement with Evidence links" } |
| 11 | review: { type: enum, required: true, values: &#91;needed, reviewed&#93;, default: needed } |
| 12 | reviewed-by: { type: text, required: false } |
| 13 | reviewed-on: { type: date, required: false } |
| 14 | sections: |
| 15 | Summary: { required: true, note: "decision with rationale or reusable finding; bound the claim to scope" } |
| 16 | Evidence: { required: true, note: "source links do not establish independent verification" } |
| 17 | Observations: { required: true, note: "what was actually observed, by whom and how" } |
| 18 | Uncertainty: { required: true, note: "unresolved assumptions or limitations; explicit none if resolved" } |
| 19 | relevance: recent-first |
| 20 | --- |
| 22 | # Finding |
| 24–27 | Durable knowledge outlives its originating task. Keep scope, provenance and review explicit. Use inherited superseded-by for a replacement and retain the old file. Archived and superseded versions remain searchable with explicit archive selection. A new skeleton needs review; only record reviewed after inspecting its evidence. |
| 29 | &lt;!-- arbiter:types · PROTOCOL.md#tier-2 · consult before writing --&gt; |

### Schema goal

Required by E, C, N. Base inheritance is mandatory for every concrete type; W
applies to every write. G rules apply throughout. Read the complete schema on
activation, including all rows below.

| Source lines | Preserved exact clause |
|---|---|
| 1 | --- |
| 2 | schema: goal |
| 3 | version: "0.4" |
| 4 | extends: _base |
| 5 | kind: work-item |
| 6 | slug-form: "&lt;base&gt;-YYYYqN" |
| 7 | fields: |
| 8 | status:  { type: enum, required: true,  values: &#91;todo, in-flight, blocked, done, dropped, needs-review&#93;, default: todo } |
| 9 | started: { type: date, required: false } |
| 10 | eta:     { type: date, required: false } |
| 11 | due:     { type: date, required: false, note: "target date — typically the quarter boundary" } |
| 12 | sections: |
| 13 | Summary:     { required: true,  note: "the outcome sought and why it matters, then current state" } |
| 14 | Plan inputs: { required: false, note: "optional reference links before Checklist; produced outputs remain in Artifacts" } |
| 15 | Checklist:   { required: false, note: "milestones; steps that are tracked tasks link them via see: lines, and referenced steps carry ^anchors" } |
| 16 | Artifacts:   { required: false } |
| 17 | Detail docs: { required: false } |
| 18 | relevance: active-first |
| 19 | --- |
| 21 | # Goal |
| 23–24 | An outcome spanning multiple tasks, usually scoped to a quarter. Same fields and lifecycle as a task; the difference is altitude. |
| 26–28 | - Child tasks declare `parent: &lt;goal-id&gt;` in their frontmatter; the goal's checklist holds milestones, not task-level steps. A milestone that a task's `blocked-by:` points at must carry a `^anchor` (PROTOCOL.md#anchors). |
| 29–31 | - Keep the goal's status honest against its children: a goal with all children terminal should itself be closed or re-scoped, and triage will flag it otherwise. |
| 33 | &lt;!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work --&gt; |

### Schema journal

Required by E, C, I, N. Base inheritance is mandatory for every concrete type; W
applies to every write. G rules apply throughout. Read the complete schema on
activation, including all rows below.

| Source lines | Preserved exact clause |
|---|---|
| 1 | --- |
| 2 | schema: journal |
| 3 | version: "0.4" |
| 4 | extends: _base |
| 5 | kind: record |
| 6 | slug-form: "&lt;base&gt;" |
| 7 | fields: |
| 8 | date: { type: date, required: true, default: "file modification date", note: "the day the entry is about" } |
| 9 | sections: |
| 10 | Summary:     { required: false, note: "human raw entries are valid without it; normalization adds it on first touch" } |
| 11 | Artifacts:   { required: false, note: "items or docs this entry feeds — link the goal/task it informs" } |
| 12 | Detail docs: { required: false } |
| 13 | relevance: recent-first |
| 14 | --- |
| 16 | # Journal entry |
| 18–21 | The capture surface: findings, gotchas, decisions, raw notes from Slack or a terminal — one entry per topic, dated. This is the type where human-friendliness matters most: a title and a few lines of prose is a complete, valid entry (PROTOCOL.md#normalization does the rest later). |
| 23–24 | - `relevance: recent-first` — by `date` descending; the tier-2 page shows the last 7 days first, older entries behind pagination. |
| 25–26 | - An entry that turns out to be *work* gets promoted: create the task, link it under `## Artifacts`, leave the entry as the record of where it came from. |
| 27 | - Personal reflections take `visibility: private`. |
| 29 | &lt;!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work --&gt; |

### Schema meeting

Required by E, C, I, A, N. Base inheritance is mandatory for every concrete type; W
applies to every write. G rules apply throughout. Read the complete schema on
activation, including all rows below.

| Source lines | Preserved exact clause |
|---|---|
| 1 | --- |
| 2 | schema: meeting |
| 3 | version: "0.4" |
| 4 | extends: _base |
| 5 | kind: record |
| 6 | slug-form: "&lt;base&gt;-YYYY-MM-DD" |
| 7 | fields: |
| 8 | date: { type: date, required: true, default: "from the id's date suffix", note: "when the meeting occurred/occurs" } |
| 9 | sections: |
| 10 | Summary:     { required: true,  note: "decisions and outcomes first, discussion second" } |
| 11 | Artifacts:   { required: false, note: "items and documents the meeting touched — link tasks/goals it advanced or blocked" } |
| 12 | Detail docs: { required: false, note: "full minutes as a tier-3 note, when they exist" } |
| 13 | relevance: recent-first |
| 14 | --- |
| 16 | # Meeting |
| 18–21 | A record of a conversation — no status, no checklist. What a meeting *decides* lives here; what it *creates* does not: promote action items into `tasks/` (one line each is enough — see PROTOCOL.md#capture) and link them under `## Artifacts` rather than keeping a to-do list inside the meeting file. |
| 23 | - `relevance: recent-first` — tier-1 ordering by `date` descending. |
| 24–25 | - 1:1s and sensitive conversations take `visibility: private` (PROTOCOL.md#visibility). |
| 27 | &lt;!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work --&gt; |

### Schema person

Required by E, C, A, N. Base inheritance is mandatory for every concrete type; W
applies to every write. G rules apply throughout. Read the complete schema on
activation, including all rows below.

| Source lines | Preserved exact clause |
|---|---|
| 1 | --- |
| 2 | schema: person |
| 3 | version: "0.4.16" |
| 4 | extends: _base |
| 5 | kind: record |
| 6 | slug-form: "&lt;base&gt;" |
| 7 | fields: |
| 8 | date: { type: date, required: true, note: "date the entity was recorded" } |
| 9 | sections: |
| 10 | Summary: { required: true, note: "context about this person or entity" } |
| 11 | Artifacts: { required: false } |
| 12 | Detail docs: { required: false } |
| 13 | relevance: recent-first |
| 14 | --- |
| 16 | # Person or entity |
| 18–21 | A stable `people/&lt;id&gt;` identity represents a person or organization. It is not an account, access grant, invitation or assignment. Connections and their roles are stored in task input ledgers and filtered independently of both endpoints. Private cards require trusted audience policy; defaults omit them entirely. |
| 23 | &lt;!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work --&gt; |

### Schema task

Required by E, H, C, N. Base inheritance is mandatory for every concrete type; W
applies to every write. G rules apply throughout. Read the complete schema on
activation, including all rows below.

| Source lines | Preserved exact clause |
|---|---|
| 1 | --- |
| 2 | schema: task |
| 3 | version: "0.4" |
| 4 | extends: _base |
| 5 | kind: work-item |
| 6 | slug-form: "&lt;base&gt;-YYYYqN" |
| 7 | fields: |
| 8 | owner: { type: text, required: false, note: "one accountable owner or unassigned; absence is unknown" } |
| 9 | checkpoint: { type: text, required: false, note: "fixed KB-root path tasks/&lt;id&gt;/checkpoint.md; see PROTOCOL.md#checkpoints" } |
| 10 | phase: { type: text, required: false, note: "optional grouping only; does not imply ownership or blockers" } |
| 11 | status:  { type: enum, required: true,  values: &#91;todo, in-flight, blocked, done, dropped, needs-review&#93;, default: todo } |
| 12 | started: { type: date, required: false, note: "when work actually began" } |
| 13 | eta:     { type: date, required: false, note: "estimated completion" } |
| 14 | due:     { type: date, required: false, note: "external deadline; overdue = due &lt; today while status is non-terminal" } |
| 15 | sections: |
| 16 | Summary:     { required: true,  note: "2–5 sentences: current state first, then context" } |
| 17 | Plan inputs: { required: false, note: "optional reference links before Checklist; produced outputs remain in Artifacts" } |
| 18 | Checklist:   { required: false, note: "steps with marks — grammar in PROTOCOL.md#tier-2; blocked steps carry blocked-by links" } |
| 19 | Artifacts:   { required: false, note: "- &lt;kind&gt;: &#91;&lt;label&gt;&#93;(&lt;url&gt;) — PRs, docs, dashboards this task produced or uses" } |
| 20 | Detail docs: { required: false, note: "links into tier 3 — plans, investigations" } |
| 21 | relevance: active-first |
| 22 | --- |
| 24 | # Task |
| 26–28 | A unit of work with a lifecycle. Status is the load-bearing field: keep it and the checklist marks true on every touch — the dashboard, triage, and accomplishments all derive from them. |
| 30–32 | - `relevance: active-first` — tier-1 ordering: non-terminal (blocked, in-flight, todo, needs-review) by `updated` descending, then terminal (done, dropped) last; terminal items age off the card 7 days after closing. |
| 33–34 | - When a task reaches `done`, distill an accomplishment with evidence (PROTOCOL.md#accomplishments). When it is `dropped`, it never becomes one. |
| 35–36 | - Recurring work: apply the reopen rule (PROTOCOL.md#slugs) before creating a near-duplicate. |
| 38 | &lt;!-- arbiter:types · PROTOCOL.md#tier-2 · field schema; consult when writing this type — do not edit during item work --&gt; |
