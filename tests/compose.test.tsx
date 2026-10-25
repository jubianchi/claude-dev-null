import type { On, ProcessRunResult, RenderSurface } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import { describe, expect, test } from 'claude-code/testing'

import { composerRows } from '../hooks/components/composer'
import { BAND, engineDrawsNothing, fakeCommitScript, held, PLUGIN, run } from './support'

async function compose($: Engine, args = ''): Promise<string | undefined> {
  return run($, 'dev-null:compose', args)
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

  test('the counter counts a link as 23 characters at most, as /dev/null does', async ($, on) => {
    const ui = await opened($, on)
    await ui.input({ key: 'message', text: `See https://example.com/${'a'.repeat(100)}`, kind: 'change' })

    expect((await ui.find({ key: 'count' }))?.text).toBe('27 / 4,000')
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

  for (const [name, message] of [
    ['an empty message', ''],
    ['a message of blanks', ' \n\t '],
  ]) {
    test(`${name} cannot be sent, the count saying so with no error`, async ($, on) => {
      const ui = await opened($, on)
      await ui.input({ key: 'message', text: message ?? '', kind: 'change' })

      expect(await ui.find({ key: 'error' })).toBeUndefined()
      expect((await ui.find({ key: 'count' }))?.text).toBe('0 / 4,000')
      expect(await ui.find({ key: 'commit' })).toBeUndefined()
    })
  }

  const invalid = [
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

describe('compose commit', () => {
  const COMMITTED =
    'Committed: https://dev-null.sh/@me/commits/1 (pending review, only you can see it until it is approved)'
  const NO_KEY = 'devnull: None of your SSH keys are on the GitHub account of a /dev/null user.'

  function commitScript(on: On, result: Partial<ProcessRunResult> | { deny: string }) {
    engineDrawsNothing(on)

    return fakeCommitScript(on, result)
  }

  async function typed($: Engine, text: string, reply = '') {
    await compose($)
    const ui = await mount($, 'terminal')
    await ui.input({ key: 'message', text, kind: 'change' })
    await ui.input({ key: 'reply', text: reply, kind: 'change' })

    return ui
  }

  for (const surface of ['terminal', 'desktop'] as const) {
    test(`commit sends the message verbatim to commit.sh on ${surface}`, async ($, on) => {
      const { runs } = commitScript(on, { stdout: `${COMMITTED}\n` })
      await compose($)
      const ui = await mount($, surface)
      const message = 'It\'s `DNS`, $HOME & "quotes" 😁\nsecond line'
      await ui.input({ key: 'message', text: message, kind: 'change' })
      await ui.press({ key: 'commit' })

      expect(runs).toHaveLength(1)
      expect(runs[0]?.argv).toHaveLength(1)
      expect(runs[0]?.argv[0]?.endsWith('/skills/commit/commit.sh')).toBe(true)
      expect(runs[0]?.stdin).toBe(message)
    })
  }

  test('commit replies to a commit', async ($, on) => {
    const { runs } = commitScript(on, { stdout: COMMITTED })
    const ui = await typed($, 'Agreed!', '0be0130')
    await ui.press({ key: 'commit' })

    expect(runs[0]?.argv.slice(1)).toEqual(['--reply', '0be0130'])
  })

  test('commit is sent once while it is being sent, however fast it is pressed, and says so', async ($, on) => {
    engineDrawsNothing(on)
    const { until, release } = held()
    const runs: string[][] = []
    on('process.run', async (_$, e) => {
      runs.push([...e.argv])
      await until

      return {
        value: { exitCode: 0, stdout: COMMITTED, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
      }
    })
    on('ui.toast', () => ({ value: undefined }))
    const ui = await typed($, 'It was DNS.')
    const first = ui.press({ key: 'commit' })
    await ui.redraw()

    expect(await ui.find({ type: 'Button', key: 'commit' })).toBeUndefined()
    expect((await ui.find({ key: 'committing' }))?.text).toBe('Committing…')

    await ui.input({ key: 'message', text: 'It was DNS.' })
    release()
    await first

    expect(runs).toHaveLength(1)
  })

  test('a commit shows its link in a toast and closes the band', async ($, on) => {
    const { toasts } = commitScript(on, { stdout: `${COMMITTED}\n` })
    const ui = await typed($, 'It was DNS.')
    await ui.press({ key: 'commit' })

    expect(toasts).toEqual([COMMITTED])
    expect(await ui.find({ key: 'message' })).toBeUndefined()
  })

  test('the next composer starts empty after a commit', async ($, on) => {
    commitScript(on, { stdout: COMMITTED })
    const ui = await typed($, 'It was DNS.')
    await ui.press({ key: 'commit' })
    await compose($)
    await ui.redraw()

    expect((await ui.find({ key: 'message' }))?.props.value).toBe('')
  })

  test('enter in the message commits', async ($, on) => {
    const { runs } = commitScript(on, { stdout: COMMITTED })
    const ui = await typed($, 'It was DNS.')
    await ui.input({ key: 'message', text: 'It was DNS.' })

    expect(runs).toHaveLength(1)
  })

  test('enter in the reply commits', async ($, on) => {
    const { runs } = commitScript(on, { stdout: COMMITTED })
    const ui = await typed($, 'Agreed!')
    await ui.input({ key: 'reply', text: '0be0130' })

    expect(runs[0]?.argv.slice(1)).toEqual(['--reply', '0be0130'])
  })

  test('enter does not send an invalid commit', async ($, on) => {
    const { runs } = commitScript(on, { stdout: COMMITTED })
    const ui = await typed($, '  ')
    await ui.input({ key: 'message', text: '  ' })

    expect(runs).toHaveLength(0)
    expect(await ui.find({ key: 'message' })).toBeDefined()
  })

  test('an error from /dev/null shows in a toast and keeps the draft', async ($, on) => {
    const { toasts } = commitScript(on, { exitCode: 1, stderr: `${NO_KEY}\n` })
    const ui = await typed($, 'It was DNS.')
    await ui.press({ key: 'commit' })

    expect(toasts).toEqual([NO_KEY])
    expect((await ui.find({ key: 'message' }))?.props.value).toBe('It was DNS.')
  })

  test('a failure without a message still shows in a toast', async ($, on) => {
    const { toasts } = commitScript(on, { exitCode: 2 })
    const ui = await typed($, 'It was DNS.')
    await ui.press({ key: 'commit' })

    expect(toasts).toEqual(['devnull: the commit failed (exit code 2).'])
    expect(await ui.find({ key: 'message' })).toBeDefined()
  })

  test('a script that cannot run shows in a toast and keeps the draft', async ($, on) => {
    const { toasts } = commitScript(on, { deny: 'timed out' })
    const ui = await typed($, 'It was DNS.')
    await ui.press({ key: 'commit' })

    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatch(/^devnull: could not run the commit script \(.*timed out\)\.$/)
    expect((await ui.find({ key: 'message' }))?.props.value).toBe('It was DNS.')
  })
})

describe('compose images', () => {
  const COMMITTED = 'Committed: https://dev-null.sh/@me/commits/1'

  async function opened($: Engine, on: On) {
    const commits = fakeCommitScript(on, { stdout: COMMITTED })
    engineDrawsNothing(on)
    await compose($)
    const ui = await mount($, 'terminal')
    await ui.input({ key: 'message', text: 'Shipped!', kind: 'change' })
    const add = (path: string) => ui.input({ key: 'image', text: path })

    return { ui, add, ...commits }
  }

  async function images(ui: Awaited<ReturnType<typeof mount<'terminal'>>>): Promise<string[]> {
    const found = await Promise.all([0, 1, 2].map(index => ui.find({ key: `image-path-${index}` })))

    return found.flatMap(path => (path === undefined ? [] : [path.text ?? '']))
  }

  test('enter in the image field adds its path to the commit, and empties the field', async ($, on) => {
    const { ui, add } = await opened($, on)
    await add('shipped.png')
    await add('  ~/Desktop/screen shot.webp ')

    expect(await images(ui)).toEqual(['shipped.png', '~/Desktop/screen shot.webp'])
    expect((await ui.find({ type: 'Input', key: 'image' }))?.props.value).toBe('')
  })

  test('enter in an empty image field adds nothing, and commits nothing', async ($, on) => {
    const { ui, add, runs } = await opened($, on)
    await add('   ')

    expect(await images(ui)).toEqual([])
    expect(runs).toHaveLength(0)
  })

  test('an image is removed with its ×', async ($, on) => {
    const { ui, add } = await opened($, on)
    await add('shipped.png')
    await add('demo.jpg')
    await ui.press({ key: 'remove-image-0' })

    expect(await images(ui)).toEqual(['demo.jpg'])
  })

  test('the image field goes once the commit carries 3 images, and comes back once one is removed', async ($, on) => {
    const { ui, add } = await opened($, on)
    await add('a.png')
    await add('b.png')
    await add('c.png')

    expect(await ui.find({ type: 'Input', key: 'image' })).toBeUndefined()

    await ui.press({ key: 'remove-image-1' })

    expect(await ui.find({ type: 'Input', key: 'image' })).toBeDefined()
  })

  test('an image that is no JPEG, PNG or WebP cannot be sent', async ($, on) => {
    const { ui, add } = await opened($, on)
    await add('notes.txt')

    expect((await ui.find({ key: 'error' }))?.text).toBe('Images are JPEG, PNG or WebP files.')
    expect(await ui.find({ key: 'commit' })).toBeUndefined()

    await add('shot.JPEG')
    await ui.press({ key: 'remove-image-0' })

    expect(await ui.find({ key: 'error' })).toBeUndefined()
  })

  test('commit sends the images to commit.sh, after the reply', async ($, on) => {
    const { ui, add, runs } = await opened($, on)
    await ui.input({ key: 'reply', text: '0be0130', kind: 'change' })
    await add('shipped.png')
    await add('~/Desktop/screen shot.webp')
    await ui.press({ key: 'commit' })

    expect(runs[0]?.argv.slice(1)).toEqual([
      '--reply',
      '0be0130',
      '--image',
      'shipped.png',
      '--image',
      '~/Desktop/screen shot.webp',
    ])
    expect(runs[0]?.stdin).toBe('Shipped!')
  })

  test('a path dropped from the Finder, escaped or quoted as for a shell, is taken as the file it names', async ($, on) => {
    const { ui, add, runs } = await opened($, on)
    await add("/Users/me/Desktop/Capture\\ d'écran\\ à\\ 14.45.36.png")
    await add("'/Users/me/screen shot.webp'")
    await ui.input({ key: 'image', text: '"/Users/me/demo \\ 1.jpg"', kind: 'change' })
    await ui.press({ key: 'commit' })

    expect(runs[0]?.argv.slice(1)).toEqual([
      '--image',
      "/Users/me/Desktop/Capture d'écran à 14.45.36.png",
      '--image',
      '/Users/me/screen shot.webp',
      '--image',
      '/Users/me/demo \\ 1.jpg',
    ])
  })

  test('commit also sends the path left in the image field, not added yet', async ($, on) => {
    const { ui, add, runs } = await opened($, on)
    await add('shipped.png')
    await ui.input({ key: 'image', text: ' demo.jpg ', kind: 'change' })
    await ui.press({ key: 'commit' })

    expect(runs[0]?.argv.slice(1)).toEqual(['--image', 'shipped.png', '--image', 'demo.jpg'])
  })

  test('a path left in the image field that is no JPEG, PNG or WebP cannot be sent', async ($, on) => {
    const { ui } = await opened($, on)
    await ui.input({ key: 'image', text: 'notes.txt', kind: 'change' })

    expect((await ui.find({ key: 'error' }))?.text).toBe('Images are JPEG, PNG or WebP files.')
    expect(await ui.find({ key: 'commit' })).toBeUndefined()
  })

  test('the next composer starts without images, after a commit or once cancelled', async ($, on) => {
    const { ui, add } = await opened($, on)
    await add('shipped.png')
    await ui.press({ key: 'commit' })
    await compose($)
    await ui.redraw()

    expect(await images(ui)).toEqual([])

    await ui.input({ key: 'image', text: 'demo.png', kind: 'change' })
    await add('shipped.png')
    await ui.press({ key: 'cancel' })
    await compose($)
    await ui.redraw()

    expect(await images(ui)).toEqual([])
    expect((await ui.find({ type: 'Input', key: 'image' }))?.props.value).toBe('')
  })

  test('the composer takes a row for its image field and one for each image', () => {
    expect(composerRows(0)).toBe(10)
    expect(composerRows(2)).toBe(12)
    expect(composerRows(3)).toBe(12)
  })
})

describe('compose modes', () => {
  function fakes(on: On, entries: Record<string, unknown> = {}): Map<string, unknown> {
    const store = engineDrawsNothing(on, entries)
    on('process.run', () => ({
      value: {
        exitCode: 0,
        stdout: 'Committed: https://dev-null.sh/@me/commits/1',
        stderr: '',
        isStdoutTruncated: false,
        isStderrTruncated: false,
      },
    }))
    on('ui.toast', () => ({ value: undefined }))

    return store
  }

  test('always shows the band without the command', async ($, on) => {
    fakes(on)
    await compose($, 'always')
    await compose($, 'manual')
    await compose($, 'always')
    const ui = await mount($, 'terminal')

    expect(await ui.find({ key: 'message' })).toBeDefined()
  })

  test('always is kept from one session to the next', async ($, on) => {
    fakes(on, { mode: 'always' })
    const ui = await mount($, 'terminal')

    expect(await ui.find({ key: 'message' })).toBeDefined()
  })

  test('always is stored for the next sessions', async ($, on) => {
    const store = fakes(on)
    await compose($, 'always')

    expect(store.get('mode')).toBe('always')
  })

  test('the band stays after a commit in always mode, with an empty draft', async ($, on) => {
    fakes(on)
    await compose($, 'always')
    const ui = await mount($, 'terminal')
    await ui.input({ key: 'message', text: 'It was DNS.', kind: 'change' })
    await ui.input({ key: 'reply', text: '0be0130', kind: 'change' })
    await ui.press({ key: 'commit' })

    expect((await ui.find({ key: 'message' }))?.props.value).toBe('')
    expect((await ui.find({ key: 'reply' }))?.props.value).toBe('')
  })

  test('cancel becomes clear in always mode and keeps the band', async ($, on) => {
    fakes(on)
    await compose($, 'always')
    const ui = await mount($, 'terminal')
    await ui.input({ key: 'message', text: 'It was DNS.', kind: 'change' })

    expect((await ui.find({ key: 'cancel' }))?.props.label).toBe('Clear')

    await ui.press({ key: 'cancel' })

    expect((await ui.find({ key: 'message' }))?.props.value).toBe('')
  })

  test('manual hides the band and is stored', async ($, on) => {
    const store = fakes(on, { mode: 'always' })
    await compose($, 'manual')
    const ui = await mount($, 'terminal')

    expect(await ui.find({ key: 'message' })).toBeUndefined()
    expect(store.get('mode')).toBe('manual')
  })

  test('manual keeps the draft for the next composer', async ($, on) => {
    fakes(on)
    await compose($, 'always')
    const ui = await mount($, 'terminal')
    await ui.input({ key: 'message', text: 'It was DNS.', kind: 'change' })
    await compose($, 'manual')
    await compose($)
    await ui.redraw()

    expect((await ui.find({ key: 'message' }))?.props.value).toBe('It was DNS.')
  })

  test('the command alone opens the band once in manual mode', async ($, on) => {
    fakes(on, { mode: 'manual' })
    await compose($)
    const ui = await mount($, 'terminal')
    await ui.input({ key: 'message', text: 'It was DNS.', kind: 'change' })
    await ui.press({ key: 'commit' })

    expect(await ui.find({ key: 'message' })).toBeUndefined()
  })

  test('the command alone closes the band when it is open, keeping the draft', async ($, on) => {
    fakes(on)
    await compose($)
    const ui = await mount($, 'terminal')
    await ui.input({ key: 'message', text: 'It was DNS.', kind: 'change' })

    expect(await compose($)).toBe('Composer closed.')

    await ui.redraw()

    expect(await ui.find({ key: 'message' })).toBeUndefined()

    await compose($)
    await ui.redraw()

    expect((await ui.find({ key: 'message' }))?.props.value).toBe('It was DNS.')
  })

  test('the command alone closes the band in always mode, and goes back to manual', async ($, on) => {
    const store = fakes(on, { mode: 'always' })
    const text = await compose($)
    const ui = await mount($, 'terminal')

    expect(text).toBe('Composer closed, shown on demand again with /dev-null:compose.')
    expect(store.get('mode')).toBe('manual')
    expect(await ui.find({ key: 'message' })).toBeUndefined()
  })

  test('an unknown mode changes nothing and shows the usage', async ($, on) => {
    const store = fakes(on)
    const text = await compose($, 'auto')
    const ui = await mount($, 'terminal')

    expect(text).toBe('Usage: /dev-null:compose [always|manual]')
    expect(await ui.find({ key: 'message' })).toBeUndefined()
    expect(store.has('mode')).toBe(false)
  })
})
