import { describe, expect, test } from 'claude-code/testing'

import { loadPicture } from '../hooks/application/pictures'

/** A lossy WebP 16×8 of one red, (202, 50, 21) once decoded. */
const RED = 'UklGRj4AAABXRUJQVlA4IDIAAADQAQCdASoQAAgAAMASJaACdLoB+AADsAD+9hNf/uQD2QD2QD+E//9krfZ5f2St/2PIAA=='
const URL = 'https://dev-null.sh/commit-images/red'

/** Keeps the pixels it is given in memory, as files named after their count. */
function files() {
  const saved: string[] = []

  return {
    saved,
    save: async (rgba: string) => {
      saved.push(rgba)

      return `/tmp/dev-null-picture.${saved.length}`
    },
  }
}

const red = async () => Uint8Array.fromBase64(RED)

describe('loading a picture of a commit', () => {
  test('downloads it, decodes it, shrinks it to the side asked and keeps its pixels in a file', async () => {
    const urls: string[] = []
    const { saved, save } = files()
    const download = async (url: string) => {
      urls.push(url)

      return red()
    }
    const picture = await loadPicture(download, save, URL, 8)

    expect(urls).toEqual([URL])
    expect(picture).toEqual({ file: '/tmp/dev-null-picture.1', width: 8, height: 4 })
    expect(saved.map(rgba => Uint8Array.fromBase64(rgba).length)).toEqual([8 * 4 * 4])
  })

  test('keeps a picture smaller than the side asked as it is', async () => {
    const picture = await loadPicture(red, files().save, URL, 640)

    expect([picture.width, picture.height]).toEqual([16, 8])
  })

  test('decodes no picture that says it is over 4096 pixels a side, nor one that says no size', async () => {
    const header = (data: number[]) => {
      const text = (value: string) => [...value].map(c => c.charCodeAt(0))

      return new Uint8Array([...text('RIFF'), 22, 0, 0, 0, ...text('WEBPVP8X'), 10, 0, 0, 0, ...data])
    }
    const huge = header([0, 0, 0, 0, 0xff, 0x3f, 0, 0x00, 0x10, 0])
    const { saved, save } = files()

    await expect(loadPicture(async () => huge, save, URL, 640)).rejects.toThrow('16384×4097')
    await expect(loadPicture(async () => new Uint8Array([1, 2, 3]), save, URL, 640)).rejects.toThrow('no WebP')
    expect(saved).toEqual([])
  })

  test('fails as the download, the decoding or the file does', async () => {
    const failing = async () => {
      throw new Error('curl: (22) 404')
    }

    await expect(loadPicture(failing, files().save, URL, 8)).rejects.toThrow('curl: (22) 404')
    await expect(loadPicture(async () => new Uint8Array([1, 2, 3]), files().save, URL, 8)).rejects.toThrow()
    await expect(
      loadPicture(
        red,
        async () => {
          throw new Error('no space left')
        },
        URL,
        8,
      ),
    ).rejects.toThrow('no space left')
  })
})
