import { describe, expect, test } from 'claude-code/testing'

import { MAX_COLUMNS, MAX_ROWS, shown, shrunk, webpSize } from '../hooks/picture'

/** A WebP whose first chunk is `fourCC`, with `data`, for its header to be read. */
function webp(fourCC: string, data: number[]): Uint8Array {
  const text = (value: string) => [...value].map(c => c.charCodeAt(0))
  const length = (n: number) => [n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]

  return new Uint8Array([
    ...text('RIFF'),
    ...length(12 + data.length),
    ...text('WEBP'),
    ...text(fourCC),
    ...length(data.length),
    ...data,
  ])
}

describe('the size a WebP says it has', () => {
  test('is read from the header of its frame, lossy, lossless or extended', () => {
    const lossy = Uint8Array.fromBase64(
      'UklGRj4AAABXRUJQVlA4IDIAAADQAQCdASoQAAgAAMASJaACdLoB+AADsAD+9hNf/uQD2QD2QD+E//9krfZ5f2St/2PIAA==',
    )
    const width = 1600 - 1
    const height = 942 - 1
    const bits = width | (height << 14)

    expect(webpSize(lossy)).toEqual({ width: 16, height: 8 })
    expect(
      webpSize(webp('VP8L', [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >> 24) & 0xff])),
    ).toEqual({
      width: 1600,
      height: 942,
    })
    expect(webpSize(webp('VP8X', [0, 0, 0, 0, 0x7f, 0x3e, 0, 0xff, 0x3f, 0]))).toEqual({ width: 16000, height: 16384 })
  })

  test('is unknown for what is no WebP, or too short to say', () => {
    expect(webpSize(new Uint8Array([1, 2, 3]))).toBeUndefined()
    expect(webpSize(webp('VP8 ', [0, 0, 0]))).toBeUndefined()
    expect(webpSize(webp('ALPH', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeUndefined()
  })
})

function pixels(...values: number[][]): Uint8Array {
  return new Uint8Array(values.flat())
}

describe('shrinking a picture', () => {
  test('averages each block of pixels into one, a wide picture as wide as asked', () => {
    const image = {
      width: 4,
      height: 2,
      data: pixels(
        [0, 0, 0, 255],
        [100, 100, 100, 255],
        [200, 0, 0, 255],
        [200, 0, 0, 255],
        [0, 0, 0, 255],
        [100, 100, 100, 255],
        [0, 0, 200, 255],
        [0, 0, 200, 255],
      ),
    }
    const picture = shrunk(image, 2)

    expect(picture).toEqual({
      rgba: pixels([50, 50, 50, 255], [100, 0, 100, 255]).toBase64(),
      width: 2,
      height: 1,
    })
  })

  test('makes a tall picture as tall as asked, so that it never goes over what an Image takes', () => {
    const image = {
      width: 2,
      height: 4,
      data: pixels(
        [0, 0, 0, 255],
        [100, 100, 100, 255],
        [0, 0, 0, 255],
        [100, 100, 100, 255],
        [200, 0, 0, 255],
        [0, 0, 200, 255],
        [200, 0, 0, 255],
        [0, 0, 200, 255],
      ),
    }

    expect(shrunk(image, 2)).toEqual({
      rgba: pixels([50, 50, 50, 255], [100, 0, 100, 255]).toBase64(),
      width: 1,
      height: 2,
    })
  })

  test('keeps a picture smaller than asked as it is', () => {
    const image = { width: 1, height: 1, data: pixels([1, 2, 3, 4]) }

    expect(shrunk(image, 640)).toEqual({ rgba: pixels([1, 2, 3, 4]).toBase64(), width: 1, height: 1 })
  })
})

describe('the box a picture is shown in', () => {
  test('takes the columns it is given, and rows half as many as its shape would, a cell being twice as tall', () => {
    expect(shown({ width: 1600, height: 800 }, 40)).toEqual({ columns: 40, rows: 10 })
  })

  test(`is ${MAX_COLUMNS} columns wide at most`, () => {
    expect(shown({ width: 1600, height: 800 }, 200)).toEqual({ columns: MAX_COLUMNS, rows: MAX_COLUMNS / 4 })
  })

  test(`is ${MAX_ROWS} rows tall at most, narrower to keep its shape`, () => {
    expect(shown({ width: 800, height: 1600 }, 60)).toEqual({ columns: MAX_ROWS, rows: MAX_ROWS })
  })

  test('takes a column and a row at least', () => {
    expect(shown({ width: 4000, height: 10 }, 60)).toEqual({ columns: 60, rows: 1 })
    expect(shown({ width: 10, height: 4000 }, 60)).toEqual({ columns: 1, rows: MAX_ROWS })
    expect(shown({ width: 0, height: 0 }, 60)).toEqual({ columns: 1, rows: 1 })
  })
})
