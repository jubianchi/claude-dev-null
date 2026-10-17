#!/usr/bin/env bash
#
# Tests for cliff.toml: each test builds a throwaway git repository and checks the changelog git-cliff generates
# from it.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLIFF="$ROOT/node_modules/.bin/git-cliff"

failures=0
passes=0

setup() {
  REPO="$(mktemp -d)"
  git -C "$REPO" init -q -b main
  commit 'chore: initial commit'
}

teardown() {
  rm -rf "$REPO"
}

commit() {
  git -C "$REPO" -c user.name=Test -c user.email=test@example.com commit -q --allow-empty -m "$1"
}

run_cliff() {
  OUTPUT="$("$CLIFF" --config "$ROOT/cliff.toml" --repository "$REPO" 2>&1)"
  STATUS=$?
}

# The lines of the section headed `### $1`, up to the next heading.
section() {
  printf '%s\n' "$OUTPUT" | awk -v title="### $1" '$0 == title { inside = 1; next } /^#/ { inside = 0 } inside && /^- /'
}

check() {
  local name="$1"
  shift
  if "$@"; then
    passes=$((passes + 1))
  else
    failures=$((failures + 1))
    printf 'FAIL: %s\n  status: %s\n  output:\n%s\n' "$name" "${STATUS:-}" "${OUTPUT:-}"
  fi
}

test_lists_features() {
  commit 'feat(compose): open a composer'
  run_cliff
  [ "$STATUS" -eq 0 ] && [[ "$(section Features)" == '- **compose**: open a composer ('* ]]
}

test_lists_fixes() {
  commit 'fix: say where the composer runs'
  run_cliff
  [[ "$(section Fixes)" == '- say where the composer runs ('* ]]
}

test_links_each_change_to_its_commit() {
  commit 'feat: open a composer'
  local id
  id="$(git -C "$REPO" rev-parse HEAD)"
  run_cliff
  [[ "$(section Features)" == *"([${id:0:7}](https://github.com/jubianchi/claude-dev-null/commit/$id))" ]]
}

test_leaves_out_other_types() {
  commit 'docs: document the composer'
  commit 'ci: run the checks'
  commit 'build: add Biome'
  commit 'style: format the module'
  commit 'refactor: split the module'
  commit 'test: cover the composer'
  commit 'chore(plugin): release 0.2.0'
  commit 'feat: open a composer'
  run_cliff
  [ "$(printf '%s\n' "$OUTPUT" | grep -c '^- ')" -eq 1 ]
}

test_leaves_out_unconventional_commits() {
  commit 'Update README'
  commit 'feat: open a composer'
  run_cliff
  [[ "$OUTPUT" != *'Update README'* ]]
}

test_lists_breaking_changes_marked_with_a_bang() {
  commit 'feat(compose)!: drop the auto mode'
  run_cliff
  [[ "$(section 'Breaking changes')" == '- **compose**: drop the auto mode ('* ]] && [ -z "$(section Features)" ]
}

test_lists_breaking_changes_marked_with_a_footer() {
  commit "$(printf 'fix: rename the modes\n\nBREAKING CHANGE: auto is now always.')"
  run_cliff
  [[ "$(section 'Breaking changes')" == '- rename the modes ('* ]] && [ -z "$(section Fixes)" ]
}

test_lists_breaking_changes_of_any_type() {
  commit 'refactor!: rename the plugin'
  run_cliff
  [[ "$(section 'Breaking changes')" == '- rename the plugin ('* ]]
}

test_leaves_out_merge_commits() {
  git -C "$REPO" switch -q -c feature
  commit 'feat: open a composer'
  git -C "$REPO" switch -q main
  git -C "$REPO" -c user.name=Test -c user.email=test@example.com merge -q --no-ff -m 'feat: open a composer (#1)' feature
  run_cliff
  [ "$(printf '%s\n' "$OUTPUT" | grep -c 'open a composer')" -eq 1 ]
}

test_leaves_out_empty_sections() {
  commit 'feat: open a composer'
  run_cliff
  [[ "$OUTPUT" != *'### Fixes'* && "$OUTPUT" != *'### Breaking changes'* ]]
}

test_groups_changes_by_version() {
  commit 'feat: add the commit skill'
  git -C "$REPO" tag v0.1.0
  commit 'feat: open a composer'
  run_cliff
  [[ "$OUTPUT" == *'## Unreleased'*'open a composer'*'## [0.1.0] - '*'add the commit skill'* ]]
}

test_orders_sections() {
  commit 'fix: say where the composer runs'
  commit 'feat: open a composer'
  commit 'feat!: drop the auto mode'
  run_cliff
  [[ "$OUTPUT" == *'### Breaking changes'*'### Features'*'### Fixes'* ]]
}

for test in $(declare -F | awk '{ print $3 }' | grep '^test_'); do
  setup
  check "$test" "$test"
  teardown
done

printf '%d passed, %d failed\n' "$passes" "$failures"
[ "$failures" -eq 0 ]