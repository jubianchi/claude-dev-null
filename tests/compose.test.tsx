import { describe, expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On, RenderSurface } from 'claude-code'

const PLUGIN = 'dev-null'
const COMMAND = 'dev-null:compose'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { bodyRows: 19, offset: 0 },
    view: {},
  },
} as const

const ENGINE_BAND = 'engine-band'

function engineDrawsNothing(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Text', props: {}, children: [ENGINE_BAND] }))
}

async function compose($: Engine, args = ''): Promise<void> {
  await $.command.run({
    command: COMMAND,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })
}

async function mount($: Engine, surface: RenderSurface) {
  return $.ui.mount({ plugin: PLUGIN, surface, ...BAND })
}

describe('compose', () => {
  test('the band is closed until the person runs the command', async ($, on) => {
    engineDrawsNothing(on)
    const ui = await mount($, 'terminal')

    expect(await ui.find({ key: 'message' })).toBeUndefined()
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`the command opens the band on ${surface}`, async ($, on) => {
      engineDrawsNothing(on)
      await compose($)
      const ui = await mount($, surface)

      expect(await ui.find({ type: 'Input', key: 'message' })).toBeDefined()
      expect(await ui.find({ type: 'Input', key: 'reply' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'cancel' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'commit' })).toBeDefined()
    })

    test(`cancel closes the band on ${surface}`, async ($, on) => {
      engineDrawsNothing(on)
      await compose($)
      const ui = await mount($, surface)
      await ui.press({ key: 'cancel' })

      expect(await ui.find({ key: 'message' })).toBeUndefined()
    })
  }

  for (const surface of ['vscode', 'mobile'] as const) {
    test(`the band is not drawn on ${surface}`, async ($, on) => {
      engineDrawsNothing(on)
      await compose($)
      const ui = await mount($, surface)

      expect(await ui.find({ key: 'message' })).toBeUndefined()
    })
  }

  test('the band yields to a survey', async ($, on) => {
    engineDrawsNothing(on)
    await compose($)
    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface: 'terminal',
      component: 'AbovePrompt',
      props: { ...BAND.props, hasSurvey: true },
    })

    expect(await ui.find({ key: 'message' })).toBeUndefined()
  })
})
