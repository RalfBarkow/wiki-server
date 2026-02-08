#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# --- config ---
CONFIG="./repomix.config.json"
OUT="repomix-output-wiki-server.md"

# --- preflight ---
test -f "$CONFIG"
test -f package-lock.json

# CLI is `repomix` (no repomix-md). Markdown output is controlled by
# repomix.config.json output.style and output.filePath.

# Determine repomix command (argv array), prefer local binary.
REPOMIX_CMD=()
if [[ -x "./node_modules/.bin/repomix" ]]; then
  REPOMIX_CMD=("./node_modules/.bin/repomix" -c "$CONFIG")
elif command -v repomix >/dev/null 2>&1; then
  REPOMIX_CMD=(repomix -c "$CONFIG")
elif command -v repomix-md >/dev/null 2>&1; then
  echo "ERROR: repomix-md found but repomix CLI is required." >&2
  echo "Hint: install repomix (npm i -D repomix) or provide it via nix shell; repomix-md is not accepted here." >&2
  exit 3
elif command -v npx >/dev/null 2>&1; then
  REPOMIX_CMD=(npx --no-install repomix -c "$CONFIG")
else
  echo "ERROR: repomix not found (no node_modules/.bin/repomix, no repomix in PATH, no npx)." >&2
  echo "Hint: install repomix locally (npm i -D repomix) or provide repomix via nix shell." >&2
  exit 2
fi

# Bound runtime to avoid indefinite hangs.
# Use GNU timeout if available; otherwise use perl alarm fallback.
run_bounded () {
  local seconds="${1:-60}"
  shift || true

  if command -v timeout >/dev/null 2>&1; then
    timeout "${seconds}" "$@"
    return
  fi

  perl -e '
    my $t = shift @ARGV;
    alarm($t);
    exec @ARGV;
  ' "${seconds}" "$@"
}

echo "Running repomix using pinned config: ${CONFIG}"
run_bounded 120 "${REPOMIX_CMD[@]}"

# Verify output exists
test -f "$OUT"

# Verify presence (both directory structure entry and file block)
rg -n "^[[:space:]]*package-lock\\.json$" "$OUT" >/dev/null
rg -n "^## File: package-lock\\.json$" "$OUT" >/dev/null

echo "OK: package-lock.json is included in ${OUT}"
