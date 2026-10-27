import type { Component } from 'vue'
import { CONTRACT, type RemoteModule } from './types'

/** What the shell knows about a service from `GET /registry`. */
export interface RemoteService {
  name: string
  /** Where the registry says the UI is served, '/svc/<name>/ui/'. */
  ui: string
  /** Remote entry, relative to `ui`, from the manifest. */
  entry: string
  /** Opaque build id; part of the entry URL so a new deploy is a new module. */
  build: string
}

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/
const ENTRY_RE = /^[A-Za-z0-9_-][A-Za-z0-9._-]*(?:\/[A-Za-z0-9_-][A-Za-z0-9._-]*)*$/

// One import per service build, shared by every route and slot that needs it.
const entries = new Map<string, Promise<RemoteModule>>()

let importer = (url: string): Promise<{ default?: RemoteModule }> => import(/* @vite-ignore */ url)
/** Tests only (not exported from the package): stand in for the browser's import(). */
export function setImporterForTests(fn: typeof importer): void {
  importer = fn
  entries.clear()
}

/**
 * The entry URL, checked: same origin, exactly under /svc/<name>/ui/. The registry
 * already validates manifests; this keeps a bad registry answer from making the
 * shell import code from anywhere else.
 */
function entryUrl(svc: RemoteService): string {
  const ui = `/svc/${svc.name}/ui/`
  if (!NAME_RE.test(svc.name) || svc.ui !== ui || !ENTRY_RE.test(svc.entry) || /(^|\/)\.\.?(\/|$)/.test(svc.entry)) {
    throw new Error(`service-ui: refusing to load "${svc.name}" from "${svc.ui}${svc.entry}"`)
  }
  const url = new URL(ui + svc.entry, window.location.origin)
  if (url.origin !== window.location.origin || !url.pathname.startsWith(ui)) {
    throw new Error(`service-ui: refusing to load "${svc.name}" from "${url.href}"`)
  }
  url.searchParams.set('v', svc.build)
  return url.pathname + url.search
}

async function importEntry(svc: RemoteService): Promise<RemoteModule> {
  const url = entryUrl(svc)
  const mod = (await importer(url)).default
  if (!mod || mod.contract !== CONTRACT || mod.service !== svc.name) {
    throw new Error(`service-ui: "${svc.name}" entry is not a contract ${CONTRACT} remote for that service`)
  }
  mod.init({ apiBase: `/svc/${svc.name}` })
  return mod
}

/**
 * Load a view from a federated service — the shell's half of `defineRemote`.
 * Use it as a lazy route component or a slot provider's loader:
 *
 *   component: () => loadRemote(service, './List')
 *
 * The entry is imported once per build and initialised with the service's API
 * base before any of its views load. A failed import is not cached, so the next
 * navigation tries again instead of being stuck on one network blip.
 */
export function loadRemote(svc: RemoteService, expose: string): Promise<Component> {
  const key = `${svc.name}@${svc.build}`
  let entry = entries.get(key)
  if (!entry) {
    const pending = importEntry(svc)
    entries.set(key, pending)
    pending.catch(() => {
      if (entries.get(key) === pending) entries.delete(key)
    })
    entry = pending
  }
  return entry.then((mod) => mod.load(expose))
}
