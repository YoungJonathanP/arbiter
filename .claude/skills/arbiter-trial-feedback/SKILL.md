---
name: arbiter-trial-feedback
description: >-
  TEMPORARY (v0.5 trial only). Capture trial feedback — a change, fix, or idea
  wanted from using Arbiter — into the Trial feedback backlog. Use when the user
  says "log trial feedback", "dogfood feedback", "I'd like to see X changed",
  "add this to the feedback log", or reports a renderer/CLI/workflow gripe during
  the trial. Retired at v1.0 with the dev-trial binding.
---

# Trial feedback (provisional)

Scaffolding for the v0.5 dogfood trial (ends 2026-07-23). It defers to the
**arbiter** skill for all mechanics (bootstrap, CAS write-then-verify, regen,
validate); this only says WHERE trial feedback goes. Retired at v1.0 — tracked
in `tasks/retire-dev-trial-cli-binding-at-v1-0-2026q3`.

The backlog lives at `tasks/trial-feedback-2026q3` (nested under
`tasks/arbiter-trial-2026q3`). Each piece of feedback is one **journal entry**
(the narrative) linked from one **checklist step** on that task (the lifecycle).

To capture a piece of feedback:

1. `arbiter new journal "Trial feedback <short title>"` — write the request in
   `## Summary`: what's wanted, why, and (if known) where it lives in the code.
   Link the backlog task under `## Artifacts`.
2. Append a checklist step to `tasks/trial-feedback-2026q3` (CAS/verify per the
   arbiter skill): `- [ ] <one-line request>` with a `see:` continuation
   linking the journal entry. Flip it to `[x]` only when the change lands.
3. `arbiter regen`, then `arbiter validate` — finish green.

Do not scatter feedback into unrelated items or the dashboard; it all threads
through the backlog task so one read shows every open request.

<!-- provisional trial skill — defers to the arbiter skill and PROTOCOL.md -->
