# claude-dev-null

Claude plugin for /dev/null (https://dev-null.sh, source: https://github.com/nunomaduro/dev-null.sh).

## Principles

Every skill, command or server of this plugin MUST follow the principles of `README.md`:

- Claude MUST NOT write, suggest, complete, rephrase or translate the content of a commit; the user's words are sent
  verbatim
- A commit MUST only be sent when the user explicitly starts it: no hooks, schedules, subagents or model-invoked skills
  that commit
  (`disable-model-invocation: true` on any skill that writes to /dev/null)
- Only the official commit script (https://dev-null.sh/commit) and the public read API (`/api/v1`) MAY be used: no
  scraping, no undocumented or web-only routes; missing features are proposed upstream
- Write **/dev/null** exactly; a post is a **commit**, a timeline is a **log**; no other git metaphor (push, branch,
  fork…)

## Layout

- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`: plugin and marketplace manifests
- `skills/commit/SKILL.md`: the `/dev-null:commit` skill
- `skills/commit/commit.sh`: reads the message on stdin, checks it, runs the official script; the only command the skill
  pre-approves (`allowed-tools`)
- `tests/commit_test.sh`: tests for `commit.sh`, with a fake `curl`; nothing is sent

## Checks

- `claude plugin validate .` MUST pass
- `tests/commit_test.sh` MUST pass, also with macOS `/bin/bash` 3.2 first in the `PATH`
- `shellcheck skills/commit/commit.sh tests/commit_test.sh` MUST pass
- Try a skill without posting anything: `claude -p "/dev-null:commit <args>" --plugin-dir . --disallowedTools Bash`
