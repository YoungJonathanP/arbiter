# T09 synthetic whole-bootstrap evaluation

> Historical evaluation/proposal. The user's [2026-09-14 decision](progressive-disclosure-handoffs.md#budget-scope-and-conflict-resolution)
> supersedes the cumulative-session budget and the unresolved either/or gate below.
> Preserve these measurements and mappings as evidence; they do not require a
> compact protocol rewrite or a larger whole-session maximum for T09 continuation.
> The remaining original text records the 2026-09-13 proposal, not current policy.

2026-09-13. Design checkpoint, review-required. This experiment changes no runtime,
protocol, grammar, installed KB or acceptance threshold. Protocol/base remain
0.4.17; accomplishment remains 0.4.18. It is not a new exporter.

## Result

The full-contract synthetic bootstrap is bounded under an explicit **65,536-byte
maximum and reason**, at **46,497 UTF-8 bytes** including its declared client
context and measurement receipt. It fails the ordinary 10 KiB ceiling. Even a
representation with no framing or duplicate metadata retains **43,126 raw source
bytes**. Removing export duplication cannot make this contract compact.

Actual agent system/developer/tool/client context remains unmeasured. An unknown
component makes the experiment's admission check fail even with the larger
maximum. No fresh agent was launched or measured. Bytes are not model tokens.

## Reproduce

Run `node --import tsx scripts/evaluate-bootstrap.ts` from the checkout. The
[evaluator](../scripts/evaluate-bootstrap.ts) accepts no data path, creates a
disposable synthetic KB using the current bundled contract, and removes only that
test-owned directory. It emits a JSON report. Fresh UUIDs/hashes change between
runs; the byte sizes below are stable for this fixture and contract.

`npm test` includes [four regression tests](../test/bootstrap-budget.test.ts).
The report and full verification logs from this evaluation are outside the repo
at `/Users/jonathanyoung/Documents/arbiter-t09-local-review/bounded-bootstrap-20260913/`.
No employer content or private manifests are included here.

## Required context and duplication

The installed protocol says to read the full file once per session and the type
schema before writing that type. Checkpoint inputs also bind the base/task schemas.
The existing offline exporter already includes each required source once, retaining
all exact frontmatter, clauses, provenance, authority and revision evidence:

| Component | UTF-8 bytes |
|---|---:|
| Full installed protocol, with fresh synthetic KB identity | 35,292 |
| Base schema | 3,119 |
| Task schema | 2,230 |
| Synthetic task | 406 |
| Current checkpoint | 2,079 |
| Raw source total, before any framing | 43,126 |
| Reviewed offline JSON packet | 45,671 |
| Declared synthetic context outside packet | 255 |
| Measurement receipt, including explicit override | 571 |
| Full declared synthetic bootstrap | 46,497 |

The linked JSON packet alone is **10,098**. Adding full protocol/base/task reads
gives **50,739**, with a repeated **5,602-byte** checkpoint excerpt. The offline
JSON format removes that repeated excerpt without summarizing any rule. Its
framing/escaping costs **2,545** above the raw source total, including duplicate
manifest fields. Even removing all of that cost would leave 43,126 bytes. These
are lower-bound comparisons, not permission to remove fields from production.

The unreviewed offline packet is **45,550** and refuses ordinary export. The
reviewed packet records the deliberate 65,536 maximum/reason. That packet-level
override alone does not bound extra client context: the experiment records and
counts the whole-context override again in its separate receipt.

## Synthetic admission design

Use the exact reviewed offline packet once. Inventory system, developer, tool,
client, user, prior conversation, workspace instructions and recheck output as
separate context slots. Count every emitted occurrence, including repeated rules
if the client actually loads them twice. An intentionally absent component is an
explicit empty string; unavailable context is unknown, never silently zero.

Count the measurement receipt itself, including component counts, unknowns,
maximum/reason, result and limitations. Recalculate until its total stabilizes.
Refuse when any slot is unknown or the complete total exceeds the chosen maximum.
The helper checks UTF-8 bytes only; it neither discovers the real host inventory
nor proves that the caller listed everything. Model message framing and tool
results, when present, belong in the declared client/tool/recheck context. If
they cannot be measured, the full-context gate stays unmet.

Budget admission never grants execution authority or bypasses production export,
freshness, readiness, staging or audience checks. The original full offline packet
retains its planning-only limitation. The synthetic client declares zero tool,
workspace and conversation context because it is a harness with no model session;
those zeros must not be transferred to a real agent.

## Verification

Two captures retain the exact prior checkpoint under its digest. Export returns
the reviewed bytes, while superseded previews refuse. Adding **312,181 bytes** of
synthetic checkpoint/detail history leaves the freshly previewed packet identical.
Immutable checkpoint history does not stale export; ordinary optional source growth
does stale the old preview. This measures emission, not internal corpus reads.

Private canary identity/body/counts stay absent, and selecting the private input
refuses even with the larger budget. New shared linked input appears in the packet
and forces review-required; exporting acknowledges nothing. Its changed revision
invalidates the old preview. Large required input yields **136,448 bytes** and
refuses even the reviewed maximum, retaining the entire input. The synthetic corpus
validates without errors.

The arithmetic tests cover multibyte text, repeated loaded bytes, unknown context,
client overhead, invalid overrides and receipt-induced overflow. **152/152 tests
and typecheck pass**, including the four new tests; build passes. The sandbox's
24 localhost failures disappear in the escalated full run. Both frozen corpora
validate at 26/0/0 and 23/0/1 (existing raw-journal warning).

## Design decision gate

The experiment resolves the representation question: a lossless renderer change
alone cannot satisfy ordinary compact acceptance with the current required reads.
It does not resolve which requirement to change. The review choice is:

1. Retain the full installed contract and explicitly accept a larger **measured
   whole-context** maximum for the receiving client. The synthetic 65,536 ceiling
   is evidence only; it is not a selected maximum for an unmeasured real client.
   Calling this T09 compact acceptance needs an explicit acceptance-policy decision.
2. Keep the ordinary 6 KiB target/10 KiB ceiling and design a compact operational
   contract plus a client whose complete context fits it. This requires a reviewed
   clause-preservation map and versioned protocol/grammar decision. Moving rules
   to optional links while they are still required is not a solution.

For the second route, a candidate must map every current protocol/schema directive
to a retained global rule or an operation-specific required read with explicit
activation and a stop-before-operation gate. Privacy, source exclusions, authority,
revision checks, staging, interruption recovery and history preservation cannot
be optional. Pending linked inputs must still be included or explicitly presented;
large inputs must refuse, never truncate. Client overhead must be measured before
allocating the remaining bytes to the contract and assignment. A digest binds
rules but cannot substitute for reading them.

Recommended next step: resolve this exact policy choice before another real-data
iteration. If no choice is supplied, prepare the clause-preservation map for review
using public bundled contracts only; do not reinterpret acceptance or adopt a
scoped contract. Fresh-agent execution requires separate authorization and a
measurable client inventory. Live rollout/reconciliation are separate again.
