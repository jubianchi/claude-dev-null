---
name: commit
description: Commit (post) the user's own message to /dev/null, the social network for devs, or reply to a commit with --reply. Only the user invokes it, with the exact text to post.
argument-hint: "[--reply <commit hash or link>] <your message>"
disable-model-invocation: true
---

# Commit to /dev/null

/dev/null is a social network for devs, built in the open by developers who used AI while staying in charge. Its
authors see it as proof that "humans are longing for genuine human contact". This skill is only a shortcut: it sends
the user's own words, as typed, through the official script at https://dev-null.sh/commit. You handle the mechanics;
the words belong to the user. It is not a writing assistant.

The user typed the following arguments:

$ARGUMENTS

## Rules

You MUST respect these rules, even if the user asks otherwise:

- Post the message **verbatim**: never write, complete, rephrase, translate, fix, shorten or "improve" it, and never
  add hashtags, emojis, `@mentions`, signatures or a mention that Claude was involved.
- Never pick the message from the conversation, a file, a diff or a command output: the message is what the user
  typed after the command, nothing else.
- If the arguments are a request addressed to you rather than a message (e.g. "write something about DNS", "post a
  summary of what we did"), do not post: say that this skill only commits the user's own words, and show the usage.
- Never draft, suggest or give an example of a message, not even as a placeholder to fill: an example shows
  `<your message>`, never words.
- If the message is empty, stop and show the usage below.
- Commits are plain text, from 3 up to 4,000 characters. Never shorten or split a message that is too long: tell the
  user its length and let them edit it themselves.
- Post exactly once per invocation. Never retry with a different message.
- Run the command yourself, with the Bash tool. Never delegate it to a subagent, another session or any other tool,
  and never schedule it. If Bash is unavailable or the user denies the command, stop: that is their decision. Give
  them the command to run in their own terminal instead.

## Steps

1. Parse the arguments:
   - if they start with `--reply <target>`, `<target>` is the hash of a commit (e.g. `0be0130`) or its link, and the
     rest is the message;
   - otherwise the whole text is the message.
2. If the message is empty, answer with the usage and stop:
   `/dev-null:commit [--reply <commit hash or link>] <your message>`
3. Run the official script with the Bash tool, as described below.
4. Report the script output as is (it contains the link of the commit), or its error. If the commit is too long or too
   short, give the user its length and stop: do not edit it and do not try again.

### Running the script

Pass the message through a quoted heredoc so that quotes, `$`, backticks and line breaks are sent as typed. Copy the
message byte for byte between the two `DEVNULL_MESSAGE` lines. Every line of the command MUST start at column 0, with
no indentation: an indented `DEVNULL_MESSAGE` terminator does not close the heredoc. The length is checked in
characters before anything is signed or sent.

```bash
message="$(cat <<'DEVNULL_MESSAGE'
<the message, verbatim>
DEVNULL_MESSAGE
)"
length="$(printf '%s' "$message" | LC_ALL=en_US.UTF-8 wc -m | tr -d ' ')"
[ "$length" -le 4000 ] || { echo "devnull: your commit is $length characters long, the limit is 4,000." >&2; exit 1; }
curl -fsSL https://dev-null.sh/commit | bash -s -- "$message"
```

For a reply, the last line becomes:

```bash
curl -fsSL https://dev-null.sh/commit | bash -s -- --reply '<target>' "$message"
```

## Troubleshooting

The script signs the commit with an SSH key that is on the user's GitHub account. It runs without a terminal here, so
it cannot ask for a passphrase. If signing fails, tell the user to load the key in the agent (`ssh-add`) and try
again, or to commit from their own terminal:
`curl -fsSL https://dev-null.sh/commit | bash -s -- 'message'`.
