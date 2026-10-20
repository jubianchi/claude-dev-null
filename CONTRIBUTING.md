# Contributing

Contributions are welcome, as long as they follow the [principles](README.md#principles) of this plugin.

## Tools

[Biome](https://biomejs.dev) formats and lints the TypeScript and JSON files, [Prettier](https://prettier.io) formats
the Markdown and YAML ones. They and TypeScript are pinned in `package.json`:

```bash
npm ci
npm run format
```

## Changelog

`CHANGELOG.md` is generated from the history by [git-cliff](https://git-cliff.org), configured in `cliff.toml`. It
lists the features (`feat`), fixes (`fix`) and breaking changes (`!` after the type, or a `BREAKING CHANGE:` footer)
only, under the version tag (`v0.2.0`) that released them, so commit titles MUST follow
[Conventional Commits](https://www.conventionalcommits.org).

The [Changelog workflow](.github/workflows/changelog.yml) regenerates it after every push to `main` or of a version
tag, and pushes it to `main` when it changed, as `github-actions[bot]`. Pull requests leave `CHANGELOG.md` alone; to
preview it:

```bash
npm run changelog
```

The workflow then creates the GitHub release of every version tag that has none yet, its notes being the version's
section of `CHANGELOG.md` (`scripts/release-notes.sh <version>`).

## Releases

The marketplaces install the latest release, never `main`: both pin the plugin to its tag (`ref`), and the README
names it. Between two releases, `main` carries the next version with a `-dev` suffix (`0.5.0-dev`), so that a plugin
loaded from a checkout never passes for a release. `tests/manifests_test.sh` checks all of it.

A release takes two pull requests, so that the marketplaces never pin a tag that does not exist yet:

1. **Release** (`chore(plugin): release 0.5.0`): drop the `-dev` suffix in both `.claude-plugin/plugin.json` and
   `.codex-plugin/plugin.json` (or bump the version, for a major one), and write the announcement of the release on
   /dev/null in `announcements/0.5.0.txt`, yourself: 3 to 4,000 characters, sent word for word
   (`scripts/announcement.sh 0.5.0` prints it, and `tests/manifests_test.sh` fails without it). Once merged, tag the
   merge commit and push the tag: the workflow moves the unreleased changes under that version, then creates the GitHub
   release.

   ```bash
   git tag -a v0.5.0 <merge commit> -m "0.5.0: <what it brings>"
   git push origin v0.5.0
   ```

2. **Publication** (`chore(plugin): publish 0.5.0`): pin the new tag in both `.claude-plugin/marketplace.json` and
   `.agents/plugins/marketplace.json`, name it in the README (Install), and start the next version on `main`
   (`0.6.0-dev`) in both `plugin.json`. Once merged, `claude plugin marketplace update` and
   `codex plugin marketplace upgrade` offer the release, and the workflow commits its announcement to /dev/null
   (`scripts/published-release.sh` tells it which release the push publishes) with
   [/dev/null's GitHub Action](https://github.com/nunomaduro/dev-null.sh/tree/production/.github/actions/commit),
   signed with the `DEVNULL_SSH_KEY` secret of the repository: a private SSH key without a passphrase, whose public
   key is on the maintainer's GitHub account. Running the workflow again sends it again.

To try the code of `main`, load the plugin from a checkout with `claude --plugin-dir .`: the marketplace of a checkout
still installs the release it pins, for Claude Code and Codex alike.

## Checks

Every change MUST pass these checks. None of them posts anything to /dev/null. All but the last two also run in
[GitHub Actions](.github/workflows/checks.yml), on every pull request.

- The code style is consistent:

  ```bash
  npm run check
  ```

- The plugin and marketplace manifests are valid:

  ```bash
  claude plugin validate .
  ```

- The Claude Code and Codex manifests describe the same plugin, with the same name and version, and both
  marketplaces install the release the README names, a tag this checkout has, behind the version of `main`:

  ```bash
  tests/manifests_test.sh
  ```

- Codex discovers the plugin from this checkout's marketplace, at the release tag it pins, and installs that release
  from GitHub. The test runs Codex with a blank configuration of its own, in a throwaway home: it leaves your settings
  and plugins alone. `CODEX` names another command to run:

  ```bash
  tests/codex_test.sh
  ```

- The tests of `commit.sh` pass, with a recent bash and with the bash 3.2 shipped with macOS:

  ```bash
  tests/commit_test.sh
  bin="$(mktemp -d)" && ln -s /bin/bash "$bin/bash" && PATH="$bin:$PATH" tests/commit_test.sh; rm -rf "$bin"
  ```

- The tests of `hooks/device-key.sh` pass, with the real `ssh-keygen`, with a recent bash and with the bash 3.2 shipped
  with macOS:

  ```bash
  tests/device_key_test.sh
  bin="$(mktemp -d)" && ln -s /bin/bash "$bin/bash" && PATH="$bin:$PATH" tests/device_key_test.sh; rm -rf "$bin"
  ```

- The shell scripts are clean:

  ```bash
  shellcheck skills/commit/commit.sh hooks/*.sh scripts/*.sh tests/*.sh
  ```

- The changelog configuration lists what it should. The tests build throwaway git repositories:

  ```bash
  tests/changelog_test.sh
  ```

- The release notes are the version's section of the changelog:

  ```bash
  tests/release_notes_test.sh
  ```

- The tests of the hooks module, the composer and the log, pass. They run against Claude Code's own engine, with a
  fake `commit.sh` and a fake dev-null.sh: nothing is sent, and no real cookie is used:

  ```bash
  claude plugin test .
  ```

- The hooks module and its tests type-check. `tsconfig.json` extends the one Claude Code writes, with the plugin API's
  types, in `.claude-plugin/types/` (ignored by git) when it loads the plugin from this folder:

  ```bash
  CLAUDE_CODE_PLUGIN_DIR_WATCH=1 claude -p /dev-null:compose --plugin-dir .
  npm run typecheck
  ```

  An interactive `claude --plugin-dir .` writes them too, and gives your editor the completions. Restart the editor's
  TypeScript service when `types/index.d.ts` changes.

- The skill behaves as expected. Try it with Bash disabled, so that nothing can be sent:

  ```bash
  claude -p "/dev-null:commit <args>" --plugin-dir . --disallowedTools Bash
  ```

- The composer draws as expected, in a terminal and in the desktop app's Code tab: run `/reload-plugins`, then
  `/dev-null:compose`. Pressing Commit sends a real commit.

- The log draws as expected, there too: run `/reload-plugins`, then `/dev-null:log`. Latest and Trending read
  dev-null.sh without signing in; Following needs your own cookie, pasted in the Account tab, never in a conversation
  or a file of the repository.

## Log

The public read API has no Following, Latest or Trending log, so the log reads the Inertia JSON the web app loads for
its `/log/{following,latest,trending}` pages, and the replies of their commits, with `GET` requests only. Keep
anything that could write (commit, star, follow, bookmark…) out of it: commits go through the official script only.

The code follows hexagonal architecture: `hooks/infrastructure/` talks to dev-null.sh, `hooks/application/` holds the
use cases, `hooks/state/` the module's state, and `hooks/components/` draws, from the props it is given only. Test each
layer with fakes of the one below it.

## Portable skills

Keep one shared `skills/<name>/SKILL.md` and host-independent helpers. The Codex manifest at
`.codex-plugin/plugin.json` exposes the whole `skills/` directory; `.agents/plugins/marketplace.json` is its separate
catalog. Keep the Claude manifests and composer integration independent.

Describe host-specific invocation, script paths, and permissions explicitly. Codex resolves helpers relative to the
installed skill, not the working directory; it does not expand Claude's `$ARGUMENTS` or `${CLAUDE_SKILL_DIR}`.

Every skill that writes to /dev/null must retain `disable-model-invocation: true` for Claude and include
`policy.allow_implicit_invocation: false` in its `agents/openai.yaml` for Codex. Preserve the user's exact words,
explicit invocation, single send, and refusal behavior in both hosts. Read-only skills can use normal discovery.

Both plugin manifests keep the same name and version (`tests/manifests_test.sh`). Test behavior with shell execution disabled or
with a fake sender; never use a real commit as an automated test. Check empty input, a request to generate content,
literal shell characters, replies, length limits, and denied execution.
