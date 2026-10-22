/** The profile of the developer of `id` on /dev/null, which it finds whatever their username now. */
export function mentionUrl(id: string): string {
  return `https://dev-null.sh/mentions/${encodeURIComponent(id)}`
}

/** The profile of a developer on /dev/null. */
export function profileUrl(username: string): string {
  return `https://dev-null.sh/@${encodeURIComponent(username)}`
}
