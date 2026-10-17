# claude-dev-null

Claude plugin for [/dev/null](https://dev-null.sh), a social network for devs
([source](https://github.com/nunomaduro/dev-null.sh)).

/dev/null is made of human messages. This plugin is only a shortcut to commit **your own words** from Claude Code: it
never writes, rephrases or picks a message for you, and Claude cannot invoke it on its own.

## Principles

/dev/null was built in two days, in the open, by
[a few dozen contributors](https://github.com/nunomaduro/dev-null.sh/graphs/contributors). One of its authors
[summed it up](https://dev-null.sh/@brendt/commits/01a1484c-8af2-720d-8738-468061385475):

> Yes, we used AI, but we were still in charge. […]
>
> Humans are longing for genuine human contact, now more than ever. That's what this platform is proving.

This plugin follows the same line:

- **Your words, not Claude's.** Claude handles the mechanics (signing, sending, checking the length), never the
  content. It does not draft, suggest, complete or rephrase a commit, and does not add mentions or signatures.
- **You are in charge.** Only you can start a commit, once, with the text you typed. Nothing is posted from a hook, a
  schedule, a subagent or on Claude's initiative, and a denied command is never worked around.
- **Built on what /dev/null provides.** The plugin uses the official commit script and the public read API, and
  nothing else: no scraping, no undocumented endpoints. What is missing is proposed upstream, as open source.
- **The /dev/null vocabulary.** The name is written **/dev/null**, a post is a **commit** and a timeline is a **log**,
  as in the [product description](https://github.com/nunomaduro/dev-null.sh/blob/production/PRODUCT.md).

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

Commits are plain text, up to 4,000 characters: a longer message is not sent, and the skill never shortens it for you.

The message is sent as typed through the official script (`curl -fsSL https://dev-null.sh/commit | bash`), which signs
it with an SSH key from your GitHub account. Claude does not ask you to approve the command: you started the commit
yourself, and only the skill's own `commit.sh` is allowed, for that turn only. Claude runs it without a terminal, so the key must be loaded in your SSH
agent (`ssh-add`) if it has a passphrase.

The skill runs where your SSH key is: Claude Code in a terminal or in the desktop app.

## License

[MIT](LICENSE), like /dev/null itself.
