import type { EngineInterface, ProcessRunResult, Register, RenderSurface, Timer } from 'claude-code'
import { atom, read, update } from 'claude-code'
import type { Refresh } from './application/web-logs'
import type { ComposerProps } from './components/composer'
import Composer, { composerRows } from './components/composer'
import { attached, check } from './draft'
import { scrolled } from './log'
import type { Route } from './router'
import { isSameRoute } from './router'
import { isAutoRefresh } from './state/auto-refresh'
import { currentMode, setMode } from './state/mode'
import { addNewCommits, forgetNewCommits, newCommitsOf } from './state/new-commits'
import {
  askForPictures,
  drawsPictures,
  forgetFailedPictures,
  PROBE,
  probeSource,
  removePictures,
} from './state/pictures'
import { goBack, openView, pushView, scrollRoute } from './state/router'
import { readSpinner } from './state/spinner'
import { forgetLoadings } from './state/web-logs'
import { availableOf, shownRoute, tabsOf, viewFor, viewsOf } from './views'
import type { Layout, List, View } from './views/view'

const COMMAND = 'dev-null:compose'
const USAGE = `Usage: /${COMMAND} [always|manual]`
const LOG_COMMAND = 'dev-null:log'
const LOG_PANE = 'dev-null-log'

/** How often a log refreshes on its own: one page and ten requests for replies at most, a minute. */
const REFRESH_EVERY = 60_000

const isOpen = atom({ plugin: 'dev-null', key: 'isOpen' } as const, false)

/** Whether the composer is shown above the prompt: always, or once opened there, the log pane open or not. */
async function isBandWanted($: EngineInterface): Promise<boolean> {
  return (await currentMode($)) === 'always' || (await read($, isOpen))
}

/**
 * The keys of the store the plugin kept the cookie it signed in with in, before the device did: forgotten, for the
 * cookie no longer to be kept anywhere.
 */
const COOKIE_KEYS = ['cookie', 'username']

/**
 * Whether the host shows the log: it keeps the pane, and the module its timers, when a `/clear` starts the state
 * over.
 */
async function isLogShown($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === LOG_PANE)
}

/** The timer refreshing the log on its own, while it is open and auto is on; a reload of the module drops it. */
let refreshTimer: Timer | undefined
/**
 * The session the timer was last armed, or left unarmed, in: a `/clear` goes on under another, where the timer of the
 * one before draws nothing, if it still runs at all.
 */
let armedIn: string | undefined

function stopRefresh(): void {
  refreshTimer?.cancel()
  refreshTimer = undefined
}

/**
 * Arms the timer again once the log is drawn in a session it was not armed in, after the drawing, which may not write
 * the state.
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

  if (!((await isLogShown($)) && (await isAutoRefresh($)) && viewFor($, (await shownRoute($)).view).refresh)) {
    return
  }

  refreshTimer = $.clock.every(REFRESH_EVERY, async () => {
    void refreshShown($, 'kept')
  })
}

/**
 * Loads again the view the pane shows: from its top, scrolled to it, as the person asks; or keeping what it showed, as
 * it does on its own, scrolled to the commit or reply it showed first, the commits that arrived above it said.
 */
async function refreshShown($: EngineInterface, how: Refresh = 'top'): Promise<void> {
  const route = await shownRoute($)
  const { refresh, items } = viewFor($, route.view)

  if (refresh === undefined) {
    return
  }

  const anchor = how === 'kept' ? (await items?.(route))?.[route.offset] : undefined
  const arrivedIds = await refresh(route, how)
  const after = await shownRoute($)

  if (!isSameRoute(after, route)) {
    return
  }

  if (how === 'top') {
    await forgetNewCommits($, route.view)
    await scrollRoute($, after, 0)

    return
  }

  const offset = anchor === undefined ? -1 : ((await items?.(after)) ?? []).indexOf(anchor)

  if (offset !== -1) {
    await scrollRoute($, after, offset)
  }

  await addNewCommits($, route.view, arrivedIds)
}

/** Shows the top of the view the pane shows, where the commits that arrived on top of it are, seen since. */
async function showNewCommits($: EngineInterface): Promise<void> {
  const route = await shownRoute($)
  await scrollRoute($, route, 0)
  await forgetNewCommits($, route.view)
}

