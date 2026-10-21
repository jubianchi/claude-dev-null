export type LogLinkPreview = { url: string; title: string | null; description: string | null; site: string | null }

export type LogImage = { url: string; width: number; height: number; description: string | null }

/** The logs of /dev/null: the commits of the people followed, everyone's latest, and the trending ones. */
export type LogName = 'following' | 'latest' | 'trending'

/** What a log of the web app shows: its commits in its order, their replies, where it goes on, and what went wrong. */
export type WebLog = { commits: LogEntry[]; replies: LogEntry[]; next: string | null; error: string }

/** What a log is loading: nothing, its first page again, or its next one. */
export type LogLoading = '' | 'refresh' | 'more'

/** A load of a log under way: what it loads, and since when. */
export type WebLogLoad = { kind: 'refresh' | 'more'; since: number }

/** The lane a developer picked on /dev/null: one of its six, by index, or a color of their own. */
export type LogLane = number | string

export type LogAuthor = { username: string; name: string; lane?: LogLane | null }

export type LogEntry = {
  id: string
  shortHash: string
  body: string
  parentId: string | null
  url: string
  createdAt: string
  stars: number
  replies: number
  /** Who wrote it; null once it is deleted, when /dev/null keeps only its place in its thread. */
  author: LogAuthor | null
  /** When it was deleted, null while it is not. */
  deletedAt: string | null
  /** The ids of the developers it mentions, by their username in small letters: /dev/null links those only. */
  mentions: Record<string, string>
  linkPreview: LogLinkPreview | null
  images: LogImage[]
  /** What `body` says, as /dev/null splits it: text, code, and blocks of code. */
  segments: LogSegment[]
  /** The start of a long commit, which /dev/null shows of it in a log, split the same; null when it shows it whole. */
  preview: LogSegment[] | null
  /** The commit it quotes, whose own quote is left out. */
  quote: LogEntry | null
  /** The id of the commit it quotes, even when it comes without it: /dev/null shows a quote among its replies. */
  quotedId: string | null
  /**
   * The id of the first reply its author continues it with, which /dev/null leaves out of its replies, and links to
   * the thread of instead.
   */
  continuationId: string | null
  poll: LogPoll | null
}

/**
 * A poll, as /dev/null shows it to whoever reads it: its options, and their votes once shown (after voting, or once
 * it closes), null until then; `closesAt` is null until the commit is approved.
 */
export type LogPoll = {
  closesAt: string | null
  isClosed: boolean
  hasVoted: boolean
  totalVotes: number | null
  options: { label: string; votes: number | null; isVoted: boolean }[]
}

/** A part of a commit's words: text, code within the text, or a block of code in `language`. */
export type LogSegment =
  | { type: 'text'; text: string }
  | { type: 'code'; code: string }
  | { type: 'block'; language: string | null; code: string }

declare module 'claude-code' {
  interface PluginState {
    'dev-null': {
      isOpen: boolean
      isLogOpen: boolean
      logTab: '' | 'following' | 'latest' | 'trending' | 'account'
      cookieDraft: string
      accountError: string
      isAccountLoaded: boolean
      username: string
      webLogs: { following?: WebLog; latest?: WebLog; trending?: WebLog }
      loadingLogs: { following?: WebLogLoad; latest?: WebLogLoad; trending?: WebLogLoad }
      listOffset: number
      autoRefresh: '' | 'on' | 'off'
      /** The time of the last tick of the countdown to the next refresh, for the pane to draw it again. */
      refreshTick: number
      /** The time of the last frame of the spinner turning while a log loads, for the pane to draw it again. */
      spinnerTick: number
      mode: '' | 'always' | 'manual'
      message: string
      reply: string
      /** The path typed in the composer's image field, not added yet. */
      image: string
      /** The paths of the images the commit carries, as typed. */
      images: string[]
      /** Whether a commit is being sent, for the composer to say so in place of Commit. */
      isSending: boolean
    }
  }
}
