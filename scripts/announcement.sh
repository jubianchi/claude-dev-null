#!/usr/bin/env bash
#
# Prints the announcement of a version, as its maintainer wrote it in announcements/<version>.txt: the commit the
# release workflow sends to /dev/null. Fails when there is none, or when /dev/null would refuse it.
#
#   announcement.sh <version or tag> [directory]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIN_LENGTH=3
MAX_LENGTH=4000

[ "$#" -ge 1 ] || {
  echo "Usage: announcement.sh <version or tag> [directory]" >&2
  exit 2
}

version="${1#v}"
file="${2:-$ROOT/announcements}/$version.txt"

[ -f "$file" ] || {
  echo "announcement.sh: no announcement for $version: write it in $file" >&2
  exit 1
}

text="$(cat -- "$file")"

[ -n "${text//[[:space:]]/}" ] || {
  echo "announcement.sh: the announcement of $version is empty" >&2
  exit 1
}

# Characters as /dev/null counts them: code points, each UTF-8 byte but the continuation ones.
length="$(printf '%s' "$text" | LC_ALL=C tr -d '\200-\277' | wc -c | tr -d ' ')"

[ "$length" -ge "$MIN_LENGTH" ] && [ "$length" -le "$MAX_LENGTH" ] || {
  echo "announcement.sh: the announcement of $version has $length characters, /dev/null takes $MIN_LENGTH to $MAX_LENGTH" >&2
  exit 1
}

printf '%s\n' "$text"
