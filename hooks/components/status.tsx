import type { Elements } from 'claude-code'

import type { LogEntry } from '../../types'

export type StatusProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Text'>
  id: string
  status: LogEntry['status']
}

/** The amber the site says a commit in review in. */
export const REVIEW = '#d97706'
/** The red the site says a commit rejected in. */
export const REJECTED = 'error'

/**
 * Whether /dev/null still reviews a commit of its author, or rejected it, as the site says it; nothing once approved,
 * or when /dev/null does not say.
 */
export default function Status(props: StatusProps) {
  const { ui, id, status } = props
  const { Box, Text } = ui

  if (status !== 'pending' && status !== 'rejected') {
    return null
  }

  return (
    <Box key={`status-${id}`}>
      <Text color={status === 'pending' ? REVIEW : REJECTED}>{status === 'pending' ? 'in review' : 'rejected'}</Text>
    </Box>
  )
}
