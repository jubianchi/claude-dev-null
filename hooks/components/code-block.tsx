import type { Elements } from 'claude-code'

export type CodeBlockProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Code' | 'Text'>
  /** The element's address. */
  id: string
  language: string | null
  code: string
}

/** A block of code, in a frame under the name of its language, highlighted in it. */
export default function CodeBlock(props: CodeBlockProps) {
  const { ui, id, language, code } = props
  const { Box, Code, Text } = ui

  return (
    <Box key={id} flexDirection="column" borderStyle="round" paddingX={1}>
      {language !== null && <Text dimColor>{language}</Text>}
      <Code source={code} wrap="wrap" {...(language === null ? {} : { language })} />
    </Box>
  )
}
