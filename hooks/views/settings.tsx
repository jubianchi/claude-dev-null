import type { EngineInterface } from 'claude-code'

import Choice from '../components/choice'
import DeviceSignIn from '../components/device-sign-in'
import { isAutoRefresh, setAutoRefresh } from '../state/auto-refresh'
import {
  approveWithLink,
  cancelDeviceSignIn,
  deviceSignedInAs,
  deviceSignInForm,
  forgetDeviceUser,
  signInDevice,
  typeApprovalLink,
} from '../state/device'
import type { Mode } from '../state/mode'
import { currentMode, setMode } from '../state/mode'
import { perPage, REPLIES_PER_PAGE, setPerPage } from '../state/replies'
import { forgetWebLog } from '../state/web-logs'
import type { View } from './view'

/** Forgets whoever approved the device, and the logs read as them: Following and Starred. */
async function forgetAndRead($: EngineInterface): Promise<void> {
  await forgetDeviceUser($)
  await forgetWebLog($, 'following')
  await forgetWebLog($, 'starred')
}

const MODES: readonly (readonly [Mode, string])[] = [
  ['always', 'Always'],
  ['manual', 'On demand, with /dev-null:compose'],
]

const AUTO: readonly (readonly ['on' | 'off', string])[] = [
  ['on', 'Every minute'],
  ['off', 'Never'],
]

/**
 * The settings of the plugin: the device signed in, or signing in, whether the log refreshes on its own, and where the
 * composer shows.
 */
export function settingsView($: EngineInterface): View {
  return {
    id: 'settings',
    label: '⚙',
    placement: 'toolbar',
    isAvailable: async () => true,
    async render(_route, { ui }) {
      const { Box, Text } = ui

      return (
        <Box flexDirection="column">
          <Box key="settings-account" paddingX={1} marginTop={1}>
            <Text weight="bold">Account</Text>
          </Box>
          <DeviceSignIn
            ui={ui}
            username={await deviceSignedInAs($)}
            {...(await deviceSignInForm($))}
            onStart={() => signInDevice($)}
            onCancel={() => cancelDeviceSignIn($)}
            onForget={() => forgetAndRead($)}
            onDraft={value => typeApprovalLink($, value)}
            onApprove={value => approveWithLink($, value)}
          />
          <Choice
            ui={ui}
            id="auto"
            title="Log"
            question="Refreshed on its own, while shown:"
            options={AUTO}
            chosen={(await isAutoRefresh($)) ? 'on' : 'off'}
            onChoose={value => setAutoRefresh($, value === 'on')}
          />
          <Choice
            ui={ui}
            id="replies"
            title="Replies"
            question="How many replies show under a commit, and each reply, before Show more:"
            options={REPLIES_PER_PAGE.map(count => [String(count), String(count)] as const)}
            chosen={String(await perPage($))}
            onChoose={value => setPerPage($, Number(value))}
          />
          <Choice
            ui={ui}
            id="mode"
            title="Composer"
            question="Shown above the prompt:"
            options={MODES}
            chosen={await currentMode($)}
            onChoose={value => setMode($, value)}
          />
        </Box>
      )
    },
  }
}
