import type { Elements } from 'claude-code'

import type { LogEntry } from '../../types'
import type { Brand } from '../brand'
import { laneColor } from '../log'
import Author from './author'
import Body from './body'
import Images from './images'
import LinkCard from './link-card'
import type { PollActions } from './poll'
import Poll from './poll'

export type QuoteProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Code' | 'Link' | 'Markdown' | 'Text'>
  /** The colors of /dev/null in the theme of Claude Code. */
  brand: Brand
  /** The commit that quotes. */
  id: string
  quote: LogEntry
  now: number
  polls: PollActions
}

/** The commit a commit quotes, in a card: who wrote it, in their lane, when, a link to it, and its words. */
export default function Quote(props: QuoteProps) {
  const { ui, brand, id, quote, now, polls } = props
  const { Box, Link } = ui

  return (
    <Box key={`quote-${id}`} flexDirection="column" borderStyle="round" paddingX={1}>
      <Box justifyContent="space-between">
        <Author ui={ui} brand={brand} author={quote.author} createdAt={quote.createdAt} now={now} />
        {quote.deletedAt === null && <Link href={quote.url} label={quote.shortHash} />}
      </Box>
      <Body
        ui={ui}
        brand={brand}
        id={`quote-${quote.id}`}
        segments={quote.preview ?? quote.segments}
        mentions={{}}
        isStatic
      />
      <Images ui={ui} id={`quote-${quote.id}`} images={quote.images} />
      {quote.poll !== null && (
        <Poll
          ui={ui}
          id={`quote-${quote.id}`}
          poll={quote.poll}
          url={quote.url}
          color={laneColor(quote.author, brand.lanes)}
          now={now}
          isOwn={false}
          isStatic
          polls={polls}
        />
      )}
      {quote.linkPreview !== null && <LinkCard ui={ui} id={`quote-${quote.id}`} preview={quote.linkPreview} />}
    </Box>
  )
}
