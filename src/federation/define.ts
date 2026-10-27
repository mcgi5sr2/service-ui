import { NAME_RE } from '../patterns'
import type { ServiceUiDefinition } from './types'

// Every rule schema/manifest.v1.schema.json states, plus the ones a schema can't
// (views exist, ids/bases/routes/slots unique, launcher targets under the base),
// so a definition that passes here passes the registry. The plugin's build test
// validates a real emitted manifest against the schema to keep the two honest.
const BASE_RE = /^(?:\/[a-z0-9][a-z0-9-]*)+$/
const EXPOSE_RE = /^\.\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/
const ICON_RE = /^pi-[a-z0-9-]+$/
const SLOT_RE = /^[a-z0-9-]+\.[a-z0-9-]+$/
// Route segments are names or :params — no regex params, no leading slash, no dot segments.
const SEGMENT = '(?::[A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9_-][A-Za-z0-9_.-]*)'
const ROUTE_RE = new RegExp(`^(?:${SEGMENT}(?:/${SEGMENT})*)?$`)
// Absolute path; segments can't start with '.', so no dot segments.
const PATH_RE = /^(?:\/[A-Za-z0-9_-][A-Za-z0-9_.-]*)+$/
// owner/repo; neither part may start with '.', so no '.' or '..'.
const REPO_RE = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\/[A-Za-z0-9_-][A-Za-z0-9_.-]*$/
const LEN = { name: 63, label: 80, description: 300, path: 200, ref: 100, icon: 64 }
const COUNT = { tools: 32, routes: 64, launcher: 16, slots: 32, requires: 16 }

const under = (base: string, path: string) => path === base || path.startsWith(base + '/')
const fits = (s: string, max: number, min = 0) => typeof s === 'string' && s.length >= min && s.length <= max
const positive = (n: number) => Number.isInteger(n) && n >= 1

/** Every rule a definition breaks, as readable lines; empty when it is sound. */
export function checkDefinition(def: ServiceUiDefinition): string[] {
  const problems: string[] = []
  const has = (expose: string) => Object.hasOwn(def.views, expose)
  const name = (label: string, s: string) => {
    if (!NAME_RE.test(s) || !fits(s, LEN.name)) problems.push(`${label} "${s}" must be 1–${LEN.name} lowercase letters, digits and dashes`)
  }
  const most = (label: string, list: unknown[] | undefined, max: number) => {
    if ((list?.length ?? 0) > max) problems.push(`${label}: at most ${max} allowed`)
  }
  const icon = (label: string, s: string) => {
    if (!ICON_RE.test(s) || !fits(s, LEN.icon)) problems.push(`${label} "${s}" must look like pi-name`)
  }
  const slot = (label: string, s: string, props: number) => {
    if (!SLOT_RE.test(s) || !fits(s, LEN.ref)) problems.push(`${label} "${s}" must look like owner.slot`)
    if (!positive(props)) problems.push(`${label} "${s}": props version must be a positive integer`)
  }

  name('service', def.service)
  for (const key of Object.keys(def.views)) {
    if (!EXPOSE_RE.test(key) || !fits(key, LEN.ref)) problems.push(`views key "${key}" must look like ./Name (relative, no ..)`)
  }

  most('tools', def.tools, COUNT.tools)
  const ids = new Set<string>()
  const bases = new Set<string>()
  for (const tool of def.tools) {
    const at = `tool "${tool.id}"`
    name(`${at}: id`, tool.id)
    if (ids.has(tool.id)) problems.push(`${at}: id is used twice`)
    ids.add(tool.id)
    if (!BASE_RE.test(tool.base) || !fits(tool.base, LEN.path)) problems.push(`${at}: base "${tool.base}" must be an absolute lowercase path`)
    if (bases.has(tool.base)) problems.push(`${at}: base "${tool.base}" is used twice`)
    bases.add(tool.base)
    icon(`${at}: icon`, tool.icon)
    if (!fits(tool.label, LEN.label, 1)) problems.push(`${at}: label must be 1–${LEN.label} characters`)
    if (!fits(tool.description, LEN.description)) problems.push(`${at}: description is over ${LEN.description} characters`)
    if (tool.listed !== 'everyone' && tool.listed !== 'signed-in') problems.push(`${at}: listed must be everyone or signed-in`)

    most(`${at}: routes`, tool.routes, COUNT.routes)
    const paths = new Set<string>()
    for (const route of tool.routes) {
      const r = `${at}: route "${route.path}"`
      if (route.path.startsWith('/')) problems.push(`${r} must be relative to the base`)
      else if (!ROUTE_RE.test(route.path) || !fits(route.path, LEN.path)) problems.push(`${r} may only use name and :param segments`)
      if (!fits(route.title, LEN.label, 1)) problems.push(`${r} title must be 1–${LEN.label} characters`)
      if (route.auth !== 'none' && route.auth !== 'required') problems.push(`${r} auth must be none or required`)
      if (paths.has(route.path)) problems.push(`${r} is defined twice`)
      paths.add(route.path)
      if (!has(route.expose)) problems.push(`${r} names "${route.expose}", which is not in views`)
    }

    most(`${at}: launcher`, tool.launcher, COUNT.launcher)
    for (const entry of tool.launcher ?? []) {
      const l = `${at}: launcher "${entry.to}"`
      if (!PATH_RE.test(entry.to) || !fits(entry.to, LEN.path) || !under(tool.base, entry.to)) {
        problems.push(`${l} must be a plain path under ${tool.base}`)
      }
      if (!fits(entry.label, LEN.label, 1)) problems.push(`${l} label must be 1–${LEN.label} characters`)
      icon(`${l} icon`, entry.icon)
      name(`${l} section`, entry.section)
      if (!Number.isInteger(entry.order)) problems.push(`${l} order must be an integer`)
    }
  }

  most('slots.provides', def.slots?.provides, COUNT.slots)
  const provided = new Set<string>()
  for (const p of def.slots?.provides ?? []) {
    slot('slot', p.slot, p.props)
    if (!has(p.expose)) problems.push(`slot "${p.slot}" names "${p.expose}", which is not in views`)
    // A host renders one provider per service and props version.
    const key = `${p.slot}@${p.props}`
    if (provided.has(key)) problems.push(`slot "${p.slot}" props ${p.props} is provided twice`)
    provided.add(key)
  }
  most('slots.hosts', def.slots?.hosts, COUNT.slots)
  for (const h of def.slots?.hosts ?? []) slot('hosted slot', h.slot, h.props)

  most('requires', def.requires, COUNT.requires)
  for (const r of def.requires ?? []) {
    name('required service', r.service)
    if (!positive(r.contract)) problems.push(`required service "${r.service}": contract must be a positive integer`)
  }
  if (def.feedback && (!REPO_RE.test(def.feedback.repo) || !fits(def.feedback.repo, LEN.path))) {
    problems.push(`feedback repo "${def.feedback.repo}" must be owner/repo`)
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
