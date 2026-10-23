#!/usr/bin/env bash
#
# Tests for scripts/published-release.sh: each test builds a throwaway git repository whose commits pin a tag in the
# Claude Code marketplace, as the publication of a release does.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PUBLISHED="$ROOT/scripts/published-release.sh"
NONE=0000000000000000000000000000000000000000

failures=0
passes=0

setup() {
  REPO="$(mktemp -d)"
  git -C "$REPO" init -q -b main
  mkdir -p "$REPO/.claude-plugin"
}

teardown() {
  rm -rf "$REPO"
}

# Commits the marketplace pinning `ref`, and the file `other` when given; prints the commit.
pin() {
  local ref="$1" other="${2:-}"
  printf '{ "plugins": [{ "name": "dev-null", "source": { "source": "github", "ref": "%s" } }] }\n' "$ref" \
    > "$REPO/.claude-plugin/marketplace.json"
  [ -z "$other" ] || printf '%s\n' "$other" > "$REPO/other.txt"
  git -C "$REPO" add -A
  git -C "$REPO" -c user.name=Test -c user.email=test@example.com commit -q --allow-empty -m "pin $ref"
  git -C "$REPO" rev-parse HEAD
}

run_published() {
  OUTPUT="$(cd "$REPO" && "$PUBLISHED" "$@" 2>&1)"
  STATUS=$?
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

test_names_the_tag_a_push_pins() {
  local before after
  before="$(pin v0.5.0)"
  after="$(pin v0.6.0)"
  run_published "$before" "$after"
  [ "$STATUS" -eq 0 ] && [ "$OUTPUT" = v0.6.0 ]
}

test_names_the_tag_pinned_by_any_commit_of_the_push() {
  local before after
  before="$(pin v0.5.0)"
  pin v0.6.0 > /dev/null
  after="$(pin v0.6.0 'something else')"
  run_published "$before" "$after"
  [ "$STATUS" -eq 0 ] && [ "$OUTPUT" = v0.6.0 ]
}

test_names_nothing_when_the_push_pins_the_same_tag() {
  local before after
  before="$(pin v0.5.0)"
  after="$(pin v0.5.0 'something else')"
  run_published "$before" "$after"
  [ "$STATUS" -eq 0 ] && [ -z "$OUTPUT" ]
}

test_names_nothing_without_a_commit_before() {
  local after
  after="$(pin v0.6.0)"
  run_published "$NONE" "$after"
  [ "$STATUS" -eq 0 ] && [ -z "$OUTPUT" ]
}

test_names_nothing_when_the_commit_before_is_unknown() {
  local after
  after="$(pin v0.6.0)"
  run_published 1234567890123456789012345678901234567890 "$after"
  [ "$STATUS" -eq 0 ] && [ -z "$OUTPUT" ]
}

test_names_nothing_but_a_version_tag() {
  local before after
  before="$(pin v0.5.0)"
  after="$(pin main)"
  run_published "$before" "$after"
  [ "$STATUS" -eq 0 ] && [ -z "$OUTPUT" ]
}

for test in $(declare -F | awk '{ print $3 }' | grep '^test_'); do
  setup
  check "$test" "$test"
  teardown
done

printf '%d passed, %d failed\n' "$passes" "$failures"
[ "$failures" -eq 0 ]
