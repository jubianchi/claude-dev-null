import type { Elements } from 'claude-code'

export type NewCommitsProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Text'>
  /** How many commits arrived above the log, not seen yet. */
  count: number
  onPress: () => Promise<unknown>
}

/** The blue of the badge of the web app, which the white of its words stands out on. */
export const BADGE = '#2563eb'

/**
 * The commits that arrived above the log, in a badge drawn over its top, centered, as the web app draws it: it takes
 * no row of the log.
 */
export default function NewCommits(props: NewCommitsProps) {
  const { ui, count, onPress } = props
  const { Box, Button, Text } = ui

  return (
    <Box key="new-commits-badge" position="absolute" top={0} left={0} right={0} justifyContent="center">
      <Box key="new-commits-pill" backgroundColor={BADGE}>
        <Button key="new-commits" plain onPress={onPress}>
          <Text color="#ffffff" weight="bold">
            {` ↑ ${count} new commit${count === 1 ? '' : 's'} `}
          </Text>
        </Button>
      </Box>
    </Box>
  )
}
