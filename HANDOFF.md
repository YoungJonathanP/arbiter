# Handoff — working on Arbiter from another machine

For the next implementation assignment, start with
[`docs/handoffs/next-task.md`](docs/handoffs/next-task.md), the current chaining
handoff. The completing agent prepares its successor at that same path.
[`docs/improvement-plan.md`](docs/improvement-plan.md) is the execution index. Each linked task packet
contains its start gate, required inputs, acceptance checklist and current handoff.
The [checkpoint contract](docs/v0.4.11-checkpoints.md) is implemented at the
file-role/validation/write-lifecycle layer. [Capture/export CLI and task UI](docs/v0.4.12-handoff-tooling.md)
now share exact-byte previews and stale-input checks.

Written 2026-09-06. Everything needed to clone this repo on a fresh machine and
work on the tool. Read `CLAUDE.md` next for the dogfooding rules and the
three-directory hazard.

## The one thing that does not travel

The live knowledge base is **local-only git with no remote**, by design: it holds
employer content, and this repo's remote is a public personal account. So the
improvement backlog it carried does not arrive with a clone.

That backlog is now ported to **[`docs/v0.5-trial-feedback-backlog.md`](docs/v0.5-trial-feedback-backlog.md)** —
17 open items with rationale, code pointers, and priority. It is the portable
brief and the answer to "what should I work on." The live KB stays canonical for
lifecycle marks; mirror a mark back when an item lands.

The in-repo `arbiter-data/` copy of the same backlog is **frozen at 2026-07-16**
and shows only 1 open item. Do not read it as current.

## Setup

```sh
git clone https://github.com/YoungJonathanP/arbiter.git
cd arbiter
npm ci          # see the JFrog note below if you are on a corporate network
npm test        # T01: 36/36 pass, typecheck clean; localhost access needed
```

Node 22 or newer is required (`engines`). Verified on v22.22.3.

### On a corporate network, `npm ci` may fail

Redfin's JFrog package-curation proxy blocks packages published less than 7 days
ago. `@types/node` has hit this before. The workaround is a **local-only** pin: set
`@types/node` to the newest version allowed under the existing `^22.20.0` range,
then regenerate the lockfile. Keep the pin out of shared history — it is a
per-machine workaround for one proxy, not a repo fact. The only runtime dependency,
`better-sqlite3`, builds its native binding fine.

### Bind the CLI

```sh
scripts/dev-bind.sh install     # wrapper at ~/.local/bin/arbiter + profile exports
scripts/dev-bind.sh uninstall   # fully reversible
```

Install builds `dist/` first if it is missing, writes the wrapper, and appends a
fenced `ARBITER_DATA` export to `~/.bash_profile`, `~/.bashrc`, and `~/.zprofile`.
It points `ARBITER_DATA` at `../arbiter-data`, a **sibling** of the repo.

This binding is temporary trial scaffolding. The v1.0 install story replaces it.

### Bootstrap a data directory

`dev-bind.sh` does **not** create `../arbiter-data`. Bootstrap explicitly:

```sh
npm run --silent arbiter -- init --data ../arbiter-data
npm run --silent arbiter -- doctor --data ../arbiter-data
npm run --silent arbiter -- validate --data ../arbiter-data
```

`init` accepts a missing or completely empty directory. It installs only the
bundled protocol and schemas, creates empty item directories and a dashboard,
and validates the result. It never overwrites a KB or changes shell profiles.
`doctor` checks supported protocol/schema identities and corpus health.
Selection diagnostics include the absolute KB path and source on stderr.
A missing path fails; an empty bootstrap directory is explicitly reported as
not initialized. See [T01 CLI decisions](docs/t01-cli-decisions.md).

For renderer development, copy the frozen corpus to a temporary location and
pass that path with `--data`. The bundled corpora reject CLI writes, including
through symlink aliases. Read-only validation and dry runs remain supported.

### Skills

