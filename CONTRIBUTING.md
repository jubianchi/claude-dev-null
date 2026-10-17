# Contributing

Contributions are welcome, as long as they follow the [principles](README.md#principles) of this plugin.

## Checks

Every change MUST pass these checks. None of them posts anything to /dev/null. All but the last two also run in
[GitHub Actions](.github/workflows/checks.yml), on every pull request.

- The plugin and marketplace manifests are valid:

  ```bash
  claude plugin validate .
  ```

- The tests of `commit.sh` pass, with a recent bash and with the bash 3.2 shipped with macOS:

  ```bash
  tests/commit_test.sh
  bin="$(mktemp -d)" && ln -s /bin/bash "$bin/bash" && PATH="$bin:$PATH" tests/commit_test.sh; rm -rf "$bin"
  ```

- The shell scripts are clean:

  ```bash
  shellcheck skills/commit/commit.sh tests/commit_test.sh
  ```

- The tests of the composer's hooks module pass. They run against Claude Code's own engine, with a fake `commit.sh`:

  ```bash
  claude plugin test .
  ```

- The hooks module and its tests type-check. `tsconfig.json` extends the one Claude Code writes, with the plugin API's
  types, in `.claude-plugin/types/` (ignored by git) when it loads the plugin from this folder:

  ```bash
  CLAUDE_CODE_PLUGIN_DIR_WATCH=1 claude -p /dev-null:compose --plugin-dir .
  npx --yes -p typescript tsc -p .
  ```

  An interactive `claude --plugin-dir .` writes them too, and gives your editor the completions. Restart the editor's
  TypeScript service when `types/index.d.ts` changes.

- The skill behaves as expected. Try it with Bash disabled, so that nothing can be sent:

  ```bash
  claude -p "/dev-null:commit <args>" --plugin-dir . --disallowedTools Bash
  ```

- The composer draws as expected, in a terminal and in the desktop app: run `/reload-plugins`, then
  `/dev-null:compose`. Pressing Commit sends a real commit.