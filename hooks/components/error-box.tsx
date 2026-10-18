import type { Elements } from 'claude-code'

export type ErrorBoxProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Text'>
  id: string
  messages: readonly string[]
}

/** Errors to show: each of its messages, in a box framed in the error color. */
export default function ErrorBox(props: ErrorBoxProps) {
  const { ui, id, messages } = props
  const { Box, Text } = ui

  return (
    <Box key={id} flexDirection="column" borderStyle="round" borderColor="error" paddingY={1} paddingX={2} gap={1}>
      {messages.map((message, index) => (
        <Text key={`${id}-${index}`} color="error">
          {message}
        </Text>
      ))}
    </Box>
  )
}
