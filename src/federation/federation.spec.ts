import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { ServiceUiDefinition, RemoteModule } from './types'

const fetchMock = vi.fn()

const Page = defineComponent({ props: { who: String }, setup: (p) => () => h('p', { class: 'page' }, `page ${p.who ?? ''}`) })

function def(overrides: Partial<ServiceUiDefinition> = {}): ServiceUiDefinition {
  return {
    service: 'demo',
    views: { './List': async () => ({ default: Page }), './Card': async () => Page },
    tools: [
      {
        id: 'demo',
        label: 'Demo',
        description: 'A demo tool.',
        icon: 'pi-box',
        base: '/demo',
        listed: 'signed-in',
        routes: [
          { path: '', title: 'Things', expose: './List', auth: 'required' },
          { path: 'open', title: 'Open', expose: './List', auth: 'none', fullBleed: true },
        ],
        launcher: [{ label: 'Demo', icon: 'pi-box', to: '/demo', section: 'analysis', order: 10 }],
      },
    ],
    slots: { provides: [{ slot: 'person.card', expose: './Card', props: 1 }] },
    ...overrides,
  }
}

// Module state (API bases, loader cache, slot resolver) is per module instance.
async function fresh() {
  vi.resetModules()
  return import('..')
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.unstubAllEnvs()
  vi.stubEnv('VITE_DEV_USER', '')
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('defineServiceUi', () => {
  it('accepts a sound definition and returns it unchanged', async () => {
    const { defineServiceUi } = await fresh()
    const d = def()
    expect(defineServiceUi(d)).toBe(d)
  })

  it('lists every problem at once', async () => {
    const { defineServiceUi } = await fresh()
    const bad = def({
      service: 'Demo Service',
      views: { './List': async () => Page, '../escape': async () => Page },
      tools: [
        { ...def().tools[0]!, icon: 'fa-box', launcher: [{ label: 'x', icon: 'pi-x', to: '/elsewhere', section: 's', order: 1 }] },
        { ...def().tools[0]!, routes: [{ path: '/abs', title: 't', expose: './Missing', auth: 'none' }] },
      ],
      slots: { provides: [{ slot: 'nodot', expose: './Card', props: 0 }], hosts: [{ slot: 'bad', props: 1.5 }] },
    })
    let err = ''
    try {
      defineServiceUi(bad)
    } catch (e) {
      err = (e as Error).message
    }
    for (const fragment of [
      'service "Demo Service"',
      'views key "../escape"',
      'icon "fa-box"',
      'launcher "/elsewhere" must be a plain path under /demo',
      'id is used twice',
      'base "/demo" is used twice',
      'route "/abs" must be relative',
      'names "./Missing", which is not in views',
      'slot "nodot" must look like owner.slot',
      'names "./Card", which is not in views',
      'props version must be a positive integer',
      'hosted slot "bad" must look like owner.slot',
      'hosted slot "bad": props version must be a positive integer',
    ]) {
      expect(err).toContain(fragment)
    }
  })

  it('holds the same patterns and limits as the manifest schema', async () => {
    const { checkDefinition } = await fresh()
    const d = def()
    const tool = d.tools[0]!
    tool.id = 'Bad Id'
    tool.label = 'x'.repeat(81)
    tool.description = 'x'.repeat(301)
    tool.routes[0]!.path = ':id(.*)'
    tool.routes[1]!.title = ''
    tool.launcher![0]!.section = 'Analysis & Reporting'
    const problems = checkDefinition(d).join('\n')
    for (const fragment of [
      'id "Bad Id" must be 1–63 lowercase letters',
      'label must be 1–80 characters',
      'description is over 300 characters',
      'route ":id(.*)" may only use name and :param segments',
      'route "open" title must be 1–80 characters',
      'section "Analysis & Reporting" must be 1–63 lowercase letters',
    ]) {
      expect(problems).toContain(fragment)
    }
    expect(checkDefinition(def({ tools: [{ ...def().tools[0]!, routes: [{ path: ':owner/:repo', title: 'R', expose: './List', auth: 'none' }] }] }))).toEqual([])
  })

  it('rejects what the registry would: launcher escapes, bad repos, requires, duplicate providers', async () => {
    const { checkDefinition } = await fresh()
    const d = def({
      slots: { provides: [{ slot: 'person.card', expose: './Card', props: 1 }, { slot: 'person.card', expose: './List', props: 1 }] },
      requires: [{ service: 'Other', contract: 0 }],
      feedback: { repo: 'x/..' },
    })
    d.tools[0]!.launcher = [
      { label: 'Esc', icon: 'pi-box', to: '/demo/../admin', section: 'analysis', order: 1 },
      { label: '', icon: 'pi-box', to: '/demo?x=1', section: 'analysis', order: 1.5 },
    ]
    const problems = checkDefinition(d).join('\n')
    for (const fragment of [
      'launcher "/demo/../admin" must be a plain path under /demo',
      'launcher "/demo?x=1" must be a plain path under /demo',
      'label must be 1–80 characters',
      'order must be an integer',
      'slot "person.card" props 1 is provided twice',
      'required service "Other" must be',
      'contract must be a positive integer',
      'feedback repo "x/.." must be owner/repo',
    ]) {
      expect(problems).toContain(fragment)
    }
    expect(checkDefinition(def({ feedback: { repo: 'example/my.repo' } }))).toEqual([])
  })

  it('does not accept inherited keys as views', async () => {
    const { checkDefinition } = await fresh()
    const d = def()
    d.tools[0]!.routes[0]!.expose = 'constructor'
    expect(checkDefinition(d).join()).toContain('names "constructor", which is not in views')
  })
})

describe('defineRemote', () => {
  it('init points the service API at the shell base; load returns the view', async () => {
    const { defineRemote, createClient } = await fresh()
    const remote = defineRemote(def())
    expect(remote).toMatchObject({ contract: 1, service: 'demo' })
    remote.init({ apiBase: '/svc/demo' })
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '[]' } as Response)
    await createClient('demo').get('/api/things')
    expect(fetchMock.mock.calls[0]![0]).toBe('/svc/demo/api/things')
    expect(await remote.load('./List')).toBe(Page)
    expect(await remote.load('./Card')).toBe(Page)
  })

  it('refuses names that are not its own views', async () => {
    const { defineRemote } = await fresh()
    const remote = defineRemote(def())
    for (const name of ['./Nope', 'constructor', '__proto__', 'toString']) {
      await expect(remote.load(name)).rejects.toThrow(/has no view/)
    }
  })
})

