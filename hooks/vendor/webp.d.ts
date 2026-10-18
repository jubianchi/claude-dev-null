/** The pixels of a decoded WebP: RGBA, four bytes each, a row after another. */
export type WebpImageData = {
  data: Uint8Array
  width: number
  height: number
  hasAlpha?: boolean
}

/**
 * Decodes a WebP, lossy (VP8, with or without alpha) or lossless (VP8L), as dwebp does; throws on what is no WebP.
 */
export function decode(buffer: Uint8Array | ArrayBuffer, options?: { format?: 'rgba' | 'rgb' }): WebpImageData
