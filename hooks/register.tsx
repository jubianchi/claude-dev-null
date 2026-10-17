import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

const COMMAND = 'dev-null:compose'

const isOpen = atom({ plugin: 'dev-null', key: 'isOpen' } as const, false)

export const register: Register = on => {
  on('command.run', { command: COMMAND }, async $ => {
    await update($, isOpen, () => true)

    return { text: 'Composer open.' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }

    if (e.props.hasSurvey || !(await read($, isOpen))) {
      return next(e)
    }

    const { Box, Button, Input, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Box flexDirection="row" gap={1} marginBottom={1}>
          <Box>
              <Text weight="bold">/</Text>
              <Text weight="bold" color="#d9480f">/</Text>
          </Box>
          <Box>
             <Text weight="bold">/dev</Text>
             <Text weight="bold" color="#d9480f">/</Text>
             <Text weight="bold">null</Text>
          </Box>
        </Box>
        <Input key="message" rows={4} autoFocus onSubmit={() => {}} placeholder="What did you ship?" />
        <Box justifyContent="space-between">
          <Input key="reply" label="Reply to " placeholder="commit hash or link (optional)" onSubmit={() => {}} />
          <Box>
            <Button key="cancel" label="Cancel" variant="secondary" onPress={() => update($, isOpen, () => false)} />
            <Button key="commit" label="Commit" variant="primary" onPress={() => {}} />
          </Box>
        </Box>
      </Box>
    )
  })
}
