#!/usr/bin/env bash
#
# Tests for hooks/device-key.sh, with the real ssh-keygen: the signatures are checked as /dev/null checks them, in the
# devnull-api namespace. Nothing is sent.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVICE_KEY="$ROOT/hooks/device-key.sh"
MESSAGE="$(printf '1760534400\n3f9c2a7e5b1d4c8f9a0b2c3d4e5f6a7b\nGET\n/api/v1/me\n')"

failures=0
passes=0

setup() {
  WORK="$(mktemp -d)"
  mkdir -p "$WORK/tmp"
  STATUS=
  OUTPUT=
}

teardown() {
  rm -rf "$WORK"
}

create_key() {
  OUTPUT="$(TMPDIR="$WORK/tmp" "$DEVICE_KEY" create 2> "$WORK/stderr")"
  STATUS=$?
  PUBLIC="$(printf '%s\n' "$OUTPUT" | sed -n 1p)"
  FINGERPRINT="$(printf '%s\n' "$OUTPUT" | sed -n 2p)"
  PRIVATE="$(printf '%s\n' "$OUTPUT" | sed -n '3,$p')"
}

sign() {
  OUTPUT="$(printf '%s' "$1" | DEVNULL_KEY="$PRIVATE" TMPDIR="$WORK/tmp" "$DEVICE_KEY" sign 2> "$WORK/stderr")"
  STATUS=$?
}

# Whether $1, the base64 of a signature, signs $2 by the key that was created, in the devnull-api namespace.
verifies() {
  printf -- '-----BEGIN SSH SIGNATURE-----\n%s\n-----END SSH SIGNATURE-----\n' "$1" | fold -w 70 > "$WORK/signature"
  printf '%s\n' "$PUBLIC" > "$WORK/key.pub"
  printf '%s' "$2" | ssh-keygen -Y check-novalidate -n devnull-api -f "$WORK/key.pub" -s "$WORK/signature" > /dev/null 2>&1
}

nothing_left() {
  [ -z "$(ls -A "$WORK/tmp")" ]
}

check() {
  local name="$1"
  shift
  if "$@"; then
    passes=$((passes + 1))
  else
    failures=$((failures + 1))
    printf 'FAIL: %s\n  status: %s\n  output: %s\n  stderr: %s\n' "$name" "${STATUS:-}" "${OUTPUT:-}" \
      "$(cat "$WORK/stderr" 2> /dev/null)"
  fi
}

test_creates_an_ed25519_key() {
  create_key
  [ "$STATUS" -eq 0 ] &&
    [[ "$PUBLIC" == "ssh-ed25519 "* ]] &&
    [[ "$PRIVATE" == "-----BEGIN OPENSSH PRIVATE KEY-----"* ]] &&
    [[ "$PRIVATE" == *"-----END OPENSSH PRIVATE KEY-----" ]]
}

test_gives_the_fingerprint_dev_null_identifies_the_device_by() {
  create_key
  printf '%s\n' "$PUBLIC" > "$WORK/key.pub"
  [ "$STATUS" -eq 0 ] &&
    [[ "$FINGERPRINT" =~ ^SHA256:[A-Za-z0-9+/]{43}$ ]] &&
    [ "$FINGERPRINT" = "$(ssh-keygen -l -E sha256 -f "$WORK/key.pub" | awk '{ print $2 }')" ]
}

test_creates_a_new_key_each_time() {
  create_key
  local first="$FINGERPRINT"
  create_key
  [ "$STATUS" -eq 0 ] && [ "$FINGERPRINT" != "$first" ]
}

test_leaves_no_key_behind_once_created() {
  create_key
  [ "$STATUS" -eq 0 ] && nothing_left
}

test_signs_the_message_in_the_devnull_api_namespace() {
  create_key
  sign "$MESSAGE"
  [ "$STATUS" -eq 0 ] && verifies "$OUTPUT" "$MESSAGE"
}

test_signs_the_message_as_it_is_with_its_last_empty_line() {
  local message
  message="$(printf '1760534400\n3f9c2a7e5b1d4c8f9a0b2c3d4e5f6a7b\nGET\n/api/v1/me\n_')"
  message="${message%_}"
  create_key
  sign "$message"
  [ "$STATUS" -eq 0 ] && verifies "$OUTPUT" "$message" && ! verifies "$OUTPUT" "${message%$'\n'}"
}

test_prints_the_signature_on_one_line_without_its_armor() {
  create_key
  sign "$MESSAGE"
  [ "$STATUS" -eq 0 ] && [[ "$OUTPUT" =~ ^[A-Za-z0-9+/]+=*$ ]]
}

test_leaves_no_key_behind_once_signed() {
  create_key
  sign "$MESSAGE"
  [ "$STATUS" -eq 0 ] && nothing_left
}

test_refuses_to_sign_without_a_key() {
  OUTPUT="$(printf '%s' "$MESSAGE" | TMPDIR="$WORK/tmp" "$DEVICE_KEY" sign 2> "$WORK/stderr")"
  STATUS=$?
  [ "$STATUS" -ne 0 ] && [ -z "$OUTPUT" ] && nothing_left
}

test_refuses_to_sign_with_what_is_no_key() {
  PRIVATE='not a key'
  sign "$MESSAGE"
  [ "$STATUS" -ne 0 ] && [ -z "$OUTPUT" ] && nothing_left
}

test_refuses_an_unknown_command() {
  OUTPUT="$("$DEVICE_KEY" push 2> "$WORK/stderr")"
  STATUS=$?
  [ "$STATUS" -ne 0 ] && grep -q Usage "$WORK/stderr"
}

for test in $(declare -F | awk '{ print $3 }' | grep '^test_'); do
  setup
  check "$test" "$test"
  teardown
done

printf '%d passed, %d failed\n' "$passes" "$failures"
[ "$failures" -eq 0 ]
