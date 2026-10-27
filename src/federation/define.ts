import type { ServiceUiDefinition } from './types'

const NAME_RE = /^[a-z0-9][a-z0-9-]*$/
const BASE_RE = /^(?:\/[a-z0-9][a-z0-9-]*)+$/
const EXPOSE_RE = /^\.\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/
const ICON_RE = /^pi-[a-z0-9-]+$/
const SLOT_RE = /^[a-z0-9-]+\.[a-z0-9-]+$/

const under = (base: string, path: string) => path === base || path.startsWith(base + '/')

/** Every rule a definition breaks, as readable lines; empty when it is sound. */
export function checkDefinition(def: ServiceUiDefinition): string[] {
  const problems: string[] = []
  const has = (expose: string) => Object.hasOwn(def.views, expose)

  if (!NAME_RE.test(def.service)) problems.push(`service "${def.service}" must be lowercase letters, digits and dashes`)
  for (const key of Object.keys(def.views)) {
    if (!EXPOSE_RE.test(key)) problems.push(`views key "${key}" must look like ./Name (relative, no ..)`)
  }

  const ids = new Set<string>()
  const bases = new Set<string>()
  for (const tool of def.tools) {
    const at = `tool "${tool.id}"`
    if (ids.has(tool.id)) problems.push(`${at}: id is used twice`)
    ids.add(tool.id)
    if (!BASE_RE.test(tool.base)) problems.push(`${at}: base "${tool.base}" must be an absolute lowercase path`)
    if (bases.has(tool.base)) problems.push(`${at}: base "${tool.base}" is used twice`)
    bases.add(tool.base)
    if (!ICON_RE.test(tool.icon)) problems.push(`${at}: icon "${tool.icon}" must look like pi-name`)

    const paths = new Set<string>()
    for (const route of tool.routes) {
      if (route.path.startsWith('/')) problems.push(`${at}: route "${route.path}" must be relative to the base`)
      if (paths.has(route.path)) problems.push(`${at}: route "${route.path}" is defined twice`)
      paths.add(route.path)
      if (!has(route.expose)) problems.push(`${at}: route "${route.path}" names "${route.expose}", which is not in views`)
    }
    for (const entry of tool.launcher ?? []) {
      if (!under(tool.base, entry.to)) problems.push(`${at}: launcher "${entry.to}" is outside the base ${tool.base}`)
      if (!ICON_RE.test(entry.icon)) problems.push(`${at}: launcher icon "${entry.icon}" must look like pi-name`)
    }
  }

  for (const p of def.slots?.provides ?? []) {
    if (!SLOT_RE.test(p.slot)) problems.push(`slot "${p.slot}" must look like owner.slot`)
    if (!has(p.expose)) problems.push(`slot "${p.slot}" names "${p.expose}", which is not in views`)
    if (!Number.isInteger(p.props) || p.props < 1) problems.push(`slot "${p.slot}": props version must be a positive integer`)
  }
  for (const h of def.slots?.hosts ?? []) {
    if (!SLOT_RE.test(h.slot)) problems.push(`hosted slot "${h.slot}" must look like owner.slot`)
    if (!Number.isInteger(h.props) || h.props < 1) problems.push(`hosted slot "${h.slot}": props version must be a positive integer`)
  }
  return problems
}

/**
 * Declare a service's UI: its tools, routes and the view modules they render.
 *
 *   export default defineServiceUi({
 *     service: 'my-service',
 *     views: { './List': () => import('./views/List.vue') },
 *     tools: [{ id: 'my-tool', label: 'My Tool', description: '…', icon: 'pi-box',
 *               base: '/my-tool', listed: 'signed-in',
 *               routes: [{ path: '', title: 'Things', expose: './List', auth: 'required' }] }],
 *   })
 *
 * The same object starts the standalone app (`createStandaloneApp`), becomes the
 * remote entry the shell loads (`defineRemote`), and is what manifest.json is
 * emitted from — so routes are written once. A broken definition throws here,
 * at startup, listing every problem, rather than failing later as a blank route.
 */
export function defineServiceUi<T extends ServiceUiDefinition>(def: T): T {
  const problems = checkDefinition(def)
  if (problems.length) {
    throw new Error(`service-ui: invalid definition for "${def.service}":\n  - ${problems.join('\n  - ')}`)
  }
  return def
}
