# Progressive disclosure for task continuation

Decision: accepted product direction, supplied by the user on 2026-09-14 during
T09 budget review. This resolves the pending budget/contract choice by correcting
its scope. It does not select the proposed compact protocol or a larger total
session maximum. This is a task-design and evaluation decision; bundled protocol,
grammar, schemas, runtime and installed KBs are unchanged.

## User intent

A human can give a new agent an Arbiter task URL or path and ask it to pick up
where work left off. The agent should find a concise, sufficient starting point,
identify the next appropriate unit of work, and finish that unit without rebuilding
the preceding sessions. Context expands when a concrete question makes another
source relevant. The user further clarified that a reasonable numeric handoff
limit is acceptable, and session loading also needs a limit so that the agent has
room to accomplish its task. Progressive disclosure is controlled expansion, not
unlimited loading of individually relevant sources.

## Flight, task and handoff

A flight is a manageable group of related work aligned with a larger plan. Use
existing goal/parent-task relationships and independently assignable tasks; this
decision introduces no new type, storage path or automatic ownership. A checklist
step that is independently assignable can point to its own task; a small step
can stay in the owning task. Do not manufacture a task and handoff for every row.

The normal path for a large task is:

1. Inspect the flight's concise summary and checklist to understand the outcome,
   current progress and next eligible task. A direct task link can start at that
   task and follow its parent only when the flight context is needed.
2. Inspect that task and its current T3 handoff, prepared by the preceding session
   or task. Recheck relevant prerequisites and authority before starting work.
   Checklist order suggests sequence; it does not override blockers or assignment.
3. Open the flight's larger plan only when needed for alignment, scope or acceptance.
   Open supporting investigation or historical sections only for a specific question.

The task presents a project/task summary and larger-plan link; a checklist aligned
with that plan, with step descriptions, current marks and task/handoff pointers;
and navigable supporting investigations, tickets, PRs and other useful artifacts.
Keep task identity, lifecycle and checklist status canonical on the task. The
handoff records current execution state rather than maintaining a second checklist.
Plan inputs, Artifacts/Evidence and Detail docs retain their existing roles.

The current handoff carries nearly everything needed to complete the selected
assignment: outcome, boundaries, next action, verified work, essential decisions
and rationale, constraints, dependencies, remaining uncertainty, verification and
completion criteria. Code inspection and relevant evidence checks remain ordinary
work. If an investigation established a rule the next task must obey, carry that
rule into the handoff and cite its source; do not require rereading the investigation
to discover it. Include a source, selected section and reason to open each pointer.

Previous handoffs remain available for targeted historical questions. They are not
a prerequisite reading chain. A predecessor's directive for the next task must be
carried into that task's current handoff, with provenance, so that the agent does
not have to recover it from an old packet. Essential conflicts and constraints
cannot be hidden behind an optional link. Preserve history, refs and anchors.

## Budget scope and conflict resolution

Retain the existing 6 KiB target and 10 KiB ordinary export ceiling for the complete
handoff packet. These are existing defaults, not new user-selected numeric limits.
Count all content actually emitted in that packet: metadata, manifest, excerpts,
selected inlined sources and any override. Warn/split or record an explicit larger
maximum and reason when necessary; never truncate required information.

Separate three observations in evaluation:

- **Exported packet:** exact bytes, including every emitted component and override.
- **Task continuation reads:** flight/task/checkpoint and later relevant sources;
  record what was read, why, and unnecessary expansion or duplicate loading.
- **Host overhead:** system, developer, tools, client framing and other session
  context, measured where available and explicitly unknown otherwise.

The export ceiling is not the same ceiling for all three categories or later
working reads. An unknown host inventory does not by itself invalidate a measured
packet; it prevents a claim about the complete session size. An offline export
that includes the full protocol still counts that protocol and can exceed the
export ceiling. A small linked packet is not proof of small total context.

This explicitly supersedes the 2026-09-13 T09 requirement to choose either a larger
measured whole-session maximum or a rewritten compact contract before continuation
evaluation. The whole-bootstrap evaluator and clause map retain historical
measurements; their cumulative admission gate and proposed dispatcher are not the
selected product policy. No new larger maximum is adopted. The installed protocol
read and required schema/input duties remain in force; changing those requires a
separate versioned decision, rather than treating required rules as optional.

Optional background investigations differ from actionable linked input: new or
changed tagged input must still inform or be presented at the next task review
under the existing input-review contract. Required blockers, privacy/access checks,
staging, freshness and interruption reconciliation remain mandatory. An optional
source link grants neither access nor execution authority.

## Bound session loading separately

Use two controls: the numeric packet limit above, and a task-scoped startup budget
with room reserved for execution, tool results, verification and the outgoing
checkpoint. A small packet must not implicitly authorize loading all its links.
The default source set is the selected flight/task/current handoff plus mandatory
operating rules, schemas and actionable input. Larger-plan or investigation reads
are added for an identified need, not loaded as a complete background bundle.

For an actual receiving client, choose and record an explicit startup allowance
and working reserve based on measured required reads and available usable context.
Account for known host overhead separately; distinguish UTF-8 output bytes from
model token capacity. The user has not selected these numeric values. Calibrate
them in the next exercise rather than reusing 10 KiB or the synthetic 65,536-byte
maximum as a session limit. Unknown capacity remains an explicit limitation: a
bounded source list can demonstrate navigation scope but cannot prove enough
working room in a real session.

Before expanding, state the question, select the smallest useful section and check
the remaining allowance/reserve where measurable. Relevance alone is insufficient
if the required expansion consumes the room needed to finish. Narrow or split the
flight/task, or checkpoint into a fresh session before that happens. An explicit
budget revision needs a reason and sufficient remaining capacity; never silently
ignore the bound or omit required rules/input to appear within it. Starting the
task and completing it without avoidable context exhaustion is part of acceptance.

## T09 acceptance and next exercise

Evaluate the user journey with a synthetic flight containing completed work, a next
eligible task, and supporting pointers. A receiver should be able to state the
outcome, next action, relevant gates and completion criteria from the flight/task
and current handoff without reading sibling bodies or prior handoffs by default.
Keep one directly relevant investigation available to answer a specific question;
the handoff must already carry its essential conclusion. Include ticket/PR and
larger-plan pointers with enough labels to choose them without opening all of them.

Measure packet size and baseline task reads separately, followed by each justified
expansion. Propose/calibrate the separate startup allowance and working reserve;
exercise stop/split/checkpoint behavior when an expansion would consume that reserve.
Growing background/history should not enlarge the normal start packet
or force historical reading. Verify next-step eligibility, stale-state handling,
pending-input presentation and preservation of refs/anchors as well as size. An
appropriate relevant read is not a failure merely because it increases context.

Authored examples and exporter tests establish structure and emission behavior;
actual successful continuation requires an authorized fresh-agent exercise.
Fresh-agent launch, private-data use and live adoption/reconciliation retain their
existing separate authority boundaries. T09 stays partial until its remaining
acceptance and reconciliation evidence exists.

## Sources

- [Handoff design](task-handoffs.md#product-contract): task/checkpoint roles and navigation.
- [Export policy](grammar.md#15-current-task-checkpoints-v0411): entire output accounting.
- [Installed bootstrap obligations](../assets/contract/PROTOCOL.md#checkpoints): mandatory rules, freshness and input review.
- [Prior measurement](bootstrap-budget-evaluation.md#required-context-and-duplication): packet and source sizes, not a selected session maximum.
- [Historical clause map](compact-contract-map.md#measured-preservation-baseline): preservation evidence, not adopted dispatch.
