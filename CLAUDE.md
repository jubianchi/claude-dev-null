# claude-dev-null

Claude plugin for /dev/null (https://dev-null.sh, source: https://github.com/nunomaduro/dev-null.sh).

## Principles

Every skill, command or server of this plugin MUST follow the principles of `README.md`:

- Claude MUST NOT write, suggest, complete, rephrase or translate the content of a commit; the user's words are sent
  verbatim
- A commit MUST only be sent when the user explicitly starts it: no hooks, schedules, subagents or model-invoked skills
  that commit
  (`disable-model-invocation: true` for Claude and `policy.allow_implicit_invocation: false` in `agents/openai.yaml`
  for Codex, on any skill that writes to /dev/null)
- Commits MUST go through the official commit script (https://dev-null.sh/commit) only
- The one exception outside the plugin is the announcement of a release, sent by the release workflow once the
  maintainer merges its publication pull request, which pins its tag in the marketplaces: its text MUST be the maintainer's, written in `announcements/<version>.txt` and
  sent verbatim; Claude MUST NOT write, suggest, complete, rephrase or translate it either; it goes through
  /dev/null's own GitHub Action, which runs the official commit script, with the `DEVNULL_SSH_KEY` secret only
- Reading MAY use the API (`/api/v1`), signed as the device the user approved for what needs signing in (the
  Following log), and, for the rest, the Inertia JSON of the web app's log pages (`/log/{latest,trending}`), and the
  pictures of commits (`/commit-images/`), signed in as no one, with no cookie: `GET` only, never a web route that writes (commit, star, follow, bookmark…), nor a route of the API that does
  (`POST /api/v1/commits`, `DELETE /api/v1/commits/{commit}`, follow…), though /dev/null accepts them; the only
  requests that are not `GET` are the two of the sign-in, `POST /api/v1/device-authorizations` and
  `POST /api/v1/devices`, which approve the device and change nothing on /dev/null
- The plugin MUST NOT sign in with a session cookie, nor keep one: it forgets the one earlier versions kept
- The private key of the device the API knows the plugin by MUST be created by the plugin (`hooks/device-key.sh`),
  stored with `$.store`, and handed to `ssh-keygen` only, through its environment, never as an argument; only its
  signatures are sent, to `https://dev-null.sh` only; Claude MUST NOT read, print or log it
- Until /dev/null offers the sign-in of a terminal (nunomaduro/dev-null.sh#585), the device MAY be approved as its app
  is (`/mobile/authorize`, PKCE): the `devnull://authorize?code=…` link dev-null.sh sends back MUST be pasted by the
  user into the plugin, kept in its state only, never in the store, and its code redeemed with `POST /api/v1/devices`
  only; the verifier stays in the state of the sign-in; Claude MUST NOT ask for the link in the conversation, read,
  print or log it
- Write **/dev/null** exactly; a post is a **commit**, a timeline is a **log**; no other git metaphor (push, branch,
  fork…)

## Layout

- `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`: Claude Code plugin and marketplace manifests
- `.codex-plugin/plugin.json`, `.agents/plugins/marketplace.json`: Codex plugin and marketplace manifests; the plugin
  manifests MUST keep the same name and version, the `-dev` of the next release on `main`; both marketplaces MUST pin
  the plugin to the tag of the latest release, which the README names (`tests/manifests_test.sh`); a release takes two
  pull requests, as `CONTRIBUTING.md` (Releases) says
- `skills/commit/SKILL.md`: the `/dev-null:commit` skill, shared by Claude Code and Codex, with host-specific
  instructions; `skills/commit/agents/openai.yaml`: its Codex policy
- `skills/commit/commit.sh`: reads the message on stdin, checks it, runs the official script; the only command the skill
  pre-approves (`allowed-tools`)
- `tests/commit_test.sh`: tests for `commit.sh`, with a fake `curl`; nothing is sent
- `hooks/device-key.sh`: creates the ed25519 key the plugin signs its requests to the API with, and signs a message
  read on stdin with the private key given in `DEVNULL_KEY`, in the `devnull-api` namespace, the key only in a
  temporary file while `ssh-keygen` reads it; `tests/device_key_test.sh` tests it with the real `ssh-keygen`
- `commands/compose.md`, `commands/log.md`: name the `/dev-null:compose` and `/dev-null:log` commands; the hooks module
  answers them without a model turn, and the files' prompts only run when the module did not load
- `hooks/register.tsx`: the hooks module drawing the composer band above the prompt (terminal and desktop only) and
  running `commit.sh` directly with `$.process.run`, and the `/dev-null:log` pane (Following, Latest, Trending and
  Account tabs); `hooks/draft.ts`: the checks of a draft; `hooks/log.ts`: threading, lanes, dates, rows (pictures drawn included) and scrolling
  of the log, tested by `tests/log-data.test.ts`; `hooks/body.ts`: the links, commit links, mentions and /dev/null of
  a commit's text, with the rules of the site, and the parts its words are drawn in, tested by `tests/body.test.ts`;
  `hooks/hash.ts`: a commit's short hash; `hooks/pkce.ts`: the verifier, challenge and state of a sign-in (RFC 7636),
  tested by `tests/pkce.test.ts`; `hooks/versioned.ts`: the version a value of the store is kept at, and its
  migrations, tested by `tests/versioned.test.ts`; `hooks/picture.ts`: the size a WebP says it has, a commit's
  picture shrunk to what an Image takes, and the box of cells it is shown in, tested by `tests/picture.test.ts`;
  `hooks/least-recent.ts`: values by key, the one used least recently left out first, tested by
  `tests/least-recent.test.ts`; `hooks/vendor/webp.js`: the WebP decoder of ts-webp (MIT, `hooks/vendor/webp.LICENSE`),
  generated by `scripts/vendor-webp.sh` (do not edit it), typed by `hooks/vendor/webp.d.ts`, tested by
  `tests/webp.test.ts`; `hooks/spinner.ts`: the frames of the spinner drawn while a log loads,
  tested by `tests/spinner.test.ts`, turned by `hooks/state/spinner.ts`; `hooks/countdown.ts`: the countdown to the next refresh, tested by
  `tests/countdown.test.ts`; `hooks/profile.ts`: the link to a developer's profile, by username or, for a mention, by id; `hooks/poll.ts`: where a poll is and the share of its options, with the rules
  of the site, tested by `tests/poll.test.ts`; `hooks/emoji.ts`: the emoji of the `:shortcodes:`, from the site's table in
  `hooks/emoji-shortcodes.ts` (generated from its `emoji-shortcodes.json`, MIT); `hooks/components/`: the elements the band and the pane draw (logo,
  composer, log, thread, commit, author, body, code block, quote, images, poll, loader, empty log, link card, device sign-in), each taking its data as props and the surface's elements as `ui`
- `hooks/application/`: the use cases; `web-logs.ts` refreshes a log and loads more of it, with the replies of its
  commits, from the web app or the API (`webReader`, `apiReader`), tested by `tests/web-logs.test.ts`; `pictures.ts` loads the picture of a commit, downloaded, decoded and shrunk, tested by
  `tests/pictures.test.ts`; `device-sign-in.ts` starts signing in the device and asks whether it was approved,
  tested by `tests/device-sign-in.test.ts`
- `hooks/state/`: the module's state, read and changed with `$`; `web-app.ts` gives the web app adapter, `web-logs.ts`
  holds the logs, Following read from the API as the device approved, the others from the web app, the first page of
  each kept in the store too, under a key of its own and within a
  budget, since a `/clear` starts the state over, `stored.ts` reads and
  writes the versioned values of the store, `device.ts` the key of the device (store key
  `deviceKey`), created once, the sign-in of the device under way, polled from a timer of its own that a `/clear`
  leaves, or its approval as the app of /dev/null, with the link pasted, in the state only, and whoever approved it (store key `deviceUser`), the person signed in, and `pictures.ts` whether the
  terminal draws pictures, which it asks with a probe Image drawn from a file and blitted, and the pictures loaded,
  those near what the log shows, one a period from a timer of their own, 32 kept at most, in a folder removed once
  the session ends with the process (a timer started by a drawing writes no state, and starts nothing while it is
  dispatched), tested through the pane by
  `tests/log-web.test.tsx`, `tests/log-feed.test.tsx`, `tests/log-device.test.tsx` and
  `tests/log-pictures.test.tsx`
- `hooks/infrastructure/`: the adapters to the outside; `web-app.ts` reads the web app's pages as Inertia JSON
  (version of the assets, partial reloads), signed in as no one, tested by `tests/web-app.test.ts`; `web-commit.ts` reads
  a commit of those pages as a `LogEntry`, tested by `tests/web-commit.test.ts`; `web-log.ts` reads a page of a log
  (`following`, `latest`, `trending`), tested by `tests/web-log.test.ts`; `replies.ts` reads the replies of commits
  down their threads, whatever reads their pages, and `web-replies.ts` reads them from the web app, tested by
  `tests/web-replies.test.ts`; `web-picture.ts` downloads the picture of a commit with
  `curl`, the host's network answering text only, tested by `tests/web-picture.test.ts`; `signed-request.ts` the message a
  request to the API is signed with and its nonce, tested by `tests/signed-request.test.ts`; `device-key.ts` creates the key of the device and
  signs with it through `hooks/device-key.sh`, tested by `tests/device-key.test.ts`; `api.ts` reads the API (`GET`, but
  the two `POST` of the sign-in, `/api/v1/` on `https://dev-null.sh` only), each request signed, and says why
  /dev/null refused one, tested by
  `tests/api.test.ts`; `api-commit.ts` reads a commit of the API as a `LogEntry`, as `web-commit.ts` does, tested by
  `tests/api-commit.test.ts`; `api-log.ts` reads a page of a log (`following`, `latest`, `trending`) from the API,
  tested by `tests/api-log.test.ts`; `api-replies.ts` reads the replies of commits down their threads from the API,
  tested by `tests/api-replies.test.ts`; `api-device.ts` starts the sign-in of the device and polls for its approval
  (RFC 8628), or, until /dev/null offers it, asks for its approval as its app does and redeems the code of the link
  dev-null.sh sends back, tested by `tests/api-device.test.ts`; `picture-file.ts` keeps
  the pixels of a picture in a file of a temporary folder the terminal reads, a drawing taking 2 MiB of pictures in
  all, and removes them, only its own, tested by `tests/picture-file.test.ts`
- `types/index.d.ts`: the module's state contract (`PluginState`)
- `tests/*.test.ts(x)`: tests run by `claude plugin test`; `compose.test.tsx`, `log.test.tsx`, `log-feed.test.tsx`
  and `log-pictures.test.tsx` test the band and the pane, with `process.run`, the blits of the terminal and
  dev-null.sh faked by `tests/support.ts`: nothing is sent, nothing is written
- `tsconfig.json`: extends the one Claude Code writes in `.claude-plugin/types/` (ignored by git)
- `package.json`: pins Biome (TypeScript and JSON), Prettier (Markdown and YAML), TypeScript and git-cliff; run
  `npm run format` before committing
- `cliff.toml`: the git-cliff configuration generating `CHANGELOG.md` (`npm run changelog`) from the features, fixes
  and breaking changes of the history; `tests/changelog_test.sh` tests it on throwaway repositories;
  `.github/workflows/changelog.yml` regenerates and pushes it on `main`, so pull requests MUST NOT change
  `CHANGELOG.md`, then creates the GitHub release of each version tag with `scripts/release-notes.sh` (tested by
  `tests/release_notes_test.sh`), and, once a push to `main` publishes a release, commits its announcement to /dev/null
  with /dev/null's GitHub Action, pinned by commit
- `announcements/<version>.txt`: the announcement of a release on /dev/null, written by the maintainer, never by
  Claude; `scripts/announcement.sh` prints it, as written, and fails when there is none or /dev/null would refuse it
  (1 to 4,000 characters, links counted as written), tested by `tests/announcement_test.sh`; `scripts/published-release.sh` names the version
  tag a push to `main` publishes, the one the Claude Code marketplace pins once it pinned another, tested by
  `tests/published_release_test.sh`

## Design

- Each module and component MUST have a single responsibility: fetching, mapping, state and drawing stay apart
- Components MUST be isolated: they take their data and callbacks as props and the surface's elements as `ui`, and
  never read state, the store or the network themselves
- A new value kept in the store MUST be sealed with its version (`hooks/versioned.ts`); a change of its shape MUST bump
  the version, with a migration from the previous one, or none for the value to be reset

## Checks

Every change MUST pass the checks of @CONTRIBUTING.md.
