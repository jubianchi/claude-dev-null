import type { EngineInterface, ImageSource, Timer } from 'claude-code'

import { loadPicture } from '../application/pictures'
import { makeFolder, removeFolder, removePixels, savePixels } from '../infrastructure/picture-file'
import type { Run } from '../infrastructure/web-picture'
import { downloadPicture } from '../infrastructure/web-picture'
import { LeastRecent } from '../least-recent'
import type { KeptPicture } from '../picture'

/** Whether the terminal draws pictures: not asked yet, or as it answered. */
export type Drawing = 'unknown' | 'drawn' | 'alt'

/** The key of the Image the log draws while it asks the terminal whether it draws pictures. */
export const PROBE = 'picture-probe'

/** The pixel the probe is drawn from, which no one sees: RGBA, all nought. */
const PROBE_PIXEL = new Uint8Array(4).toBase64()

/** How many times the probe is blitted before the terminal is taken for one without pictures. */
const PROBE_TRIES = 3

/**
 * What the terminal of a session answered, and the file its probe is drawn from: a /clear or a resume goes on under
 * another session, maybe in another terminal. Kept in the module, which the state of a session does not outlive.
 */
type Asked = { session: string; drawing: Drawing; tries: number; isAsking: boolean; probe?: string }

let known: Asked | undefined

async function knownIn($: EngineInterface): Promise<Asked> {
  const session = await $.session.id()

  if (known?.session !== session) {
    known = { session, drawing: 'unknown', tries: 0, isAsking: false }
  }

  return known
}

function runOf($: EngineInterface): Run {
  return (argv, init) => $.process.run(argv, init)
}

/**
 * The folder the pictures of this process are kept in, made once, the first time one is: a /clear or a resume keeps
 * it, as the pictures loaded; the end of the process removes it.
 */
let folder: Promise<string> | undefined

function folderOf($: EngineInterface): Promise<string> {
  folder ??= makeFolder(runOf($)).catch(error => {
    folder = undefined
    throw error
  })

  return folder
}

/**
 * Removes the folder of the pictures, with them, once the session ends with the process: not for a /clear or a
 * resume, which go on with the pictures loaded.
 */
export async function removePictures($: EngineInterface, reason: string): Promise<void> {
  const made = folder

  if (made === undefined || reason === 'clear' || reason === 'resume') {
    return
  }

  folder = undefined
  await removeFolder(runOf($), await made)
}

/** Whether the terminal draws pictures. */
export async function drawsPictures($: EngineInterface): Promise<Drawing> {
  return (await knownIn($)).drawing
}

/**
 * The source the probe is drawn from, once its file is written: a file, as the pictures are, which a terminal does
 * not read across ssh, where it draws the alt of an Image.
 */
export async function probeSource($: EngineInterface): Promise<ImageSource | undefined> {
  const { probe } = await knownIn($)

  return probe === undefined ? undefined : { file: probe, format: 'rgba', width: 1, height: 1 }
}

/**
 * Writes the file the probe is drawn from, a period after the drawing, which would cut short what is started while
 * it is dispatched; a terminal it cannot be written for draws none.
 */
function writeProbe($: EngineInterface, asked: Asked): void {
  $.clock.after(LOAD_EVERY, async () => {
    try {
      asked.probe = await savePixels(runOf($), await folderOf($), PROBE_PIXEL)
    } catch {
      asked.drawing = 'alt'
    } finally {
      asked.isAsking = false
      $.ui.invalidate('ui.render')
    }
  })
}

/**
 * Asks the terminal whether it draws pictures, once the probe Image under `requestId` is drawn from its file: a blit
 * of it, with another generation of that file, is taken where it does, refused where it draws its alt; any other
 * refusal, or a failure, asks again on the next drawing, PROBE_TRIES times in all. Asks a period after the drawing,
 * which gives the terminal the time to draw the probe, and draws again once answered, without writing the state: a
 * timer started by a drawing may not.
 */
