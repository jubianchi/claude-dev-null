// The rules of resources/js/components/linkified-text.tsx, on /dev/null, for the links to GitHub, GitLab and Codeberg.

const GITHUB_HOST_PATTERN = /^(?:www\.)?github\.com$/i
const GITHUB_OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/
const GITHUB_REPOSITORY_PATTERN = /^[A-Za-z0-9._-]{1,100}$/
const GITHUB_NUMBER_PATTERN = /^[1-9][0-9]{0,9}$/
const GITHUB_SHA_PATTERN = /^[0-9a-f]{7,40}$/i
/** Two refs compared, "base...head" or "base..head", each a branch, a tag or a commit. */
const GITHUB_COMPARISON_PATTERN = /^([A-Za-z0-9_][A-Za-z0-9._/-]*?)(\.{2,3})([A-Za-z0-9_][A-Za-z0-9._/-]*)$/
const GITHUB_TAG_PATTERN = /^[A-Za-z0-9_][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/
const GITHUB_LINES_PATTERN = /^#L([1-9][0-9]*)(?:-L([1-9][0-9]*))?$/

/** The first segments of a path of GitHub that are its own pages, not an owner. */
const GITHUB_PAGES = new Set(
  [
    'about account apps blog codespaces collections contact copilot customer-stories dashboard education enterprise',
    'enterprises events explore features git-guides home issues join login logout marketplace mobile models new',
    'notifications orgs organizations partners premium-support pricing pulls readme resources search security',
    'settings signup site solutions sponsors stars team topics trending users watching',
  ]
    .join(' ')
    .split(' '),
)

/** The threads of a repository of GitHub, by the segment of their path. */
const GITHUB_THREADS = new Set(['issues', 'pull', 'discussions'])

/** The anchors GitHub gives a comment or a review in an issue, a pull request or a discussion. */
const GITHUB_THREAD_ANCHORS: Record<string, [RegExp, string][]> = {
  issues: [[/^#issuecomment-[1-9][0-9]*$/, 'comment']],
  pull: [
    [/^#(?:issuecomment-|discussion_r)[1-9][0-9]*$/, 'comment'],
    [/^#pullrequestreview-[1-9][0-9]*$/, 'review'],
  ],
  discussions: [[/^#discussioncomment-[1-9][0-9]*$/, 'comment']],
}

/** Unlike GitHub, GitLab and Codeberg allow dots and underscores in owners. A GitLab subgroup's project stays a URL. */
const OWNER = '[A-Za-z0-9][A-Za-z0-9._-]{0,99}'

/** A forge other than GitHub: its repositories, and their items by the lowercased segments of their path, with the mark written before their number. */
type Forge = { pattern: RegExp; marks: Record<string, string>; pages: Set<string> }

function forge(host: string, marks: Record<string, string>, pages: string): Forge {
  return {
    pattern: new RegExp(
      `^https?://(?:www\\.)?${host}/(${OWNER})/([A-Za-z0-9._-]{1,100})(?:/(${Object.keys(marks).join('|')})/([1-9][0-9]{0,9}))?$`,
      'i',
    ),
    marks,
    pages: new Set(pages.split(' ')),
  }
}

const FORGES = [
  forge(
    'gitlab\\.com',
    { '-/issues': '#', '-/merge_requests': '!' },
    'admin dashboard explore groups help projects search users',
  ),
  forge(
    'codeberg\\.org',
    { issues: '#', pulls: '#' },
    'admin api assets explore issues milestones notifications org pulls repo user',
  ),
]

/** A commit as GitHub shortens it; any other ref as it is. */
function shortRef(ref: string): string {
  return GITHUB_SHA_PATTERN.test(ref) ? ref.slice(0, 7) : ref
}

/** An issue, a pull request or a discussion, or one of their comments or reviews: "#42", or "#42 (comment)". */
function gitHubThread(kind: string, rest: readonly string[], hash: string): string | null {
  const [number] = rest

  if (rest.length !== 1 || number === undefined || !GITHUB_NUMBER_PATTERN.test(number)) {
    return null
  }

  if (hash === '') {
    return `#${number}`
  }

  const anchor = GITHUB_THREAD_ANCHORS[kind]?.find(([pattern]) => pattern.test(hash))?.[1]

  return anchor === undefined ? null : `#${number} (${anchor})`
}

/** A file, maybe some of its lines, or a folder, by its last name only: "a.php", "a.php:10-20" or "Services/". */
function gitHubFile(kind: 'blob' | 'tree', path: readonly string[], hash: string): string | null {
  let names: string[]

  try {
    names = path.map(segment => decodeURIComponent(segment))
  } catch {
    return null
  }

  const name = names.at(-1) ?? ''

  if (kind === 'tree') {
    return hash === '' ? `:${name}/` : null
  }

  if (hash === '') {
    return `:${name}`
  }

  const lines = GITHUB_LINES_PATTERN.exec(hash)

  if (lines === null) {
    return null
  }

  const [, first, last = first] = lines

  return last === first ? `:${name}:${first}` : `:${name}:${first}-${last}`
}

/** What a link points at in a repository of GitHub, as GitHub writes it after the repository's name. */
function gitHubItem(path: readonly string[], hash: string): string | null {
  const [first = '', ...rest] = path
  const kind = first.toLowerCase()

  if (GITHUB_THREADS.has(kind)) {
    return gitHubThread(kind, rest, hash)
  }

  if ((kind === 'blob' || kind === 'tree') && rest.length >= 2 && rest.every(segment => segment !== '')) {
    return gitHubFile(kind, rest.slice(1), hash)
  }

  if (hash !== '') {
    return null
  }

  const [ref = ''] = rest

  if (kind === 'commit' && rest.length === 1 && GITHUB_SHA_PATTERN.test(ref)) {
    return `@${shortRef(ref)}`
  }

  const tag = rest.slice(1).join('/')

  if (kind === 'releases' && ref === 'tag' && GITHUB_TAG_PATTERN.test(tag)) {
    return `@${tag}`
  }

  const comparison = kind === 'compare' ? GITHUB_COMPARISON_PATTERN.exec(rest.join('/')) : null

  if (comparison !== null && !(comparison[3] ?? '').includes('..')) {
    return `@${shortRef(comparison[1] ?? '')}${comparison[2]}${shortRef(comparison[3] ?? '')}`
  }

  return null
}

/** A link to GitHub as GitHub writes it, or null when it is none GitHub writes in short. */
function gitHubLabel(href: string): string | null {
  let url: URL

  try {
    url = new URL(href)
  } catch {
    return null
  }

  if (
    !GITHUB_HOST_PATTERN.test(url.hostname) ||
    url.username !== '' ||
    url.password !== '' ||
    url.port !== '' ||
    url.search !== ''
  ) {
    return null
  }

  const segments = url.pathname.slice(1).split('/')
  const [owner = '', repository, ...path] =
    segments.length === 2 && segments[0]?.toLowerCase() === 'orgs' ? segments.slice(1) : segments

  if (!GITHUB_OWNER_PATTERN.test(owner) || GITHUB_PAGES.has(owner.toLowerCase())) {
    return null
  }

  if (repository === undefined) {
    return url.hash === '' ? owner : null
  }

  if (!GITHUB_REPOSITORY_PATTERN.test(repository)) {
    return null
  }

  if (path.length === 0) {
    return url.hash === '' ? `${owner}/${repository}` : null
  }

  const item = gitHubItem(path, url.hash)

  return item === null ? null : `${owner}/${repository}${item}`
}

/**
 * A link to a profile, a repository, or what is in it, on GitHub, GitLab or Codeberg, as its forge writes it
 * ("owner/repo#42", "owner/repo!4", "owner/repo@4fa008f"…), or null when it is none of them.
 */
export function forgeLabel(href: string): string | null {
  const gitHub = gitHubLabel(href)

  if (gitHub !== null) {
    return gitHub
  }

  for (const { pattern, marks, pages } of FORGES) {
    const match = pattern.exec(href)
    const [, owner = '', repository = '', kind, number] = match ?? []

    if (match !== null && !pages.has(owner.toLowerCase())) {
      const mark = kind === undefined ? undefined : marks[kind.toLowerCase()]

      return `${owner}/${repository}${mark === undefined ? '' : `${mark}${number}`}`
    }
  }

  return null
}
