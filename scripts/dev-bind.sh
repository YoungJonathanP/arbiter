#!/bin/sh
# dev-bind.sh — TEMPORARY dev-trial binding for the arbiter CLI.
#
#   scripts/dev-bind.sh install     put `arbiter` on PATH + default ARBITER_DATA
#   scripts/dev-bind.sh uninstall   remove everything this script installed
#
# What install does (all reversible, all fenced with marker comments):
#   1. writes a wrapper at ~/.local/bin/arbiter that execs this repo's built
#      bin/arbiter.js with ARBITER_DATA defaulted to the SIBLING arbiter-data/
#      (../arbiter-data, kept outside the repo so KB content never lands in the
#      tool repo's git remote)
#   2. appends a fenced ARBITER_DATA export to ~/.bash_profile, ~/.bashrc,
#      and ~/.zprofile
#
# This is scaffolding for the v0.5 dogfood trial. The v1.0 install story
# (docs/launch-plan.md) replaces it; run `uninstall` as part of that cleanup.

set -eu

REPO_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
# Data lives as a SIBLING of the repo (../arbiter-data), never inside it.
DATA_DIR=$(CDPATH= cd -- "$REPO_DIR/.." && pwd)/arbiter-data
WRAPPER="$HOME/.local/bin/arbiter"
MARK_START="# >>> arbiter dev bind (scripts/dev-bind.sh) >>>"
MARK_END="# <<< arbiter dev bind <<<"
PROFILES="$HOME/.bash_profile $HOME/.bashrc $HOME/.zprofile"

strip_block() {
  # remove a previously installed fenced block from $1, in place
  [ -f "$1" ] || return 0
  tmp=$(mktemp)
  awk -v s="$MARK_START" -v e="$MARK_END" '
    $0 == s { skip = 1; next }
    $0 == e { skip = 0; next }
    !skip { print }
  ' "$1" > "$tmp" && mv "$tmp" "$1"
}

case "${1:-}" in
  install)
    if [ ! -f "$REPO_DIR/dist/src/cli/main.js" ]; then
      echo "building first (dist/ missing)…"
      (cd "$REPO_DIR" && npm run build)
    fi
    mkdir -p "$HOME/.local/bin"
    cat > "$WRAPPER" <<EOF
#!/bin/sh
# Arbiter CLI — TEMPORARY dev-trial wrapper, installed by
# $REPO_DIR/scripts/dev-bind.sh (uninstall with: scripts/dev-bind.sh uninstall)
export ARBITER_DATA="\${ARBITER_DATA:-$DATA_DIR}"
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="\$HOME/.nvm"
  [ -s "\$NVM_DIR/nvm.sh" ] && . "\$NVM_DIR/nvm.sh"
fi
exec node "$REPO_DIR/bin/arbiter.js" "\$@"
EOF
    chmod +x "$WRAPPER"
    for f in $PROFILES; do
      strip_block "$f"
      printf '\n%s\n' "$MARK_START" >> "$f"
      printf 'export ARBITER_DATA="%s"\n' "$DATA_DIR" >> "$f"
      printf '%s\n' "$MARK_END" >> "$f"
    done
    if command -v npm >/dev/null 2>&1 && npm ls -g arbiter >/dev/null 2>&1; then
      echo "warning: a globally npm-linked arbiter exists and may shadow the wrapper — run: npm rm -g arbiter"
    fi
    echo "installed: $WRAPPER (data: $DATA_DIR)"
    echo "open a new shell (or 'hash -r') and run: arbiter"
    ;;
  uninstall)
    rm -f "$WRAPPER" && echo "removed $WRAPPER"
    for f in $PROFILES; do strip_block "$f"; done
    echo "removed fenced ARBITER_DATA blocks from: $PROFILES"
    echo "note: if 'which arbiter' still resolves, remove the npm link too: npm rm -g arbiter"
    ;;
  *)
    echo "usage: scripts/dev-bind.sh install | uninstall" >&2
    exit 2
    ;;
esac
