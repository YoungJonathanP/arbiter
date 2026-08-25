# FROZEN corpus — this is not the live KB

This directory is the **pre-split dogfood corpus**, last written 2026-07-16. It
is kept as a CI conformance target (`arbiter validate --data arbiter-data`) and
as history. **Do not write to it.**

The live knowledge base moved out of this repo in `29f4be2` (2026-08-10), so
employer content never reaches this repo's personal remote. It now lives in a
sibling directory resolved by `$ARBITER_DATA`:

```sh
"${ARBITER_DATA:?set ARBITER_DATA — see CLAUDE.md}"
```

The `arbiter` CLI already resolves this correctly from anywhere, because
`$ARBITER_DATA` outranks the "nearest `arbiter-data/` walking up from cwd"
fallback. The hazard is agents using **file tools**: a bare relative
`arbiter-data/` inside this repo lands here, on the frozen copy. Resolve the
live directory through the environment variable, never as a repo-relative path.

See `CLAUDE.md` in the repo root for the full three-directory table.
