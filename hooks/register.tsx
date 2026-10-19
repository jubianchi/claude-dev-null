import type { EngineInterface, ProcessRunResult, Register, RenderSurface, Timer } from 'claude-code'
import { atom, read, update } from 'claude-code'
import Account from './components/account'
import type { ComposerProps } from './components/composer'
import Composer, { composerRows } from './components/composer'
import Log from './components/log'
import { countdown } from './countdown'
import { check, MAX_IMAGES } from './draft'
import type { Thread } from './log'
import { entries, heights, located, scrolled, threadsOf } from './log'
import { spinner } from './spinner'
import { accountForm, sessionCookie, signedInAs, signInWith, signOut, typeCookie } from './state/account'
import {
  askForPictures,
  drawsPictures,
  forgetFailedPictures,
  isLoaded,
  loadPictures,
  PROBE,
  pictureOf,
  probeSource,
  removePictures,
} from './state/pictures'
import { readSpinner } from './state/spinner'
import type { Kept } from './state/stored'
import { readKept, writeKept } from './state/stored'
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
const logTab = atom({ plugin: 'dev-null', key: 'logTab' } as const, '')

const LOG_TABS: readonly unknown[] = ['following', 'latest', 'trending', 'account'] satisfies LogTab[]

/** The tab chosen, kept in the store for a /clear, which starts the state over, to show it still. */
const keptTab: Kept<LogTab> = {
  key: 'logTab',
  version: 1,
  migrations: {},
  read: value => (LOG_TABS.includes(value) ? (value as LogTab) : undefined),
}

/** The tab the pane shows: Following hides while no one is signed in, Latest showing instead. */
async function shownTab($: EngineInterface): Promise<LogTab> {
  const chosen = await read($, logTab)
  const tab = chosen === '' ? ((await readKept($, keptTab)) ?? 'following') : chosen

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

/**
 * Whether the host shows the log: it keeps the pane, and the module its timers, when a `/clear` starts the state
 * over.
 */
async function isLogShown($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === LOG_PANE)
}

/** The timer refreshing the log on its own, while it is open and auto is on; a reload of the module drops it. */
let refreshTimer: Timer | undefined
/** The timer drawing the countdown to the next refresh again, every second, while the log refreshes on its own. */
let tickTimer: Timer | undefined
/** When `refreshTimer` refreshes the log next, 0 while it is not armed; kept with it, which a `/clear` leaves. */
let nextRefreshAt = 0
/**
 * The session the timers were last armed, or left unarmed, in: a `/clear` goes on under another, where the timers of
 * the one before draw nothing, if they still run at all.
 */
let armedIn: string | undefined

const refreshTick = atom({ plugin: 'dev-null', key: 'refreshTick' } as const, 0)

function stopRefresh(): void {
  refreshTimer?.cancel()
  tickTimer?.cancel()
  refreshTimer = undefined
  tickTimer = undefined
  nextRefreshAt = 0
}

/**
 * Arms the timers again once the log is drawn in a session they were not armed in, after the drawing, which may not
 * write the state.
 */
async function armRefreshInSession($: EngineInterface): Promise<void> {
  const session = await $.session.id()

  if (armedIn !== session) {
    armedIn = session
    $.clock.after(0, () => armRefresh($))
  }
}

async function armRefresh($: EngineInterface): Promise<void> {
  stopRefresh()
  armedIn = await $.session.id()

  if (!((await isLogShown($)) && (await isAutoRefresh($)) && isWebTab(await shownTab($)))) {
    return
  }

  nextRefreshAt = (await $.clock.now()) + REFRESH_EVERY
  refreshTimer = $.clock.every(REFRESH_EVERY, async () => {
    nextRefreshAt = (await $.clock.now()) + REFRESH_EVERY
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

  await read($, refreshTick)

  return nextRefreshAt === 0 ? 'auto 🟢' : `auto 🟢 ${countdown(nextRefreshAt, await $.clock.now())}`
}

/** Loads again the log the pane shows, from its first page. */
async function refreshShown($: EngineInterface): Promise<void> {
  const tab = await shownTab($)

  if (isWebTab(tab)) {
    await refreshTab($, tab)
    await update($, listOffset, () => 0)
  }
}

/** Loads again the log the pane shows, as the person asks, and tries again the pictures that could not be loaded. */
async function refreshOnDemand($: EngineInterface): Promise<void> {
  forgetFailedPictures()
  await refreshNow($)
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
  await writeKept($, keptTab, tab)
  await update($, listOffset, () => 0)
  await refreshNow($)
}

const listOffset = atom({ plugin: 'dev-null', key: 'listOffset' } as const, 0)

/** The rows the tabs take above the list, with the row above them. */
const TAB_ROWS = 2

/** The rows above the list: the composer, as tall as the images of its draft make it, and the tabs. */
async function fixedRows($: EngineInterface): Promise<number> {
  return composerRows((await read($, images)).length) + TAB_ROWS
}
/** The columns the log's padding takes. */
const LOG_INSET = 2

/** The width the log was last drawn at, which the scroll hook is not told. */
let logColumns = 80

/** Whether the log was last drawn with pictures, which the scroll hook is not told: none where the surface draws none. */
let drawsLogPictures = false

/** Whether the log draws pictures on `surface`: those loaded, where the terminal draws pictures; none elsewhere. */
async function picturesOn($: EngineInterface, surface: RenderSurface): Promise<boolean> {
  return surface === 'terminal' && (await drawsPictures($)) === 'drawn'
}

/** The URLs of the images of the commits and replies from `offset` on, down to twice the rows the list shows. */
function nearImages(threads: readonly Thread[], heights: readonly number[], offset: number, visible: number): string[] {
  const items = entries(threads)
  const urls: string[] = []
  let rows = 0

  for (let index = offset; index < items.length && rows < visible * 2; index++) {
    rows += heights[index] ?? 0
    urls.push(...(items[index]?.images.map(image => image.url) ?? []))
  }

  return urls
}

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
        url => drawsLogPictures && isLoaded(url),
      ),
      visible: bodyRows - (await fixedRows($)) - (shown.error === '' ? 0 : 1),
    }
  }

  return { heights: [], visible: bodyRows - (await fixedRows($)) }
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
const image = atom({ plugin: 'dev-null', key: 'image' } as const, '')
const images = atom({ plugin: 'dev-null', key: 'images' } as const, [])

