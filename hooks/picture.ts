/** Pixels of a picture, four bytes each, red, green, blue and alpha, a row after another. */
export type Pixels = { width: number; height: number; data: Uint8Array }

/** A picture as an Image shows it: its RGBA pixels, base64. */
export type Picture = { rgba: string; width: number; height: number }

/** A picture whose RGBA pixels are kept in a file the terminal reads, which a drawing names rather than carries. */
export type KeptPicture = { file: string; width: number; height: number }

/**
 * The size a WebP says it has, read from the header of its first chunk, before its pixels are decoded: lossy (`VP8 `,
 * 14 bits a side after its start code), lossless (`VP8L`, 14 bits a side, less one) or extended (`VP8X`, its canvas, 24
 * bits a side, less one); unknown for what is no WebP, or too short to say.
 */
export function webpSize(bytes: Uint8Array): { width: number; height: number } | undefined {
  const text = (from: number) => String.fromCharCode(...bytes.subarray(from, from + 4))
  const at = (offset: number) => bytes[20 + offset] ?? 0
  const has = (length: number) => bytes.length >= 20 + length

  if (text(0) !== 'RIFF' || text(8) !== 'WEBP') {
    return undefined
  }

  switch (text(12)) {
    case 'VP8 ':
      return has(10) && at(3) === 0x9d && at(4) === 0x01 && at(5) === 0x2a
        ? { width: (at(6) | (at(7) << 8)) & 0x3fff, height: (at(8) | (at(9) << 8)) & 0x3fff }
        : undefined
    case 'VP8L': {
      const bits = at(1) | (at(2) << 8) | (at(3) << 16) | (at(4) << 24)

      return has(5) && at(0) === 0x2f ? { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 } : undefined
    }
    case 'VP8X':
      return has(10)
        ? { width: 1 + (at(4) | (at(5) << 8) | (at(6) << 16)), height: 1 + (at(7) | (at(8) << 8) | (at(9) << 16)) }
        : undefined
    default:
      return undefined
  }
}

/** How wide a picture is shown, in columns, at most. */
export const MAX_COLUMNS = 60
/** How tall a picture is shown, in rows, at most: a tall one is shown narrower. */
export const MAX_ROWS = 20

/**
 * `image` `side` pixels wide and tall at most, each of its pixels the average of the block of pixels it stands for, so
 * that it fits what an Image takes: 2 MiB of RGBA, 640 pixels a side taking 1.6.
 */
export function shrunk(image: Pixels, side: number): Picture {
  const scale = Math.max(image.width / side, image.height / side)

  if (scale <= 1) {
    return { rgba: image.data.toBase64(), width: image.width, height: image.height }
  }

  const width = Math.max(1, Math.round(image.width / scale))
  const height = Math.max(1, Math.round(image.height / scale))
  const data = new Uint8Array(width * height * 4)

  for (let y = 0; y < height; y++) {
    const top = Math.floor(y * scale)
    const bottom = Math.min(image.height, Math.max(top + 1, Math.floor((y + 1) * scale)))

    for (let x = 0; x < width; x++) {
      const left = Math.floor(x * scale)
      const right = Math.min(image.width, Math.max(left + 1, Math.floor((x + 1) * scale)))
      const sums = [0, 0, 0, 0]

      for (let row = top; row < bottom; row++) {
        for (let column = left; column < right; column++) {
          const from = (row * image.width + column) * 4
          for (let channel = 0; channel < 4; channel++) {
            sums[channel] = (sums[channel] ?? 0) + (image.data[from + channel] ?? 0)
          }
        }
      }

      const count = (bottom - top) * (right - left)
      data.set(
        sums.map(sum => Math.round(sum / count)),
        (y * width + x) * 4,
      )
    }
  }

  return { rgba: data.toBase64(), width, height }
}

/**
 * The box of cells a picture `size` is shown in, `columns` wide at most: as wide as it may be up to MAX_COLUMNS, its
 * rows half its shape's, a cell being about twice as tall as wide, up to MAX_ROWS, narrower then to keep its shape.
 */
export function shown(size: { width: number; height: number }, columns: number): { columns: number; rows: number } {
  if (size.width <= 0 || size.height <= 0) {
    return { columns: 1, rows: 1 }
  }

  const wide = Math.max(1, Math.min(MAX_COLUMNS, columns))
  const rows = Math.round((wide * size.height) / size.width / 2)

  return rows > MAX_ROWS
    ? { columns: Math.max(1, Math.round((MAX_ROWS * 2 * size.width) / size.height)), rows: MAX_ROWS }
    : { columns: wide, rows: Math.max(1, rows) }
}
