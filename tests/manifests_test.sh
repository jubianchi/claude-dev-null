#!/usr/bin/env bash
#
# Tests that the Claude Code and Codex manifests describe the same plugin: same name, same version, so a release
# bumps both. ROOT can point at another checkout.

set -uo pipefail

ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CLAUDE="$ROOT/.claude-plugin/plugin.json"
CODEX="$ROOT/.codex-plugin/plugin.json"

failures=0
passes=0

field() {
  node -p "require(process.argv[1])[process.argv[2]] ?? ''" "$1" "$2"
}

check() {
  local name="$1"
  shift
  if "$@"; then
    passes=$((passes + 1))
  else
    failures=$((failures + 1))
    printf 'FAIL: %s\n' "$name"
  fi
}

same() {
  local key="$1" claude codex
  claude="$(field "$CLAUDE" "$key")"
  codex="$(field "$CODEX" "$key")"
  if [ -z "$claude" ] || [ "$claude" != "$codex" ]; then
    printf '  %s: %s in %s, %s in %s\n' "$key" "${claude:-none}" "$CLAUDE" "${codex:-none}" "$CODEX"
    return 1
  fi
}

test_same_name() {
  same name
}

test_same_version() {
  same version
}

for test in $(declare -F | awk '{ print $3 }' | grep '^test_'); do
  check "$test" "$test"
done

printf '%d passed, %d failed\n' "$passes" "$failures"
[ "$failures" -eq 0 ]
