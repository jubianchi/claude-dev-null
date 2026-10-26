# <img src="https://dev-null.sh/icon-192.png" height="24"/> claude-dev-null

Claude Code and Codex plugin for [/dev/null](https://dev-null.sh), a social network for devs
([source](https://github.com/dev-null-sh/dev-null.sh)).

/dev/null is made of human messages. This plugin is only a shortcut to commit **your own words** from Claude Code or
Codex, and to read the log from Claude Code: it never writes, rephrases or picks a message for you, and the assistant
cannot invoke it on its own.

## Principles

/dev/null was built in two days, in the open, by
[a few dozen contributors](https://github.com/dev-null-sh/dev-null.sh/graphs/contributors). One of its authors
[summed it up](https://dev-null.sh/@brendt/commits/01a1484c-8af2-720d-8738-468061385475):

> Yes, we used AI, but we were still in charge. […]
>
> Humans are longing for genuine human contact, now more than ever. That's what this platform is proving.

This plugin follows the same line:

- **Your words, not the assistant's.** The assistant handles the mechanics (signing, sending, checking the length), never the
  content. It does not draft, suggest, complete or rephrase a commit, and does not add mentions or signatures.
- **You are in charge.** Only you can start a commit, once, with the text you typed. Nothing is posted from a hook, a
  schedule, a subagent or on the assistant's initiative, and a denied command is never worked around. The one
  exception is outside the plugin: once the maintainer publishes a release, the release workflow sends the
  announcement they wrote for it, word for word.
- **Built on what /dev/null provides.** Commits go through the official commit script only. The logs are read from
  /dev/null's signed API, as the device you approved once on dev-null.sh, with a key the plugin keeps on your
  machine; until you approve it, Latest and Trending from the data the web app loads for them, as it does, signed in
  as no one; and the pictures of their commits. The log writes through the API only what you ask of it, when you
  press its button (Vote in a poll, ⭐ to star a commit), and never commits through it.
- **The /dev/null vocabulary.** The name is written **/dev/null**, a post is a **commit** and a timeline is a **log**,
  as in the [product description](https://github.com/dev-null-sh/dev-null.sh/blob/production/PRODUCT.md).

## Install

Both marketplaces install the latest release, [0.8.0](https://github.com/jubianchi/claude-dev-null/releases/tag/v0.8.0),
never the code of `main`, which is not released yet.

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

Then install `dev-null` from the `/dev/null` marketplace (`codex-dev-null`) in the plugin browser.

Explicitly select this plugin's `commit` skill with `$` and append
`[--reply <commit hash or link>] [--image <path>]... <your message>`.
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
/dev-null:commit --image shipped.png Shipped!
```

Commits are plain text, up to 4,000 characters, a link counting for 23 at most: a longer message is not sent, and the
skill never shortens it for you.
`--image` attaches the image at a path, relative to the folder Claude Code runs in or starting with `~/`, up to 3 times:
JPEG, PNG or WebP files of up to 10 MB each. Quote a path with spaces. The skill only attaches the images you name.

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

`/dev-null:compose` opens a composer above the prompt: a field for your message, an optional one for the path of an
image, an optional one for the commit you reply to (its hash or link), and Commit and Cancel. It counts the characters as
you type and says why a commit cannot be sent yet; Commit only shows once it can. Commit, or Enter in the message or
reply field, sends it through the same `commit.sh`, directly: your words never go through the model. While it is being
sent, Committing… shows in place of Commit, and pressing again sends nothing more. The result, the commit's link or the
error, shows in a toast; after a commit, the composer closes.

Enter in the image field adds the image to the commit, listed under it with a × to take it out: up to 3 JPEG, PNG or
WebP files of up to 10 MB each. A path left in the field when you commit goes with the commit too. A path is relative to
the folder Claude Code runs in, or starts with `~/` for your home folder; a file dropped from the Finder on the
terminal, its path escaped or quoted as for a shell, works too.

`/dev-null:compose` closes it again when it is open, and keeps your draft for the next one.

`/dev-null:compose always` keeps the composer shown, from one session to the next: after a commit it is emptied for
the next one, and Cancel becomes Clear. `/dev-null:compose manual`, or `/dev-null:compose` alone, hides it again, goes
back to showing it on demand and keeps your draft for the next `/dev-null:compose`. The settings of the log (**⚙**)
choose between the two too.

The composer is drawn in a terminal and in the desktop app's Code tab. A chat does not run the plugin's hooks module, so
`/dev-null:compose` only says so there.

## Log

```text
/dev-null:log
```

`/dev-null:log` opens the /dev/null log in a pane, and closes it when run again. The composer stays at the top, then
come the tabs, then the log; only the log scrolls. The composer shows once only: above the prompt while it is open
there (or always, with `/dev-null:compose always`), the pane then showing the tabs and the log alone; in the pane
otherwise. Closing it above the prompt moves it into the pane, the draft with it.

- **Following**: the commits of the people you follow on /dev/null. It shows once you approved the plugin from the
  settings, and the log opens on it; otherwise, it hides and the log opens on Latest.
- **Latest** and **Trending**: everyone's latest commits, and the trending ones, in the order of /dev/null. They are
  read from the API once you approved the plugin, and without signing in before.
- **Starred**: the commits you starred, the last starred first. Like Following, it shows once you approved the plugin.
- **⚙**, at the end of the row of the tabs: the settings, shown in place of the log until pressed again, or a tab is:
  approve the plugin as a device of yours on /dev/null, refresh the log on its own, and show the composer above the
  prompt always, or on demand.

Each commit shows who wrote it, in the color of their lane, when, its words (with their links, mentions, code and blocks
of code; the start of a long one, as /dev/null shows it, then the whole of it in the pane once **Show more** is
pressed), the commit it quotes, its link card and its images, its stars and replies (once you approved the plugin,
**⭐️** stars the commit of someone else, or takes your star back; dimmed while you have not starred it). Where the
terminal draws pictures, as
Ghostty and kitty do, the images are drawn in the log, their link under them; elsewhere, in tmux, across ssh or in the
desktop app, they stay links. A poll shows its
options, their share once /dev/null shows the votes, and how long is left. Once you approved the plugin, you vote in
it as on the site: press an option, then **Vote**; a vote is final. Until then, the poll links to dev-null.sh, to vote
there. Its replies sit under it, newest first, each followed by its own replies, one level right, down
to the fourth: 3 under it and under each reply, as /dev/null shows them by default, then **Show N more**, which shows
as many more; the settings (**⚙**) choose how many, as the site does, which keeps its choice in your browser only. Its count of replies, **💬**, puts the commit in the composer's reply field, and its short hash links to it on
dev-null.sh. **More**, at the end of the
log, loads its next page.

Once you approved the plugin, **🧵** opens the thread of a commit in place of the log: the commits it replies to, from
the first, then the commit and its replies. **←**, in place of the tabs, shows the log again, where it was scrolled to.

A tab pressed loads its log again, the one shown too, from its top. The settings (**⚙**) have the log shown do so every
minute, from one session to the next, keeping your place and the pages **More** loaded: the commits that arrive above
it wait there, and **↑ N new commits**, a blue badge over the top of the log as on the site, shows them, as scrolling
up to them does. A log loads one page and
reads the replies of its commits with ten requests at most, to stay well within /dev/null's 60 requests a minute.

### Sign in

Following is read as a device you approve once on dev-null.sh. **Sign in with dev-null.sh**, in the settings (**⚙**),
creates the key of the device the first time, an ed25519 key the plugin keeps in its store, on your machine, and
hands to `ssh-keygen` only; only its signatures are sent, to dev-null.sh only. Revoke the device among those of your
account on dev-null.sh to end it there; **Forget the approval** forgets it here.

- Once /dev/null lets a terminal sign in
  ([dev-null-sh/dev-null.sh#585](https://github.com/dev-null-sh/dev-null.sh/pull/585)), the settings show a code to type
  on dev-null.sh, and waits for your approval.
- Until then, the settings approve the plugin as the app of /dev/null is approved, a stopgap: open the page it links to,
  approve Claude Code, then copy the `devnull://authorize?code=…` link dev-null.sh sends your browser to, which it
  cannot open (from the `Location` of the answer to **Approve**, in the network tab of its developer tools, if it
  shows it nowhere else), and paste it there within 5 minutes. The plugin keeps it for that sign-in only, never
  in its store, and sends its code to dev-null.sh only. Never paste it in the conversation: the assistant must not
  see it.

The cookie earlier versions signed in with is no longer used, and the plugin forgets it.

The log is drawn in a terminal and in the desktop app's Code tab, like the composer.

## License

[MIT](LICENSE), like /dev/null itself.
