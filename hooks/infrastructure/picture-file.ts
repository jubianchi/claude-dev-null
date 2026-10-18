import type { Run } from './web-picture'

/** Makes a folder of its own in the temporary directory, which only it names so, and prints its path. */
const MAKE_FOLDER = `d="$(mktemp -d "\${TMPDIR:-/tmp}/dev-null-pictures.XXXXXX")" && printf %s "$d"`

/**
 * Writes the base64 it reads into a file of its own in the folder $1, and prints its path; a command's input and
 * output are text. A file it could not write goes.
 */
const SAVE =
  'f="$(mktemp "$1/picture.XXXXXX")" && { base64 --decode > "$f" || { rm -f "$f"; exit 1; }; } && printf %s "$f"'

/** Whether `path` is a folder makeFolder made: an absolute path with no `..`, named `dev-null-pictures.` and more. */
function isFolder(path: string): boolean {
  const parts = path.split('/')

  return path.startsWith('/') && !parts.includes('..') && /^dev-null-pictures\.[A-Za-z0-9]+$/.test(parts.at(-1) ?? '')
}

/** Whether `path` is a file savePixels wrote: `picture.` and more, in a folder makeFolder made. */
function isPixels(path: string): boolean {
  const slash = path.lastIndexOf('/')

  return isFolder(path.slice(0, slash)) && /^picture\.[A-Za-z0-9]+$/.test(path.slice(slash + 1))
}

async function printed(run: Run, argv: readonly string[], stdin?: string): Promise<string> {
  const { exitCode, stdout, stderr } = await run(argv, { timeoutMs: 30_000, ...(stdin === undefined ? {} : { stdin }) })

  if (exitCode !== 0 || stdout === '') {
    throw new Error(stderr.trim().split('\n')[0] || `could not keep a picture (exit ${exitCode})`)
  }

  return stdout
}

/** Makes the folder the pictures of this process are kept in, which goes with it; gives its path. */
export async function makeFolder(run: Run): Promise<string> {
  return printed(run, ['sh', '-c', MAKE_FOLDER])
}

/**
 * Keeps the RGBA pixels of a picture, `rgba` in base64, in a file of `folder` the terminal reads, so that a drawing
 * names it rather than carry its bytes: a drawing takes 2 MiB of pictures in all. Gives the file's path.
 */
export async function savePixels(run: Run, folder: string, rgba: string): Promise<string> {
  return printed(run, ['sh', '-c', SAVE, 'sh', folder], rgba)
}

/** Removes a file savePixels wrote, and no other. */
export async function removePixels(run: Run, file: string): Promise<void> {
  if (isPixels(file)) {
    await run(['rm', '-f', '--', file])
  }
}

/** Removes a folder makeFolder made, with the pictures in it, and no other. */
export async function removeFolder(run: Run, folder: string): Promise<void> {
  if (isFolder(folder)) {
    await run(['rm', '-rf', '--', folder])
  }
}
