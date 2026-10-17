export const MIN_LENGTH = 3
export const MAX_LENGTH = 4000

const REPLY = /^[A-Za-z0-9:/._@-]*$/

export type Check = { length: number; error?: string }

export function characters(text: string): number {
  return [...text].length
}

export function thousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function check(message: string, reply: string): Check {
  const length = characters(message)

  if (length < MIN_LENGTH) {
    return { length, error: `At least ${MIN_LENGTH} characters.` }
  }

  if (length > MAX_LENGTH) {
    const over = length - MAX_LENGTH

    return { length, error: `Too long by ${thousands(over)} character${over === 1 ? '' : 's'}: shorten it yourself.` }
  }

  if (!REPLY.test(reply)) {
    return { length, error: 'Reply to a commit hash (0be0130) or its link.' }
  }

  return { length }
}
