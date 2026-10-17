#!/usr/bin/env bash
#
# Tests for skills/commit/commit.sh. Nothing is sent: a fake `curl` on the PATH records how it was called and
# serves a fake commit script that records the arguments it received.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMMIT="$ROOT/skills/commit/commit.sh"

failures=0
passes=0

setup() {
  WORK="$(mktemp -d)"
  mkdir -p "$WORK/bin"
  cat > "$WORK/bin/curl" <<'FAKE_CURL'
#!/usr/bin/env bash
for arg in "$@"; do printf '%s\0' "$arg"; done > "$FAKE_DIR/curl.args"
[ -z "${FAKE_CURL_FAIL:-}" ] || exit 22
printf '%s\n' 'for arg in "$@"; do printf "%s\0" "$arg"; done > "$FAKE_DIR/script.args"' 'echo "Committed: https://dev-null.sh/@me/commits/1"'
FAKE_CURL
  chmod +x "$WORK/bin/curl"
}

teardown() {
  rm -rf "$WORK"
}

run_commit() {
  OUTPUT="$(FAKE_DIR="$WORK" PATH="$WORK/bin:$PATH" "$COMMIT" "$@" 2>&1)"
  STATUS=$?
}

expect_args() {
  local file="$1"
  shift
  local expected
  expected="$(for arg in "$@"; do printf '%s\0' "$arg"; done | od -c)"
  [ -f "$WORK/$file" ] && [ "$(od -c < "$WORK/$file")" = "$expected" ]
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

test_fetches_the_official_script() {
  run_commit <<< 'It was DNS.'
  [ "$STATUS" -eq 0 ] && expect_args curl.args -fsSL https://dev-null.sh/commit
}

test_sends_the_message_verbatim() {
  local message
  message="$(printf '%s\n%s' "It's \`DNS\`, \$HOME & \"quotes\" \$(whoami) 😁" 'second line')"
  run_commit <<< "$message"
  [ "$STATUS" -eq 0 ] && expect_args script.args "$message"
}

test_prints_the_script_output() {
  run_commit <<< 'It was DNS.'
  [ "$STATUS" -eq 0 ] && [ "$OUTPUT" = 'Committed: https://dev-null.sh/@me/commits/1' ]
}

test_replies_to_a_commit() {
  run_commit --reply 0be0130 <<< 'Agreed!'
  [ "$STATUS" -eq 0 ] && expect_args script.args --reply 0be0130 'Agreed!'
}

test_refuses_an_empty_message() {
  run_commit < /dev/null
  [ "$STATUS" -ne 0 ] && [ ! -f "$WORK/curl.args" ] && [[ "$OUTPUT" == *Usage* ]]
}

test_refuses_a_reply_without_target() {
  run_commit --reply <<< 'Agreed!'
  [ "$STATUS" -ne 0 ] && [ ! -f "$WORK/curl.args" ] && [[ "$OUTPUT" == *Usage* ]]
}

test_accepts_4000_characters() {
  run_commit <<< "$(printf 'é%.0s' $(seq 4000))"
  [ "$STATUS" -eq 0 ] && [ -f "$WORK/script.args" ]
}

test_refuses_more_than_4000_characters() {
  run_commit <<< "$(printf 'é%.0s' $(seq 4001))"
  [ "$STATUS" -ne 0 ] && [ ! -f "$WORK/curl.args" ] && [[ "$OUTPUT" == *"4001 characters"* ]]
}

test_fails_when_the_script_cannot_be_fetched() {
  FAKE_CURL_FAIL=1 run_commit <<< 'It was DNS.'
  [ "$STATUS" -ne 0 ] && [ ! -f "$WORK/script.args" ]
}

for test in $(declare -F | awk '{ print $3 }' | grep '^test_'); do
  setup
  check "$test" "$test"
  teardown
done

printf '%d passed, %d failed\n' "$passes" "$failures"
[ "$failures" -eq 0 ]
