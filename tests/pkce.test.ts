import { describe, expect, test } from 'claude-code/testing'

import { challengeOf, pkce } from '../hooks/pkce'

const sha256 = (data: Uint8Array) => crypto.subtle.digest('SHA-256', data)

describe('proving the key of a sign-in, as RFC 7636 says', () => {
  test('challenges a verifier with its SHA-256, in base64url', async () => {
    expect(await challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk', sha256)).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    )
  })

  test('draws a verifier of 64 characters, its challenge and a state of its own', async () => {
    let drawn = 0
    const random = (length: number) => Uint8Array.from({ length }, () => drawn++ % 256)
    const found = await pkce(random, sha256)

    expect(found.verifier).toMatch(/^[A-Za-z0-9_-]{64}$/)
    expect(found.challenge).toBe(await challengeOf(found.verifier, sha256))
    expect(found.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(found.state).toMatch(/^[0-9a-f]{32}$/)
  })
})
