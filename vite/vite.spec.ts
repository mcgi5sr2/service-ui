// @vitest-environment node
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import vue from '@vitejs/plugin-vue'
import Ajv from 'ajv/dist/2020'
import { build } from 'vite'
import schema from '../schema/manifest.v1.schema.json'
import { CONTRACT } from '../src/federation/types'
import { cargoVersion, serviceUi, type ServiceUiOptions } from './index'

const root = join(import.meta.dirname, 'fixture')
const src = join(import.meta.dirname, '../src')
const validate = new Ajv({ strict: true }).compile(schema)

const outs: string[] = []
afterAll(() => {
  for (const dir of outs) rmSync(dir, { recursive: true, force: true })
})

/** A real remote build of the fixture service (a few hundred ms each). */
async function buildRemote(options: ServiceUiOptions = {}) {
  const out = mkdtempSync(join(tmpdir(), 'service-ui-build-'))
  outs.push(out)
  await build({
    root,
    configFile: false,
    logLevel: 'silent',
    mode: 'remote',
    // The fixture imports the kit by name; point that at this checkout's source.
    resolve: {
      alias: [
        { find: /^service-ui$/, replacement: join(src, 'index.ts') },
        { find: /^service-ui\/define$/, replacement: join(src, 'federation/define.ts') },
      ],
    },
    plugins: [vue(), serviceUi({ outDir: out, ...options })],
  })
  return {
    files: readdirSync(out, { recursive: true, encoding: 'utf8' }).sort(),
    manifest: JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8')),
    entry: readFileSync(join(out, 'remoteEntry.js'), 'utf8'),
  }
}

