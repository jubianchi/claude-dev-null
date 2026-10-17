#!/usr/bin/env bash
#
# Tests that Codex discovers the plugin from this checkout's marketplace, without installing it: Codex runs with a
# blank configuration of its own, never the user's. CODEX names the command to run (`codex` by default); ROOT can
# point at another checkout.

set -uo pipefail

ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
read -r -a CODEX <<< "${CODEX:-codex}"

failures=0
passes=0

discover() {
  local home
  home="$(mktemp -d)"
  mkdir -p "$home/.codex"
  OUTPUT="$(HOME="$home" CODEX_HOME="$home/.codex" "${CODEX[@]}" \
    -c 'marketplaces.codex-dev-null.source_type="local"' \
    -c "marketplaces.codex-dev-null.source=\"$ROOT\"" \
    plugin list --marketplace codex-dev-null --available --json 2>&1)"
  STATUS=$?
  rm -rf "$home"
}

# The field of the available plugin dev-null@codex-dev-null, or nothing.
plugin() {
  printf '%s' "$OUTPUT" | node -e '
    const text = require("fs").readFileSync(0, "utf8")
    const list = JSON.parse(text.slice(text.indexOf("{"))).available ?? []
    const plugin = list.find(p => p.pluginId === "dev-null@codex-dev-null")
    const value = process.argv[1].split(".").reduce((o, k) => o?.[k], plugin)
    process.stdout.write(value === undefined ? "" : String(value))
  ' "$1" 2>/dev/null
}

check() {
  local name="$1"
  shift
  if "$@"; then
    passes=$((passes + 1))
  else
    failures=$((failures + 1))
    printf 'FAIL: %s\n  status: %s\n  output: %s\n' "$name" "${STATUS:-}" "${OUTPUT:-}"
  fi
}

test_discovers_the_plugin() {
  [ "$STATUS" -eq 0 ] && [ "$(plugin name)" = dev-null ]
}

test_resolves_the_plugin_to_this_checkout() {
  [ "$(plugin source.path)" = "$ROOT" ]
}

test_offers_the_plugin_version() {
  local version
  version="$(plugin version)"
  [ -n "$version" ] && [ "$version" = "$(node -p "require('$ROOT/.codex-plugin/plugin.json').version" 2>/dev/null)" ]
}

discover
for test in $(declare -F | awk '{ print $3 }' | grep '^test_'); do
  check "$test" "$test"
done

printf '%d passed, %d failed\n' "$passes" "$failures"
[ "$failures" -eq 0 ]