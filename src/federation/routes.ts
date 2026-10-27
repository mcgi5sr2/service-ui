import type { Component } from 'vue'
import type { NavigationGuard, RouteRecordRaw, Router } from 'vue-router'
import { isAuthenticated, login } from '../auth'
import type { RouteAuth, Tool } from './types'

declare module 'vue-router' {
  interface RouteMeta {
    /** Page title, for the top bar and the browser tab. */
    title?: string
    /** Opt out of the reading measure. */
    fullBleed?: boolean
    /** Whether a signed-out user is sent to log in first. */
    auth?: RouteAuth
    /** Id of the tool the route belongs to. */
    tool?: string
  }
}

/**
 * Route records for a list of tools: one parent per tool at its base, one child
 * per route. The standalone app and the shell both build their routes here, so a
 * route has the same path, params and meta in both modes; only where the view
 * module comes from differs (`resolve`).
 *
 * `layout` wraps every tool's pages; without one the parent renders its child
 * directly.
 */
export function toolRoutes(
  tools: Tool[],
  resolve: (expose: string) => () => Promise<Component>,
  layout?: Component,
): RouteRecordRaw[] {
  return tools.map((tool) => ({
    path: tool.base,
    ...(layout && { component: layout }),
    meta: { tool: tool.id },
    children: tool.routes.map((r) => ({
      path: r.path,
      component: resolve(r.expose),
      meta: { title: r.title, fullBleed: r.fullBleed ?? false, auth: r.auth },
    })),
  }))
}

/**
 * Router guard: a route with `auth: 'required'` sends a signed-out user to log in,
 * returning to the page they asked for. UX only — the backend is the enforcement
 * point, and a route marked 'none' says nothing about whether its API is open.
 */
export function requireSignIn(router: Router): NavigationGuard {
  return async (to) => {
    if (to.meta.auth !== 'required' || (await isAuthenticated())) return true
    login(router.resolve(to).href)
    return false
  }
}
