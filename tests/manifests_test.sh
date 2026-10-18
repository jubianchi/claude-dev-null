#!/usr/bin/env bash
#
# Tests that the Claude Code and Codex manifests describe the same plugin: same name, same version, so a release
# bumps both; and that both marketplaces install the release the README names, a tag of this repository. ROOT can
# point at another checkout, with its tags.

set -uo pipefail

ROOT="${ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
CLAUDE="$ROOT/.claude-plugin/plugin.json"
CODEX="$ROOT/.codex-plugin/plugin.json"
CLAUDE_MARKETPLACE="$ROOT/.claude-plugin/marketplace.json"
CODEX_MARKETPLACE="$ROOT/.agents/plugins/marketplace.json"
REPOSITORY=jubianchi/claude-dev-null

failures=0
passes=0

# The value at the dotted `path` of the JSON file, or nothing.
field() {
  node -p "process.argv[2].split('.').reduce((o, k) => o?.[k], require(process.argv[1])) ?? ''" "$1" "$2"
}

# The tag both marketplaces pin the plugin to, as Claude Code's names it.
pinned() {
  field "$CLAUDE_MARKETPLACE" plugins.0.source.ref
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

test_claude_installs_a_tag_of_this_repository() {
  [ "$(field "$CLAUDE_MARKETPLACE" plugins.0.source.source)" = github ] &&
    [ "$(field "$CLAUDE_MARKETPLACE" plugins.0.source.repo)" = "$REPOSITORY" ] &&
    [[ "$(pinned)" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]
}

test_codex_installs_the_same_tag() {
  [ "$(field "$CODEX_MARKETPLACE" plugins.0.source.source)" = url ] &&
    [ "$(field "$CODEX_MARKETPLACE" plugins.0.source.url)" = "https://github.com/$REPOSITORY.git" ] &&
    [ "$(field "$CODEX_MARKETPLACE" plugins.0.source.ref)" = "$(pinned)" ]
}

test_the_tag_is_the_release_it_names() {
  local tag
  tag="$(pinned)"
  git -C "$ROOT" rev-parse -q --verify "refs/tags/$tag" > /dev/null &&
    git -C "$ROOT" show "$tag:.claude-plugin/plugin.json" | grep -q "\"version\": \"${tag#v}\""
}

test_the_readme_names_the_release() {
  local tag
  tag="$(pinned)"
  [ -n "$tag" ] &&
    grep -qF "[${tag#v}](https://github.com/$REPOSITORY/releases/tag/$tag)" "$ROOT/README.md"
}

for test in $(declare -F | awk '{ print $3 }' | grep '^test_'); do
  check "$test" "$test"
done

printf '%d passed, %d failed\n' "$passes" "$failures"
[ "$failures" -eq 0 ]
