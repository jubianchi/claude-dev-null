# Contributing

Contributions are welcome, as long as they follow the [principles](README.md#principles) of this plugin.

## Checks

Every change MUST pass these checks. None of them posts anything to /dev/null.

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

- The skill behaves as expected. Try it with Bash disabled, so that nothing can be sent:

  ```bash
  claude -p "/dev-null:commit <args>" --plugin-dir . --disallowedTools Bash
  ```
