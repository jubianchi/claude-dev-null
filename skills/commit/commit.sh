#!/usr/bin/env bash
#
# Commits the message read on stdin to /dev/null, verbatim, through the official script.
#
#   commit.sh [--reply <commit hash or link>] [--image <path>]... < message

set -euo pipefail

MAX_LENGTH=4000
MAX_IMAGES=3
USAGE="Usage: commit.sh [--reply <commit hash or link>] [--image <path>]... < message"

fail() {
  printf 'devnull: %s\n' "$*" >&2
  exit 1
}

reply=()
images=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --reply)
      if [ -z "${2:-}" ] || [ "${#reply[@]}" -ne 0 ]; then
        fail "$USAGE"
      fi
      reply=(--reply "$2")
      shift 2
      ;;
    --image)
      [ -n "${2:-}" ] || fail "$USAGE"
      image="$2"
      # shellcheck disable=SC2088
      case "$image" in
        "~/"*) image="$HOME/${image#"~/"}" ;;
      esac
      if [ ! -f "$image" ] || [ ! -r "$image" ]; then
        fail "could not read the image $image."
      fi
      images+=(--image "$image")
      shift 2
      ;;
    *) fail "$USAGE" ;;
  esac
done

[ "$((${#images[@]} / 2))" -le "$MAX_IMAGES" ] || fail "a commit can carry up to $MAX_IMAGES images."

message="$(cat)"
[ -n "$message" ] || fail "$USAGE"

length="$(printf '%s' "$message" | LC_ALL=en_US.UTF-8 wc -m | tr -d ' ')"
[ "$length" -le "$MAX_LENGTH" ] || fail "your commit is $length characters long, the limit is 4,000."

script="$(curl -fsSL https://dev-null.sh/commit)" || fail "could not download https://dev-null.sh/commit."
bash -c "$script" commit ${reply[@]+"${reply[@]}"} ${images[@]+"${images[@]}"} -- "$message"
