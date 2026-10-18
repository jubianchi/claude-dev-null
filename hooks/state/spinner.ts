import type { EngineInterface, Timer } from 'claude-code'
import { atom, read, update } from 'claude-code'

import { FRAME_EVERY } from '../spinner'

/** The time of the spinner's last frame, for what draws it to draw again. */
const spinnerTick = atom({ plugin: 'dev-null', key: 'spinnerTick' } as const, 0)

/** The timer turning the spinner while something loads; a reload of the module drops it. */
let timer: Timer | undefined
/** How many loads the spinner turns for. */
let loads = 0

/** Turns the spinner while `work` runs, and stops it once nothing else loads. */
export async function spinning<T>($: EngineInterface, work: () => Promise<T>): Promise<T> {
  loads++
  timer ??= $.clock.every(FRAME_EVERY, async () => {
    const now = await $.clock.now()
    await update($, spinnerTick, () => now)
  })

  try {
    return await work()
  } finally {
    loads--

    if (loads === 0) {
      timer?.cancel()
      timer = undefined
    }
  }
}

/** Reads the spinner's last frame, for a drawing to draw again when it turns. */
export async function readSpinner($: EngineInterface): Promise<void> {
  await read($, spinnerTick)
}
