# Reviewed handoff

{"task":"tasks/verify-search-2026q3","checkpointRevision":"sha256:4705143ae47ffb2443f4631ac455853eca76890090b403521cd660808b322684","readiness":"review-required","reasons":["input selected-0: stale revision"],"verified":"2026-09-14T12:00","mode":"planning snapshot; resolve readiness before implementation","recheck":"Resolve KB UUID and repository identity to receiver-local paths. Re-read current task/checkpoint and selected source revisions; verify branch/worktree, owner, current authority and live dependency predicates before implementation. No network or repository state was fetched. Assignment grants no publication, merge, messaging or external-system authority.","limitations":"Requires the identified KB and its installed protocol for implementation. All packets remain snapshots; no atomic read or external-editor guarantee.","omissions":["Prior checkpoints and transaction journals are never expanded.","Unselected optional sources are not loaded into the packet."],"override":{"maxBytes":14336,"reason":"Synthetic measurement retains essential directives and current exporter framing; no session limit implied."},"manifest":[{"source":"kb:tasks/verify-search-2026q3.md","revision":"sha256:ade5f7f280919b42367c1375daab0178fbcf4219ebe902d36d7601ef073df1ab","purpose":"required assignment input","included":"full"},{"source":"kb:PROTOCOL.md","revision":"sha256:ecb263d0a9ace31e75f97231c6dcb7ab4ff9047f6542088b6b87c36e74f52aa2","purpose":"required assignment input","included":"checkpoints excerpt"},{"source":"kb:types/_base.md","revision":"sha256:67c8f74d3ae6d5bb2f065de56c098bdb5bb1433a27d34c1ceaad021045931a29","purpose":"required assignment input","included":"revision only; open selected source when needed"},{"source":"kb:types/task.md","revision":"sha256:a3e7ba965f628e2c918ba710d3c7dd35ef678073a0115b262a4d6b04e7cad10f","purpose":"required assignment input","included":"revision only; open selected source when needed"},{"source":"kb:tasks/search-flight-2026q3.md","revision":"sha256:b8f01087af8acee9a20adc4eb71d1e39c6ad5cbfea31aecb8d151ebd97aef34b","purpose":"flight design and eligibility gates","included":"revision only; open selected source when needed"},{"source":"kb:tasks/verify-search-2026q3/investigation.md","revision":"sha256:2db862deaa30590bb7341395d75f5ac5eb3237b5dc7dbc3cf0de5fb4e700b6f8","purpose":"essential conclusion and optional whitespace question","included":"revision only; open selected source when needed"}],"bytes":13543}

## Included: tasks/verify-search-2026q3/checkpoint.md

---
role: checkpoint
task: tasks/verify-search-2026q3
kb: urn:uuid:0abf5a43-4030-4611-a17b-3be82a51e3a2
repository: urn:synthetic:search
branch: synthetic
revision: synthetic-fixture
owner: 'synthetic-session'
readiness: ready
captured: 2026-09-14T12:00
verified: 2026-09-14T12:00
previous: none
inputs:
  input-0: { source: 'kb:tasks/verify-search-2026q3.md', revision: 'sha256:ade5f7f280919b42367c1375daab0178fbcf4219ebe902d36d7601ef073df1ab', observed: '2026-09-14T12:00', purpose: 'required assignment input' }
  input-1: { source: 'kb:PROTOCOL.md', revision: 'sha256:ecb263d0a9ace31e75f97231c6dcb7ab4ff9047f6542088b6b87c36e74f52aa2', observed: '2026-09-14T12:00', purpose: 'required assignment input' }
  input-2: { source: 'kb:types/_base.md', revision: 'sha256:67c8f74d3ae6d5bb2f065de56c098bdb5bb1433a27d34c1ceaad021045931a29', observed: '2026-09-14T12:00', purpose: 'required assignment input' }
  input-3: { source: 'kb:types/task.md', revision: 'sha256:a3e7ba965f628e2c918ba710d3c7dd35ef678073a0115b262a4d6b04e7cad10f', observed: '2026-09-14T12:00', purpose: 'required assignment input' }
  selected-0: { source: kb:tasks/search-flight-2026q3.md, revision: sha256:b8f01087af8acee9a20adc4eb71d1e39c6ad5cbfea31aecb8d151ebd97aef34b, observed: 2026-09-14T12:00, purpose: flight design and eligibility gates }
  selected-1: { source: kb:tasks/verify-search-2026q3/investigation.md, revision: sha256:2db862deaa30590bb7341395d75f5ac5eb3237b5dc7dbc3cf0de5fb4e700b6f8, observed: 2026-09-14T12:00, purpose: essential conclusion and optional whitespace question }
