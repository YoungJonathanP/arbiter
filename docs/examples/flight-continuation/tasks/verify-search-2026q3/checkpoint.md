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
