import type { Elements } from 'claude-code'

export type ChoiceProps<T extends string> = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Text'>
  /** The key of the choice, and the prefix of the keys of its options. */
  id: string
  title: string
  question: string
  /** Each option, by its value, with its label. */
  options: readonly (readonly [T, string])[]
  chosen: T
  onChoose: (value: T) => Promise<unknown>
}

/** A setting: its title, its question, and its options, the one chosen standing out. */
export default function Choice<T extends string>(props: ChoiceProps<T>) {
  const { ui, id, title, question, options, chosen, onChoose } = props
  const { Box, Button, Text } = ui

  return (
    <Box key={id} flexDirection="column" paddingX={1} marginTop={1}>
      <Text weight="bold">{title}</Text>
      <Text>{question}</Text>
      <Box gap={2}>
        {options.map(([value, label]) => (
          <Button key={`${id}-${value}`} onPress={() => onChoose(value)}>
            {chosen === value ? (
              <Text weight="bold" underline>
                {label}
              </Text>
            ) : (
              <Text dimColor>{label}</Text>
            )}
          </Button>
        ))}
      </Box>
    </Box>
  )
}
