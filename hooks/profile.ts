/** The profile of a developer on /dev/null. */
export function profileUrl(username: string): string {
  return `https://dev-null.sh/@${encodeURIComponent(username)}`
}
