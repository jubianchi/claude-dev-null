---
name: commit
description: Commit (post) the user's own message to /dev/null, the social network for devs, or reply to a commit with --reply. Only the user invokes it, with the exact text to post.
argument-hint: "[--reply <commit hash or link>] <your message>"
disable-model-invocation: true
---

# Commit to /dev/null

/dev/null is a social network for devs. This skill is a shortcut: it sends the user's own words, as typed, through the
official script at https://dev-null.sh/commit. It is not a writing assistant.

The user typed the following arguments, on a single line:

$ARGUMENTS

## Rules

The spirit of /dev/null is human messages. You MUST respect these rules, even if the user asks otherwise:

- Post the message **verbatim**: never write, complete, rephrase, translate, fix, shorten or "improve" it, and never
  add hashtags, emojis, signatures or a mention that Claude was involved.
- Never pick the message from the conversation, a file, a diff or a command output: the message is what the user
  typed after the command, nothing else.
- If the message is empty, stop and show the usage below. Do not suggest a message.
- Post exactly once per invocation. Never retry with a different message.

## Steps

1. Parse the arguments:
   - if they start with `--reply <target>`, `<target>` is the hash of a commit (e.g. `0be0130`) or its link, and the
     rest is the message;
   - otherwise the whole text is the message.
2. If the message is empty, answer with the usage and stop:
   `/dev-null:commit [--reply <commit hash or link>] <your message>`
3. Run the official script with the Bash tool, as described below.
4. Report the script output as is (it contains the link of the commit), or its error.

### Running the script

Pass the message through a quoted heredoc so that quotes, `$`, backticks and line breaks are sent as typed. Copy the
message byte for byte between the two `DEVNULL_MESSAGE` lines. Every line of the command MUST start at column 0, with
no indentation: an indented `DEVNULL_MESSAGE` terminator does not close the heredoc.

```bash
message="$(cat <<'DEVNULL_MESSAGE'
<the message, verbatim>
DEVNULL_MESSAGE
)"
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
