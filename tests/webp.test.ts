import { describe, expect, test } from 'claude-code/testing'

import { decode } from '../hooks/vendor/webp'

/** A lossy WebP (VP8), as /dev/null serves its pictures: 16×8 of one red, encoded by cwebp. */
const RED = 'UklGRj4AAABXRUJQVlA4IDIAAADQAQCdASoQAAgAAMASJaACdLoB+AADsAD+9hNf/uQD2QD2QD+E//9krfZ5f2St/2PIAA=='

describe('decoding a WebP', () => {
  test('gives its RGBA pixels, within a level of what dwebp gives, (202, 50, 21), rounding aside', () => {
    const image = decode(Uint8Array.fromBase64(RED))
    const isFar = (value: number, index: number) => Math.abs(value - ([202, 50, 21, 255][index % 4] ?? 0)) > 1

    expect(image.width).toBe(16)
    expect(image.height).toBe(8)
    expect(image.data.length).toBe(16 * 8 * 4)
    expect([...image.data].filter(isFar)).toEqual([])
  })

  test('throws on what is no WebP', () => {
    expect(() => decode(new Uint8Array([1, 2, 3]))).toThrow()
  })
})
