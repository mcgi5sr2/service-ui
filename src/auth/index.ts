/**
 * Browser half of the login flow.
 *
 * The browser never holds a token: the server (a standalone service running the
 * login feature, or the shell's edge) keeps the session and sets an httpOnly
 * cookie. This module only asks who is signed in (`GET /auth/me`) and navigates
 * to the server's `/auth/login` and `/auth/logout`. Paths are same-origin, so the
 * same code works standalone and inside a shell — whichever server served the
 * page answers them.
 *
 * Module state is deliberate: inside a shell, service-ui is one shared instance,
 * so every UI on the page shares one identity cache.
 */
import { readonly, shallowRef } from 'vue'

export interface User {
  sub?: string
  email?: string
  name?: string
}

/**
 * Local dev identity, for running a UI against a service in its dev-auth bypass.
 *
 * `VITE_DEV_USER=dev@local` in `.env.local` answers `getUser()` with a stub: no
 * session exists and none is needed, because a service in dev-auth mode treats
 * every caller as that user. Against a real service the stub is useless by
 * construction.
 *
 * Guarded by `import.meta.env.DEV`, so a production build strips this branch and
 * the variable does nothing there.
 */
function devUser(): User | null {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_USER
    ? { email: import.meta.env.VITE_DEV_USER, name: 'Local dev' }
    : null
}

// /auth/me is cheap but called from many places per page — cache briefly, and
// single-flight the fetch so a burst of concurrent callers (first page load)
// shares one request instead of stampeding the server. Failures cache too,
// shorter: while the server is down every call site must not pay its own timeout.
let cached: { user: User | null; at: number; ttl: number } | null = null
let inflight: Promise<User | null> | null = null
// Bumped by invalidateUser(); a fetch started before the bump must not write its
// (possibly pre-invalidation) answer into the cache, and waiters that joined it
// must not be joined by callers arriving after the bump.
let generation = 0
// The same counter, observable: anything mirroring the identity (the session
// store) watches it and re-reads, so a 401 anywhere updates every user menu.
const changes = shallowRef(0)
/** Bumped whenever the identity is invalidated. Watch it to re-read `getUser()`. */
export const identityChanges = readonly(changes)
const CACHE_MS = 60_000
const ERROR_CACHE_MS = 5_000

/** Drop the cached identity. Called by the API client when a request comes back
 *  401 — the one place that actually observes a session dying — so a route guard
 *  doesn't keep reporting signed-in until the TTL happens to lapse. */
export function invalidateUser(): void {
  cached = null
  inflight = null
  generation++
  changes.value = generation
}

async function fetchMe(gen: number): Promise<User | null> {
  // Only the fetch belonging to the current generation may write the cache.
  const remember = (user: User | null, ttl: number) => {
    if (gen === generation) cached = { user, at: Date.now(), ttl }
  }
  try {
    const res = await fetch('/auth/me', { headers: { Accept: 'application/json' } })
    // A non-2xx here is the server misbehaving, not an identity answer; treat it
    // like unreachable rather than parsing an error page.
    const me = res.ok ? await res.json() : null
    const user: User | null = me?.authenticated ? { sub: me.sub, email: me.email, name: me.name } : null
    remember(user, res.ok ? CACHE_MS : ERROR_CACHE_MS)
    return user
  } catch {
    // Unreachable, or a 2xx that wasn't JSON — signed-out is the safe answer, not a crash.
    remember(null, ERROR_CACHE_MS)
    return null
  } finally {
    if (gen === generation) inflight = null
  }
}

/** Who is signed in, or null. Never throws. */
export async function getUser(): Promise<User | null> {
  const dev = devUser()
  if (dev) return dev
  if (cached && Date.now() - cached.at < cached.ttl) return cached.user
  inflight ??= fetchMe(generation)
  return inflight
}

export async function isAuthenticated(): Promise<boolean> {
  return !!(await getUser())
}

/** The current location as a same-origin path — the default place to come back to. */
function here(): string {
  return window.location.pathname + window.location.search + window.location.hash
}

/**
 * Only a same-origin path may be a destination: '/x', never '//host', '/\\host',
 * 'https://…' or 'javascript:…'. Anything else falls back to '/'. The server
 * re-checks returnTo; this keeps the kit from being the open redirect itself.
 */
function safePath(to: string): string {
  return /^\/(?![/\\])/.test(to) && !/[\u0000-\u001f]/.test(to) ? to : '/'
}

function toLogin(returnTo: string, stepUp: boolean): void {
  const params = new URLSearchParams({ returnTo: safePath(returnTo) })
  if (stepUp) params.set('stepUp', '1')
  window.location.assign(`/auth/login?${params}`)
}

/**
 * Send the user to sign in, returning to `returnTo` (default: where they are).
 * The server validates `returnTo` as a same-origin path; this side just passes it.
 */
export function login(returnTo: string = here()): void {
  toLogin(returnTo, false)
}

/**
 * Force a real re-authentication before something destructive.
 *
 * The server turns `stepUp=1` into `prompt=login` + `max_age=0` at the identity
 * provider, which asks for credentials again even though a session is valid and
 * issues a fresh `auth_time` — which is what the service checks. A normal session
 * proves a session exists, not that a human is present.
 */
export function stepUp(returnTo: string = here()): void {
  toLogin(returnTo, true)
}

/**
 * Sign out and leave the page (default: to '/').
 *
 * A failed logout POST must not strand the user on the page: the local identity is
 * already dropped, so staying would show a signed-in UI for a session they believe
 * has ended. They leave either way; the server-side session then expires on its TTL.
 */
export async function logout(to = '/'): Promise<void> {
  invalidateUser()
  await fetch('/auth/logout', { method: 'POST' }).catch(() => {})
  window.location.assign(safePath(to))
}
