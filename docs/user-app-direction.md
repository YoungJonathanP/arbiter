# User app direction and agent review of human input

Product direction from the user, 2026-09-10. This records intended behavior and
acceptance cases. The [executable candidate](app-review-candidate.md) now tests
linked-input review and accessible relationships. It does not change the installed
protocol, implement new record types, or claim the current renderer provides these flows.

Agreement recorded 2026-09-10: the user explicitly concurred with revised item 5
(connected people/entities with relationships separate from assignment/access)
and item 6 (Relevant sources and the explained linked-input review model).
These behavior decisions are settled. A core candidate and twelve synthetic tests
now exercise them; persistence, app integration and migration verification remain.

## Human and agent responsibilities

Move toward a user-facing application in the near term. People manage quick
actions through structured controls, while agents maintain the task overview,
implementation plan and continuation state. The user remains in control of work.

| Surface | Intended human interaction | Intended agent interaction |
|---|---|---|
| Task | Change status, mark done, assign relationships, add a linked quick note | Review, plan, implement and maintain the task and its current checkpoint |
| Journal or note | Write freely, tag one or more tasks, projects or people | Review new linked input, explain relevance, incorporate authorized changes with source attribution |
| Person or entity card | Create/select an entity and connect it to shared work with an explicit relationship | Discover relevant participants and context without treating association as assignment |
| Appointment or calendar item | Create/edit through a form and link relevant work | Use relevant scheduling context during review; infer neither task completion nor new authority from an event |

The default task experience has structured controls and readable agent-maintained
content. It is not an unrestricted task-body editor. A task's Add note action
creates a linked note/journal entry; it does not splice arbitrary prose into the
task's Summary or Checklist. Existing imported raw text must remain preserved;
future authoring constraints do not justify deleting historical input.

An authorized person's Done action must work without an agent session. Save an
auditable change, update the visible status, and expose Undo. Conflicting task or
checklist state requires a clear structured resolution, not silent overwriting or
an unconditional requirement to call an agent. A human completion declaration is
distinct from independently verified accomplishment evidence. An agent holding an
older checkpoint must see the status change before continuing implementation.

## People, relationships and visibility

Agreed item 5 supports connected people/entities and audience-aware views.
A person can be a contributor, reviewer, stakeholder, source of a note, or an
accountable owner. Show the relationship from both the task and the person's card.
Use stable entity identities; a person card need not be an authenticated app user.
Representing a collaborator does not send them an invitation or notification.

Connecting an entity to a task expresses relevance. Assignment expresses
responsibility. Access rules determine who can see the task, note or relationship.
These are separate choices. For example, a user's own view can show their personal
reflection alongside a shared task, while another viewer sees only the shared
work. A private note must not silently become shared task prose through agent
reconciliation. Present it in the authorized review context; sharing or deriving
shared content requires the relevant visibility decision.

An authorized person's view should show their accessible connections. Restricted
views/exports must not reveal inaccessible targets through titles, counts or
backlinks. This extends the earlier blanket omission proposal into a future
audience model; it does not remove privacy or claim current authentication exists.
Entity schemas and access-policy details remain design work before implementation.

## What Plan inputs means

Plan inputs are a small selected reading list answering: "What must the agent
consult to understand or continue this task?" In the app, a clearer label could
be Context or Relevant sources. The existing proposed task schema makes this
section optional; it is not another plan or checklist.

For a synthetic task, "Implement password reset":

| Task content | Example | Purpose |
|---|---|---|
| Relevant sources (Plan inputs) | Account recovery design, section on expiry | Establish what the task should implement |
| Relevant sources (Plan inputs) | Linked note: expired links need an explanation | Carry user feedback that affects the work |
| Checklist | Add expiry handling and verify it | Describe work to perform |
| Artifacts | Resulting PR and verification report | Preserve what the work produced |
| People | Sam, reviewer | Explain participation; this is not a blocker by itself |

Inputs are selected references, preferably to the relevant section with a short
reason. They do not require copying an entire document, importing sibling histories,
following every relationship, or treating every source as an instruction. A source
can inform the plan without blocking execution. Actual blockers need an explicit
condition. Produced outputs belong in Artifacts; current continuation belongs in
the checkpoint. A new journal entry first enters pending input; review determines
whether it should become enduring task context.

## Timestamp-based journal reflection

User requirement: tag a task on a new journal/note entry and have that newer input
reflected in the task or presented during the next agent session. Implement a
visible pending-input state independent of execution status.

1. Saving a note records its identity, content revision, author and capture time,
   plus explicit links to tasks. Preserve an optional date for when its subject
   happened separately from when the note was entered. Edits and new links are
   new events even when the described meeting happened yesterday.
2. Compare linked-input activity to that task's last agent review of linked input.
   Show New input with accessible note previews and links. Merely opening a task,
   regenerating its dashboard or changing its status does not acknowledge notes.
3. At task review or continuation, the agent reads pending relevant input first.
   It presents the implications or incorporates changes within its current task
   authority. Preserve source wording and attribution. A conflicting instruction
   or material scope change stays visible for resolution.
4. Record what happened to each source revision for each task: incorporated,
   presented, deferred, or explicitly dismissed as irrelevant with a reason.
   Presentation is not incorporation. Deferred input stays actionable. A note
   linked to two tasks is reviewed independently for each.

Recommendation: use last review of linked input rather than the task's general
last-updated time. Example: review at 09:00; note at 09:15; human marks task Done
at 09:20; agent resumes at 09:30. The note still needs review. Comparing only to
the 09:20 status change would lose it. New input on a done task should flag review,
not automatically reopen the task or reverse the human's decision.

Timestamps drive ordering and the user-facing explanation. Durable per-source
revision receipts prevent omissions and repeated processing. Equal timestamps,
backdated entries, edits without timestamp changes, newly added links and input
arriving during review must not disappear behind a single time cutoff. Only
acknowledge the exact source revision actually observed. This complements the
current-file freshness direction rather than returning to timestamp-only detection.
Field names and storage formats are proposals to settle with the contract design.

## Acceptance examples for copied or synthetic data

- A person marks a task Done in the app without launching an agent. Stale agent
  writes cannot overwrite that change, and completion history remains recoverable.
- A task quick note appears as a linked journal/note, leaving structured task prose
  intact until reviewed. Freeform task-body editing is absent from the normal UI.
- A new linked note appears at the next review even after a later status change.
- Editing an already reviewed note, including within the same timestamp unit,
  reintroduces the changed revision as pending input.
- Linking an older note to a task now creates pending input for that task. Two
  linked tasks maintain separate dispositions; a concurrent note stays pending.
- Deferred feedback and conflicts remain visible; showing a note is not recorded
  as applying it. Done tasks stay done unless an authorized action changes them.
- Accessible shared-work relationships appear on both person and task cards;
  inaccessible relationships do not leak through an export. Private reflections
  can be presented to their authorized user without becoming shared task content.

## Delivery implications

Bring structured task actions and linked note capture into the near-term app
milestone, followed by pending-input review and connected entity views. Keep the
shared write/recovery boundary across app and agents. Appointment entry is a
structured capture use case; external calendar synchronization is a separate
integration decision. Customer hosting, account/access design and a deployment
target still need their own implementation plan; no deployment is performed here.

The [launch plan](launch-plan.md) now points to this direction. T09 remains the
current migration/evaluation assignment, with these examples informing its review;
this document does not mark future app features implemented or create a successor.
