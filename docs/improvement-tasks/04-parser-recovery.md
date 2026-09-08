# T04: Preserve navigable entries through malformed input

Status: complete. Start gate: Complete; verified 2026-09-07.
Traceability: Feedback 5.
Owner: completed in T04 session. Checkpoint verified: 2026-09-07.

## Outcome

One human formatting error does not make an entire checklist or document/link section unusable.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- src/core/parse.ts; src/core/model.ts; src/core/serialize.ts
- src/core/normalize.ts; src/core/validate.ts; src/web/server.ts
- test/gates.test.ts; docs/grammar.md (opaque preservation and section productions)

## Task checklist

- [x] Represent valid entries and opaque malformed lines together, retaining original order and source locations.
- [x] Recover Artifacts and Detail docs per entry; evaluate the same failure pattern in checklists.
- [x] Report the exact line and expected production; distinguish a malformed entry from a broken target.
- [x] Preserve malformed bytes and valid links through normalization and round trips; do not silently skip or delete human material.
- [x] Render recognized links normally and unresolved text visibly with an actionable diagnostic.
- [x] Document accepted annotations and canonical link syntax in the versioned protocol/type templates.
- [x] Coordinate mixed-section semantics with T02's op application and postconditions.

## Completion evidence

- [x] A section containing many valid links and one annotated malformed link retains all valid links in the structured view.
- [x] Repeated normalization preserves content and is idempotent.
- [x] Diagnostics identify the actual offending line, including blank lines/frontmatter offsets.
- [x] Arbitration cannot mistake preserved malformed text for a successfully applied structured entry.

## Current handoff

Completed: valid checklist/link/doc entries coexist with opaque lines in order;
normalization preserves content; CLI and renderer diagnostics locate original
source lines and expected syntax. Parsed effects remain mandatory for arbitration.
Contract 0.4.10 and bootstrap/base guidance are versioned; older supported KBs
remain accepted. T01–T04 are uncommitted on main at
`4a5e0979ec078cf492df3050b6fdc46196727093`.

Verification: 68/68 tests, build and diff check pass. Source CLI: bundled corpus
26/0/0; fixtures 23/0/1 existing raw warning. Frozen SHA-256 manifests unchanged.
[Completion evidence and limits](../handoffs/completed/t04.md) records files,
source-map semantics and unavailable live capture. No T04 gate remains.
The [current chaining handoff](../handoffs/next-task.md) assigns T05; its next action
is to design checkpoint storage/lifecycle, without starting T06 tooling.

Working boundary: implement this packet's outcome and coordinate shared interfaces
with the named dependencies. Existing unrelated changes belong to their authors.
Use temporary/synthetic corpora for tests; preserve conformance fixture semantics.
Protocol changes need a version bump and decision note. Select the KB explicitly;
the shell environment currently selects the frozen in-repo corpus.

## Capture before handing off

- [x] Replace Current handoff with verified state, exact next action and remaining gate.
- [x] Link the tested revision, checks performed and material limitations.
- [x] Preserve still-applicable constraints; move detailed logs into linked history.
- [x] Update this packet and the [execution index](../improvement-plan.md).
- [x] Use the [handoff template](../templates/task-handoff.md) for a fresh session.
