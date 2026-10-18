import type { EngineInterface } from 'claude-code'
import { atom, read, update } from 'claude-code'

import { signIn } from '../application/account'
import { webAppOf } from './web-app'

const cookieDraft = atom({ plugin: 'dev-null', key: 'cookieDraft' } as const, '')
const accountError = atom({ plugin: 'dev-null', key: 'accountError' } as const, '')
const isAccountLoaded = atom({ plugin: 'dev-null', key: 'isAccountLoaded' } as const, false)
const username = atom({ plugin: 'dev-null', key: 'username' } as const, '')

/** The username of the person signed in, '' when no one is. */
export async function signedInAs($: EngineInterface): Promise<string> {
  if (await read($, isAccountLoaded)) {
    return read($, username)
  }

  const stored = await $.store.get('username')

  return typeof stored === 'string' ? stored : ''
}

/** The remember cookie the person pasted, kept in the store only. */
export async function sessionCookie($: EngineInterface): Promise<string | undefined> {
  const stored = await $.store.get('cookie')

  return typeof stored === 'string' ? stored : undefined
}

export async function accountForm($: EngineInterface): Promise<{ draft: string; error: string }> {
  return { draft: await read($, cookieDraft), error: await read($, accountError) }
}

export async function typeCookie($: EngineInterface, value: string): Promise<void> {
  await update($, cookieDraft, () => value)
}

async function setSignedIn($: EngineInterface, name: string): Promise<void> {
  await update($, username, () => name)
  await update($, isAccountLoaded, () => true)
}

export async function signInWith($: EngineInterface, pasted: string): Promise<void> {
  await update($, cookieDraft, () => pasted)
  const signed = await signIn(cookie => webAppOf($, cookie), pasted)

  if ('error' in signed) {
    await update($, accountError, () => signed.error)

    return
  }

  await $.store.set('cookie', signed.cookie)
  await $.store.set('username', signed.username)
  await update($, cookieDraft, () => '')
  await update($, accountError, () => '')
  await setSignedIn($, signed.username)
}

export async function signOut($: EngineInterface): Promise<void> {
  await $.store.delete('cookie')
  await $.store.delete('username')
  await setSignedIn($, '')
}
