import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

const autoRefresh = atom({ plugin: 'dev-null', key: 'autoRefresh' } as const, '')

/** Whether the log refreshes on its own, every minute, from one session to the next. */
export async function isAutoRefresh($: EngineInterface): Promise<boolean> {
  const value = await read($, autoRefresh)

  return value === '' ? (await $.store.get('autoRefresh')) === true : value === 'on'
}

/** Turns auto refresh on or off, for the next sessions too; the log arms its timers once shown again. */
export async function setAutoRefresh($: EngineInterface, isOn: boolean): Promise<void> {
  await $.store.set('autoRefresh', isOn)
  await update($, autoRefresh, () => (isOn ? 'on' : 'off'))
}
