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

To release a version, bump it in both `.claude-plugin/plugin.json` and `.codex-plugin/plugin.json` in a pull request,
then tag the merge commit and push the tag: the workflow moves the unreleased changes under that version.

```bash
git tag -a v0.3.0 <merge commit> -m "0.3.0: <what it brings>"
git push origin v0.3.0
```

## Checks

Every change MUST pass these checks. None of them posts anything to /dev/null. All but the last three also run in
[GitHub Actions](.github/workflows/checks.yml), on every pull request.

- The code style is consistent:

  ```bash
  npm run check
  ```

- The plugin and marketplace manifests are valid:

  ```bash
  claude plugin validate .
  ```

- The Claude Code and Codex manifests describe the same plugin, with the same name and version:

  ```bash
  tests/manifests_test.sh
  ```

- The tests of `commit.sh` pass, with a recent bash and with the bash 3.2 shipped with macOS:

  ```bash
  tests/commit_test.sh
  bin="$(mktemp -d)" && ln -s /bin/bash "$bin/bash" && PATH="$bin:$PATH" tests/commit_test.sh; rm -rf "$bin"
  ```

- The shell scripts are clean:

  ```bash
  shellcheck skills/commit/commit.sh tests/commit_test.sh tests/changelog_test.sh tests/manifests_test.sh
  ```

- The changelog configuration lists what it should. The tests build throwaway git repositories:

  ```bash
  tests/changelog_test.sh
  ```

- The tests of the composer's hooks module pass. They run against Claude Code's own engine, with a fake `commit.sh`:

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

- Codex discovers the plugin from this checkout, without installing it or changing your settings. The result must
  include `dev-null@codex-dev-null` and resolve its source to this checkout:

  ```bash
  codex -c 'marketplaces.codex-dev-null.source_type="local"' \
    -c "marketplaces.codex-dev-null.source=\"$PWD\"" \
    plugin list --marketplace codex-dev-null --available --json
  ```

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
