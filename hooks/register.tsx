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
        <Text bold>/dev/null · commit</Text>
        <Input key="message" label="Message " rows={3} autoFocus onSubmit={() => {}} />
        <Input key="reply" label="Reply to " placeholder="commit hash or link (optional)" onSubmit={() => {}} />
        <Box justifyContent="flex-end">
          <Text dimColor>Sent as typed. </Text>
          <Button key="cancel" label="Cancel" onPress={() => update($, isOpen, () => false)} />
          <Button key="commit" label="Commit" variant="primary" onPress={() => {}} />
        </Box>
      </Box>
    )
  })
}
