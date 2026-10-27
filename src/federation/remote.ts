import type { Component } from 'vue'
import { setApiBase } from '../api/client'
import { CONTRACT, type RemoteModule, type ServiceUiDefinition } from './types'

/**
 * Load one of a definition's view modules by expose name. Own keys only, so a
 * name like 'constructor' or '__proto__' can't reach something that isn't a view.
 */
export async function loadView(def: ServiceUiDefinition, expose: string): Promise<Component> {
  if (!Object.hasOwn(def.views, expose)) {
    throw new Error(`service-ui: "${def.service}" has no view "${expose}"`)
  }
  const mod = await def.views[expose]!()
  return 'default' in mod ? mod.default : mod
}

/**
 * The remote entry a shell loads: the service's `src/remote.ts` is just
 *
 *   import ui from './ui'
 *   export default defineRemote(ui)
 *
 * The shell imports it, calls `init` once with the base its edge proxies the
 * service under, then `load`s views as routes and slots need them. Nothing runs
 * at import time: no app, no router, no styles — the shell owns all of those.
 */
export function defineRemote(def: ServiceUiDefinition): RemoteModule {
  return {
    contract: CONTRACT,
    service: def.service,
    init({ apiBase }) {
      setApiBase(def.service, apiBase)
    },
    load: (expose) => loadView(def, expose),
  }
}
