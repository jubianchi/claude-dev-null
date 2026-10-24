import type { EngineInterface } from 'claude-code'

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
import { forgetWebLog } from '../state/web-logs'
import type { View } from './view'

/** Forgets whoever approved the device, and the Following log read as them. */
async function forgetAndRead($: EngineInterface): Promise<void> {
  await forgetDeviceUser($)
  await forgetWebLog($, 'following')
}

/** The view signing the device in, or saying who approved it. */
export function accountView($: EngineInterface): View {
  return {
    id: 'account',
    label: 'Account',
    placement: 'tab',
    isAvailable: async () => true,
    async render(_route, { ui }) {
      const { Box } = ui

      return (
        <Box flexDirection="column">
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
        </Box>
      )
    },
  }
}
