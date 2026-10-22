import { linksIn } from './body'

export const MIN_LENGTH = 1
export const MAX_LENGTH = 4000

/** The characters a link of the text counts for at most. */
const LINK_LENGTH = 23

/** A block of code, from a line of ``` or more to a line of ``` or more, or code between backticks on one line. */
const CODE = /((?<![^\n])`{3,}[^`\r\n]*\r?\n(?:[\s\S]*?\r?\n)?`{3,}[ \t]*(?![^\r\n])|`[^`\r\n]+`)/

/** The images a commit carries at most. */
export const MAX_IMAGES = 3

const REPLY = /^[A-Za-z0-9:/._@-]*$/
const IMAGE = /\.(jpe?g|png|webp)$/i

export type Check = { length: number; error?: string }

export function characters(text: string): number {
  return [...text].length
}

/** The prose of `text`, the parts outside code, in its order. */
function prose(text: string): string[] {
  return text.split(CODE).filter((_, index) => index % 2 === 0)
}

/** `text` as /dev/null keeps it: trimmed, its line ends `\n`, and the blank lines of its prose run into one. */
function normalized(text: string): string {
  return text
    .trim()
    .replace(/\r\n?/g, '\n')
    .split(CODE)
    .map((part, index) => (index % 2 === 0 ? part.replace(/(?:[ \t]*\n){3,}/g, '\n\n') : part))
    .join('')
}

/** The characters of a commit, as /dev/null counts them: once kept, each link of its prose for 23 at most. */
export function lengthOf(message: string): number {
  const kept = normalized(message)

  return prose(kept)
    .flatMap(linksIn)
    .reduce((total, link) => total - Math.max(0, characters(link) - LINK_LENGTH), characters(kept))
}

export function thousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * The path of a file as typed in the image field: what a terminal pastes for a file dropped on it, escaped (`a\ b`) or
 * quoted (`'a b'`) as for a shell, is the file it names.
 */
export function imagePath(typed: string): string {
  const trimmed = typed.trim()
  const quoted = /^(['"])(.*)\1$/s.exec(trimmed)

  return quoted?.[2] ?? trimmed.replace(/\\(.)/gs, '$1')
}

/** The images a commit carries: those added, then the path left in the image field, while fewer than MAX_IMAGES. */
export function attached(images: readonly string[], typed: string): string[] {
  const path = imagePath(typed)

  return path === '' || images.length >= MAX_IMAGES ? [...images] : [...images, path]
}

export function check(message: string, reply: string, images: readonly string[] = []): Check {
  const length = lengthOf(message)

  if (length < MIN_LENGTH) {
    return { length, error: `At least ${MIN_LENGTH} character.` }
  }

  if (length > MAX_LENGTH) {
    const over = length - MAX_LENGTH

    return { length, error: `Too long by ${thousands(over)} character${over === 1 ? '' : 's'}: shorten it yourself.` }
  }

  if (!REPLY.test(reply)) {
    return { length, error: 'Reply to a commit hash (0be0130) or its link.' }
  }

  if (!images.every(image => IMAGE.test(image))) {
    return { length, error: 'Images are JPEG, PNG or WebP files.' }
  }

  return { length }
}
