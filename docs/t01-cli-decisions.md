# T01 CLI decisions — 2026-09-06

T01 changes CLI behavior only. The bundled protocol remains 0.4.6, the base
schema 0.4.6, and concrete schemas 0.4. No grammar or stored contract changed,
so no protocol version bump is needed.

## Arguments and exit status

`help`, `--help`, and `-h` print command usages and exit before KB selection
or server startup. Bare invocation still serves. Options may precede the
command; `--` ends option parsing. Options use separate values (`--data <dir>`);
unknown/duplicate options, missing values, and extra positionals exit 2.
Only commands that use the clock accept `--now`; queries accept it only for
`overdue` and `needs-review`. The documented deterministic clock format is a
real local `YYYY-MM-DDTHH:MM` timestamp.

`validate` operates on the whole selected KB. Scoped path arguments are
explicitly rejected with exit 2 until dependency-aware validation is implemented.
`doctor` checks identity, then runs the same whole-corpus validator. Corpus
validation errors exit 1. Input, selection, identity and bootstrap errors exit 2.
Real digest mismatch and sticky-staging refusals exit 3.

`hash` still prints `sha256:<hex>`. `write --if-match` accepts that output,
bare SHA-256 hex (case-insensitive), or `new`; malformed digests exit 2 before
reading content. True mismatches print labelled expected and actual values in
the same prefixed representation. This repairs an input-format bug: the
read/check/write sequence is still vulnerable to concurrent writers. T02 owns
the shared commit boundary, semantic postconditions and crash recovery.

## Event dates and capture time

`new --date YYYY-MM-DD` accepts actual Gregorian dates in years 0001–9999,
including future dates and leap days. It defaults to the capture date.

| Type | Effect of `--date` |
|---|---|
| Meeting | Immutable ID date suffix and `date` field are the meeting date. |
| Journal | `date` is the day the entry concerns; the base-only ID stays unchanged. |
| Accomplishment | `date` is the impact date; the ID quarter follows that date. |
| Task, goal | ID quarter and the ±2-quarter reopen window follow that date; no due date is inferred. |

`created` remains the capture day; `updated` remains the capture timestamp.
`--now` overrides that clock for deterministic runs, independently of `--date`.
The existing reopen rule and `--force` override remain in effect for work items.
Accomplishment scaffolds still need their source/evidence filled in before they
are valid; T01 does not change that existing capture workflow.

## Selection and bootstrap

Selection precedence is `--data` > `ARBITER_DATA` > nearest `arbiter-data`
directory walking up from cwd. The walk now selects the nearest existing
directory even if empty or malformed, so a parent KB cannot mask its state.
The selected absolute path, source, and differing real path are printed on
stderr. stdout stays usable for hashes, paths, JSON and rendered dry runs.

A missing path fails instead of reporting zero validated files. An existing
directory with no entries is an **empty bootstrap directory (not initialized)**:
`validate` and `doctor` report this explicitly and exit 0; other commands require
initialization. A nonempty directory must have the expected protocol identity,
all six schemas with matching filenames/identities, supported versions and base
inheritance, and basic required definitions. `doctor` then validates its content.
Unsupported versions and additional unregistered schema identities fail closed;
future contract work must update the compatibility checks in `src/cli/data.ts`.
Identity checks are compatibility checks, not a cryptographic authenticity claim.

`init --data <dir>` requires an explicit missing or completely empty destination.
It copies only `PROTOCOL.md` and the six type schemas from the bundled frozen
contract, creates empty item directories, regenerates the dashboard and validates
the result. It imports no items and changes no profiles, bindings or environment
variables. It never overwrites existing content. An interrupted init can leave a
partial directory; automatic recovery/overwrite is intentionally unavailable.
Inspect that state before retrying in an empty destination.

The two bundled conformance roots and their descendants are read-only to CLI
mutations, including selection through symlink aliases. Live copies in other
locations remain writable. Item paths must stay inside the selected KB; mutation
commands reject symlinks anywhere under managed corpus paths before traversing
them. This is a CLI guard against accidental selection, not protection against
external editors or symlink changes racing a command. Read-only validation and
dry runs against the bundled corpora remain supported.

## Evidence

See [T01 completion](handoffs/completed/t01.md) and `test/cli.test.ts` for
subprocess regressions on temporary directories and the final verification record.
