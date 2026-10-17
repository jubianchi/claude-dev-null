import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { check, MAX_LENGTH, thousands } from './draft'

const COMMAND = 'dev-null:compose'
const USAGE = `Usage: /${COMMAND} [always|manual]`

type Mode = 'always' | 'manual'

const isOpen = atom({ plugin: 'dev-null', key: 'isOpen' } as const, false)
const mode = atom({ plugin: 'dev-null', key: 'mode' } as const, '')
const message = atom({ plugin: 'dev-null', key: 'message' } as const, '')
const reply = atom({ plugin: 'dev-null', key: 'reply' } as const, '')

async function currentMode($: EngineInterface): Promise<Mode> {
  const value = (await read($, mode)) || (await $.store.get('mode'))

  return value === 'always' ? 'always' : 'manual'
}

async function setMode($: EngineInterface, value: Mode): Promise<void> {
  await $.store.set('mode', value)
  await update($, mode, () => value)
}

async function clear($: EngineInterface): Promise<void> {
  await update($, message, () => '')
  await update($, reply, () => '')
}

async function close($: EngineInterface): Promise<void> {
  await clear($)

  if ((await currentMode($)) === 'manual') {
    await update($, isOpen, () => false)
  }
}

const TOAST = { timeoutMs: 10_000 }

async function send($: EngineInterface): Promise<void> {
  const text = await read($, message)
  const target = await read($, reply)

  if (check(text, target).error !== undefined) {
    return
  }

  const argv = [`${$.plugin.root}/skills/commit/commit.sh`, ...(target === '' ? [] : ['--reply', target])]

  let result
  try {
    result = await $.process.run(argv, { stdin: text, timeoutMs: 60_000 })
  } catch (error) {
    $.ui.toast(`devnull: could not run the commit script (${error instanceof Error ? error.message : String(error)}).`, TOAST)

    return
  }

  if (result.exitCode !== 0) {
    $.ui.toast(result.stderr.trim() || `devnull: the commit failed (exit code ${result.exitCode}).`, TOAST)

    return
  }

  $.ui.toast(result.stdout.trim(), TOAST)
  await close($)
}

export const register: Register = on => {
  on('command.run', { command: COMMAND }, async ($, e) => {
    switch (e.args.trim()) {
      case '':
        await update($, isOpen, () => true)

        return { text: 'Composer open.' }
      case 'always':
        await setMode($, 'always')

        return { text: 'Composer always shown.' }
      case 'manual':
        await setMode($, 'manual')
        await update($, isOpen, () => false)

        return { text: `Composer shown on demand, with /${COMMAND}.` }
      default:
        return { text: USAGE }
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      return next(e)
    }

    const isAlways = (await currentMode($)) === 'always'

    if (e.props.hasSurvey || !(isAlways || (await read($, isOpen)))) {
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
          onSubmit={async value => {
            await update($, message, () => value)
            await send($)
          }}
          submitLabel="commit"
        />
        <Box justifyContent="space-between">
          <Input
            key="reply"
            label="Reply to "
            value={draft.reply}
            placeholder="commit hash or link (optional)"
            onInput={value => update($, reply, () => value)}
            onSubmit={async value => {
              await update($, reply, () => value)
              await send($)
            }}
            submitLabel="commit"
          />
          <Box>
              {error === undefined && (
                  <Button key="commit" label="Commit" variant="primary" onPress={() => send($)} />
              )}
              <Button key="cancel" label={isAlways ? 'Clear' : 'Cancel'} variant="secondary" onPress={() => close($)} />
          </Box>
        </Box>
      </Box>
    )
  })
}
