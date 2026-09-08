# Next agent: implement T01, then prepare the next handoff

Current task: T01 — honest CLI inputs and data-directory selection.
Readiness: ready. Implementation has not started.
Prepared: 2026-09-06. Repository: YoungJonathanP/arbiter.
Observed branch: main. HEAD: 4a5e0979ec078cf492df3050b6fdc46196727093.
Local checkout: /Users/jonathanyoung/Documents/Work/arbiter.
On another machine, resolve the repository locally; do not assume this path exists.

## Assignment

Implement [T01](../../improvement-tasks/01-cli-contract.md), verify its acceptance
criteria, and prepare this file for a fresh agent to take the next ready task.
The task includes CLI input correctness and explicit init/doctor support.
Complete the full task packet, including init/doctor.

Work on this one assignment. At completion, create the successor handoff and
return its link and launch prompt to the human. Starting another session or
executing the successor task is not part of this handoff.

## Bootstrap

1. Inspect repository instructions, branch, HEAD and worktree changes. Read
   CLAUDE.md for repository conventions. Preserve existing planning documents.
2. Read the T01 packet. Inspect src/cli/main.ts and package.json, then only the
   specific supporting sources named by that packet as needed.
3. Consult backlog items 1, 6, 7 and 17 only when their rationale is needed.
   No Finance Hub material or previous session transcript is needed for T01.

Starting worktree contains uncommitted planning changes in README.md, HANDOFF.md
and docs/. Preserve them; inspect any implementation changes since this baseline.

## Implementation checklist

- [ ] Accept bare and sha256-prefixed hashes; distinguish format errors from real
  contention and print labelled expected/actual values on mismatch.
- [ ] Validate arguments per command. Unknown flags, missing values, unknown
  commands and ignored positional paths must not look like successful execution.
- [ ] Make help, --help and -h exit without resolving a KB or binding a port.
- [ ] Implement --date and calendar validation; meeting date and quarter semantics
  are explicit, future dates work, and capture timestamps remain separate.
- [ ] Implement scoped validate, or explicitly reject path arguments as permitted
  by T01. Document that choice and its limitation.
- [ ] Report the resolved KB and selection source; reject nonexistent directories,
  distinguish empty bootstrap state, and detect accidental frozen-corpus writes.
- [ ] Implement explicit init/doctor behavior against temporary directories, with
  protocol/schema identity checks and no changes to the user's shell profiles.

## Constraints and verification

- Use temporary or synthetic corpora for mutation tests. Do not change the frozen
  arbiter-data/ or fixture bytes to make tests pass. Do not import the USB KB.
- ARBITER_DATA was observed pointing at the frozen in-repo corpus; the live sibling
  was absent. Recheck resolution, pass --data explicitly, and record live-KB capture
  as unavailable if still absent. That does not block isolated implementation.
- The shared atomic commit/arbitration redesign belongs to T02. T01's digest-format
  repair must not be described as resolving concurrent-write safety.
- Preserve current supported CLI flows. Protocol changes need a version bump and
  decision note. Do not change installed profiles, publish, push or commit without
  the applicable user authority; repository instructions require asking to commit.
- Add CLI regressions with temporary inputs; run npm test and npm run build.
  The earlier 29 passing tests are historical evidence. Localhost tests may need
  sandbox approval; distinguish environment failures from product failures.
- Check git diff --check. Validate both bundled corpora explicitly with the source
  CLI as read-only checks; exercise new writes/init only in temporary locations.

## Chain the handoff after completion

Preserve these instructions in every successor. This file is the current entry
point: replace current state; keep session history in completion records.

1. Verify every required task and acceptance checkbox. Mark the task and its
   execution-index checkbox complete only with evidence. Record any intentionally
   supported fallback, such as explicitly rejecting scoped validation arguments.
2. Write docs/handoffs/completed/t01.md (use the completed task ID thereafter):
   outcome, changed files, tests, limitations, decisions, HEAD and uncommitted
   state. Preserve the outgoing packet there or in a unique historical file.
   Never overwrite an existing completion record silently.
3. Select the next incomplete task whose start gate is satisfied from the table
   in docs/improvement-plan.md. Default successor after T01 is
   [T02](../../improvement-tasks/02-safe-writes.md). Recheck its packet and current
   implementation before declaring it ready. Record prerequisite gaps explicitly.
4. Replace docs/handoffs/next-task.md with a self-contained packet for that task:
   outcome, exact first action, required inputs, verified starting state, gates,
   constraints, acceptance checks and these chaining instructions. Carry relevant
   interface changes directly; earlier handoffs are optional evidence. Stay within
   6 KiB UTF-8 without silently truncating constraints.
5. Verify local links, size, task identity and agreement with the execution index.
   Return a clickable link and this copyable launch prompt, adapted if necessary:
   "Open docs/handoffs/next-task.md in the Arbiter checkout. Complete its current
   assignment and, after verification, create the chaining handoff for a new
   agent exactly as instructed."
6. End the session after delivering that handoff. A human opens the new session.

If the task is incomplete, do not advance the chain: update this file to resume
the same task with verified progress, failed checks, the blocker and exact next
action. Do not mark it complete because the session is ending. If all tasks are
complete, replace this entry point with the verified completion summary and state
that no successor is pending.
