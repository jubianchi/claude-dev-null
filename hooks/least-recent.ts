/** Values by key, `size` at most: the one used least recently is left out first. */
export class LeastRecent<V> {
  readonly #values = new Map<string, V>()

  constructor(readonly size: number) {}

  /** Whether `key` holds a value, which does not make it used. */
  has(key: string): boolean {
    return this.#values.has(key)
  }

  /** The value of `key`, if any, which makes it the one used last. */
  get(key: string): V | undefined {
    const value = this.#values.get(key)

    if (value !== undefined) {
      this.#values.delete(key)
      this.#values.set(key, value)
    }

    return value
  }

  /** Sets the value of `key`, the one used last; gives the values left out: the one it replaced, those over `size`. */
  set(key: string, value: V): V[] {
    const replaced = this.#values.get(key)
    this.#values.delete(key)
    this.#values.set(key, value)
    const over = [...this.#values.keys()].slice(0, Math.max(0, this.#values.size - this.size))
    const left = over.flatMap(oldest => {
      const old = this.#values.get(oldest)
      this.#values.delete(oldest)

      return old === undefined ? [] : [old]
    })

    return replaced === undefined ? left : [replaced, ...left]
  }
}