predicates:
  workspace: { state: met, owner: 'synthetic-session', condition: verify receiving workspace and current authority, evidence: isolated synthetic exercise authorized }
conflicts: []
---

# Verify search compatibility

## Assignment

Verify empty results and stable anchors at tasks/search-flight-2026q3.md#^verify. Synthetic only.
Ranking and release are outside scope. Task owns lifecycle and checklist.

## Authority

Local synthetic checks only; no agent launch or external actions. Recheck owner,
input revisions and design gate before implementation. Export grants no authority.

## Verified state

Design is complete at the observed flight revision. Predecessor directive:
empty queries return no results; preserve stable anchors. This prevents accidental
scope expansion. Provenance: tasks/search-flight-2026q3/design.md#directive.
No implementation or human acceptance is claimed.

## Constraints

Keep refs/history and human status control. Review all actionable input before work;
export acknowledges nothing. Installed protocol and base/task schemas are mandatory.
Do not infer eligibility from row order, timestamps or snapshot readiness alone.

## Next actions

1. Recheck flight design, task owner, checkpoint hashes and pending input.
2. Verify empty-query behavior and anchors locally; consult the whitespace section
   only if the meaning of empty needs clarification.
3. Record checks and replace this checkpoint; stop before release or status changes.

## Completion

Evidence covers empty queries and unchanged anchors, with limitations and current
hashes. A human reviews completion. Checkpoint before exhausting working reserve.

## Evidence

- source: [Design: Directive section](tasks/search-flight-2026q3/design.md)

## Read only as needed

Startup: flight, task, current handoff, full installed protocol, base/task schemas,
and pending input. Measure before admission; reserve execution/verification room.
Host capacity is unknown; the evaluator proposes byte allowances, not token limits.

