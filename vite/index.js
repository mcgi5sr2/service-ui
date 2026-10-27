// service-ui/vite — build-time half of the kit. Plain JavaScript on purpose: Vite
// loads this from node_modules, where Node will not strip TypeScript.
//
//   // vite.config.ts
//   import { serviceUi } from 'service-ui/vite'
//   export default defineConfig({ plugins: [vue(), serviceUi()] })
//
//   // package.json
//   "build": "vite build && vite build --mode remote"
//
// The first build is the standalone app (dist/). The second, in `remote` mode,
// builds the remote entry the shell loads plus manifest.json (dist/ui/), which
// the service serves at /ui/.
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runnerImport } from 'vite'

/** Packages the shell provides once for every remote (contract §6). */
export const SHARED = ['vue', 'vue-router', 'pinia', 'service-ui']

const CONTRACT = 1
const MAX_MANIFEST_BYTES = 64 * 1024
const ENTRY = 'remoteEntry.js'
// ui.ts imports defineServiceUi from 'service-ui/define', which has no Vue in it,
// so evaluating the definition needs no Vue compiler and runs none of the app.
// Pinned to this plugin's own copy, which is the installed service-ui.
const DEFINE_MODULE = fileURLToPath(new URL('../src/federation/define.ts', import.meta.url))

/** `version = "x.y.z"` from a Cargo.toml's [package] table — for UIs released with a Rust service. */
export function cargoVersion(path) {
  const pkg = readFileSync(path, 'utf8').split(/^\[/m).find((t) => t.startsWith('package]'))
  const v = pkg?.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
  if (!v) throw new Error(`service-ui: no [package] version in ${path}`)
  return v
}

const OWN = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

/** Installed version of a package, looking up from `root` the way Node resolves it. */
function installedVersion(root, name) {
  // This plugin is the installed service-ui, so its own version is the answer —
  // and the only one that works in the kit's own checkout, where it isn't in node_modules.
  if (name === OWN.name) return OWN.version
  for (let dir = root; ; dir = dirname(dir)) {
    const file = join(dir, 'node_modules', name, 'package.json')
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).version
    if (dirname(dir) === dir) throw new Error(`service-ui: ${name} is not installed (needed for remote.shared)`)
  }
}

/** '3.5.44' → '^3.5', '0.1.3' → '^0.1': the range the shell's copy must satisfy. */
const caret = (v) => `^${v.split('.').slice(0, 2).join('.')}`

/** Evaluate the definition and run the kit's own check on it, whatever ui.ts did. */
async function loadDefinition(root, file) {
  const inline = {
    root,
    configFile: false,
    logLevel: 'error',
    resolve: { alias: [{ find: /^service-ui\/define$/, replacement: DEFINE_MODULE }] },
  }
  const [{ module: ui }, { module: kit }] = await Promise.all([
    runnerImport(resolve(root, file), inline),
    runnerImport(DEFINE_MODULE, inline),
  ])
  const def = ui.default
  if (!def || typeof def !== 'object' || !def.views || !Array.isArray(def.tools)) {
    throw new Error(`service-ui: ${file} must default-export defineServiceUi({ … }) from 'service-ui/define'`)
  }
  const problems = kit.checkDefinition(def)
  if (problems.length) throw new Error(`service-ui: invalid definition in ${file}:\n  - ${problems.join('\n  - ')}`)
  return def
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]))

/**
 * The manifest's description of the UI, built key by key from the schema's fields:
 * anything else on the definition objects (a note, an internal URL) stays out of
 * a file anyone can read signed out.
 */
function describe(def) {
  return {
    tools: def.tools.map((t) => ({
      ...pick(t, ['id', 'label', 'description', 'icon', 'base', 'listed']),
      routes: t.routes.map((r) => pick(r, ['path', 'title', 'expose', 'auth', 'fullBleed'])),
      ...(t.launcher && { launcher: t.launcher.map((l) => pick(l, ['label', 'icon', 'to', 'section', 'order'])) }),
      ...pick(t, ['tile']),
    })),
    slots: {
      provides: (def.slots?.provides ?? []).map((p) => pick(p, ['slot', 'expose', 'props'])),
      hosts: (def.slots?.hosts ?? []).map((h) => pick(h, ['slot', 'props'])),
    },
    requires: (def.requires ?? []).map((r) => pick(r, ['service', 'contract'])),
    ...(def.feedback && { feedback: pick(def.feedback, ['repo']) }),
  }
}

