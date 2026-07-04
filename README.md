# Arbiter

> Work, recorded. Impact, attested.

Arbiter is an agentic knowledge-base tool that captures the work you perform and renders it as progressively disclosed summaries — inspectable by humans at a glance, and by agents with minimal context. It tracks what's done, what's in flight, what's blocked (and by what), and builds the attestation trail that proves your impact when review season comes.

## Mission

Build, track and create hi-fidelity datapoints meant to improve daily performance by capturing work performed and rendering impactful, meaningful attestation summaries.

## The three tiers

Progressive disclosure is the core design principle: each tier holds just enough to decide whether to go deeper, so neither a human nor an agent is ever handed more context than the question requires.

| Tier | View | Contains |
|------|------|----------|
| **1 — Dashboard** | Card board (Tasks, Goals, Meetings, Journal, Accomplishments — extensible) | Up to 5 items per card ordered by relevance: active items (blocked / in-flight / todo) by recency first, done items last, aged off the card 7 days after completion. One screen answers "what have I done recently, what should I do next?" |
| **2 — Card / Item** | Full item list per card; item detail page | High-level summary, time fields (started / estimated completion / due, with overdue flagging), status checklist (done / in-flight / blocked-with-blocker-link / todo), hyperlinked artifacts (PRs, design docs, Figma, Confluence), links into tier 3 |
| **3 — Documents** | Rendered detail documents | Plans, investigations, reports, notes — the full-context material |

Status colors: **todo = white**, **done = green**, **in-flight = blue**, **blocked = red**. Accomplishments are records rather than work items — review-ready impact statements linked back to their source items and artifacts, built for performance-review inspection by humans and agents alike.

## Storage model

Markdown files on disk with YAML frontmatter. Agents read and write them with plain file tools — no API required — and the UI is a renderer over the files.

```
arbiter-data/
├── PROTOCOL.md                   # agent contract: per-tier navigation + repair rules
├── DASHBOARD.md                  # tier 1: index, ≤5 relevant per card
├── tasks/
│   ├── <task-slug>.md            # tier 2: frontmatter + summary + checklist + artifacts
│   └── <task-slug>/
│       ├── plan.md               # tier 3: detail documents
│       └── investigation.md
├── goals/
├── meetings/
├── journal/
└── accomplishments/
```

## Agent protocol (top-level priority)

Agents may operate Arbiter with full autonomy, so clean navigation and minimal context are load-bearing:

- **`PROTOCOL.md` is read once** — it defines how to read/write each tier, checklist mark semantics, the tier-1 ordering rule, and capture etiquette.
- **Every other file ends with a single scoped pointer line** (`<!-- arbiter:tier-2 · PROTOCOL.md#tier-2 · … -->`) naming its tier and the section that governs it. Instructions are never repeated per file, so visiting an item never loads navigation guidance meant for its neighbors.
- **Pointers are the only navigation**: tier-1 entries end with `-> path`; tier-2 links tier-3 docs explicitly. An agent opens exactly the files its current tier points to — no bulk reads.
- **Human entries are always valid**: a title plus prose is an acceptable file. Missing fields get defaults (status=todo, type from directory, updated from mtime), and the next agent touch normalizes the entry without ever discarding human prose. Humans get friendliness; agents get safeguards.

## Status

**v0.1 — clickable visual prototype.** Open [`prototype/dashboard.html`](prototype/dashboard.html) in a browser. It is fully self-contained (no build, no network) and demonstrates:

- Tier 1 board with relevance ordering (active first, done last, 7-day age-off), truncation, and status legend
- Tier 2 card lists with status filters and due dates, and item detail pages with time fields, checklists, blocker links, artifacts, and tier-3 links
- Tier 3 rendered documents, plus the rendered `PROTOCOL.md` agent contract
- A collapsible left sidebar for fast navigation across all cards and items
- An Accomplishments card with review-ready impact statements linked to source items
- A raw human entry ("payout report ask") showing the pending-normalization safeguard
- A **"View as agent"** toggle on every view, showing the exact markdown file — including its scoped protocol pointer line — an agent would read/write for that view

Sample data is realistic (drawn from actual project work) so the design can be evaluated against real shapes of information.

## Roadmap (not yet built)

- Real file storage + renderer (the prototype embeds sample data)
- Capture pipeline: automatic capture from agent sessions, plus a "note for later" inbox for work done outside agentic workflows
- Status-tag maintenance and blocker resolution tracking
- Timeline and impact/attestation reports
- Search
