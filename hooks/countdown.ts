/** The time left until `at`, from `now`, in whole seconds rounded up, a second at least, in three columns. */
export function countdown(at: number, now: number): string {
  return `${Math.max(1, Math.ceil((at - now) / 1000))}s`.padStart(3)
}
