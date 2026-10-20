#!/usr/bin/env bash
#
# Prints the version tag a push publishes: the one the Claude Code marketplace pins at <after>, when it pinned another
# at <before>, as the publication pull request of a release does. Prints nothing for any other push, and when <before>
# is not known, so that nothing is announced twice or by mistake.
#
#   published-release.sh <before> <after>

set -euo pipefail

MARKETPLACE=.claude-plugin/marketplace.json

[ "$#" -eq 2 ] || {
  echo "Usage: published-release.sh <before> <after>" >&2
  exit 2
}

# The tag the marketplace pins at `commit`, or nothing.
pinned() {
  git show "$1:$MARKETPLACE" 2> /dev/null |
    node -e 'let text = ""; process.stdin.on("data", chunk => (text += chunk)).on("end", () => {
      try { process.stdout.write(String(JSON.parse(text).plugins?.[0]?.source?.ref ?? "")) } catch {}
    })'
}

git cat-file -e "$1^{commit}" 2> /dev/null || exit 0

before="$(pinned "$1")"
after="$(pinned "$2")"

if [[ "$after" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]] && [ "$after" != "$before" ]; then
  printf '%s\n' "$after"
fi
