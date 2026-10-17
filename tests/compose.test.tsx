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

async function mount<S extends RenderSurface>($: Engine, surface: S) {
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

describe('compose validation', () => {
  async function opened($: Engine, on: On, surface: 'terminal' | 'desktop' = 'terminal') {
    engineDrawsNothing(on)
    await compose($)

    return mount($, surface)
  }

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`the counter follows the message on ${surface}`, async ($, on) => {
      const ui = await opened($, on, surface)
      await ui.input({ key: 'message', text: 'It was DNS.', kind: 'change' })
      expect((await ui.find({ key: 'count' }))?.text).toBe('11 / 4,000')

      await ui.input({ key: 'message', text: 'It was always DNS.', kind: 'change' })

      expect((await ui.find({ key: 'count' }))?.text).toBe('18 / 4,000')
    })
  }

  test('the counter counts characters, not code units', async ($, on) => {
    const ui = await opened($, on)
    await ui.input({ key: 'message', text: 'été 😁', kind: 'change' })

    expect((await ui.find({ key: 'count' }))?.text).toBe('5 / 4,000')
  })

  test('the message is kept when the band is drawn again', async ($, on) => {
    const ui = await opened($, on)
    await ui.input({ key: 'message', text: 'It was DNS.', kind: 'change' })
    await ui.redraw()

    expect((await ui.find({ key: 'message' }))?.props.value).toBe('It was DNS.')
  })

  test('a valid commit can be sent', async ($, on) => {
    const ui = await opened($, on)
    await ui.input({ key: 'message', text: 'It was DNS.', kind: 'change' })
    await ui.input({ key: 'reply', text: '0be0130', kind: 'change' })

    expect(await ui.find({ key: 'error' })).toBeUndefined()
    expect(await ui.find({ type: 'Button', key: 'commit' })).toBeDefined()
  })

  const invalid = [
    { name: 'an empty message', message: '', reply: '', error: 'At least 3 characters.' },
    { name: 'a too short message', message: 'ok', reply: '', error: 'At least 3 characters.' },
    {
      name: 'a too long message',
      message: 'é'.repeat(4001),
      reply: '',
      error: 'Too long by 1 character: shorten it yourself.',
    },
    {
      name: 'a much too long message',
      message: 'é'.repeat(4012),
      reply: '',
      error: 'Too long by 12 characters: shorten it yourself.',
    },
    {
      name: 'an invalid reply',
      message: 'It was DNS.',
      reply: 'not a hash!',
      error: 'Reply to a commit hash (0be0130) or its link.',
    },
  ]

  for (const { name, message, reply, error } of invalid) {
    test(`${name} cannot be sent`, async ($, on) => {
      const ui = await opened($, on)
      await ui.input({ key: 'message', text: message, kind: 'change' })
      await ui.input({ key: 'reply', text: reply, kind: 'change' })

      expect((await ui.find({ key: 'error' }))?.text).toBe(error)
      expect(await ui.find({ key: 'commit' })).toBeUndefined()
    })
  }

  test('a reply can be a link to a commit', async ($, on) => {
    const ui = await opened($, on)
    await ui.input({ key: 'message', text: 'Agreed!', kind: 'change' })
    await ui.input({
      key: 'reply',
      text: 'https://dev-null.sh/@brendt/commits/01a1484c-8af2-720d-8738-468061385475',
      kind: 'change',
    })

    expect(await ui.find({ key: 'error' })).toBeUndefined()
  })

  test('cancel clears the draft', async ($, on) => {
    const ui = await opened($, on)
    await ui.input({ key: 'message', text: 'It was DNS.', kind: 'change' })
    await ui.press({ key: 'cancel' })
    await compose($)
    await ui.redraw()

    expect((await ui.find({ key: 'message' }))?.props.value).toBe('')
  })
})
