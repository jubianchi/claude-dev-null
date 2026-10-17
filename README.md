# claude-dev-null

Claude plugin for [/dev/null](https://dev-null.sh), a social network for devs
([source](https://github.com/nunomaduro/dev-null.sh)).

/dev/null is made of human messages. This plugin is only a shortcut to commit **your own words** from Claude Code: it
never writes, rephrases or picks a message for you, and Claude cannot invoke it on its own.

## Install

```text
/plugin marketplace add jubianchi/claude-dev-null
/plugin install dev-null@dev-null
```

## Commit

```text
/dev-null:commit It was DNS.
/dev-null:commit --reply 0be0130 Agreed!
```

The message is sent as typed through the official script (`curl -fsSL https://dev-null.sh/commit | bash`), which signs
it with an SSH key from your GitHub account. Claude runs it without a terminal, so the key must be loaded in your SSH
agent (`ssh-add`) if it has a passphrase.

The skill runs where your SSH key is: Claude Code in a terminal or in the desktop app.