describe('serviceUi() remote build', () => {
  // The two tests that only read the default build share it.
  let built: Awaited<ReturnType<typeof buildRemote>>
  beforeAll(async () => {
    built = await buildRemote()
  }, 30_000)

  it('emits the entry, per-view chunks with their CSS, and a manifest', () => {
    const { files, entry } = built
    expect(files).toContain('remoteEntry.js')
    expect(files).toContain('manifest.json')
    expect(files.some((f) => /^assets\/List-.+\.js$/.test(f))).toBe(true)
    expect(files.some((f) => /^assets\/List-.+\.css$/.test(f))).toBe(true)
    // Shared packages stay external: the shell provides them through its import map.
    expect(entry).toMatch(/from\s*["']service-ui["']/)
    expect(entry).not.toContain('createElementVNode')
    // The default export is what the shell reads.
    expect(entry).toMatch(/export\s*\{[^}]*as default/)
  })

  it('writes the definition minus code, plus build fields, valid against the schema', () => {
    const { manifest } = built
    expect(manifest).toMatchObject({
      contract: CONTRACT,
      service: 'fixture',
      version: '9.9.9',
      remote: { entry: 'remoteEntry.js', shared: { vue: expect.stringMatching(/^\^3\./), 'service-ui': '^0.1' } },
      tools: [{ id: 'fixture', base: '/fixture', routes: [{ path: '' }, { path: ':id/detail', fullBleed: true }] }],
      slots: { provides: [{ slot: 'person.card', expose: './Card', props: 1 }], hosts: [{ slot: 'other.panel', props: 2 }] },
      requires: [],
      feedback: { repo: 'example/fixture' },
    })
    expect(manifest.build).toMatch(/^[0-9a-f]{12}$/)
    expect(manifest).not.toHaveProperty('views')
    expect(JSON.stringify(manifest)).not.toContain('internalNote')
    expect(validate(manifest), JSON.stringify(validate.errors)).toBe(true)
    // The plugin's copy of the contract major (it is plain JS) matches the kit's and the schema's.
    expect(schema.properties.contract.const).toBe(CONTRACT)
  })

  it('takes the version from the option, then SERVICE_VERSION', async () => {
    expect((await buildRemote({ version: '1.2.3' })).manifest.version).toBe('1.2.3')
    vi.stubEnv('SERVICE_VERSION', '4.5.6')
    try {
      expect((await buildRemote()).manifest.version).toBe('4.5.6')
    } finally {
      vi.unstubAllEnvs()
    }
  }, 30_000)

  it('checks the definition itself, even one that skipped defineServiceUi', async () => {
    await expect(buildRemote({ definition: 'src/bad-ui.ts' })).rejects.toThrow(/launcher "\/fixture\/\.\.\/admin" must be a plain path/)
  }, 30_000)

  it('refuses a remote that imports a shared package subpath', async () => {
    await expect(buildRemote({ remote: 'src/bad-remote.ts' })).rejects.toThrow(/can't import "service-ui\/standalone"/)
  }, 30_000)

  it('does nothing outside the remote mode', async () => {
    const plugin = serviceUi()
    const config = (plugin.config as (c: object, e: object) => unknown)({}, { command: 'build', mode: 'production' })
    expect(config).toBeUndefined()
  })
})

describe('cargoVersion', () => {
  it('reads [package] version and ignores other tables', () => {
    const dir = mkdtempSync(join(tmpdir(), 'service-ui-cargo-'))
    outs.push(dir)
    const file = join(dir, 'Cargo.toml')
    writeFileSync(file, '[workspace]\nversion = "0.0.0"\n\n[package]\nname = "x"\nversion = "0.3.7"\n\n[dependencies]\nfoo = { version = "1" }\n')
    expect(cargoVersion(file)).toBe('0.3.7')
  })
})

describe('manifest schema', () => {
  const good = () => ({
    contract: 1,
    service: 'demo',
    version: '0.1.0',
    build: 'abc123',
    remote: { entry: 'remoteEntry.js', shared: { vue: '^3.5' } },
    tools: [
      {
        id: 'demo',
        label: 'Demo',
        description: '',
        icon: 'pi-box',
        base: '/demo',
        listed: 'signed-in',
        routes: [{ path: ':owner/:repo', title: 'Repo', expose: './Repo', auth: 'required' }],
      },
    ],
  })

  it('accepts a minimal manifest, and unknown additive fields', () => {
    expect(validate(good())).toBe(true)
    expect(validate({ ...good(), futureField: { x: 1 } })).toBe(true)
  })

  it.each([
    ['another contract major', (m: any) => (m.contract = 2)],
    ['an absolute entry', (m: any) => (m.remote.entry = '/evil.js')],
    ['an entry with a scheme', (m: any) => (m.remote.entry = 'https://evil.example/x.js')],
    ['a dot-segment entry', (m: any) => (m.remote.entry = '../x.js')],
    ['a protocol-relative entry', (m: any) => (m.remote.entry = '//evil.example/x.js')],
    ['a non-relative expose', (m: any) => (m.tools[0].routes[0].expose = '/abs')],
    ['an expose climbing out', (m: any) => (m.tools[0].routes[0].expose = './../x')],
    ['a non-pi icon', (m: any) => (m.tools[0].icon = 'fa fa-x" onerror="x')],
    ['an absolute route path', (m: any) => (m.tools[0].routes[0].path = '/x')],
    ['a regex route param', (m: any) => (m.tools[0].routes[0].path = ':id(.*)')],
    ['a base with a dot segment', (m: any) => (m.tools[0].base = '/a/..')],
    ['an unknown listed value', (m: any) => (m.tools[0].listed = 'admins')],
    ['an overlong label', (m: any) => (m.tools[0].label = 'x'.repeat(81))],
    ['a props version of 0', (m: any) => (m.slots = { provides: [{ slot: 'a.b', expose: './X', props: 0 }] })],
    ['a bare-string host', (m: any) => (m.slots = { hosts: ['a.b'] })],
    ['a feedback repo URL', (m: any) => (m.feedback = { repo: 'https://host/o/r' })],
    ['a feedback repo climbing out', (m: any) => (m.feedback = { repo: 'x/..' })],
    ['a dot-segment feedback owner', (m: any) => (m.feedback = { repo: '../repo' })],
    ['a missing tools list', (m: any) => delete m.tools],
  ])('rejects %s', (_, mutate) => {
    const m = good()
    mutate(m)
    expect(validate(m)).toBe(false)
  })
})