/** The draft the composer shows: its message, the commit it replies to, the image field and the images it carries. */
async function draftOf($: EngineInterface): Promise<ComposerProps['draft']> {
  return {
    message: await read($, message),
    reply: await read($, reply),
    image: await read($, image),
    images: await read($, images),
  }
}

/** Adds the image at `path` to the draft, while it carries fewer than MAX_IMAGES, and empties the image field. */
async function addImage($: EngineInterface, path: string): Promise<void> {
  const trimmed = path.trim()

  if (trimmed !== '') {
    await update($, images, paths => (paths.length < MAX_IMAGES ? [...paths, trimmed] : paths))
  }

  await update($, image, () => '')
}

/** The callbacks of the composer, each changing the draft. */
function composerActions($: EngineInterface) {
  return {
    onMessage: (value: string) => update($, message, () => value),
    onReply: (value: string) => update($, reply, () => value),
    onImage: (value: string) => update($, image, () => value),
    onAddImage: (path: string) => addImage($, path),
    onRemoveImage: (index: number) => update($, images, paths => paths.filter((_, at) => at !== index)),
    onSend: () => send($),
  }
}

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
  await update($, image, () => '')
  await update($, images, () => [])
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
  const attached = await read($, images)

  if (check(text, target, attached).error !== undefined) {
    return
  }

  const argv = [
    `${$.plugin.root}/skills/commit/commit.sh`,
    ...(target === '' ? [] : ['--reply', target]),
    ...attached.flatMap(path => ['--image', path]),
  ]

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
    if (await isLogShown($)) {
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

  on('session.end', async ($, e, next) => {
    await removePictures($, e.reason)

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
      stopRefresh()
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: LOG_PANE }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }

    await armRefreshInSession($)
    const ui = $.ui.resolve(e)
    const { Box, Button, Text } = ui
    const draft = await draftOf($)
    const tab = await shownTab($)
    const isSignedIn = (await signedInAs($)) !== ''
    logColumns = e.props.bodyColumns
    drawsLogPictures = await picturesOn($, e.surface)
    const { heights, visible } = await list($, e.props.scroll.bodyRows)
    const offset = scrolled(await read($, listOffset), 0, heights, visible)
    const shown = tab === 'account' ? undefined : await shownLog($, tab)

    if (shown !== undefined && drawsLogPictures) {
      await loadPictures($, nearImages(shown.threads, heights, offset, visible))
    }
    const isAuto = await isAutoRefresh($)
    const isRefreshingNow = await isRefreshing($, tab)
    await readSpinner($)
    const now = await $.clock.now()
    const Probe = e.surface === 'terminal' && (await drawsPictures($)) === 'unknown' && 'Image' in ui ? ui.Image : null
    const probe = Probe === null ? undefined : await probeSource($)

    if (Probe !== null) {
      await askForPictures($, LOG_PANE)
    }

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
        <Composer ui={ui} draft={draft} cancelLabel="Clear" {...composerActions($)} onCancel={() => clear($)} />
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
              onPress={() => (isRefreshingNow ? Promise.resolve() : refreshOnDemand($))}
            />
            <Button key="auto" label={await autoLabel($)} onPress={() => setAutoRefresh($, !isAuto)} />
            {Probe !== null && probe !== undefined && <Probe key={PROBE} source={probe} columns={1} rows={1} alt=" " />}
          </Box>
        </Box>
        {shown === undefined ? (
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
            {...shown}
            columns={logColumns - LOG_INSET}
            {...(drawsLogPictures ? { pictureOf } : {})}
            now={now}
            start={located(shown.threads, offset)}
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

    const draft = await draftOf($)

    return (
      <Composer
        ui={$.ui.resolve(e)}
        draft={draft}
        cancelLabel={isAlways ? 'Clear' : 'Cancel'}
        {...composerActions($)}
        onCancel={() => close($)}
      />
    )
  })
}
