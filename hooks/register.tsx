import type { EngineInterface, ProcessRunResult, Register, Timer } from 'claude-code'
import { atom, read, update } from 'claude-code'
import Account from './components/account'
import Composer from './components/composer'
import Log from './components/log'
import { countdown } from './countdown'
import { check } from './draft'
import type { Thread } from './log'
import { heights, scrolled, threadsOf } from './log'
import { spinner } from './spinner'
import { accountForm, sessionCookie, signedInAs, signInWith, signOut, typeCookie } from './state/account'
import { readSpinner } from './state/spinner'
import {
  forgetLoadings,
  forgetWebLog,
  isWebLogLoaded,
  loadMoreOfWebLog,
  refreshWebLog,
  webLog,
  webLogLoading,
} from './state/web-logs'

const COMMAND = 'dev-null:compose'
const USAGE = `Usage: /${COMMAND} [always|manual]`
const LOG_COMMAND = 'dev-null:log'
const LOG_PANE = 'dev-null-log'

type Mode = 'always' | 'manual'
type LogTab = 'following' | 'latest' | 'trending' | 'account'
type WebTab = Exclude<LogTab, 'account'>

function isWebTab(tab: LogTab): tab is WebTab {
  return tab !== 'account'
}

/** How often a log refreshes on its own: one page and ten requests for replies at most, a minute. */
const REFRESH_EVERY = 60_000

const isOpen = atom({ plugin: 'dev-null', key: 'isOpen' } as const, false)
const isLogOpen = atom({ plugin: 'dev-null', key: 'isLogOpen' } as const, false)
const logTab = atom({ plugin: 'dev-null', key: 'logTab' } as const, 'following')

/** The tab the pane shows: Following hides while no one is signed in, Latest showing instead. */
async function shownTab($: EngineInterface): Promise<LogTab> {
  const tab = await read($, logTab)

  return tab === 'following' && (await signedInAs($)) === '' ? 'latest' : tab
}

/** The cookie a log is read with: Following's, the person's; the others, none, which change nothing for them. */
async function cookieFor($: EngineInterface, tab: WebTab): Promise<string | undefined> {
  return tab === 'following' ? sessionCookie($) : undefined
}

/** Loads `tab` again, unless it is Following and no one is signed in. */
async function refreshTab($: EngineInterface, tab: WebTab): Promise<void> {
  const cookie = await cookieFor($, tab)

  if (tab !== 'following' || cookie !== undefined) {
    await refreshWebLog($, tab, cookie)
  }
}

async function signInAndRead($: EngineInterface, pasted: string): Promise<void> {
  await signInWith($, pasted)
  await forgetWebLog($, 'following')
}

async function signOutAndForget($: EngineInterface): Promise<void> {
  await signOut($)
  await forgetWebLog($, 'following')
}

const autoRefresh = atom({ plugin: 'dev-null', key: 'autoRefresh' } as const, '')

async function isAutoRefresh($: EngineInterface): Promise<boolean> {
  const value = await read($, autoRefresh)

  return value === '' ? (await $.store.get('autoRefresh')) === true : value === 'on'
}

async function setAutoRefresh($: EngineInterface, isOn: boolean): Promise<void> {
  await $.store.set('autoRefresh', isOn)
  await update($, autoRefresh, () => (isOn ? 'on' : 'off'))
  await armRefresh($)
}

/** The timer refreshing the log on its own, while it is open and auto is on; a reload of the module drops it. */
let refreshTimer: Timer | undefined
/** The timer drawing the countdown to the next refresh again, every second, while the log refreshes on its own. */
let tickTimer: Timer | undefined

const nextRefreshAt = atom({ plugin: 'dev-null', key: 'nextRefreshAt' } as const, 0)
const refreshTick = atom({ plugin: 'dev-null', key: 'refreshTick' } as const, 0)

async function armRefresh($: EngineInterface): Promise<void> {
  refreshTimer?.cancel()
  tickTimer?.cancel()
  refreshTimer = undefined
  tickTimer = undefined

  if (!((await read($, isLogOpen)) && (await isAutoRefresh($)) && isWebTab(await shownTab($)))) {
    await update($, nextRefreshAt, () => 0)

    return
  }

  const now = await $.clock.now()
  await update($, nextRefreshAt, () => now + REFRESH_EVERY)
  refreshTimer = $.clock.every(REFRESH_EVERY, async () => {
    const at = await $.clock.now()
    await update($, nextRefreshAt, () => at + REFRESH_EVERY)
    void refreshShown($)
  })
  tickTimer = $.clock.every(1_000, async () => {
    const at = await $.clock.now()
    await update($, refreshTick, () => at)
  })
}

/** The label of the auto refresh button: off, or on, with the countdown to the next refresh while it is armed. */
async function autoLabel($: EngineInterface): Promise<string> {
  if (!(await isAutoRefresh($))) {
    return 'auto 🔴'
  }

  const at = await read($, nextRefreshAt)
  await read($, refreshTick)

  return at === 0 ? 'auto 🟢' : `auto 🟢 ${countdown(at, await $.clock.now())}`
}

