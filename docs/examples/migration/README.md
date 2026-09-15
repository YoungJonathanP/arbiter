# Migration dry-run evaluation

`src/core/migration.ts` exposes `migrationDryRun(sources, choices, questions)`.
Supply an explicit list of `{path, bytes: Buffer}` sources and authored role
choices (`assignment`, `coordination`, `dependency`, `history`). File roles are
inherited by their anchors unless explicitly overridden. A proposed assignment
is not automatically a new task; retain stable IDs and existing anchors.

```typescript
import { migrationDryRun } from '../../../src/core/migration.js';
const result = migrationDryRun([
  { path: 'tasks/atlas-contract-2026q3.md', bytes: Buffer.from(taskText) },
], [{
  path: 'tasks/atlas-contract-2026q3.md',
  role: 'assignment', rationale: 'One independently reviewable API contract',
}], ['Confirm accountable owner and live start gates.']);
```

The result includes exact byte digests, section sizes, hierarchy/status/owner,
file and anchor mappings, preserved original paths, selected-source link checks,
questions, migration gates and a rollback specification. It never reads a file,
follows a link, mutates a KB, adopts a contract or claims live external evidence.
The caller supplies file bytes and controls where results are saved. There is no
new CLI command or protocol change.

Preservation defaults to retaining originals in place, so history and immutable
refs survive the proposed mapping. This does not shorten an existing task by
itself. Extraction uses the existing reviewed checkpoint capture workflow after
contract adoption; old anchors stay accessible and original bytes enter detail.
A selected-source digest list is not a full backup. Include every file and
`.arbiter/transactions` in verified backups; rehearse restore before migration.

Link analysis covers inline Markdown destinations, Detail docs entry arrows (`- [[id]] Title (kind) -> path`) and common
object-reference fields. Local paths use Arbiter root-relative syntax and `#^`
checklist anchors. Unselected targets remain uninspected, external URLs remain
unverified, and unsupported destination syntax is invalid. Reference-style links,
HTML and arbitrary prose need manual inspection; this is not a complete Markdown
parser or a visibility/redaction filter. Prose arrows describing status, hierarchy
or version transitions do not declare references. Never put a manifest of private inputs in
a shareable repository. Unknown or duplicate anchors and ambiguous scope need
review; never infer authority from a newer timestamp.

Run `node --import tsx --test test/migration.test.ts` for synthetic preservation,
malformed-link, recursive-history, stale-gate, competing-owner, superseded-scope
and rollback checks. These deterministic tests are not fresh-agent exercises.
The measured normal packet is 9,969 bytes; adding 1,100,000 bytes of history adds
zero packet bytes. This exceeds the 6 KiB target but fits the 10 KiB ceiling.
The initial repetitive synthetic draft exceeded the ceiling and was refused;
compact authoring resolved it without truncating required constraints.

Fresh-agent evaluation remains a separate gate. When authorized, give an isolated
session only one reviewed packet and a synthetic workspace. Instrument emitted
context and file reads. Require it to state assignment, owner, scope constraints,
start predicates and stopping condition before implementation. Test a changed
input, unknown owner, superseded action and growing history. Record actual bytes
(or label the tokenizer/estimate), older-handoff reads, unrelated sibling reads,
missed constraints, attempted stale actions and task completion. Automated packet
assertions cannot establish these agent behavior metrics. The current exporter
still scans visible current corpus files internally; zero recipient sibling reads
does not mean zero backend filesystem reads.
