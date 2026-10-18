/** A value kept in the store, with the version of its shape. */
export type Sealed = { version: number; value: unknown }

/** What leads a value of version `n`, the key, to version `n + 1`. */
export type Migrations = Readonly<Record<number, (value: unknown) => unknown>>

/** `value`, kept at `version`. */
export function seal(version: number, value: unknown): Sealed {
  return { version, value }
}

function isSealed(stored: unknown): stored is Sealed {
  const sealed = stored as Partial<Sealed> | null | undefined

  return typeof sealed === 'object' && sealed !== null && Number.isInteger(sealed.version) && 'value' in sealed
}

/**
 * The value `stored` holds, brought to `version` through `migrations`; undefined, for it to be reset, when it is no
 * sealed value, is of a newer version, or no migration leads from its version, or one fails.
 */
export function unseal(stored: unknown, version: number, migrations: Migrations): unknown {
  if (!isSealed(stored) || stored.version > version) {
    return undefined
  }

  let value = stored.value

  try {
    for (let at = stored.version; at < version; at++) {
      const migrate = migrations[at]

      if (migrate === undefined) {
        return undefined
      }

      value = migrate(value)
    }
  } catch {
    return undefined
  }

  return value
}