/** The release version: the option, then $SERVICE_VERSION, then package.json. */
function releaseVersion(root, option) {
  let version = option ?? process.env.SERVICE_VERSION
  if (version === undefined) {
    try {
      version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
    } catch {
      // no package.json: fall through to the error below
    }
  }
  if (typeof version !== 'string' || !version || version.length > 64) {
    throw new Error('service-ui: no usable version — pass `version` (e.g. cargoVersion("../Cargo.toml")) or set SERVICE_VERSION')
  }
  return version
}

/**
 * @param {import('./index').ServiceUiOptions} [options]
 * @returns {import('vite').Plugin}
 */
export function serviceUi(options = {}) {
  const {
    definition = 'src/ui.ts',
    remote = 'src/remote.ts',
    remoteMode = 'remote',
    outDir = 'dist/ui',
  } = options
  let root = process.cwd()
  let active = false
  /** @type {Promise<any> | undefined} */
  let definitionLoad

  return {
    name: 'service-ui',
    // Before Vite's resolver, so resolveId sees bare imports of shared packages.
    enforce: 'pre',

    config(config, { command, mode }) {
      active = command === 'build' && mode === remoteMode
      if (!active) return
      root = resolve(config.root ?? process.cwd())
      // App mode, not library mode: Vite keeps per-view CSS and loads it with the
      // view (a same-origin <link>), and base './' makes every URL relative to the
      // entry — which the shell serves at /svc/<name>/ui/.
      return {
        base: './',
        publicDir: false,
        build: {
          outDir,
          emptyOutDir: true,
          manifest: false,
          rolldownOptions: {
            input: { remoteEntry: resolve(root, remote) },
            // The shell reads the entry's default export.
            preserveEntrySignatures: 'strict',
            external: (id) => SHARED.includes(id),
            output: {
              entryFileNames: ENTRY,
              chunkFileNames: 'assets/[name]-[hash].js',
              assetFileNames: 'assets/[name]-[hash][extname]',
            },
          },
        },
      }
    },

    // A shared package's subpath would be bundled into the remote — a second copy
    // of state the shell owns (API bases, identity, theme). Only service-ui/define,
    // which holds none, may be bundled.
    resolveId(source) {
      if (!active || source === 'service-ui/define') return null
      if (SHARED.some((s) => source.startsWith(s + '/'))) {
        this.error(`service-ui: a remote can't import "${source}"; import the package root, which the shell provides`)
      }
      return null
    },

    buildStart() {
      if (!active) return
      // Independent of the bundle, so evaluate it while the bundle builds.
      definitionLoad = loadDefinition(root, definition)
      definitionLoad.catch(() => {}) // surfaced when generateBundle awaits it
    },

    async generateBundle(_, bundle) {
      if (!active) return
      const entry = bundle[ENTRY]
      if (!entry || entry.type !== 'chunk') this.error(`service-ui: ${ENTRY} was not produced`)

      const def = await definitionLoad
      const version = releaseVersion(root, options.version)
      const manifest = {
        contract: CONTRACT,
        service: def.service,
        version,
        // Changes exactly when the entry does: it names every chunk by content hash.
        build: createHash('sha256').update(entry.code).digest('hex').slice(0, 12),
        remote: { entry: ENTRY, shared: Object.fromEntries(SHARED.map((n) => [n, caret(installedVersion(root, n))])) },
        ...describe(def),
      }
      const source = JSON.stringify(manifest, null, 2) + '\n'
      if (Buffer.byteLength(source) > MAX_MANIFEST_BYTES) {
        this.error(`service-ui: manifest.json is over ${MAX_MANIFEST_BYTES / 1024} KiB; the registry would reject it`)
      }
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source })
    },
  }
}
