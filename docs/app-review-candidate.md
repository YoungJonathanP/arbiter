# Candidate: linked input and accessible relationships

Current candidate, 2026-09-12: protocol/base 0.4.17 adds authenticated input
continuation to the 0.4.16 personal task controls. See the
[continuation decision](v0.4.17-personal-continuation.md) for the exact client flow,
whole-packet budget and remaining adoption gates. Synthetic HTTP continuation
passes; installed-contract reconciliation, imported-record compatibility, target
migration and fresh-session acceptance remain. No installed KB changed.

The following 0.4.15 account records the preceding candidate. Its then-remaining
app controls are implemented by 0.4.16; authenticated continuation is implemented
by 0.4.17 for private input alongside shared canonical checkpoints. Historical
privacy and revision-review constraints remain applicable.


T09 implementation candidate, updated 2026-09-11. The behavior agreed in
[app direction](user-app-direction.md) now has an executable core model in
[input-review.ts](../src/core/input-review.ts) and synthetic acceptance cases in
[input-review.test.ts](../test/input-review.test.ts). Protocol 0.4.15 now adds a canonical private audit ledger, CAS persistence,
shared local-app actions and checkpoint input presentation. See the
[version decision](v0.4.15-input-storage.md). No installed KB was changed.
Personal-account authentication, broader app controls and migration remain pending.

## Concrete representation

| Value | Meaning and constraint |
|---|---|
| Task identity/revision | Stable task ref and digest of the observed canonical task bytes. Any intervening human action requires rereading before completing review. |
| Source identity/revision | Stable note/journal ref and SHA-256 of all canonical bytes, including author, capture time and optional event date. Source time is descriptive; it cannot acknowledge input. |
| Link identity | Stable association incarnation linking one source to one task. A later removal/re-add allocates a fresh ID. Two linked tasks have independent receipts. |
| Audience | Shared, or an explicit finite set of readable principal IDs. The model takes a trusted resolved audience; it does not authenticate a browser or accept a viewer-selected grant. |
| Input receipt | Task, source, link incarnation, observed source digest, task digest, reviewer, review time, disposition and reason. Receipt append order resolves successive dispositions. |
| Review snapshot | Task digest, digest of that task's receipt sequence, reviewer and only the exact selected revisions actually read. |
| Relationship | Stable edge ID, task ref, entity ref, role and independent audience. Entity identity is separate from an authenticated account. |

`pendingInput` filters the task, link and source by audience before returning
bodies or associations. Counts must be computed from this filtered result. It
returns `new`, `presented` or `deferred`; incorporated/dismissed revisions leave
the actionable list. Presented is acknowledged as shown but remains actionable;
deferred requires follow-up. Neither is described as applied. The API has no
task-status mutation and does not reopen Done tasks.

`beginInputReview` captures an explicit reading selection without receipts.
`finishInputReview` proposes receipts only for that selection. It refuses a
changed task or competing receipt sequence, ambiguous identities, missing reasons,
unobserved revisions and revoked access. A concurrent source edit receives no
acknowledgment from an older receipt; the new digest stays pending. Input arriving
after the review began also stays pending. Timestamps never filter either case.

`accessibleRelationships` produces the same filtered edge set for task and entity
cards. An edge requires readable endpoints and a readable relationship. No hidden
edge title, identity or count enters the result. A role called owner describes an
association; assigning accountable ownership remains an explicit task action.
No relationship operation grants access, creates an account or sends a message.

## Sharing boundary

The current candidate permits incorporation only when every reader of the target
task can also read the source and the association. A private note can be presented
to its authorized reader alongside shared work; it cannot be incorporated into
that shared task. A future explicit sharing action must first resolve the source
and relationship audiences, with its own exact revision and audit record.

This is a conservative permission check, not a detector for sensitive natural
language. Callers must resolve inherited access and must not insert inaccessible
material into otherwise shared source bytes. Review reasons and reviewer identities
are excluded from the pending projection; an audit view needs separate access.
Existing default exports keep their current conservative privacy filtering until
an authenticated audience-aware projection is implemented and verified.

## Persistence and app integration

