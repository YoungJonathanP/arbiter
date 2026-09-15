# Synthetic flight continuation

Update 2026-09-14: [one authorized fresh receiver](receiver-evaluation.md) saved
13 passing synthetic assertions, then hit a usage limit before outgoing capture.
The parent verified and captured its results. Full receiver acceptance/calibration
remains open. The authored harness measurements below predate that receiver run.

Verified 2026-09-14 against the current exporter at repository revision
`bfdc5519cc730fb0e23bb840b5ac83d6c7bddb66` plus preserved uncommitted work.
This is authored structure and executable harness evidence. No receiving agent
ran, no real search implementation was tested, and no live data was migrated.

## Start here

1. [Flight summary/checklist](tasks/search-flight-2026q3.md): design is complete,
   verification is eligible, release is blocked by verification.
2. [Selected task](tasks/verify-search-2026q3.md): identity, parent, canonical
   checklist and labelled plan/ticket/PR pointers.
3. [Current T3 handoff](tasks/verify-search-2026q3/checkpoint.md): next action,
   essential design conclusion, predecessor directive, gates and completion evidence.

The receiver can identify the assignment from these three sources. The installed
protocol and required schemas must also be read before work. Supporting plans,
investigations and prior checkpoints are not a startup reading chain. Ticket and
PR documents are explicitly synthetic local stand-ins, with no external state claims.

Files under `tasks/` use **KB-root-relative links**, as required by Arbiter; resolve
them against this example directory, not against the containing file. This is an
artifact excerpt, not an installed KB: rules, private input ledgers, large history
and transaction files are deliberately outside this review excerpt. The executable
exercise creates a fresh disposable KB and installs the actual bundled rules.
The standalone packets retain their original snapshot metadata and KB-root paths.

## Measurements

Exact UTF-8 measurements are in [measurements.json](measurements.json).

| Surface | Bytes | Meaning |
|---|---:|---|
| Ordinary emitted packet | 13,327 | Exceeds the 10,240-byte ceiling; export correctly refuses |
| [Reviewed packet](packet.md) | 13,459 | All metadata, excerpts, sources and explicit 14,336-byte override included |
| Flight + task + current checkpoint | 6,516 | Baseline task source reads |
| Full installed protocol + base/task schemas | 40,641 | Mandatory rules; not replaced by the packet excerpt |
| Raw source startup | 47,157 | Baseline plus mandatory rules, each once |
| Packet route + flight + full rules | 55,305 | Counts duplicated checkpoint-rule excerpt |
| Fresh task/checkpoint rechecks | 5,311 | Additional duplicate read occurrences |
| Conservative planned startup | 60,616 | Packet route including those rechecks |
| [One optional section](optional-read.md) | 154 | Does whitespace count as empty? |
| [Pending-input packet](pending-input-packet.md) | 14,295 | Same explicit 14 KiB export allowance; requires review |
| Oversized required-input packet | 110,297 | Refused, retaining the entire source |

The justified optional read answers a concrete whitespace question; it does not
discover the essential rule for the first time. The handoff already says empty
queries return no results and stable anchors must survive. The fixture reads the
selected section separately; the exporter itself expands only complete files.

### Startup and working reserve proposal

For this harness, allow **73,728 bytes (72 KiB)** for source loading: the measured
60,616-byte route plus 15% headroom, rounded up to 4 KiB. Separately reserve
**24,576 bytes (24 KiB)**: provisional 8 KiB each for execution, results/verification
and outgoing checkpoint. The resulting known-source envelope is 98,304 bytes.
These are a calibration proposal for this fixture, not selected product defaults,
token counts, a replacement export ceiling, or measured real-session capacity.
The current checkpoint itself fits the proposed outgoing portion; real tool-output
and execution needs still require receiver calibration.

The 154-byte optional read fits. An additional 13,113 bytes at initial startup
crosses the allowance by one byte and returns `checkpoint/split`; an exact-boundary
read fits and one more byte does not. The oversized mandatory input also crosses
the startup bound. The exercise saves a [stop checkpoint](stop-checkpoint.md),
preserves the exact prior checkpoint through the supported writer, and leaves
input actionable. The stop record itself does not make that oversized packet
exportable. A human must authorize a bounded review/split or an explicit revised
budget with measured capacity; mandatory input cannot be dropped to fit.

Host instructions, tool definitions, client framing and usable context capacity
are unknown. No real session is admitted by this calculation. Planned receiver
reads are distinct from the harness's internal corpus scans; zero unnecessary
reads is a property of the authored route, not observed agent behavior.

## Verified behavior and gaps

- The flight selects verification and retains blocked release. A reopened design
  row with the same timestamp, or a changed task owner, makes execution ineligible.
  The [stale packet](stale-packet.md) requires review; planning export remains possible.
- Adding 220,150 bytes of checkpoint history changes neither packet nor baseline.
  Adding 108,001 bytes of ordinary design history also leaves both unchanged after
  repreview. The whole-corpus preview basis invalidates the older preview on the
  latter change. Runtime scan cost can grow even when receiver context does not.
- New input appears in full and requires review. A same-timestamp source edit
  invalidates the preview. Export and replacement checkpoint acknowledge nothing;
  one input remains pending. Oversized input refuses export without truncation.
- Sixteen synthetic links resolve, including checklist and selected heading
  anchors. Original design prose remains intact during append-only history growth.
- Corpus validation passes with zero errors. Three intentional end-state warnings
  identify the oversized source, waiting checkpoint and large history checkpoint.

Current limitations: no automatic eligibility scheduler, startup/reserve controller
or host-capacity measurement. The fixture checks eligibility from current parsed
state; it is not a new scheduler. Parsed Artifacts/Evidence links recognize
checklist anchors, not Markdown heading fragments, so those entries use whole-file
links with explicit section labels. Optional prose pointers can select headings.
Successful export never proves authority, comprehension or actual continuation.

## Reproduce

From the repository root:

```sh
node --import tsx scripts/evaluate-flight-continuation.ts /tmp/arbiter-flight-new-example
npm test
npm run build
```

The output directory must not exist; earlier results are never replaced. Omit it
to run assertions and print measurements without retaining artifacts. Each run gets
fresh synthetic UUIDs, so hashes and timestamps in capture metadata can differ;
the measured baseline byte lengths and asserted behavior are stable. The integration
test executes the exercise as part of the suite: **153/153 tests and typecheck pass**;
build passes. The initial sandbox run had only localhost `EPERM` failures; the
authorized rerun passes. No runtime, bundled contract or frozen fixture was changed.

T09 remains partial. Authorized fresh-session comprehension/continuation evidence,
actual receiver budget calibration and live reconciliation remain separate gates.
See the [task](../../improvement-tasks/09-migration-evaluation.md) and
[accepted direction](../../progressive-disclosure-handoffs.md).
