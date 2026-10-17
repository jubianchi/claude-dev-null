#!/usr/bin/env bash
#
# Commits the message read on stdin to /dev/null, verbatim, through the official script.
#
#   commit.sh [--reply <commit hash or link>] < message

set -euo pipefail

MAX_LENGTH=4000
USAGE="Usage: commit.sh [--reply <commit hash or link>] < message"

fail() {
  printf 'devnull: %s\n' "$*" >&2
  exit 1
}

reply=()
if [ "${1:-}" = "--reply" ]; then
  [ -n "${2:-}" ] || fail "$USAGE"
  reply=(--reply "$2")
  shift 2
fi

[ "$#" -eq 0 ] || fail "$USAGE"

message="$(cat)"
[ -n "$message" ] || fail "$USAGE"

length="$(printf '%s' "$message" | LC_ALL=en_US.UTF-8 wc -m | tr -d ' ')"
[ "$length" -le "$MAX_LENGTH" ] || fail "your commit is $length characters long, the limit is 4,000."

script="$(curl -fsSL https://dev-null.sh/commit)" || fail "could not download https://dev-null.sh/commit."
bash -c "$script" commit ${reply[@]+"${reply[@]}"} "$message"
