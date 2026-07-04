# Arbiter

> Work, recorded. Impact, attested.

Arbiter is an agentic knowledge-base tool that captures the work you perform and renders it as progressively disclosed summaries — inspectable by humans at a glance, and by agents with minimal context. It tracks what's done, what's in flight, what's blocked (and by what), and builds the attestation trail that proves your impact when review season comes.

## Mission

Build, track and create hi-fidelity datapoints meant to improve daily performance by capturing work performed and rendering impactful, meaningful attestation summaries.

## The three tiers

Progressive disclosure is the core design principle: each tier holds just enough to decide whether to go deeper, so neither a human nor an agent is ever handed more context than the question requires.

| Tier | View | Contains |
|------|------|----------|
| **1 — Dashboard** | Card board (Tasks, Goals, Meetings, Journal — extensible) | Up to 5 most recent items per card, status dot + title + recency. One screen answers "where did I leave off?" |
| **2 — Card / Item** | Full item list per card; item detail page | High-level summary, status checklist (done / in-flight / blocked-with-blocker-link / todo), hyperlinked artifacts (PRs, design docs, Figma, Confluence), links into tier 3 |
| **3 — Documents** | Rendered detail documents | Plans, investigations, reports, notes — the full-context material |

## Storage model

Markdown files on disk with YAML frontmatter. Agents read and write them with plain file tools — no API required — and the UI is a renderer over the files.

```
arbiter-data/
├── DASHBOARD.md                  # tier 1: index, ≤5 recent per card
├── tasks/
│   ├── <task-slug>.md            # tier 2: frontmatter + summary + checklist + artifacts
│   └── <task-slug>/
│       ├── plan.md               # tier 3: detail documents
│       └── investigation.md
├── goals/
├── meetings/
└── journal/
```

## Status

**v0 — clickable visual prototype.** Open [`prototype/dashboard.html`](prototype/dashboard.html) in a browser. It is fully self-contained (no build, no network) and demonstrates:

- Tier 1 board with recent-5 truncation and status legend
- Tier 2 card lists with status filters, and item detail pages with checklists, blocker links, artifacts, and tier-3 links
- Tier 3 rendered documents
- A **"View as agent"** toggle on every view, showing the exact markdown file an agent would read/write for that view

Sample data is realistic (drawn from actual project work) so the design can be evaluated against real shapes of information.

## Roadmap (not yet built)

- Real file storage + renderer (the prototype embeds sample data)
- Capture pipeline: automatic capture from agent sessions, plus a "note for later" inbox for work done outside agentic workflows
- Status-tag maintenance and blocker resolution tracking
- Timeline and impact/attestation reports
- Search
