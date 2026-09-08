# Arbiter

Agentic knowledge base: three tiers of markdown under `arbiter-data/` are
canonical truth; agents with file tools are the primary client; the CLI and
the local renderer with checkpoint capture sit on top. Normative specs: `docs/grammar.md`
(machine-read subset, conformance gates) and `assets/contract/PROTOCOL.md`
(canonical bootstrap agent contract; an installed live KB uses its own PROTOCOL.md). Decision records live in `docs/`.

## Dogfooding — applies to every session in this repo

Arbiter tracks its own development. If your session does meaningful work,
capture it in **the live KB at `$ARBITER_DATA`** before finishing — use the
**arbiter** skill (`.claude/skills/arbiter/`, also symlinked to
`~/.claude/skills/arbiter` so it works from any directory; this repo's copy is
the source of truth), which defers to that directory's `PROTOCOL.md` as the
contract. Finish with `arbiter validate` green and a regenerated dashboard.

**Two directories are named `arbiter-data/`. Do not confuse them.**

| Path | Role |
|---|---|
| `$ARBITER_DATA` (the repo's sibling, `../arbiter-data`) | The live KB. All capture goes here. Local-only git, no remote. |
| `./arbiter-data/` (in this repo) | Frozen pre-split dogfood corpus, last written 2026-07-16. A CI conformance target only. **Never write to it.** |
| `./fixtures/arbiter-data/` | Test fixtures for the conformance gates. |

The split landed in `29f4be2` (2026-08-10) to keep employer content out of this
repo's personal remote. The CLI already resolves correctly from inside the repo
because `$ARBITER_DATA` outranks the cwd walk — but an agent using **file tools**
reading a bare `arbiter-data/` here would land on the frozen copy. Always resolve
the live directory as `"${ARBITER_DATA:?}"`, never as a repo-relative path.

The `arbiter` CLI works from anywhere: `scripts/dev-bind.sh install` (a
TEMPORARY dev-trial binding, retired at the v1.0 install story) writes a
`~/.local/bin/arbiter` wrapper and fenced `ARBITER_DATA` exports into the bash
and zsh login profiles. Data-dir resolution is `--data` > `$ARBITER_DATA` > nearest
`arbiter-data/` walking up from cwd — inside this repo that last fallback finds
the frozen copy, so never rely on it here; keep `$ARBITER_DATA` set. After
changing CLI/core source,
`npm run build` so the wrapper picks it up.

## Commands

- `npm test` — typecheck + conformance gates 1–7 (the spec is the oracle;
  never "fix" `fixtures/arbiter-data/` to make code pass).
- `npm run build` — compile; `bin/arbiter.js` / `npm link` for the CLI.
- `npm run --silent arbiter -- <cmd>` — run the CLI from source.

## Conventions

- One commit per milestone (`vX.Y: ...`) for milestone work; plain messages
  for dogfood/data updates. Ask before committing.
- Protocol or grammar changes require a version bump and a decision note in
  `docs/` (see `docs/v0.5-decisions.md` for the shape).
- `fixtures/arbiter-data/` staged-proposal base hashes must keep matching the
  item file's bytes — regenerate proposals if you touch the item fixture.
