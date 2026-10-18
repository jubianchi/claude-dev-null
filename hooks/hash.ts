/** A commit's short hash, as /dev/null makes it: the last 7 characters of its id, without its dashes. */
export function shortHash(id: string): string {
  return id.replaceAll('-', '').slice(-7)
}
