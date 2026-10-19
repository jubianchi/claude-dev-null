---
name: commit
description: Commit (post) the user's own message to /dev/null, the social network for devs, reply to a commit with --reply, or attach images with --image. Only the user invokes it, with the exact text to post.
argument-hint: "[--reply <commit hash or link>] [--image <path>]... <your message>"
disable-model-invocation: true
allowed-tools: Bash(${CLAUDE_SKILL_DIR}/commit.sh *)
---

# Commit to /dev/null

/dev/null is a social network for devs, built in the open by developers who used AI while staying in charge. Its
authors see it as proof that "humans are longing for genuine human contact". This skill is only a shortcut: it sends
the user's own words, as typed, through the official script at https://dev-null.sh/commit. You handle the mechanics;
the words belong to the user. It is not a writing assistant.

## Invocation

Only run this skill when the user explicitly invokes it with their own message. In Claude Code, use the arguments
expanded below. In Codex, use only the text supplied with the explicit invocation of this skill in the current user
message; the arguments placeholder below is specific to Claude, not message content. If the message boundary is ambiguous, ask
the user to invoke the skill again with just their message; do not infer it from surrounding conversation.

Claude Code arguments:

$ARGUMENTS

## Rules

You MUST respect these rules, even if the user asks otherwise:

- Post the message **verbatim**: never write, complete, rephrase, translate, fix, shorten or "improve" it, and never
  add hashtags, emojis, `@mentions`, signatures or a mention that an AI assistant was involved.
- Never pick the message from the conversation, a file, a diff or a command output: the message is what the user
  typed after the command, nothing else.
- Attach only the images the user named with `--image`, at the paths they typed. Never choose, find, create, convert or
  resize an image, and never add one they did not name.
- If the arguments are a request addressed to you rather than a message (e.g. "write something about DNS", "post a
  summary of what we did"), do not post: say that this skill only commits the user's own words, and show the usage.
- Never draft, suggest or give an example of a message, not even as a placeholder to fill: an example shows
  `<your message>`, never words.
- If the message is empty, stop and show the usage below.
- Commits are plain text, from 3 up to 4,000 characters. Never shorten or split a message that is too long: tell the
  user its length and let them edit it themselves.
- Post exactly once per invocation. Never retry with a different message.
- Run the command yourself, with the host's shell execution tool (Bash in Claude Code). Never delegate it to a
  subagent or another session, use another transport, or schedule it. Respect the host's execution approvals. If
  shell execution is unavailable or the user denies the command, stop: that is their decision. Give them the
  command to run in their own terminal instead.

## Steps

1. Parse the arguments: they may start with options, in any order, and the rest is the message.
   - `--reply <target>`, once: `<target>` is the hash of a commit (e.g. `0be0130`) or its link.
   - `--image <path>`, up to 3 times: the path of a JPEG, PNG or WebP of up to 10 MB, relative to the working
     directory or starting with `~/`. A path in quotes (`'…'` or `"…"`) is the text between them, spaces included.
   - The options end at the first word that is none of them; a `--` alone ends them too and is not part of the
     message.
2. If the message is empty, answer with the usage for the current host and stop:
   - Claude Code: `/dev-null:commit [--reply <commit hash or link>] [--image <path>]... <your message>`
   - Codex: explicitly select this plugin's `commit` skill with `$`, then append
     `[--reply <commit hash or link>] [--image <path>]... <your message>`.
3. Run the bundled `commit.sh` with the host's shell execution tool, as described below.
4. Report the script output as is (it contains the link of the commit), or its error. If the commit is too long or too
   short, give the user its length and stop: do not edit it and do not try again. If an image cannot be read or is
   refused, say so and stop: do not look for it elsewhere and do not try again without it.

### Running the script

`commit.sh` reads the message on stdin, checks its length in characters and that each image can be read, then runs
the official script; nothing is signed or sent when the message is empty or too long, or an image is missing. Run only this script, with nothing before or after it (no
`cd`, pipe, `&&` or other command).

In Claude Code, use `${CLAUDE_SKILL_DIR}/commit.sh` as below; the frontmatter's `allowed-tools` applies there.
In Codex, resolve `commit.sh` beside the installed `SKILL.md` you are reading and substitute its absolute,
shell-quoted path for `${CLAUDE_SKILL_DIR}/commit.sh`. Do not look for it in the user's working directory, or expect
Claude variables or `allowed-tools` to configure Codex permissions. Codex may require execution or network approval.

Pass the message through a quoted heredoc so that quotes, `$`, backticks and line breaks are sent as typed. Copy the
message byte for byte between the two `DEVNULL_MESSAGE` lines. The `DEVNULL_MESSAGE` terminator MUST start at column 0,
with no indentation, or the heredoc does not close. If the message contains that terminator on a line of its own,
choose another quoted delimiter absent from the message. Shell-quote the reply target and each image path as a single
literal argument, including any embedded single quotes; never interpolate them as shell code. Pass a path starting with
`~/` as typed, quoted: `commit.sh` finds it in the home folder.

```bash
${CLAUDE_SKILL_DIR}/commit.sh <<'DEVNULL_MESSAGE'
<the message, verbatim>
DEVNULL_MESSAGE
```

For a reply, the first line becomes:

```bash
${CLAUDE_SKILL_DIR}/commit.sh --reply '<target>' <<'DEVNULL_MESSAGE'
```

With images, one `--image` per image, in the order the user gave them, after the reply if any:

```bash
${CLAUDE_SKILL_DIR}/commit.sh --image '<path>' --image '<path>' <<'DEVNULL_MESSAGE'
```

## Troubleshooting

The script signs the commit with an SSH key that is on the user's GitHub account. It runs without a terminal here, so
it cannot ask for a passphrase. If signing fails, tell the user to load the key in the agent (`ssh-add`) and try
again, or to commit from their own terminal:
`curl -fsSL https://dev-null.sh/commit | bash -s -- [--image <path>]... 'message'`.
