/** The frames of the spinner drawn while something loads, one column each. */
export const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const

/** How long each frame shows, in milliseconds. */
export const FRAME_EVERY = 120

/** The frame of the spinner at `now`: every spinner drawn turns together. */
export function spinner(now: number): string {
  return FRAMES[Math.floor(now / FRAME_EVERY) % FRAMES.length] as string
}