/** Loads again the log the pane shows, from its first page. */
async function refreshShown($: EngineInterface): Promise<void> {
  const tab = await shownTab($)

  if (isWebTab(tab)) {
    await refreshTab($, tab)
    await update($, listOffset, () => 0)
  }
}

/**
 * Loads again the log the pane shows, and counts down again from the start to the next refresh on its own: the one
 * countdown starts over with every refresh, but for the next page.
 */
async function refreshNow($: EngineInterface): Promise<void> {
  await armRefresh($)
  await refreshShown($)
}

/** Shows `tab`, loaded again. */
async function showTab($: EngineInterface, tab: LogTab): Promise<void> {
  await update($, logTab, () => tab)
  await update($, listOffset, () => 0)
  await refreshNow($)
}

const listOffset = atom({ plugin: 'dev-null', key: 'listOffset' } as const, 0)

/** The rows above the list: the composer (9) and the tabs with the row above them (2). */
const FIXED_ROWS = 11
/** The columns the log's padding takes. */
const LOG_INSET = 2

/** The width the log was last drawn at, which the scroll hook is not told. */
let logColumns = 80

/** The rows of each item of the list the tab shows, and the rows the list has, in a pane body `bodyRows` high. */
async function list($: EngineInterface, bodyRows: number): Promise<{ heights: number[]; visible: number }> {
  const tab = await shownTab($)

  if (isWebTab(tab)) {
    const shown = await webLog($, tab)

    return {
      heights: heights(
        threadsOf(shown.commits, shown.replies),
        logColumns - LOG_INSET,
        shown.next !== null || (await isFirstLoad($, tab)),
      ),
      visible: bodyRows - FIXED_ROWS - (shown.error === '' ? 0 : 1),
    }
  }

  return { heights: [], visible: bodyRows - FIXED_ROWS }
}

/** Whether `tab` loads with nothing shown yet, or is not loaded yet: its loader shows in place of its threads. */
async function isFirstLoad($: EngineInterface, tab: WebTab): Promise<boolean> {
  if (!(await isWebLogLoaded($, tab))) {
    return true
  }

  return (await webLogLoading($, tab)) !== '' && (await webLog($, tab)).commits.length === 0
}

/** Whether `tab` loads its first page, on demand or on its own: refresh turns into a spinner, and does nothing more. */
async function isRefreshing($: EngineInterface, tab: LogTab): Promise<boolean> {
  return isWebTab(tab) && (await webLogLoading($, tab)) === 'refresh'
}

/** What the Log component shows for `tab`: its threads, errors, what it says when empty, and how to load more. */
async function shownLog(
  $: EngineInterface,
  tab: WebTab,
): Promise<{
  threads: Thread[]
  errors: string[]
  empty: string
  isFirstLoad: boolean
  isLoadingMore: boolean
  onMore?: () => Promise<void>
}> {
  const { commits, replies, next, error } = await webLog($, tab)
  const errors = error === '' ? [] : [error]
  const cookie = await cookieFor($, tab)

  return {
    threads: threadsOf(commits, replies),
    errors,
    empty: errors.length === 0 ? 'No commits yet.' : '',
    isFirstLoad: await isFirstLoad($, tab),
    isLoadingMore: (await webLogLoading($, tab)) === 'more',
    ...(next === null ? {} : { onMore: () => loadMoreOfWebLog($, tab, cookie) }),
  }
}

const mode = atom({ plugin: 'dev-null', key: 'mode' } as const, '')
const message = atom({ plugin: 'dev-null', key: 'message' } as const, '')
const reply = atom({ plugin: 'dev-null', key: 'reply' } as const, '')

async function currentMode($: EngineInterface): Promise<Mode> {
  const value = (await read($, mode)) || (await $.store.get('mode'))

  return value === 'always' ? 'always' : 'manual'
}

async function setMode($: EngineInterface, value: Mode): Promise<void> {
  await $.store.set('mode', value)
  await update($, mode, () => value)
}

async function clear($: EngineInterface): Promise<void> {
  await update($, message, () => '')
  await update($, reply, () => '')
}

async function close($: EngineInterface): Promise<void> {
  await clear($)

  if ((await currentMode($)) === 'manual') {
    await update($, isOpen, () => false)
  }
}

const TOAST = { timeoutMs: 10_000 }

async function send($: EngineInterface): Promise<void> {
  const text = await read($, message)
  const target = await read($, reply)

  if (check(text, target).error !== undefined) {
    return
  }

  const argv = [`${$.plugin.root}/skills/commit/commit.sh`, ...(target === '' ? [] : ['--reply', target])]

  let result: ProcessRunResult
  try {
    result = await $.process.run(argv, { stdin: text, timeoutMs: 60_000 })
  } catch (error) {
    $.ui.toast(
      `devnull: could not run the commit script (${error instanceof Error ? error.message : String(error)}).`,
      TOAST,
    )

    return
  }

  if (result.exitCode !== 0) {
    $.ui.toast(result.stderr.trim() || `devnull: the commit failed (exit code ${result.exitCode}).`, TOAST)

    return
  }

  $.ui.toast(result.stdout.trim(), TOAST)
  await close($)
}

