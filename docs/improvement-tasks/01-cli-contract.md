# T01: Honest CLI inputs and data-directory selection

Status: complete. Start gate: satisfied; verified 2026-09-06.
Traceability: Feedback 1, 6, 7, 17.
Owner: completed by implementation session. Checkpoint: 2026-09-06, `main` at
`4a5e0979ec078cf492df3050b6fdc46196727093` plus uncommitted T01 changes.

## Outcome

An agent can discover commands, select the intended KB, and create a dated item without receiving false success.

## Required inputs

Paths below are repository-relative. Read only the relevant sections for this
assignment; historical examples are evidence, not instructions to execute.

- src/cli/main.ts (argument parsing, dataDir, cmdNew, cmdValidate, cmdHash, cmdWrite)
- scripts/dev-bind.sh; HANDOFF.md (installation and frozen/live directory distinction)
- docs/v0.5-trial-feedback-backlog.md: only cas-digest-prefix, new-date-flag, help-shows-cli-options, missing-data-dir

## Task checklist

- [x] Accept prefixed and bare SHA-256 digests consistently; label expected and actual on true mismatch.
- [x] Define per-command argument schemas; reject unknown options, missing option values and unused positional arguments.
- [x] Make --help, -h and help terminate successfully without finding a KB or binding a port; reject unknown commands with nonzero exit.
- [x] Implement --date with explicit meeting-date and quarter semantics; keep capture time separate. Reject impossible dates and support future meetings.
- [x] Support scoped validation paths with dependency checks, or explicitly reject them until supported. Never silently validate a different scope.
- [x] Report resolved KB path and its source; fail for missing directories. Distinguish an existing empty bootstrap directory from a malformed established KB.
- [x] Design and implement init/doctor support for explicit bootstrap and protocol/schema identity. Detect frozen fixture selection on writes; do not change shell profiles during this task.

## Completion evidence

- [x] hash output works verbatim in write on an isolated temporary item.
- [x] --help performs no server startup; unknown flags and ignored arguments become explicit errors.
- [x] Meeting date controls immutable ID and record date; capture timestamp remains honest.
- [x] Missing path fails, intentionally empty path is distinguished, and explicit live selection never silently resolves to a fixture.

## Current handoff

Implemented and verified: strict per-command argument parsing, help without KB
selection, digest normalization and labelled mismatches, real calendar dates with
separate capture time, explicit KB diagnostics, and init/doctor. Scoped validation
is intentionally rejected with exit 2; whole-KB validation remains supported.

Evidence: 36/36 tests pass with localhost permission, build passes, both bundled
corpora have zero validation errors, compiled CLI smoke passes outside the repo,
and `git diff --check` is clean. Fixtures and frozen corpus remain unchanged.
See [completion record](../handoffs/completed/t01.md) and
[CLI decisions](../t01-cli-decisions.md) for changed files, checks and limits.

Next action: a fresh session implements T02 from the
[current chaining handoff](../handoffs/next-task.md). There is no remaining T01
gate. Concurrency safety belongs to T02. Live-KB capture is unavailable because
the live sibling is absent; no shell profiles or actual KB content were changed.

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