/**
 * Loads again the log the pane shows, and arms again the timer refreshing it on its own, a minute from now: it starts
 * over with every refresh, but for the next page.
 */
async function refreshNow($: EngineInterface): Promise<void> {
  await armRefresh($)
  await refreshShown($)
}

/**
 * Shows the view of `id`, alone, loaded again, as a press of its tab asks, even the one shown, and tries again the
 * pictures that could not be loaded.
 */
async function showView($: EngineInterface, id: string): Promise<void> {
  forgetFailedPictures()
  await openView($, id, tabsOf(viewsOf($)))
  await refreshNow($)
}

/** Shows the view of `id`, showing `params`, over the one shown, unless it shows already, loaded again. */
async function openOver($: EngineInterface, id: string, params: Record<string, string>): Promise<void> {
  const shown = await shownRoute($)

  if (!isSameRoute(shown, { view: id, params, offset: 0 })) {
    await pushView($, shown, id, params)
    await refreshNow($)
  }
}

/** Shows the route under the one shown again, as it was scrolled, refreshed on its own again if it refreshes. */
async function showBack($: EngineInterface): Promise<void> {
  await goBack($)
  await armRefresh($)
}

/** Shows the view of `id` over the one shown, or closes it, showing that one again, when it shows already. */
async function toggleView($: EngineInterface, id: string): Promise<void> {
  const shown = await shownRoute($)

  if (shown.view === id) {
    await showBack($)
  } else {
    await pushView($, shown, id)
    await armRefresh($)
  }
}

/** The rows the tabs take above the list, with the row above them. */
const TAB_ROWS = 2

/**
 * The rows above the list: the composer, as tall as the images of its draft make it, unless it shows above the prompt,
 * and the tabs.
 */
async function fixedRows($: EngineInterface): Promise<number> {
  return ((await isBandWanted($)) ? 0 : composerRows((await read($, images)).length)) + TAB_ROWS
}
/** The columns the log's padding takes. */
const LOG_INSET = 2

/**
 * How the pane was last drawn, which the scroll hook is not told: its columns inside the log's padding, and whether it
 * drew pictures, none where the surface draws none.
 */
let layout: Layout = { columns: 80 - LOG_INSET, drawsPictures: false }

/** Whether the log draws pictures on `surface`: those loaded, where the terminal draws pictures; none elsewhere. */
async function picturesOn($: EngineInterface, surface: RenderSurface): Promise<boolean> {
  return surface === 'terminal' && (await drawsPictures($)) === 'drawn'
}

/** What `route` lists, and the rows its items are shown in, in a pane body `bodyRows` high. */
async function list(
  $: EngineInterface,
  route: Route,
  bodyRows: number,
): Promise<{ heights: number[]; visible: number }> {
  const listed: List = (await viewFor($, route.view).list?.(route, layout)) ?? { heights: [], aboveRows: 0 }

  return { heights: listed.heights, visible: bodyRows - (await fixedRows($)) - listed.aboveRows }
}

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
    isSending: await read($, isSending),
  }
}