The agent skills live in this repo at `.claude/skills/arbiter/` and
`.claude/skills/arbiter-trial-feedback/`, so they clone with it. This repo's copy
is the source of truth. To use them from any directory, symlink them per machine:

```sh
ln -s "$PWD/.claude/skills/arbiter" ~/.claude/skills/arbiter
ln -s "$PWD/.claude/skills/arbiter-trial-feedback" ~/.claude/skills/arbiter-trial-feedback
```

`arbiter-trial-feedback` is provisional and retires at v1.0.

### Pushing

The remote is the personal account `YoungJonathanP`, not a work account. With
multiple `gh` accounts configured, switch before a push:

```sh
gh auth switch --user YoungJonathanP
```

## Verified T01 state, 2026-09-06

T01 is implemented in the uncommitted worktree based on `4a5e097` on `main`.
All 36 tests pass, the build passes, and both bundled corpora validate with zero
errors. The live sibling KB is absent; the shell selects the frozen in-repo
corpus. Live capture remains unavailable. Continue at the current chaining
handoff; [T01 completion](docs/handoffs/completed/t01.md) records the evidence.

## Historical pre-handoff state (not current live verification)

| | |
|---|---|
| Version | v0.5.0, headless core (library + CLI + read-only renderer) |
| Tool tests | 29/29 pass, typecheck clean |
| Live KB validate | 267 files, 0 errors, 64 warnings (all unresolved wikilinks in tier-3 docs) |
| Staged proposals | none pending |
| `main` | pushed through `d3f3198` |

### Where the milestone actually stands

`docs/launch-plan.md` and the KB both still carry `eta: 2026-07-23` for the v0.5
trial. That date is about 6 weeks stale. The trial did not fail — it ran long and
kept producing feedback, which is what the backlog doc holds. Read the goal's dates
as "started, still open," not as a schedule.

The v0.5 exit bar itself is met: the dashboard regenerates correctly, CI is green,
and there has been far more than a week of real use.

### Open work beyond the feedback backlog

- **v1.0 launch items** (`docs/launch-plan.md`): concurrency tests, a history
  safety net (auto-commit of arbiter-data on regen/triage), the install story, and
  a docs pass.
- **Retire the dev-trial binding at v1.0**: run `scripts/dev-bind.sh uninstall`,
  confirm no npm-linked or stray `arbiter` remains on PATH, drop the
  temp-binding sections from `README.md`, `CLAUDE.md`, and the arbiter skill, and
  remove the provisional `arbiter-trial-feedback` skill and its symlink.

## Historical suggested order (the execution index now governs)

1. **The arbitration and CAS package** — backlog items 1-4. Three separate
   correctness bugs sit on the path that carries the protocol's "silent loss is
   structurally impossible" claim. Two of them report success while losing data.
   This is the least-tested code in the CLI because single-writer sessions never
   reach it, and it is the highest-value work in the list.
2. **The silent-input family** — items 6, 17, and 5. The CLI accepts arguments it
   cannot honor and reports success. Item 6 mints wrong immutable ids that way.
3. **Renderer polish** — items 14, 15, 16. Small, self-contained, visible.
4. **Validator lints and structure** — items 8 through 13. Several are coupled:
   8 and 12 land together, and 11 constrains how 8 is implemented.

T01 now resolves items 1, 6, 7 and 17, including explicit init/doctor support.

## Conventions worth knowing before the first commit

- One commit per milestone (`vX.Y: ...`); plain messages for dogfood and data
  updates. **Ask before committing.**
- A protocol or grammar change needs a version bump and a decision note in `docs/`.
  `docs/v0.5-decisions.md` shows the shape.
- `npm test` treats the spec as the oracle. Never edit `fixtures/arbiter-data/` to
  make code pass.
- Staged-proposal base hashes in the fixtures must keep matching the item file's
  bytes. Regenerate the proposals if you touch an item fixture.
- After a change to CLI or core source, run `npm run build` so the wrapper picks it
  up.
