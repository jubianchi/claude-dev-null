import type { KeptPicture } from '../picture'
import { shrunk, webpSize } from '../picture'
import { decode } from '../vendor/webp'

/** How many pixels a side a picture may say it has, to be decoded: its RGBA pixels are all held at once. */
const MAX_DECODED_SIDE = 4096

/** Downloads the bytes at a URL. */
export type Download = (url: string) => Promise<Uint8Array>

/** Keeps RGBA pixels, in base64, in a file the terminal reads, and gives its path. */
export type Save = (rgba: string) => Promise<string>

/**
 * The picture at `url`, downloaded with `download`, decoded, `side` pixels a side at most, and kept with `save`;
 * fails as they do, and before decoding a picture that says no size, or over MAX_DECODED_SIDE pixels a side.
 */
export async function loadPicture(download: Download, save: Save, url: string, side: number): Promise<KeptPicture> {
  const bytes = await download(url)
  const size = webpSize(bytes)

  if (size === undefined) {
    throw new Error(`${url} is no WebP`)
  }

  if (Math.max(size.width, size.height) > MAX_DECODED_SIDE) {
    throw new Error(`${url} is too large to decode (${size.width}×${size.height})`)
  }

  const { rgba, width, height } = shrunk(decode(bytes), side)

  return { file: await save(rgba), width, height }
}
