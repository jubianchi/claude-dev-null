# claude-dev-null

Claude Code and Codex plugin for [/dev/null](https://dev-null.sh), a social network for devs
([source](https://github.com/nunomaduro/dev-null.sh)).

/dev/null is made of human messages. This plugin is only a shortcut to commit **your own words** from Claude Code or
Codex: it never writes, rephrases or picks a message for you, and the assistant cannot invoke it on its own.

## Principles

/dev/null was built in two days, in the open, by
[a few dozen contributors](https://github.com/nunomaduro/dev-null.sh/graphs/contributors). One of its authors
[summed it up](https://dev-null.sh/@brendt/commits/01a1484c-8af2-720d-8738-468061385475):

> Yes, we used AI, but we were still in charge. […]
>
> Humans are longing for genuine human contact, now more than ever. That's what this platform is proving.

This plugin follows the same line:

- **Your words, not the assistant's.** The assistant handles the mechanics (signing, sending, checking the length), never the
  content. It does not draft, suggest, complete or rephrase a commit, and does not add mentions or signatures.
- **You are in charge.** Only you can start a commit, once, with the text you typed. Nothing is posted from a hook, a
  schedule, a subagent or on the assistant's initiative, and a denied command is never worked around.
- **Built on what /dev/null provides.** The plugin uses the official commit script and the public read API, and
  nothing else: no scraping, no undocumented endpoints. What is missing is proposed upstream, as open source.
- **The /dev/null vocabulary.** The name is written **/dev/null**, a post is a **commit** and a timeline is a **log**,
  as in the [product description](https://github.com/nunomaduro/dev-null.sh/blob/production/PRODUCT.md).

## Install

### Claude Code

```text
/plugin marketplace add jubianchi/claude-dev-null
/plugin install dev-null@claude-dev-null
```

### Codex

Add the marketplace from a shell:

```bash
codex plugin marketplace add jubianchi/claude-dev-null
```

Then install `dev-null` from the `/dev/null` marketplace (`codex-dev-null`) in the plugin browser. For local
development, use `codex plugin marketplace add /absolute/path/to/claude-dev-null` instead.

Explicitly select this plugin's `commit` skill with `$` and append `[--reply <commit hash or link>] <your message>`.
The skill sends only the message supplied with that invocation; it cannot be selected implicitly by Codex.

Codex needs local shell execution, network access, and access to your SSH agent. Its normal execution approvals
apply: Claude's `allowed-tools` declaration does not pre-approve commands in Codex. The composer below is available
only in Claude Code.

## Update

For Claude Code:

Fetch the latest version of the marketplace, then of the plugin, from a shell:

```bash
claude plugin marketplace update claude-dev-null
claude plugin update dev-null@claude-dev-null
```

Then run `/reload-plugins` in the sessions already open, or start a new one.

For Codex, refresh the marketplace with `codex plugin marketplace upgrade codex-dev-null`, then update the installed
plugin through the plugin browser and start a new session.

## Commit

In Claude Code:

```text
/dev-null:commit It was DNS.
/dev-null:commit --reply 0be0130 Agreed!
```

Commits are plain text, up to 4,000 characters: a longer message is not sent, and the skill never shortens it for you.

The message is sent as typed through the official script (`curl -fsSL https://dev-null.sh/commit | bash`), which signs
it with an SSH key from your GitHub account. Claude does not ask you to approve the command: you started the commit
yourself, and only the skill's own `commit.sh` is allowed, for that turn only. Claude runs it without a terminal, so the key must be loaded in your SSH
agent (`ssh-add`) if it has a passphrase.

The skill runs where your SSH key is: Claude Code in a terminal or in the desktop app's Code tab, not in a chat.

## Compose

```text
/dev-null:compose
/dev-null:compose always
/dev-null:compose manual
```

`/dev-null:compose` opens a composer above the prompt: a field for your message, an optional one for the commit you
reply to (its hash or link), and Commit and Cancel. It counts the characters as you type and says why a commit cannot
be sent yet; Commit only shows once it can. Commit, or Enter in either field, sends it through the same `commit.sh`,
directly: your words never go through the model. The result, the commit's link or the error, shows in a toast; after
a commit, the composer closes.

`/dev-null:compose always` keeps the composer shown, from one session to the next: after a commit it is emptied for
the next one, and Cancel becomes Clear. `/dev-null:compose manual` hides it again and keeps your draft for the next
`/dev-null:compose`.

The composer is drawn in a terminal and in the desktop app's Code tab. A chat does not run the plugin's hooks module, so
`/dev-null:compose` only says so there.

## License

[MIT](LICENSE), like /dev/null itself.
