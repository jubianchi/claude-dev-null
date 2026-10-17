import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { check, MAX_LENGTH, thousands } from './draft'

const COMMAND = 'dev-null:compose'

const isOpen = atom({ plugin: 'dev-null', key: 'isOpen' } as const, false)
const message = atom({ plugin: 'dev-null', key: 'message' } as const, '')
const reply = atom({ plugin: 'dev-null', key: 'reply' } as const, '')

async function close($: EngineInterface): Promise<void> {
  await update($, message, () => '')
  await update($, reply, () => '')
  await update($, isOpen, () => false)
}

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
    const draft = { message: await read($, message), reply: await read($, reply) }
    const { length, error } = check(draft.message, draft.reply)

    return (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Box justifyContent="space-between" marginBottom={1}>
          <Box flexDirection="row" gap={1}>
            <Box>
                <Text weight="bold">/</Text>
                <Text weight="bold" color="#d9480f">/</Text>
            </Box>
            <Box>
               <Text weight="bold">/dev</Text>
               <Text weight="bold" color="#d9480f">/</Text>
               <Text weight="bold">null</Text>
               <Text color="inactive"> • a social network for devs</Text>
            </Box>
          </Box>
          <Box key="count">
              {error !== undefined ? (
                  <Box key="error">
                      <Text color="red">{error}</Text>
                  </Box>
              ) : (
                  <Text dimColor={length <= MAX_LENGTH}>
                      {thousands(length)} / {thousands(MAX_LENGTH)}
                  </Text>
              )}
          </Box>
        </Box>
        <Input
          key="message"
          rows={4}
          autoFocus
          value={draft.message}
          placeholder="What did you ship?"
          onInput={value => update($, message, () => value)}
          onSubmit={() => {}}
        />
        <Box justifyContent="space-between">
          <Input
            key="reply"
            label="Reply to "
            value={draft.reply}
            placeholder="commit hash or link (optional)"
            onInput={value => update($, reply, () => value)}
            onSubmit={() => {}}
          />
          <Box>
              {error === undefined && (
                  <Button key="commit" label="Commit" variant="primary" onPress={() => {}} />
              )}
              <Button key="cancel" label="Cancel" variant="secondary" onPress={() => close($)} />
          </Box>
        </Box>
      </Box>
    )
  })
}