describe('loadRemote', () => {
  const svc = { name: 'demo', ui: '/svc/demo/ui/', entry: 'remoteEntry.js', build: 'b1' }

  async function withImporter(impl: (url: string) => Promise<{ default?: RemoteModule }>) {
    const kit = await fresh()
    const { setImporterForTests } = await import('./loader')
    const importer = vi.fn(impl)
    setImporterForTests(importer)
    return { ...kit, importer }
  }

  it('imports the entry once per build, inits it with the shell base, and loads views', async () => {
    const remoteDef = def()
    const { loadRemote, defineRemote, importer } = await withImporter(async () => ({ default: defineRemote(remoteDef) }))
    expect(await loadRemote(svc, './List')).toBe(Page)
    expect(await loadRemote(svc, './Card')).toBe(Page)
    expect(importer).toHaveBeenCalledOnce()
    expect(importer).toHaveBeenCalledWith('/svc/demo/ui/remoteEntry.js?v=b1')

    await loadRemote({ ...svc, build: 'b2' }, './List')
    expect(importer).toHaveBeenLastCalledWith('/svc/demo/ui/remoteEntry.js?v=b2')
  })

  it('refuses entries outside the service UI path, before importing anything', async () => {
    const { loadRemote, importer } = await withImporter(async () => ({}))
    for (const bad of [
      { ...svc, ui: '/svc/other/ui/' },
      { ...svc, ui: 'https://evil.example/ui/' },
      { ...svc, name: 'Demo' },
      { ...svc, entry: '../../evil.js' },
      { ...svc, entry: 'a/../../x.js' },
      { ...svc, entry: '//evil.example/x.js' },
      { ...svc, entry: '/\\evil.example/x.js' },
      { ...svc, entry: 'https://evil.example/x.js' },
    ]) {
      await expect(loadRemote(bad, './List')).rejects.toThrow(/refusing to load/)
    }
    expect(importer).not.toHaveBeenCalled()
  })

  it('rejects a module that is not a contract-1 remote for that service', async () => {
    for (const mod of [undefined, { contract: 2, service: 'demo' }, { contract: 1, service: 'other' }]) {
      const { loadRemote } = await withImporter(async () => ({ default: mod as RemoteModule | undefined }))
      await expect(loadRemote(svc, './List')).rejects.toThrow(/not a contract 1 remote/)
    }
  })

  it('does not cache a failed import, so the next attempt retries', async () => {
    const remoteDef = def()
    let fail = true
    const { loadRemote, defineRemote, importer } = await withImporter(async () => {
      if (fail) throw new TypeError('network')
      return { default: defineRemote(remoteDef) }
    })
    await expect(loadRemote(svc, './List')).rejects.toThrow('network')
    fail = false
    expect(await loadRemote(svc, './List')).toBe(Page)
    expect(importer).toHaveBeenCalledTimes(2)
  })
})

