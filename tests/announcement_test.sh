#!/usr/bin/env bash
#
# Tests for scripts/announcement.sh, on announcements written in a temporary directory.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANNOUNCEMENT="$ROOT/scripts/announcement.sh"

failures=0
passes=0

setup() {
  WORK="$(mktemp -d)"
}

teardown() {
  rm -rf "$WORK"
}

run_announcement() {
  OUTPUT="$("$ANNOUNCEMENT" "$@" 2>&1)"
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

test_prints_the_announcement_of_a_version_as_written() {
  printf 'Line one, with `code` and $HOME.\n\n  Line three.\n' > "$WORK/0.6.0.txt"
  run_announcement 0.6.0 "$WORK"
  [ "$STATUS" -eq 0 ] && [ "$OUTPUT" = "$(printf 'Line one, with `code` and $HOME.\n\n  Line three.')" ]
}

test_accepts_a_tag() {
  printf 'Hello.\n' > "$WORK/0.6.0.txt"
  run_announcement v0.6.0 "$WORK"
  [ "$STATUS" -eq 0 ] && [ "$OUTPUT" = 'Hello.' ]
}

test_fails_when_the_version_has_none() {
  run_announcement 0.6.0 "$WORK"
  [ "$STATUS" -ne 0 ] && [[ "$OUTPUT" == *"$WORK/0.6.0.txt"* ]]
}

test_fails_on_an_empty_announcement() {
  printf '\n \n' > "$WORK/0.6.0.txt"
  run_announcement 0.6.0 "$WORK"
  [ "$STATUS" -ne 0 ] && [[ "$OUTPUT" == *'empty'* ]]
}

test_takes_4000_characters() {
  printf '%4000s' '' | tr ' ' 'é' > "$WORK/0.6.0.txt"
  run_announcement 0.6.0 "$WORK"
  [ "$STATUS" -eq 0 ]
}

test_fails_past_4000_characters() {
  printf '%4001s' '' | tr ' ' 'a' > "$WORK/0.6.0.txt"
  run_announcement 0.6.0 "$WORK"
  [ "$STATUS" -ne 0 ] && [[ "$OUTPUT" == *'4001'* ]]
}

test_reads_the_repository_announcements_by_default() {
  run_announcement 0.0.0-none
  [ "$STATUS" -ne 0 ] && [[ "$OUTPUT" == *"$ROOT/announcements/0.0.0-none.txt"* ]]
}

for test in $(declare -F | awk '{ print $3 }' | grep '^test_'); do
  setup
  check "$test" "$test"
  teardown
done

printf '%d passed, %d failed\n' "$passes" "$failures"
[ "$failures" -eq 0 ]