| Source | Section | Question |
|---|---|---|
| [Plan](tasks/search-flight-2026q3/plan.md#acceptance) | Acceptance | Is requested work in scope? |
| [Investigation](tasks/verify-search-2026q3/investigation.md#whitespace-case) | Whitespace case | Does whitespace count as empty? |
| [Ticket](tasks/verify-search-2026q3/ticket.md#scope) | Scope | What was requested? |
| [PR](tasks/verify-search-2026q3/pr.md#changes) | Changes | What may change? |

<!-- arbiter:checkpoint · PROTOCOL.md#checkpoints · recheck inputs before resuming -->

## Included: tasks/verify-search-2026q3.md

---
id: verify-search-2026q3
type: task
title: Verify search compatibility
status: todo
owner: synthetic-session
updated: 2026-09-14T12:00
parent: tasks/search-flight-2026q3
checkpoint: tasks/verify-search-2026q3/checkpoint.md
---

# Verify search compatibility

## Summary

Verify empty queries return no results and stable anchors survive. Design is settled.
Use the current checkpoint for execution; humans manage status and completion.

## Plan inputs

- plan: [Larger plan: Acceptance section](tasks/search-flight-2026q3/plan.md)

## Checklist

- [ ] Verify empty result and stable anchors <!-- ^verify -->
      see: [Current handoff](tasks/verify-search-2026q3/checkpoint.md)

## Artifacts

- ticket: [Synthetic ticket: Scope section](tasks/verify-search-2026q3/ticket.md)
- pr: [Synthetic PR: Changes section](tasks/verify-search-2026q3/pr.md)

## Detail docs

- [[investigation]] Empty-query rationale (investigation) -> tasks/verify-search-2026q3/investigation.md
- [[ticket]] Synthetic ticket (note) -> tasks/verify-search-2026q3/ticket.md
- [[pr]] Synthetic PR (note) -> tasks/verify-search-2026q3/pr.md

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · preserve history -->

## Included: PROTOCOL.md#checkpoints

## Checkpoints

A task is one independently assignable, verifiable outcome. Split independent
outcomes into child or related tasks, keeping their original ticket links. A long
row that only explains the same outcome gets a detail document, not a new task.
Goals coordinate broader outcomes, usually across tasks/weeks; duration alone is
not a rule for creating one. Coordinators select work and maintain shared choices;
they do not own every implementation log. Optional task `phase` groups work without
implying blocking or permission. Keep nesting shallow and blockers explicit.

A task may have one accountable `owner` (or `unassigned`) and optional `checkpoint:
tasks/<id>/checkpoint.md`. The fixed file is a replaceable current continuation
view, a distinct role from append-only tier-3 history. Required frontmatter:
`role: checkpoint`, `task` object ref, `kb` matching this protocol's `kb-id` UUID
URN, `repository` URL/logical URN, observed `branch` and `revision`, observed
`owner`, `readiness`, `captured`, `verified`, and `previous` (none or SHA-256).
End with `<!-- arbiter:checkpoint · PROTOCOL.md#checkpoints · recheck inputs before resuming -->`.

Required body sections: Assignment (outcome/scope/exclusions), Authority (actions
and authorization source), Verified state (observed result/stopping point),
Constraints (current rules with provenance), Next actions (1–3 and stopping
condition), Completion (acceptance), Evidence (ordinary typed Markdown links).
Distinguish facts, user decisions, proposals and unknowns. Carry all essential
constraints directly, citing history only as optional support.

Use nonempty `inputs` and `predicates` nested mappings; keys are stable kebab-case
record IDs. Each value is a flat flow mapping, as in type schemas:

```yaml
inputs:
  task: { source: kb:tasks/example-2026q3.md, revision: sha256:<hex>, observed: 2026-09-07T12:00, purpose: assignment and current owner }
predicates:
  start: { state: met, owner: agent-session, condition: workspace and authorization verified, evidence: current session observation }
conflicts: []
```

Inputs require source, revision, observed time and purpose/selected section.
Include the task, PROTOCOL.md, types/_base.md, types/task.md and selected code,
decision/dependency inputs. KB/repo relative paths use `kb:`/`repo:` and byte hashes;
external HTTP(S) sources use immutable observed revisions or `unknown`. Exclude
checkpoints, dashboard and transaction/history expansion. Predicates require
state (`met | unmet | unknown`), owner, condition and evidence. Record unresolved
decisions with provenance in `conflicts`; leave an explicit empty sequence only
when resolved. New timestamps never settle contradictory decisions.

Readiness (`unprepared | ready | waiting | review-required`) is independent of
execution status and sticky review. Missing content is unprepared; changed or
unverified inputs, conflicting decisions, unknown owners/gates, identity mismatch,
pending task proposals or task review require review; an unmet predicate is
waiting. Observations can downgrade readiness but never silently promote it.
Unknown/absent task owner is not a claim of ownership. Receivers check source
revisions, branch/worktree, authority and live predicates before implementation.
Static validation cannot prove authored prose or external state.

Replacement uses the shared write path with explicit CAS. The writer archives
old exact bytes to `tasks/<id>/checkpoints/<sha256-hex>.md` under the local writer
lock before installing current bytes; `previous` must match that hash. It refuses
pending owning-task proposals and overwriting legacy detail at the reserved path.
History is immutable and may retain extra versions from interrupted captures.
Retain it and `.arbiter/transactions/` in backups. Ordinary detail remains
append-only; the checkpoint role is its explicit exception. Normal reads do not
follow previous versions; history is omitted from default projections/raw HTTP.

Bootstrap a receiving session with this installed protocol once, the selected
task and its current checkpoint, then only named relevant sections. No recursive
handoffs or sibling bulk reads. Resolve portable KB/repository identities to local
paths. An offline packet includes applicable protocol excerpts and essential
constraints, labels snapshot limits and missing capabilities, and supports only
planning until workspace/authority/live predicates are checked. A handoff does
not grant publication, messaging, merge or external-system authority.

Initial size targets: overview 4 KiB UTF-8, task Summary 1 KiB, full checklist row
400 Unicode code points, complete handoff 6 KiB. Warn at these targets; suggest
scoped splitting or verbatim detail extraction, retaining anchors and identifiers.
Normal export ceiling is 10 KiB; require an explicit larger byte maximum and reason
recorded in the preview above it. Count ALL emitted context: metadata, manifests,
protocol excerpts, constraints and inlined sources, including the override itself.
Never truncate. Larger budgets do not override privacy, readiness or authority.
Use checkpoint draft/preview/capture and handoff preview/export tooling or the local
task editor. Capture and export recheck reviewed source bytes; refresh stale previews.

Installed upgrades are explicit. Older manual packets remain ordinary documents;
retain their bytes when importing. Init assigns a fresh `kb-id: urn:uuid:<uuid>`;
replicas preserve it, independent forks deliberately change it. Never copy the
bootstrap protocol over an installed KB to adopt a design without authorization.


