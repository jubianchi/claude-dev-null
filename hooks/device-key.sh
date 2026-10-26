#!/usr/bin/env bash
#
# The key the plugin signs its requests to the API of /dev/null with, approved there as a device.
#
#   device-key.sh create              prints a new ed25519 key: its public key, its fingerprint, then its private key
#   device-key.sh sign < message      prints the signature of the message, in the devnull-api namespace, as base64 on
#                                     one line, by the private key in DEVNULL_KEY
#
# The private key only lives in a file of its own while ssh-keygen reads it, removed whatever happens; it is never an
# argument, which other processes could read.

set -euo pipefail

USAGE="Usage: device-key.sh create | device-key.sh sign < message (the private key in DEVNULL_KEY)"

fail() {
  printf '/dev/null: %s\n' "$*" >&2
  exit 1
}

umask 077

create() {
  folder="$(mktemp -d "${TMPDIR:-/tmp}/dev-null-key.XXXXXX")"
  trap 'rm -rf "$folder"' EXIT

  ssh-keygen -q -t ed25519 -N '' -C dev-null -f "$folder/key" < /dev/null
  cat "$folder/key.pub"
  ssh-keygen -l -E sha256 -f "$folder/key.pub" | awk '{ print $2 }'
  cat "$folder/key"
}

sign() {
  [ -n "${DEVNULL_KEY:-}" ] || fail "no key to sign with: $USAGE"

  local signature
  key="$(mktemp "${TMPDIR:-/tmp}/dev-null-key.XXXXXX")"
  trap 'rm -f "$key"' EXIT

  printf '%s\n' "$DEVNULL_KEY" > "$key"
  signature="$(ssh-keygen -q -Y sign -n devnull-api -f "$key")"
  printf '%s\n' "$signature" | sed '1d;$d' | tr -d '\n'
}

case "${1:-}" in
  create) create ;;
  sign) sign ;;
  *) fail "$USAGE" ;;
esac
