# T08: Durable knowledge and evidence-backed reports

Status: complete. Verified 2026-09-08 on main, base HEAD
`bfdc5519cc730fb0e23bb840b5ac83d6c7bddb66`, with preserved uncommitted T07 and
new uncommitted T08 changes. Owner: current implementation session.
Traceability: Original knowledge/attestation objective; schema extensibility finding.
Completion: [T08 evidence](../handoffs/completed/t08.md).

## Outcome

Reusable decisions and findings remain discoverable after task closure, and reports explain impact with traceable evidence.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- README.md (mission); docs/launch-plan.md (attestation and search)
- src/core/model.ts; src/core/schema.ts; src/core/corpus.ts; src/core/facts.ts
- src/core/indexdb.ts; src/core/dashboard.ts; accomplishment/type schema conventions
- src/core/discovery.ts; src/cli/args.ts; src/cli/data.ts; src/web/server.ts
- docs/v0.4.13-discovery.md; test/discovery.test.ts; test/handoff.test.ts

## Task checklist

- [x] Define durable decision/finding records with scope, provenance, supersession and review state; start with the smallest useful type set.
- [x] Make promised schema extensibility real across directory enumeration, creation, validation, index and cards, or explicitly narrow the supported promise.
- [x] Promote completed work into accomplishment candidates without inventing outcomes or treating a link as verification.
- [x] Record observed evidence and unresolved verification separately; preserve sources and archived records.
- [x] Implement date-ranged Markdown reports with impact, evidence and uncertainty; deduplicate repeated reporting of the same outcome.
- [x] Apply the shared visibility policy to all report text and source discovery.
- [x] Verify dropped/superseded work is not reported as completed impact.

## Completion evidence

- [x] An added supported schema works through capture, queries and rendering without another hardcoded type table.
- [x] A report reconstructs an outcome from archived evidence with clear source links.
- [x] Unverified claims are distinguishable from verified outcomes.
- [x] Private material is excluded and the same accomplishment is not counted repeatedly through related tasks.

## Current handoff

T08 is complete. Durable decisions/findings have scope, provenance, review and
acyclic supersession. One catalog feeds supported type registration; schema-only
custom type support is explicitly withdrawn. Both new types work through CLI
capture, validation, index queries, bounded search, cards and web detail views.

`promote <work-ref> --date <date>` emits an editable unverified accomplishment;
capture uses existing CAS write. `report --since <date> [--until <date>]` emits
Markdown with archive/source links, deduplicated outcome identities, recorded
observations and uncertainty. Private/redacted, dropped, superseded, non-done,
review/staged source work cannot inflate reports. Links are never independent
verification. Different identities for one outcome require authoring review.

Full tests **102/102**, build, diff and skill validation passed. Frozen validation
remains **26/0/0** and **23/0/1**, all **50 hashes unchanged**. The
[completion record](../handoffs/completed/t08.md) records exact revision/manifest,
checks and limits. [Decision](../v0.4.14-knowledge-evidence.md) and
[synthetic report](../examples/impact/REPORT.md) explain the implemented contract.
Protocol/base and accomplishment/decision/finding now 0.4.14; other concrete types
remain 0.4. Legacy protocol 0.4.6/8/9/10/11/12/13 and accomplishment 0.4 accepted.
No installed KB was upgraded. Live capture remains unavailable; frozen and supplied
comparison corpora were preserved.

Next action belongs to T09: recheck workspace and its external read-only sources,
then prepare one dry-run migration manifest. Live migration still needs explicit
target selection, compatibility resolution and verified backups. Follow the
[current handoff](../handoffs/next-task.md); do not redo T08.

## Capture before handing off

- [x] Replace Current handoff with verified state, exact next action and remaining gate.
- [x] Link the tested revision, checks performed and material limitations.
- [x] Preserve still-applicable constraints; move detailed logs into linked history.
- [x] Update this packet and the [execution index](../improvement-plan.md).
- [x] Use the [handoff template](../templates/task-handoff.md) for a fresh session.
