import type { Component } from 'vue'

/** The manifest contract major this kit speaks. Additive optional fields don't bump it. */
export const CONTRACT = 1

/** Whether signed-out users see a tool in the launcher / landing page. UX only. */
export type Listed = 'everyone' | 'signed-in'
/** Whether the router sends a signed-out user to log in before the route. UX only. */
export type RouteAuth = 'none' | 'required'

export interface ToolRoute {
  /** Relative to the tool's base: '' is the base itself, ':id/scoring' a child. */
  path: string
  title: string
  /** Name of the view module that renders it, a key of the definition's `views`. */
  expose: string
  auth: RouteAuth
  /** Opt out of the reading measure (canvases, maps). */
  fullBleed?: boolean
}

export interface LauncherEntry {
  label: string
  icon: string
  /** Absolute path; must fall under the tool's base. */
  to: string
  /** A section id from the shell's list; unknown ids land in "Other". */
  section: string
  order: number
}

export interface Tool {
  id: string
  label: string
  description: string
  /** PrimeIcons class, e.g. 'pi-chart-pie'. */
  icon: string
  /** Absolute path the tool's routes hang off, e.g. '/my-tool'. Unique fleet-wide. */
  base: string
  listed: Listed
  routes: ToolRoute[]
  launcher?: LauncherEntry[]
  /** Landing catalog tile; default true. */
  tile?: boolean
}

export interface SlotProvide {
  /** '<owner>.<slot>', owned by the host side. */
  slot: string
  expose: string
  /** The props version this provider renders. */
  props: number
}

/** A slot this service's pages render, and the props version they pass it. */
export interface SlotHost {
  slot: string
  props: number
}

export interface Requirement {
  service: string
  contract: number
}

/** The fields a service writes by hand: everything in its manifest that describes code. */
export interface ServiceUiFields {
  /** The service's registry name; also its API client key. */
  service: string
  tools: Tool[]
  slots?: { provides?: SlotProvide[]; hosts?: SlotHost[] }
  requires?: Requirement[]
  feedback?: { repo: string }
}

/** A view module: what `() => import('./views/List.vue')` resolves to. */
export type ViewLoader = () => Promise<Component | { default: Component }>

/**
 * The one source a service's UI is defined in. It drives the standalone router,
 * the remote entry the shell loads, and (at build time) the emitted manifest.json.
 */
export interface ServiceUiDefinition extends ServiceUiFields {
  /** Every module a route or slot provider can name, keyed by its expose name. */
  views: Record<string, ViewLoader>
}

/** `GET /ui/manifest.json`: the definition minus code, plus build-time fields. */
export interface Manifest extends ServiceUiFields {
  contract: number
  version: string
  build: string
  remote: { entry: string; shared: Record<string, string> }
}

/** What a remote entry's default export must look like. Built by `defineRemote`. */
export interface RemoteModule {
  contract: number
  service: string
  /** Called once by the shell before any view loads. */
  init(options: { apiBase: string }): void
  load(expose: string): Promise<Component>
}
