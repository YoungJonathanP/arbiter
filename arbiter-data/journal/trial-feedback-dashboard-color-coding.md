---
id: trial-feedback-dashboard-color-coding
type: journal
title: Trial feedback dashboard color coding
date: 2026-07-15
created: 2026-07-15
updated: 2026-07-15T11:20
---

# Trial feedback dashboard color coding

## Summary

Feedback (2026-07-15): the dashboard should color-code work by the goal/epic that owns it — a goal and every task that rolls up to it (directly, or through an umbrella task) share one hue, so ownership is readable at a glance. Palette: a colorblind-safe ~10-color set (Okabe–Ito based) with distinct light- and dark-mode variants via CSS custom properties + `prefers-color-scheme`; tasks with no owning goal stay neutral.

Implemented same day in the read-only renderer (`src/web/server.ts`): each active goal gets a stable palette slot, and a left-edge accent + goal-colored title is applied on dashboard cards, directory rows, and nested sub-item lists. Renderer-only — no protocol/version change.

## Artifacts

- task: [Trial feedback](tasks/trial-feedback-2026q3.md#^color-coding)

<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · record: capture now, structure later -->
