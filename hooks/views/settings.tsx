import type { EngineInterface } from 'claude-code'

import ComposerMode from '../components/composer-mode'
import DeviceSignIn from '../components/device-sign-in'
import {
  approveWithLink,
  cancelDeviceSignIn,
  deviceSignedInAs,
  deviceSignInForm,
  forgetDeviceUser,
  signInDevice,
  typeApprovalLink,
} from '../state/device'
import { currentMode, setMode } from '../state/mode'
import { forgetWebLog } from '../state/web-logs'
import type { View } from './view'

/** Forgets whoever approved the device, and the logs read as them: Following and Starred. */
async function forgetAndRead($: EngineInterface): Promise<void> {
  await forgetDeviceUser($)
  await forgetWebLog($, 'following')
  await forgetWebLog($, 'starred')
}

/** The settings of the plugin: the device signed in, or signing in, and where the composer shows. */
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
          <ComposerMode ui={ui} mode={await currentMode($)} onMode={value => setMode($, value)} />
        </Box>
      )
    },
  }
}
