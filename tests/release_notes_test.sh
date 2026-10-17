#!/usr/bin/env bash
#
# Tests for scripts/release-notes.sh, on changelogs written in a temporary directory.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOTES="$ROOT/scripts/release-notes.sh"

failures=0
passes=0

setup() {
  WORK="$(mktemp -d)"
  CHANGELOG="$WORK/CHANGELOG.md"
  cat > "$CHANGELOG" <<'CHANGELOG'
# Changelog

All the features, fixes and breaking changes of the plugin.

## Unreleased

### Fixes

- an unreleased fix ([1111111](https://example.com/1111111))

## [0.2.0] - 2026-10-17

### Features

- **compose**: open a composer ([2222222](https://example.com/2222222))

### Fixes

- **compose**: a fix ([3333333](https://example.com/3333333))

## [0.1.0] - 2026-10-16

### Features

- **commit**: add a skill ([4444444](https://example.com/4444444))
CHANGELOG
}

teardown() {
  rm -rf "$WORK"
}

run_notes() {
  OUTPUT="$("$NOTES" "$@" 2>&1)"
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

test_prints_the_section_of_a_version() {
  run_notes 0.2.0 "$CHANGELOG"
  local expected
  expected="$(printf '%s\n' '### Features' '' '- **compose**: open a composer ([2222222](https://example.com/2222222))' '' \
    '### Fixes' '' '- **compose**: a fix ([3333333](https://example.com/3333333))')"
  [ "$STATUS" -eq 0 ] && [ "$OUTPUT" = "$expected" ]
}

test_prints_the_last_section() {
  run_notes 0.1.0 "$CHANGELOG"
  [ "$STATUS" -eq 0 ] && [ "$OUTPUT" = "$(printf '%s\n' '### Features' '' '- **commit**: add a skill ([4444444](https://example.com/4444444))')" ]
}

test_accepts_a_tag() {
  run_notes v0.1.0 "$CHANGELOG"
  [ "$STATUS" -eq 0 ] && [[ "$OUTPUT" == '### Features'*'add a skill'* ]]
}

test_does_not_match_a_version_prefix() {
  run_notes 0.2 "$CHANGELOG"
  [ "$STATUS" -ne 0 ]
}

test_fails_on_an_unknown_version() {
  run_notes 9.9.9 "$CHANGELOG"
  [ "$STATUS" -ne 0 ] && [[ "$OUTPUT" == *'9.9.9'* ]]
}

test_fails_on_a_version_without_changes() {
  printf '%s\n' '# Changelog' '' '## [0.0.1] - 2026-10-01' '' '## [0.0.0] - 2026-09-01' > "$CHANGELOG"
  run_notes 0.0.1 "$CHANGELOG"
  [ "$STATUS" -ne 0 ]
}

test_reads_the_repository_changelog_by_default() {
  run_notes 0.1.0
  [ "$STATUS" -eq 0 ] && [[ "$OUTPUT" == '### Features'* ]]
}

for test in $(declare -F | awk '{ print $3 }' | grep '^test_'); do
  setup
  check "$test" "$test"
  teardown
done

printf '%d passed, %d failed\n' "$passes" "$failures"
[ "$failures" -eq 0 ]