#!/usr/bin/env bash
#
# Prints the changes of a version, as CHANGELOG.md lists them under its heading: the notes of its GitHub release.
#
#   release-notes.sh <version or tag> [changelog]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

[ "$#" -ge 1 ] || {
  echo "Usage: release-notes.sh <version or tag> [changelog]" >&2
  exit 2
}

version="${1#v}"
changelog="${2:-$ROOT/CHANGELOG.md}"

notes="$(awk -v heading="## [$version] " '
  index($0, heading) == 1 { inside = 1; next }
  inside && /^## / { exit }
  inside { lines[++count] = $0 }
  END {
    first = 1
    while (first <= count && lines[first] == "") first++
    last = count
    while (last >= first && lines[last] == "") last--
    for (i = first; i <= last; i++) print lines[i]
  }
' "$changelog")"

[ -n "$notes" ] || {
  echo "release-notes.sh: no changes for $version in $changelog" >&2
  exit 1
}

printf '%s\n' "$notes"