/** Adds the image at `path` to the draft, while it carries fewer than MAX_IMAGES, and empties the image field. */
async function addImage($: EngineInterface, path: string): Promise<void> {
  await update($, images, paths => attached(paths, path))
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

const isSending = atom({ plugin: 'dev-null', key: 'isSending' } as const, false)

/**
 * Whether a commit is being sent: kept in the module, not in the state, which a dispatch reads at the one moment it
 * started: a second press, quick enough, would not see the first.
 */
let sending = false

/** Sends the draft, once at a time: a press while a commit is being sent sends nothing more. */
async function send($: EngineInterface): Promise<void> {
  if (sending) {
    return
  }

  sending = true
  await update($, isSending, () => true)

  try {
    await sendDraft($)
  } finally {
    sending = false
    await update($, isSending, () => false)
  }
}

async function sendDraft($: EngineInterface): Promise<void> {
  const text = await read($, message)
  const target = await read($, reply)
  const carried = attached(await read($, images), await read($, image))

  if (check(text, target, carried).error !== undefined) {
    return
  }

  const argv = [
    `${$.plugin.root}/skills/commit/commit.sh`,
    ...(target === '' ? [] : ['--reply', target]),
    ...carried.flatMap(path => ['--image', path]),
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

    await $.ui.open({ id: LOG_PANE, title: '/dev/null' })
    await refreshNow($)

    return { text: 'Log open.' }
  })

  on('session.start', async ($, e, next) => {
    for (const key of COOKIE_KEYS) {
      await $.store.delete(key)
    }

    await forgetLoadings($)
    await armRefresh($)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await removePictures($, e.reason)

    return next(e)
  })

  on('ui.scroll', { component: 'Pane', requestId: LOG_PANE }, async ($, e, next) => {
    const route = await shownRoute($)
    const { heights, visible } = await list($, route, e.bodyRows)
    const offset = scrolled(route.offset, e.by, heights, visible)
    await scrollRoute($, route, offset)

    if (offset === 0) {
      await forgetNewCommits($, route.view)
    }

    return next({ ...e, offset: 0 })
  })

  on('ui.close', async (_$, e, next) => {
    if (e.id === LOG_PANE) {
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
    const hasComposer = !(await isBandWanted($))
    const route = await shownRoute($)
    const view = viewFor($, route.view)
    const available = await availableOf(viewsOf($))
    const tabs = available.filter(found => found.placement === 'tab')
    const tools = available.filter(found => found.placement === 'toolbar')
    layout = { columns: e.props.bodyColumns - LOG_INSET, drawsPictures: await picturesOn($, e.surface) }
    const { heights, visible } = await list($, route, e.props.scroll.bodyRows)
    const offset = scrolled(route.offset, 0, heights, visible)
    const newCount = (await newCommitsOf($, route.view)).length
    await readSpinner($)
    const now = await $.clock.now()
    const Probe = e.surface === 'terminal' && (await drawsPictures($)) === 'unknown' && 'Image' in ui ? ui.Image : null
    const probe = Probe === null ? undefined : await probeSource($)

    if (Probe !== null) {
      await askForPictures($, LOG_PANE)
    }

    const viewButton = (found: View, key: string, onPress: () => Promise<void>) => (
      <Button key={key} onPress={onPress}>
        {route.view === found.id ? (
          <Text weight="bold" underline>
            {found.label}
          </Text>
        ) : (
          <Text dimColor>{found.label}</Text>
        )}
      </Button>
    )

    return (
      <Box flexDirection="column">
        {hasComposer && (
          <Composer ui={ui} draft={draft} cancelLabel="Clear" {...composerActions($)} onCancel={() => clear($)} />
        )}
        <Box key="tabs" justifyContent="space-between" paddingX={1} marginTop={1}>
          {view.placement === 'detail' ? (
            <Box gap={2}>
              <Button key="back" label="←" onPress={() => showBack($)} />
              <Text weight="bold">{view.label}</Text>
            </Box>
          ) : (
            <Box gap={2}>{tabs.map(found => viewButton(found, `tab-${found.id}`, () => showView($, found.id)))}</Box>
          )}
          <Box gap={2}>
            {newCount > 0 ? (
              <Button key="new-commits" label={`↑ ${newCount} new`} onPress={() => showNewCommits($)} />
            ) : (
              offset > 0 && (
                <Box key="above">
                  <Text dimColor>↑ {offset} more</Text>
                </Box>
              )
            )}
            {tools.map(found => viewButton(found, found.id, () => toggleView($, found.id)))}
            {Probe !== null && probe !== undefined && <Probe key={PROBE} source={probe} columns={1} rows={1} alt=" " />}
          </Box>
        </Box>
        {
          await view.render(route, {
            ui,
            ...layout,
            offset,
            heights,
            visible,
            now,
            replyTo: entry => update($, reply, () => entry.shortHash),
            isAvailable: id => available.some(found => found.id === id),
            open: (id, params) => openOver($, id, params),
          })
        }
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }

    const isAlways = (await currentMode($)) === 'always'

    if (e.props.hasSurvey || !(await isBandWanted($))) {
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
