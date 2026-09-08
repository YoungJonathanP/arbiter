# T03: Fresh projections, privacy and review state

Status: complete. Verified 2026-09-07; T05 field coordination recorded.
Traceability: Feedback 3; private inclusion and status-loss findings.
Owner: completed by current session. Checkpoint verified: 2026-09-07.

## Outcome

Dashboard, queries and human views reflect current file facts without leaking private data or losing execution state.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- src/core/dashboard.ts; src/core/facts.ts; src/core/indexdb.ts
- src/core/queries.ts; src/core/triage.ts; src/web/server.ts
- docs/grammar.md sections 7, 9 and 13; docs/v0.5-decisions.md

## Task checklist

- [x] Add the same-minute status-change regression and delayed arbitration regression; incremental and full outputs must agree.
- [x] Refresh from current facts immediately. Current regen already scans all files; remove timestamp-only truth decisions before introducing a persistent hash-based cache.
- [x] Separate event time from content revision and commit metadata if required. Preserve deterministic arbitration; do not insert wall clock into the pure resolver as a shortcut.
- [x] Centralize visibility policy for dashboards, query results, previews and future exports, including derived relationships and previously carried dashboard entries.
- [x] Separate review-needed metadata from todo/in-flight/blocked status; specify migration for legacy needs-review values whose original state is unknown.
- [x] Check child reachability when a terminal parent ages off, becomes archived, or is unresolved; every active child needs a reachable route.
- [x] Share projection rules across CLI and renderer. Label freshness using verified inputs, not only a last-generated display string.

## Completion evidence

- [x] Same-minute, older-timestamp and quoted-timestamp edits cannot strand a stale mark.
- [x] Private content, titles and relationship/count side channels are excluded by the selected agent visibility policy.
- [x] Triage flags a stale blocked task without erasing its blocked status or blocker.
- [x] Deleting and rebuilding the derived cache preserves the same visible state and reachable active set.

## Current handoff

Completed on main, HEAD `4a5e0979ec078cf492df3050b6fdc46196727093`, with T01–T03
changes uncommitted. Current facts drive both regeneration modes; shared privacy
filtering precedes relationships/counts and human/agent previews. Separate review
metadata preserves execution status and blockers; legacy prior state stays unknown.
Children remain reachable across parent lifecycle changes. Contract 0.4.9 and T05
field coordination are recorded. Tests 64/64, build/diff and both read-only corpus
validations pass; frozen tracked bytes unchanged. Live KB remains unavailable.

[Completion evidence and limits](../handoffs/completed/t03.md).
Next action: a new session executes [T04](04-parser-recovery.md) using the
[current chaining handoff](../handoffs/next-task.md). No remaining T03 gate.

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