describe('routes', () => {
  it('builds one parent per tool and carries meta to every child', async () => {
    const { toolRoutes } = await fresh()
    const resolve = vi.fn(() => async () => Page)
    const [record] = toolRoutes(def().tools, resolve)
    expect(record).toMatchObject({ path: '/demo', meta: { tool: 'demo' } })
    expect(record!.children).toMatchObject([
      { path: '', meta: { title: 'Things', fullBleed: false, auth: 'required' } },
      { path: 'open', meta: { title: 'Open', fullBleed: true, auth: 'none' } },
    ])
    expect(resolve).toHaveBeenCalledWith('./List')
    expect(record).not.toHaveProperty('component')
  })

  it('requireSignIn sends a signed-out user to log in for required routes only', async () => {
    const { toolRoutes, requireSignIn } = await fresh()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ authenticated: false }) } as Response)
    const router = createRouter({ history: createMemoryHistory(), routes: toolRoutes(def().tools, () => async () => Page) })
    router.beforeEach(requireSignIn(router))

    await router.push('/demo/open')
    expect(router.currentRoute.value.path).toBe('/demo/open')
    expect(assign).not.toHaveBeenCalled()

    await router.push('/demo?x=1')
    expect(router.currentRoute.value.path).toBe('/demo/open')
    expect(assign).toHaveBeenCalledWith('/auth/login?returnTo=%2Fdemo%3Fx%3D1')
  })
})

describe('ServiceSlot', () => {
  async function slotKit() {
    const kit = await fresh()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    return { ...kit, warn }
  }
  const host = (ServiceSlot: unknown, version = 1) =>
    mount(
      defineComponent({
        setup: () => () =>
          h(ServiceSlot as never, { name: 'person.card', version, props: { who: 'ada' } }, () => h('i', { class: 'fallback' })),
      }),
    )

  it('renders the fallback when nothing provides the slot', async () => {
    const { ServiceSlot } = await slotKit()
    const w = host(ServiceSlot)
    expect(w.find('.fallback').exists()).toBe(true)
  })

  it('renders matching providers with the host props, skipping other props versions', async () => {
    const { ServiceSlot, setSlotProviders } = await slotKit()
    setSlotProviders([
      { slot: 'person.card', build: 'b1', service: 'directory', props: 1, load: async () => Page },
      { slot: 'person.card', build: 'b1', service: 'old', props: 2, load: async () => defineComponent(() => () => h('b', 'v2')) },
    ])
    const w = host(ServiceSlot)
    await flushPromises()
    expect(w.findAll('.page').map((n) => n.text())).toEqual(['page ada'])
    expect(w.text()).not.toContain('v2')
    expect(w.find('.fallback').exists()).toBe(false)
  })

  it('picks up providers registered after it mounted', async () => {
    const { ServiceSlot, setSlotProviders } = await slotKit()
    const w = host(ServiceSlot)
    expect(w.find('.fallback').exists()).toBe(true)
    setSlotProviders([{ slot: 'person.card', build: 'b1', service: 'directory', props: 1, load: async () => Page }])
    await flushPromises()
    expect(w.find('.page').exists()).toBe(true)
    expect(w.find('.fallback').exists()).toBe(false)
  })

  it('fails soft: a provider that cannot load or throws on render is dropped, the rest stay', async () => {
    const { ServiceSlot, setSlotProviders, warn } = await slotKit()
    const Boom = defineComponent(() => () => {
      throw new Error('render boom')
    })
    setSlotProviders([
      { slot: 'person.card', build: 'b1', service: 'down', props: 1, load: async () => Promise.reject(new TypeError('network')) },
      { slot: 'person.card', build: 'b1', service: 'broken', props: 1, load: async () => Boom },
      { slot: 'person.card', build: 'b1', service: 'directory', props: 1, load: async () => Page },
    ])
    const w = host(ServiceSlot)
    await flushPromises()
    await nextTick()
    expect(w.findAll('.page')).toHaveLength(1)
    expect(w.find('.fallback').exists()).toBe(false)
    expect(warn.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining([expect.stringContaining('"down" failed'), expect.stringContaining('"broken" failed')]),
    )
  })

  it('does not re-load a failed provider when a refresh changes nothing', async () => {
    const { ServiceSlot, setSlotProviders } = await slotKit()
    const load = vi.fn(async () => Promise.reject(new TypeError('network')))
    const list = () => [{ slot: 'person.card', build: 'b1', service: 'down', props: 1, load }]
    setSlotProviders(list())
    const w = host(ServiceSlot)
    await flushPromises()
    await nextTick()
    setSlotProviders(list()) // a registry refresh: new objects, same content
    await flushPromises()
    await nextTick()
    expect(load).toHaveBeenCalledOnce()
    expect(w.find('.fallback').exists()).toBe(true)
  })

  it('gives a redeployed provider a fresh try, with its new loader', async () => {
    const { ServiceSlot, setSlotProviders } = await slotKit()
    const broken = vi.fn(async () => Promise.reject(new TypeError('bad build')))
    setSlotProviders([{ slot: 'person.card', service: 'people', build: 'b1', props: 1, load: broken }])
    const w = host(ServiceSlot)
    await flushPromises()
    await nextTick()
    expect(w.find('.fallback').exists()).toBe(true)
    const fixed = vi.fn(async () => Page)
    setSlotProviders([{ slot: 'person.card', service: 'people', build: 'b2', props: 1, load: fixed }])
    await flushPromises()
    await nextTick()
    expect(fixed).toHaveBeenCalledOnce()
    expect(w.find('.page').exists()).toBe(true)
  })

  it('shows the fallback once every provider has failed', async () => {
    const { ServiceSlot, setSlotProviders } = await slotKit()
    setSlotProviders([{ slot: 'person.card', build: 'b1', service: 'down', props: 1, load: async () => Promise.reject(new TypeError('network')) }])
    const w = host(ServiceSlot)
    expect(w.find('.fallback').exists()).toBe(false) // loading: no flash of the fallback
    await flushPromises()
    await nextTick()
    expect(w.find('.fallback').exists()).toBe(true)
  })
})

