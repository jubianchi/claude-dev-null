import type { Elements } from 'claude-code'

import type { LogEntry } from '../../types'
import type { Brand } from '../brand'
import { ago, laneColor } from '../log'
import { profileUrl } from '../profile'

export type AuthorProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Link' | 'Text'>
  /** The colors of /dev/null in the theme of Claude Code: the lane of the author in them. */
  brand: Brand
  author: LogEntry['author']
  /** When the commit was made. */
  createdAt: string
  now: number
}

/**
 * Who made a commit, in their lane, their username linking to their profile on /dev/null, and when; that it was
 * deleted, as /dev/null says, once it has no author.
 */
export default function Author(props: AuthorProps) {
  const { ui, brand, author, createdAt, now } = props
  const { Box, Link, Text } = ui

  if (author === null) {
    return (
      <Box>
        <Text color={laneColor(author, brand.lanes)}>● </Text>
        <Text dimColor>[deleted] This commit was deleted.</Text>
      </Box>
    )
  }

  return (
    <Box>
      <Text color={laneColor(author, brand.lanes)}>● </Text>
      <Text weight="bold">{author.name}</Text>
      <Text> </Text>
      <Link href={profileUrl(author.username)} label={`@${author.username}`} />
      <Text dimColor>
        {' · '}
        {ago(now, createdAt)}
      </Text>
    </Box>
  )
}
