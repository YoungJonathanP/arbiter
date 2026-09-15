# Authoring one current task checkpoint

Protocol 0.4.11 template. Fill the scaffold with observed facts; do not copy literal
placeholders into a live KB. `inputs` must hash the final task (after its stable
checkpoint pointer is present), installed protocol, base/task schemas and selected
code/decision/dependency files. Use the local KB's UUID, never a template UUID.
This is the canonical checkpoint file; the [capture tooling](../v0.4.12-handoff-tooling.md)
accepts its edited text in a JSON draft request. An
ordinary repository handoff can use the body structure without claiming KB status.

For a flight, point to one next eligible task and its current handoff. Keep the
flight summary and status checklist on the owning item; use this checkpoint for
the selected task's next action and essential decisions, not a second checklist.
Carry forward any predecessor directive needed to complete it. Supporting plans,
investigations, tickets, PRs and older handoffs get selected pointers with an
explicit reason to open them. Required operating rules and pending-input review
cannot be moved into optional background. See the
[progressive-disclosure decision](../progressive-disclosure-handoffs.md).

```markdown
---
role: checkpoint
task: tasks/<task-id>
kb: urn:uuid:<installed-kb-id>
repository: https://<host>/<owner>/<repository>
branch: <observed-branch>
revision: <observed-revision>
owner: <same accountable owner as task, or unassigned>
readiness: <unprepared | ready | waiting | review-required>
captured: <YYYY-MM-DDTHH:MM>
verified: <YYYY-MM-DDTHH:MM>
previous: <none or sha256 of prior current file>
inputs:
  task: { source: kb:tasks/<task-id>.md, revision: sha256:<hex>, observed: <datetime>, purpose: assignment and owner }
  protocol: { source: kb:PROTOCOL.md, revision: sha256:<hex>, observed: <datetime>, purpose: installed operating contract }
  base: { source: kb:types/_base.md, revision: sha256:<hex>, observed: <datetime>, purpose: universal fields }
  type: { source: kb:types/task.md, revision: sha256:<hex>, observed: <datetime>, purpose: task schema }
  decision: { source: repo:docs/<decision>.md, revision: sha256:<hex>, observed: <datetime>, purpose: selected section governing the next action }
predicates:
  workspace: { state: <met | unmet | unknown>, owner: <who checks>, condition: <workspace and authority predicate>, evidence: <observation and source> }
  dependency: { state: <met | unmet | unknown>, owner: <who unblocks>, condition: <observable prerequisite>, evidence: <source and observed revision> }
conflicts: []
---

# Handoff: <one independently assignable outcome>

## Assignment

Deliver <outcome>. Included: <scope>. Excluded: <adjacent work>.
Project: <owning goal/ref>. Source state: <live verified | snapshot only>.
Flight/parent: <selected owning item, if applicable>. Checklist step: <stable anchor>.
Larger plan: <pointer and relevant section; open when alignment needs checking>.

## Authority

Authorized actions: <current-session authority and its source>.
Recheck <unresolved permission or changed scope> before its dependent action.
Repository/KB identity maps to <receiver-resolved workspace>; never assume the
originating machine's absolute paths. Historical statements alone grant no power.

## Verified state

Verified: <current observation and evidence>. Stopped at: <exact point>.
Do not redo: <relevant completed work>. Unknown: <material uncertainty>.
Essential decisions: <conclusions and rationale needed now, with source pointers>.

## Constraints

- <Essential rule carried directly> — source: <decision/ref, revision, section>.
- <User decision distinguished from proposal/unknown> — source: <provenance>.

## Next actions

1. Recheck current task/checkpoint/input revisions, workspace and start predicates.
2. <Concrete next operation and expected result>.
3. <Verification>.

Stop or checkpoint when <completion, blocking predicate or assignment boundary>.

## Completion

Complete when <observable acceptance>. Return <checks, result, source revision,
artifact links and material limitations>. A link alone is not a test result.

## Evidence

- report: [<observed result and revision>](https://<evidence-target>)

## Read only as needed

Startup scope/budget: <selected initial sources, measured allowance and basis>.
Working reserve: <room for execution, results, verification and checkpoint>.
Expansion boundary: <when to narrow/split/checkpoint; label unmeasured capacity>.

| Source | Section | Open when / why |
|---|---|---|
| <direct selected link> | <precise anchor> | <question it answers> |

<!-- arbiter:checkpoint · PROTOCOL.md#checkpoints · recheck inputs before resuming -->
```

For unresolved decisions, populate `conflicts` with each exact choice and source;
do not prefer newer timestamps. Replace `unknown` only after checking it. Owner
is canonical on the task; phase order is not a dependency. Keep produced outputs
in Artifacts, plan references in optional Plan inputs before Checklist, and row
anchors/ticket links accessible when extracting history verbatim to detail.

Before handoff, replace next actions/gates and carry essential constraints forward;
put narration in linked append-only detail. Through the supported CAS writer,
`previous` must name the exact old current bytes; the writer retains immutable
history before replacement. Re-read and validate. Normal bootstrap does not read
history. Preview/export tooling and manually assembled context obey
the same whole-packet budget: 6 KiB target, 10 KiB ordinary ceiling, explicit larger
maximum and reason if needed. Count the override, protocol excerpts and manifest;
never silently truncate. Offline packets label missing capabilities and live
rechecks. Excluded private sources cannot become exported prose or metadata.
The packet budget is not a cumulative limit on later relevant reads or host
instructions. Measure packet bytes, task/source reads and known host overhead
separately; never infer a complete session size from a small handoff file. Bound
startup and subsequent expansion separately so the task retains working room;
numeric session allowances need calibration, not the packet ceiling copied over.