describe('createStandaloneApp', () => {
  async function start(d = def(), path = '/') {
    vi.resetModules()
    const assign = vi.fn()
    window.history.replaceState(null, '', path)
    // The router reads the live location; only navigation away is intercepted.
    const real = window.location
    const live = (k: 'href' | 'origin' | 'protocol' | 'host' | 'pathname' | 'search' | 'hash') => ({
      get: () => real[k],
      enumerable: true,
    })
    const fake = Object.defineProperties({ assign }, {
      href: live('href'), origin: live('origin'), protocol: live('protocol'), host: live('host'),
      pathname: live('pathname'), search: live('search'), hash: live('hash'),
    })
    vi.stubGlobal('location', fake)
    const { createStandaloneApp } = await import('./standalone')
    const { createClient } = await import('..')
    const { app, router } = createStandaloneApp(d)
    const el = document.createElement('div')
    document.body.append(el)
    app.mount(el)
    // A guard that sends the user to log in aborts the first navigation; that's
    // the redirect working, not a failure.
    await router.isReady().catch(() => {})
    await flushPromises()
    return { app, router, el, assign, createClient }
  }

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('serves the API from this origin, redirects / to the first tool, and titles the tab', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ authenticated: true, email: 'ada@x' }), text: async () => '[]' } as Response)
    const { router, el, createClient, app } = await start()
    expect(router.currentRoute.value.path).toBe('/demo')
    expect(el.querySelector('.page')?.textContent).toBe('page ')
    expect(document.title).toBe('Things · Demo')
    await createClient('demo').get('/api/things')
    expect(fetchMock).toHaveBeenLastCalledWith('/api/things', expect.anything())
    app.unmount()
  })

  it('sends a signed-out user to log in for a required route', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ authenticated: false }) } as Response)
    const { router, assign, app } = await start(def(), '/demo')
    expect(assign).toHaveBeenCalledWith('/auth/login?returnTo=%2Fdemo')
    await router.push('/demo/open')
    expect(document.title).toBe('Open · Demo')
    app.unmount()
  })

  it('renders not-found for unknown paths', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ authenticated: false }) } as Response)
    const { el, app } = await start(def(), '/nowhere')
    expect(el.textContent).toContain('Page not found')
    expect(document.title).toBe('Not found')
    app.unmount()
  })
})