export async function askForPictures($: EngineInterface, requestId: string): Promise<void> {
  const asked = await knownIn($)
  const probe = asked.probe

  if (asked.drawing !== 'unknown' || asked.isAsking) {
    return
  }

  asked.isAsking = true

  if (probe === undefined) {
    writeProbe($, asked)

    return
  }

  $.clock.after(LOAD_EVERY, async () => {
    asked.tries++

    try {
      const source: ImageSource = { file: probe, format: 'rgba', width: 1, height: 1, generation: asked.tries }
      const { deny } = await $.ui.blit({ requestId, key: PROBE, source })

      if (deny === undefined) {
        asked.drawing = 'drawn'
      } else if (deny.includes('draws its alt')) {
        asked.drawing = 'alt'
      }
    } catch {
    } finally {
      if (asked.drawing === 'unknown' && asked.tries >= PROBE_TRIES) {
        asked.drawing = 'alt'
      }

      asked.isAsking = false
      $.ui.invalidate('ui.render')
    }
  })
}

/** How many pixels a picture is kept a side at most: about as many as the 60 columns it is drawn over at most. */
const PICTURE_SIDE = 640
/** How many pictures are kept, the oldest drawn left out first, and its file removed: some 1.6 MiB each. */
const KEPT = 32

/**
 * The pictures loaded, by URL, the one drawn least recently left out first, each kept in a file of its own; kept in
 * the module, which a /clear leaves.
 */
const pictures = new LeastRecent<KeptPicture>(KEPT)
/** The pictures that could not be loaded, which are not tried again until the log is refreshed on demand. */
const failed = new Set<string>()
/**
 * The loading of the pictures of a session, which a /clear or a resume starts over: the pictures waiting, one after
 * another, decoding one taking some 150 ms; the one loading, in the queue no more and not loaded yet, and since when;
 * and the timer loading them, one a period while some wait. Each period runs on its own, once the drawing that asked
 * for them is over, which would cut short what was started while it was dispatched.
 */
type Loading = {
  session: string
  queue: string[]
  loading?: { url: string; since: number }
  loader?: Timer
}

let current: Loading | undefined

/** How often the loader looks for a picture to load. */
export const LOAD_EVERY = 250
/**
 * How long a picture is waited for before it is taken for one that could not be loaded: longer than its download and
 * its file, 30 seconds each at most.
 */
const LOAD_TIMEOUT = 75_000

/** The picture loaded for `url`, if any, to draw: the one drawn last, left out last. */
export function pictureOf(url: string): KeptPicture | undefined {
  return pictures.get(url)
}

/** Whether the picture of `url` is loaded, which leaves the pictures kept as they were: to measure, not to draw. */
export function isLoaded(url: string): boolean {
  return pictures.has(url)
}

/** Tries again the pictures that could not be loaded, as the log is refreshed on demand. */
export function forgetFailedPictures(): void {
  failed.clear()
}

/**
 * Loads the next picture waiting, unless one is loading, not for LOAD_TIMEOUT yet; stops the loader once none waits.
 * Draws again once it is loaded, or could not be, without writing the state: a timer started by a drawing may not.
 */
async function loadNext($: EngineInterface, state: Loading): Promise<void> {
  const now = await $.clock.now()

  if (state.loading !== undefined && now - state.loading.since < LOAD_TIMEOUT) {
    return
  }

  if (state.loading !== undefined) {
    failed.add(state.loading.url)
  }

  const url = state.queue.shift()

  if (url === undefined) {
    delete state.loading
    state.loader?.cancel()
    delete state.loader

    return
  }

  const loading = { url, since: now }
  state.loading = loading
  const run = runOf($)

  try {
    const kept = await folderOf($)
    const picture = await loadPicture(
      address => downloadPicture(run, kept, address),
      rgba => savePixels(run, kept, rgba),
      url,
      PICTURE_SIDE,
    )

    for (const left of pictures.set(url, picture)) {
      await removePixels(run, left.file)
    }
  } catch {
    failed.add(url)
  }

  if (state.loading === loading) {
    delete state.loading
  }

  $.ui.invalidate('ui.render')
}

/**
 * Loads the pictures at `urls`, those near what the log shows, not loaded, loading or failed yet, one after another,
 * from a timer of their own: none starts while the drawing that asks for them is dispatched. They replace those
 * waiting, which the log may no longer show near.
 */
export async function loadPictures($: EngineInterface, urls: readonly string[]): Promise<void> {
  const session = await $.session.id()

  if (current?.session !== session) {
    current?.loader?.cancel()
    current = { session, queue: [] }
  }

  const state = current
  state.queue = [...new Set(urls)].filter(url => !pictures.has(url) && !failed.has(url) && url !== state.loading?.url)

  if (state.queue.length > 0 && state.loader === undefined) {
    state.loader = $.clock.every(LOAD_EVERY, () => loadNext($, state))
  }
}
