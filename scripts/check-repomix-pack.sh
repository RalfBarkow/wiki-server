#!/usr/bin/env bash
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

# --- config ---
CONFIG="./repomix.config.json"
OUT="repomix-output-wiki-server.md"

# --- preflight ---
test -f "$CONFIG"
test -f package-lock.json

# Prefer a local repomix binary (node_modules) to avoid npx network hangs.
run_repomix () {
  # CLI is `repomix` (no repomix-md). Markdown output is controlled by
  # repomix.config.json output.style and output.filePath.
  if [[ -x "./node_modules/.bin/repomix" ]]; then
    ./node_modules/.bin/repomix -c "$CONFIG"
    return
  fi

  # If repomix is available on PATH (e.g. nix shell), use it.
  if command -v repomix >/dev/null 2>&1; then
    repomix -c "$CONFIG"
    return
  fi

  # Fail fast only if repomix-md is present BUT repomix is NOT.
  if command -v repomix-md >/dev/null 2>&1 && ! command -v repomix >/dev/null 2>&1 && [[ ! -x "./node_modules/.bin/repomix" ]]; then
    echo "ERROR: repomix-md found but repomix CLI is required." >&2
    echo "Hint: install repomix (npm i -D repomix) or provide it via nix shell; repomix-md is not accepted here." >&2
    exit 3
  fi

  # As last resort, use npx but force offline + no install attempts.
  # This will FAIL FAST if repomix isn't already available in cache.
  if command -v npx >/dev/null 2>&1; then
    npx --no-install repomix -c "$CONFIG"
    return
  fi

  echo "ERROR: repomix not found (no node_modules/.bin/repomix, no repomix in PATH, no npx)." >&2
  echo "Hint: install repomix locally (npm i -D repomix) or provide repomix via nix shell." >&2
  exit 2
}

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
run_bounded 120 run_repomix

# Verify output exists
test -f "$OUT"

# Verify presence (both directory structure entry and file block)
rg -n "^[[:space:]]*package-lock\\.json$" "$OUT" >/dev/null
rg -n "^## File: package-lock\\.json$" "$OUT" >/dev/null

echo "OK: package-lock.json is included in ${OUT}"
