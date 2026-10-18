# claude-dev-null

Claude Code and Codex plugin for [/dev/null](https://dev-null.sh), a social network for devs
([source](https://github.com/nunomaduro/dev-null.sh)).

/dev/null is made of human messages. This plugin is only a shortcut to commit **your own words** from Claude Code or
Codex, and to read the log from Claude Code: it never writes, rephrases or picks a message for you, and the assistant
cannot invoke it on its own.

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
- **Built on what /dev/null provides.** Commits go through the official commit script only. The public read API has
  no Following, Latest or Trending log, so the log reads the data the web app loads for them, as it does: read only,
  never to commit, star, follow or change anything. Following reads it as you, with the session cookie you paste
  yourself; the plugin keeps it on your machine and sends it to dev-null.sh only.
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
apply: Claude's `allowed-tools` declaration does not pre-approve commands in Codex. The composer and the log below
are available only in Claude Code.

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

## Log

```text
/dev-null:log
```

`/dev-null:log` opens the /dev/null log in a pane, and closes it when run again. The composer stays at the top, then
come the tabs, then the log; only the log scrolls. While the pane is open, the composer above the prompt hides.

- **Following**: the commits of the people you follow on /dev/null. It shows once signed in from Account, and the log
  opens on it; signed out, it hides and the log opens on Latest.
- **Latest** and **Trending**: everyone's latest commits, and the trending ones, in the order of /dev/null. They are
  read without signing in.
- **Account**: signs in, with the cookie /dev/null signs you in with.

Each commit shows who wrote it, in the color of their lane, when, its words (with their links, mentions, code and blocks
of code), the commit it quotes, its link card and its images (as links), its stars and replies. A poll shows its
options, their share once /dev/null shows the votes, and how long is left; voting is done on dev-null.sh, which the
poll links to, since the log never writes. Its replies sit under it, newest first, each followed by its own replies, one level right, down
to the third. Its count of replies, **💬**, puts the commit in the composer's reply field, and its short hash links to it on
dev-null.sh. **More**, at the end of the
log, loads its next page.

**🔄** loads the log shown again; **auto** does it every minute, from one session to the next, counting
down the seconds to the next time beside it. A log loads one page and
reads the replies of its commits with ten requests at most, to stay well within /dev/null's 60 requests a minute.

### Sign in

Following needs the cookie dev-null.sh signs you in with after a GitHub sign-in, `remember_web_…`, valid until you
sign out there:

1. Sign in on [dev-null.sh](https://dev-null.sh), in your browser.
2. Open its developer tools, then the cookies of `https://dev-null.sh` (Application in Chrome, Storage in Firefox and
   Safari).
3. Copy the cookie whose name starts with `remember_web_`, and paste it in the Account tab as `name=value`; a whole
   `Cookie` header works too, the plugin keeps that cookie only.

The plugin checks who the cookie signs in, then keeps it in its store, on your machine, and sends it to dev-null.sh
only, with Following only: reading a log as you makes it the log dev-null.sh opens on. It never shows the cookie
again, and **Forget the cookie** removes it. Never paste it in the conversation: the assistant must not see it.

The log is drawn in a terminal and in the desktop app's Code tab, like the composer.

## License

[MIT](LICENSE), like /dev/null itself.
