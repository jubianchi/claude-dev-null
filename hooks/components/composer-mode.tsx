import type { Elements } from 'claude-code'

import type { Mode } from '../state/mode'

export type ComposerModeProps = {
  ui: Pick<Elements['terminal'] | Elements['desktop'], 'Box' | 'Button' | 'Text'>
  mode: Mode
  onMode: (mode: Mode) => Promise<unknown>
}

const CHOICES: readonly [Mode, string][] = [
  ['always', 'Always'],
  ['manual', 'On demand, with /dev-null:compose'],
]

/** Whether the composer shows above the prompt always, or on demand, the one chosen standing out. */
export default function ComposerMode(props: ComposerModeProps) {
  const { ui, mode, onMode } = props
  const { Box, Button, Text } = ui

  return (
    <Box key="composer-mode" flexDirection="column" paddingX={1} marginTop={1}>
      <Text weight="bold">Composer</Text>
      <Text>Shown above the prompt:</Text>
      <Box gap={2}>
        {CHOICES.map(([value, label]) => (
          <Button key={`mode-${value}`} onPress={() => onMode(value)}>
            {mode === value ? (
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
