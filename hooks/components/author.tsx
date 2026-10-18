import type { Elements } from 'claude-code'

import type { LogEntry } from '../../types'
import { ago, laneColor } from '../log'
import { profileUrl } from '../profile'

export type AuthorProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Link' | 'Text'>
  author: LogEntry['author']
  /** When the commit was made. */
  createdAt: string
  now: number
}

/** Who made a commit, in their lane, their username linking to their profile on /dev/null, and when. */
export default function Author(props: AuthorProps) {
  const { ui, author, createdAt, now } = props
  const { Box, Link, Text } = ui

  return (
    <Box>
      <Text color={laneColor(author)}>● </Text>
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