export const register: Register = on => {
  on('command.run', { command: COMMAND }, async ($, e) => {
    switch (e.args.trim()) {
      case '':
        if ((await currentMode($)) === 'always') {
          await setMode($, 'manual')
          await update($, isOpen, () => false)

          return { text: `Composer closed, shown on demand again with /${COMMAND}.` }
        }

        if (await read($, isOpen)) {
          await update($, isOpen, () => false)

          return { text: 'Composer closed.' }
        }

        await update($, isOpen, () => true)

        return { text: 'Composer open.' }
      case 'always':
        await setMode($, 'always')

        return { text: 'Composer always shown.' }
      case 'manual':
        await setMode($, 'manual')
        await update($, isOpen, () => false)

        return { text: `Composer shown on demand, with /${COMMAND}.` }
      default:
        return { text: USAGE }
    }
  })

  on('command.run', { command: LOG_COMMAND }, async $ => {
    if (await read($, isLogOpen)) {
      await $.ui.close({ id: LOG_PANE })

      return { text: 'Log closed.' }
    }

    await update($, isOpen, () => false)
    await update($, isLogOpen, () => true)
    await $.ui.open({ id: LOG_PANE, title: '/dev/null' })
    await refreshNow($)

    return { text: 'Log open.' }
  })

  on('session.start', async ($, e, next) => {
    await forgetLoadings($)
    await armRefresh($)

    return next(e)
  })

  on('ui.scroll', { component: 'Pane', requestId: LOG_PANE }, async ($, e, next) => {
    const { heights, visible } = await list($, e.bodyRows)
    await update($, listOffset, offset => scrolled(offset ?? 0, e.by, heights, visible))

    return next({ ...e, offset: 0 })
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === LOG_PANE) {
      await update($, isLogOpen, () => false)
      await armRefresh($)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: LOG_PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }

    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const draft = { message: await read($, message), reply: await read($, reply) }
    const tab = await shownTab($)
    const isSignedIn = (await signedInAs($)) !== ''
    logColumns = e.props.bodyColumns
    const { heights, visible } = await list($, e.props.scroll.bodyRows)
    const offset = scrolled(await read($, listOffset), 0, heights, visible)
    const isAuto = await isAutoRefresh($)
    const isRefreshingNow = await isRefreshing($, tab)
    await readSpinner($)
    const now = await $.clock.now()

    const tabButton = (key: LogTab, label: string) => (
      <Button key={`tab-${key}`} onPress={() => showTab($, key)}>
        {tab === key ? (
          <Text weight="bold" underline>
            {label}
          </Text>
        ) : (
          <Text dimColor>{label}</Text>
        )}
      </Button>
    )

    return (
      <Box flexDirection="column">
        <Composer
          ui={ui}
          draft={draft}
          cancelLabel="Clear"
          onMessage={value => update($, message, () => value)}
          onReply={value => update($, reply, () => value)}
          onSend={() => send($)}
          onCancel={() => clear($)}
        />
        <Box key="tabs" justifyContent="space-between" paddingX={1} marginTop={1}>
          <Box gap={2}>
            {isSignedIn && tabButton('following', 'Following')}
            {tabButton('latest', 'Latest')}
            {tabButton('trending', 'Trending')}
            {tabButton('account', 'Account')}
          </Box>
          <Box gap={2}>
            {offset > 0 && (
              <Box key="above">
                <Text dimColor>↑ {offset} more</Text>
              </Box>
            )}
            <Button
              key="refresh"
              label={isRefreshingNow ? `${spinner(now)} ` : '🔄'}
              onPress={() => (isRefreshingNow ? Promise.resolve() : refreshNow($))}
            />
            <Button key="auto" label={await autoLabel($)} onPress={() => setAutoRefresh($, !isAuto)} />
          </Box>
        </Box>
        {tab === 'account' ? (
          <Account
            ui={ui}
            username={await signedInAs($)}
            {...(await accountForm($))}
            onDraft={value => typeCookie($, value)}
            onSignIn={value => signInAndRead($, value)}
            onSignOut={() => signOutAndForget($)}
          />
        ) : (
          <Log
            ui={ui}
            {...(await shownLog($, tab))}
            now={now}
            offset={offset}
            onReply={entry => update($, reply, () => entry.shortHash)}
          />
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }

    const isAlways = (await currentMode($)) === 'always'

    if (e.props.hasSurvey || (await read($, isLogOpen)) || !(isAlways || (await read($, isOpen)))) {
      return next(e)
    }

    const draft = { message: await read($, message), reply: await read($, reply) }

    return (
      <Composer
        ui={$.ui.resolve(e)}
        draft={draft}
        cancelLabel={isAlways ? 'Clear' : 'Cancel'}
        onMessage={value => update($, message, () => value)}
        onReply={value => update($, reply, () => value)}
        onSend={() => send($)}
        onCancel={() => close($)}
      />
    )
  })
}