The [storage adapter](../src/core/input-storage.ts) consumes canonical journal/
meeting records and the per-task `input-review.md` role defined in
[grammar §18](grammar.md#18-linked-input-audit-storage-0415). The ledger appends
immutable event sections before its fixed pointer, retaining links, independent
edge visibility, relationships, review receipts and exact write intent. Generic
CAS writes enforce append-only history and owning-task staging. Normalization
preserves ledger bytes; default projections always exclude its body.

Task/source effects use one cooperating lock with sequential durable writes:
intent, content, reread, completion. A receipt is effective only after completion.
Interruption blocks subsequent input actions; explicit re-observation completes or
cancels matching intent without restoring target files. Interrupted incorporation
always cancels its receipt intent, leaving landed prose and actionable input for a
fresh review. Source or task changes require refreshing a stored review preview;
this adapter is stricter than the pure model's concurrent-source allowance.

The local task app now offers linked quick notes with event dates, explicit
presented/deferred/dismissed review, Done with checklist resolution, and exact-base
Undo. Its existing loopback/origin/token boundary supplies a local-operator actor;
it is not personal-account authentication and exposes shared inputs only. Private
principals require a configured trusted policy adapter. The narrow human-action
protocol exception preserves agent terminal-transition staging and refuses pending
proposals. Incorporated task changes and relationship mutation are library APIs;
their full authoring/preview UI remains pending.

Checkpoint preview includes every actionable shared source's exact bytes and
revision in the whole-packet budget. New input marks the packet review-required;
no capture, export or task status update creates receipts. Last linked-input review
comes from effective review events independently of `updated`; the local view
shows only timestamps for readable associations. Hidden associations between shared
endpoints remain hidden. Stored reasons/actors and restricted counts stay outside
exports. These are permission checks, not sensitive-prose detection.

## Changes to the historical adoption proposal

The seven-file proposal from 2026-09-09 remains historical and must not be installed
as the result of this review. A new full-contract candidate is retained privately; resolve these remaining
adoption dependencies before declaring its exact bytes compatible:

| Candidate location | Required amendment |
|---|---|
| PROTOCOL Visibility; base schema | Separate association, assignment and access; define the authenticated audience and inheritance adapter before enabling personal review. Preserve default restricted exports. |
| PROTOCOL Statuses/Arbitration | Local Done/Undo, checklist resolution and audit now exist; verify the target's specific proposal/checklist cases. Stale agents retain CAS/staging requirements. |
| PROTOCOL Tier 2/Checkpoints; task schema | Optional Relevant sources label for Plan inputs; pending linked input and revision receipts before continuation; independent last input-review event. No source or staffing-derived authority. |
| Journal schema and new relationship/receipt roles | The ledger now supplies capture/link/review evidence and validators. Personal entity schemas and access administration still need a compatible design. The earlier seven-file scope is insufficient. |
| PROTOCOL Tier 1 and projection | Reconcile the review's complete active-work overview recommendation with the current five-entry implementation; compact continuation has its own budget. |

Preserve source bytes, historical anchors and old IDs throughout. A private
evaluation fork must receive a fresh UUID only after a compatible revised contract
exists; live adoption remains separate. These remaining implementation dependencies
are not requests to agree again with items 5/6.

## Executed acceptance coverage and limits

Twelve synthetic tests cover later status changes, same-timestamp edits, backdated
notes, newly linked old sources, relinking, independent tasks, presentation/deferral,
concurrent input, conflicting reviewers, revoked access, private incorporation,
filtered relationships and actual CAS/transaction preservation. The writer test
captures a source without rewriting the task, records Done, rejects a stale agent
write, verifies transaction before/after bytes and performs CAS-protected Undo.

Thirteen additional [storage/app tests](../test/input-storage.test.ts) exercise
actual durable capture/review, stale human/agent actions, CAS Undo, interrupted
incorporation, explicit reconciliation, append-only validation, trusted policy
revisions, relationship privacy, restricted checkpoint exports, packet budgets,
old-contract refusal and the real local HTTP API. They do not measure a fresh
agent's continuation. The full suite and preservation evidence are recorded in
[the current T09 evidence](handoffs/completed/t09.md#continuation-2026-09-11-durable-input-storage-and-local-app-actions).

Remaining work includes personal access authentication/administration, connected
person schemas/cards, appointment entry, attributed-incorporation preview UI,
complete active-work overview reconciliation and large-project migration.
No installed adoption, live app rollout or fresh-session acceptance is claimed.
