# Logseq investigation

*Investigated 2026-07-04. Arbiter's README cites Logseq as the reference point for an "open-source local-first markdown architecture." That architecture has since been demoted at Logseq itself — as of May 2026 the product formally split into **Logseq OG** (markdown-canonical, maintenance mode) and **Logseq** (SQLite-canonical, the ongoing product). This investigation covers both sides and what each contributes to Arbiter.*

## The two architectures

### Logseq OG — files as truth (now maintenance mode)

Markdown/org files on disk are canonical. A formal parser (mldoc, OCaml/Angstrom — not regex) parses the graph directory into an in-memory **DataScript** database via the factored-out `deps/graph-parser` library; the UI reads and queries DataScript; edits are serialized back to the files. Git (via isomorphic-git) provides history. The core logic is split into headless libraries (`deps/graph-parser`, `deps/db`, `deps/outliner`, `deps/common`) that run both in the app and from the command line via nbb-logseq.

**Why the team abandoned it as truth** (from their [official rationale](https://discuss.logseq.com/t/why-the-database-version-and-how-its-going/26744)):

1. **Block-granularity writes against file-granularity storage.** Logseq's unit of thought is the block, but every block edit rewrites the whole markdown file. Transactional, safe block operations were impossible.
2. **Rename fan-out.** Renaming a page rewrites every file that references it — a distributed mutation with no transaction around it.
3. **Multi-client sync data loss.** Concurrent edits from multiple live clients merging at file level repeatedly lost user data. This was the single biggest driver: the DB was chosen "to ensure fast and reliable sync."
4. **Scale.** Graphs over ~2,000 pages took minutes to load; 300MB+ graphs failed to start; 50,000-page graphs were the design target the file model couldn't reach.
5. **Derived-state drift.** DataScript state and file state could diverge, and re-serialization sometimes clobbered files (e.g. the namespace-conflict data-loss bugs).

### Logseq DB — database as truth (released 2026)

SQLite is canonical (better-sqlite3 on desktop, SQLite WASM in the browser), storing blocks as serialized tree nodes keyed by stable IDs; DataScript remains the in-memory query layer. Markdown is now a *projection*, not a store. Key model changes:

- **Typed properties**: Text / Number / Date / DateTime / Checkbox / URL / Node, with defaults, choice lists, and validation — replacing freeform text properties.
- **Tags as classes**: tagging a node with `#Contact` applies that class's property schema to it; classes inherit via an `Extends` relation. The ontology is data, not code — tasks, journals, and cards are all built on it.
- **Unified nodes**: pages and blocks converge into one addressable "node" concept.
- **Real-time collaboration** and reliable sync — the features that required abandoning files as truth.
- **Typed queries and views**: kanban / gallery / calendar views are queries over typed properties.
- **Export is lossy**: plain markdown export "cannot capture all data in a graph"; only EDN export is full-fidelity.

Two late developments matter most to Arbiter:

- **Markdown Mirror** ([May 2026](https://discuss.logseq.com/t/whats-new-with-logseq-db-may-16th-2026/35020)): the DB continuously writes a plain-markdown projection of the graph to a folder, with stable block IDs embedded in comments so identity survives renames. Two-way sync (edits in the mirror flowing back to the DB) is in active development.
- **A real CLI + agent surface**: the CLI now ships with the app, runs multi-part queries headlessly, and an agent skill (`logseq-answer-machine`) ships for LLM question-answering over graphs. Agent access has become a product surface.

## What this means for Arbiter

Arbiter's central bet is the inverse of where Logseq landed: markdown files are canonical and *agents with plain file tools are the primary client*; the app is a renderer. The question is whether Logseq's retreat from files-as-truth undermines that bet.

### It doesn't — the failure modes don't transfer

Each reason Logseq abandoned files maps to a load Arbiter deliberately doesn't carry:

| Logseq's failure mode | Arbiter's position |
|---|---|
| Block edits rewrite whole files | The item file *is* the write unit; whole-file rewrite is the natural operation, not an amplification |
| Page renames fan out across files | Slugs are immutable addresses by design — renames don't exist. (Logseq DB arriving at stable IDs-in-comments confirms the same principle from the other direction) |
| Real-time multi-client sync loses data | Collaboration is turn-based (agent sessions + a human), with negotiate-on-conflict — not keystroke-level RTC |
| 50k-page graphs | A personal work graph accrues hundreds of items per quarter, with 7-day age-off and archive rolls bounding the hot set |
| Derived-state drift | The dashboard/index is explicitly regenerable from files (see adoption 1 below — this one *does* need engineering discipline) |

**The boundary is worth recording**: files-as-truth holds while collaboration is turn-based and the graph is personal-scale. If Arbiter ever needs real-time multi-user editing or org-wide graphs, that is the wall Logseq hit — and Markdown Mirror (canonical store + synced markdown projection) is the documented escape hatch, not a rewrite cliff.

### Adopt from the file-based side (Logseq OG)

1. **Parse-to-index, index-is-cache.** OG's core pattern — parse the file directory into a queryable derived store, render from the store, treat it as disposable — is exactly the architecture Arbiter's renderer needs. Dashboard regeneration, pagination, 14-day triage, overdue flagging, and search all become queries over a derived index (SQLite or in-memory) that can be rebuilt from files at any time and is never authoritative. Corollary rule, learned from DB Logseq's lossy markdown export: **no meaningful state may live only in the index** — anything that matters (needs-review flags, triage timestamps) must be written back to the markdown, or agents can't see it.
2. **A formal grammar for the machine-read subset.** Logseq used a real parser (mldoc), not regex, and still fought ambiguity in human-authored markdown. Arbiter should spec its machine-read surface — frontmatter fields, checklist marks, pointer lines, `-> path` index entries — as a small strict grammar with a validator, and treat all other prose as opaque. Normalization of human entries must be **idempotent** (parse → normalize → parse reaches a fixpoint) so "human entries are always valid" never turns into "human entries get mangled on the second touch."
3. **Factor the core as headless libraries.** OG's `deps/` split (and the DB version's CLI reusing the app's core) is the model: parser / normalizer / query as a library consumed by both the web app and a CLI. Agents and CI then validate, query, and normalize arbiter-data without the app running — preserving the guarantee that the files are fully operable when the app is down.
4. **Single-writer reconciliation while the app runs.** OG's file watcher pattern: agents keep writing files directly, the app watches and reconciles into its index, and app-initiated writes go through the same normalization path agents use. Logseq's clobbering bugs came from having *two* serialization paths; Arbiter should have one.

### Adopt from the DB side (Logseq)

5. **Card types as schemas (the classes/properties ontology).** DB Logseq's strongest idea for Arbiter: a card type (Tasks, Goals, Meetings…) becomes a declared schema — typed fields (status enum, dates, evidence links as node-references), defaults, and a relevance rule — rather than code. "Extensible cards" from the README gets a mechanism: adding a card type = adding a schema file agents can read (in `PROTOCOL.md` or a `types/` directory). An `extends` relation gives all items a shared base (slug, status, updated) the way DB Logseq's tag inheritance does. Once frontmatter is typed, relevance ordering and triage are queries, not bespoke logic.
6. **Stable anchors for sub-item references.** Blocker links already point at checklist steps inside items. DB Logseq's stable block IDs — and Markdown Mirror embedding them *as markdown comments* — is the proven pattern: a short stable anchor comment on checklist lines that must be referenceable, surviving reorder and rewording. Adopt only where a line is actually a link target; don't ID every line.
7. **Watch Markdown Mirror's two-way sync.** It is the exact hybrid Arbiter would need if it ever flips to a DB-canonical core: canonical store + continuously synced markdown projection that agents edit with file tools. If Logseq ships reliable two-way sync, that's a tested migration path to keep on file.

### Reject

- **DB-canonical storage today.** It would break the agent contract — agents would need an API where they currently need only file tools. Logseq's reasons for the flip (RTC, block ops, 50k pages) are loads Arbiter doesn't bear.
- **The block/outliner data model.** Unifying pages and blocks would dissolve the tier boundaries; progressive disclosure depends on the file being the unit of context.
- **RTC sync.** Out of scope for the current collaboration model; revisit only at the boundary described above.

## Sources

- [logseq/logseq repository](https://github.com/logseq/logseq)
- [Why the database version and how it's going? (official)](https://discuss.logseq.com/t/why-the-database-version-and-how-its-going/26744)
- [DB version documentation (logseq/docs)](https://github.com/logseq/docs/blob/master/db-version.md)
- [Logseq DB Unofficial FAQ](https://logseq.io/page/e87c7359-51f7-44fe-87b3-4a0cd9f2dee3/695feeec-88be-4c5b-8bf2-572513c2f730)
- [Logseq OG (markdown) vs Logseq (DB/SQLite) split](https://discuss.logseq.com/t/logseq-og-markdown-vs-logseq-db-sqlite/34608)
- [What's New with Logseq DB — May 16 2026 (split, Markdown Mirror, CLI, agent skill)](https://discuss.logseq.com/t/whats-new-with-logseq-db-may-16th-2026/35020)
- [What's New with Logseq DB — April 26 2026 (sync, CLI, large graphs)](https://discuss.logseq.com/t/whats-new-with-logseq-db-april-26-2026/34977)
- [`deps/graph-parser` README](https://github.com/logseq/logseq/tree/master/deps/graph-parser)
