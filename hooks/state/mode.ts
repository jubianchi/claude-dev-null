import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

/** Whether the composer shows above the prompt always, or on demand. */
export type Mode = 'always' | 'manual'

const mode = atom({ plugin: 'dev-null', key: 'mode' } as const, '')

export async function currentMode($: EngineInterface): Promise<Mode> {
  const value = (await read($, mode)) || (await $.store.get('mode'))

  return value === 'always' ? 'always' : 'manual'
}

export async function setMode($: EngineInterface, value: Mode): Promise<void> {
  await $.store.set('mode', value)
  await update($, mode, () => value)
}
