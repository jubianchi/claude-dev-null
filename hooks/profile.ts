/** The profile of the developer of `id` on /dev/null, which it finds whatever their handle now. */
export function mentionUrl(id: string): string {
  return `https://dev-null.sh/mentions/${encodeURIComponent(id)}`
}

/** The profile of a developer on /dev/null. */
export function profileUrl(handle: string): string {
  return `https://dev-null.sh/@${encodeURIComponent(handle)}`
}
