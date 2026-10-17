# claude-dev-null

Claude plugin for /dev/null (https://dev-null.sh, source: https://github.com/nunomaduro/dev-null.sh).

## Principles

Every skill, command or server of this plugin MUST follow the principles of `README.md`:

- Claude MUST NOT write, suggest, complete, rephrase or translate the content of a commit; the user's words are sent
  verbatim
- A commit MUST only be sent when the user explicitly starts it: no hooks, schedules, subagents or model-invoked skills
  that commit
  (`disable-model-invocation: true` for Claude and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`
  for Codex, on any skill that writes to /dev/null)
- Only the official commit script (https://dev-null.sh/commit) and the public read API (`/api/v1`) MAY be used: no
  scraping, no undocumented or web-only routes; missing features are proposed upstream
- Write **/dev/null** exactly; a post is a **commit**, a timeline is a **log**; no other git metaphor (push, branch,
  fork…)

## Layout

- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`: Claude Code plugin and marketplace manifests
- `.codex-plugin/plugin.json`, `.agents/plugins/marketplace.json`: Codex plugin and marketplace manifests; the plugin
  manifests MUST keep the same name and version (`tests/manifests_test.sh`)
- `skills/commit/SKILL.md`: the `/dev-null:commit` skill, shared by Claude Code and Codex, with host-specific
  instructions; `skills/commit/agents/openai.yaml`: its Codex policy
- `skills/commit/commit.sh`: reads the message on stdin, checks it, runs the official script; the only command the skill
  pre-approves (`allowed-tools`)
- `tests/commit_test.sh`: tests for `commit.sh`, with a fake `curl`; nothing is sent
- `commands/compose.md`: names the `/dev-null:compose` command; the hooks module answers it without a model turn, and
  the file's prompt only runs when the module did not load
- `hooks/register.tsx`: the hooks module drawing the composer band above the prompt (terminal and desktop only) and
  running `commit.sh` directly with `$.process.run`; `hooks/draft.ts`: the checks of a draft
- `types/index.d.ts`: the module's state contract (`PluginState`)
- `tests/compose.test.tsx`: tests for the hooks module, run by `claude plugin test`; `process.run` is faked, nothing is
  sent
- `tsconfig.json`: extends the one Claude Code writes in `.claude-plugin/types/` (ignored by git)
- `package.json`: pins Biome (TypeScript and JSON), Prettier (Markdown and YAML), TypeScript and git-cliff; run
  `npm run format` before committing
- `cliff.toml`: the git-cliff configuration generating `CHANGELOG.md` (`npm run changelog`) from the features, fixes
  and breaking changes of the history; `tests/changelog_test.sh` tests it on throwaway repositories;
  `.github/workflows/changelog.yml` regenerates and pushes it on `main`, so pull requests MUST NOT change
  `CHANGELOG.md`

## Checks

Every change MUST pass the checks of @CONTRIBUTING.md.
