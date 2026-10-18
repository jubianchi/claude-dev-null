import { describe, expect, test } from 'claude-code/testing'

import { rememberCookie, signedInAs } from '../hooks/infrastructure/web-account'
import type { Page, WebApp } from '../hooks/infrastructure/web-app'
import { WebAppError } from '../hooks/infrastructure/web-app'

const NAME = 'remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d'

describe('reading the cookie pasted', () => {
  test('keeps the remember cookie, as name=value', () => {
    expect(rememberCookie(`${NAME}=eyJpdiI6%3D%3D`)).toBe(`${NAME}=eyJpdiI6%3D%3D`)
  })

  test('takes it out of a whole Cookie header, and leaves the others', () => {
    expect(rememberCookie(`Cookie: XSRF-TOKEN=abc; ${NAME}=value; devnull-session=xyz`)).toBe(`${NAME}=value`)
  })

  test('takes it with the spaces and the newlines around it', () => {
    expect(rememberCookie(`\n  ${NAME} = value \n`)).toBe(`${NAME}=value`)
  })

  test('reads nothing without a remember cookie', () => {
    expect(rememberCookie('')).toBeNull()
    expect(rememberCookie('value')).toBeNull()
    expect(rememberCookie('devnull-session=xyz')).toBeNull()
    expect(rememberCookie(`${NAME}=`)).toBeNull()
  })

  test('reads nothing that would not stay one cookie', () => {
    expect(rememberCookie(`${NAME}=val\rue`)).toBeNull()
    expect(rememberCookie(`${NAME}=val"ue`)).toBeNull()
  })
})

/** A web app answering every visit with `auth`, recording the paths visited. */
function app(auth: unknown): WebApp & { paths: string[] } {
  const paths: string[] = []

  return {
    paths,
    visit: async (path: string): Promise<Page> => {
      paths.push(path)

      if (auth instanceof Error) {
        throw auth
      }

      return { component: 'terms/show', props: { auth }, url: path, version: 'v1' }
    },
    json: async () => Promise.reject(new Error('not JSON')),
  }
}

describe('checking who the cookie signs in', () => {
  test('answers the username of the person signed in', async () => {
    const web = app({ user: { username: 'jubianchi', name: 'Julien' } })

    expect(await signedInAs(web)).toBe('jubianchi')
  })

  test('asks a page that changes nothing for the person signed in', async () => {
    const web = app({ user: { username: 'jubianchi' } })
    await signedInAs(web)

    expect(web.paths).toEqual(['/terms'])
  })

  test('answers null when no one is signed in', async () => {
    expect(await signedInAs(app({ user: null }))).toBeNull()
    expect(await signedInAs(app(undefined))).toBeNull()
  })

  test('lets the web app say what went wrong', async () => {
    await expect(signedInAs(app(new WebAppError('HTTP 500')))).rejects.toThrow('HTTP 500')
  })
})
