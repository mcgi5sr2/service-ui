import { invalidateUser } from '../auth'

/**
 * Thrown for any non-2xx response, a 2xx whose body isn't the JSON asked for, AND a
 * request that never reached the server.
 *
 * `status` is the HTTP code, or **0** when no usable answer came back — fetch itself
 * threw (network down, DNS, aborted), or a 2xx arrived that wasn't the JSON asked for
 * (a proxy or SPA fallback answering for a route that isn't there). That distinction is load-bearing for callers: a 404 means the thing is
 * genuinely not there, while 0 (or a 502/503 from a proxy with no backend) means we
 * could not tell. Rendering the second as the first turns "the service is down" into
 * a confident, wrong "you have nothing".
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * True when an error means "we could not find out" rather than a real answer: the
 * request never arrived (0), a proxy had no healthy backend (502/503/504), or it
 * wasn't an ApiError at all. Render these with WarnState, never as empty.
 */
export function isUnknown(err: unknown): boolean {
  return !(err instanceof ApiError) || [0, 502, 503, 504].includes(err.status)
}

// ---------------------------------------------------------------------------
// API base registry
//
// The same page build runs standalone (its API is on its own origin, at the root)
// and inside a shell (its API is behind the shell's edge at /svc/<name>). The
// wrapper that starts the UI records which, once, before any page runs:
//
//   standalone:  setApiBase('my-service', '')
//   in a shell:  setApiBase('my-service', '/svc/my-service')
//
// Clients look the base up at request time, not at creation, so a module-level
// `const api = createClient('my-service')` works however early it is evaluated.
// Keyed by service, because inside a shell one shared registry serves every UI.
// ---------------------------------------------------------------------------

const bases = new Map<string, string>()

// '' or plain path segments: no scheme, no '//' or '\\' (browsers read both as a new
// host), no dot segments, no encoding tricks, no trailing slash.
const BASE_RE = /^(?:\/[A-Za-z0-9_~-][A-Za-z0-9._~-]*)*$/

/** Record where `service`'s API lives: '' (same origin, at the root) or a path like /svc/name. */
export function setApiBase(service: string, base: string): void {
  if (!BASE_RE.test(base) || /(^|\/)\.\.?(\/|$)/.test(base)) {
    throw new Error(`service-ui: API base for "${service}" must be '' or a path like /svc/name, got "${base}"`)
  }
  const existing = bases.get(service)
  if (existing !== undefined && existing !== base) {
    // Two wrappers disagreeing about one service is a wiring bug; don't let the
    // later one silently redirect the earlier one's requests.
    throw new Error(`service-ui: API base for "${service}" is already "${existing}", refusing "${base}"`)
  }
  bases.set(service, base)
}

/**
 * Resolve base + path against this page and insist it stays on this origin and
 * under the service's base. String checks alone miss what the URL parser does:
 * '\\' becomes '/', and '..' or '%2e%2e' climbs out of /svc/a into /svc/b.
 */
function resolve(service: string, path: string, query: string): string {
  const base = baseFor(service)
  if (!path.startsWith('/')) {
    throw new Error(`service-ui: request path must start with '/', got "${path}"`)
  }
  const url = new URL(base + path + query, window.location.origin)
  if (url.origin !== window.location.origin || (base !== '' && !url.pathname.startsWith(base + '/'))) {
    throw new Error(`service-ui: request path "${path}" escapes the "${service}" API`)
  }
  return url.pathname + url.search
}

function baseFor(service: string): string {
  const base = bases.get(service)
  if (base === undefined) {
    // A programming error, not a runtime condition: fail loudly at the first request.
    throw new Error(`service-ui: no API base registered for "${service}" — start the UI through a service-ui wrapper`)
  }
  return base
}

// ---------------------------------------------------------------------------

type QueryValue = string | number | boolean | undefined | null
export interface RequestOptions {
  headers?: Record<string, string>
  /** Query params; undefined / null / '' entries are dropped. */
  query?: Record<string, QueryValue>
  /** Abort the request (e.g. on unmount, or a timeout via AbortSignal.timeout(ms)). */
  signal?: AbortSignal
}

const MAX_ERROR_TEXT = 300

/**
 * A short, plain message from an error response. Pages render ApiError.message to
 * the user, so an HTML error page or a long stack trace must not come through
 * whole: HTML is replaced by the status, and anything else is capped.
 */
async function errorText(res: Response): Promise<string> {
  const fallback = `Request failed: ${res.status}`
  if (res.headers?.get('Content-Type')?.includes('text/html')) return fallback
  const text = (await res.text().catch(() => '')).trim()
  if (!text) return fallback
  return text.length > MAX_ERROR_TEXT ? `${text.slice(0, MAX_ERROR_TEXT)}…` : text
}

function buildQuery(query?: Record<string, QueryValue>): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Build a typed API client for one service. Paths are the service's own routes,
 * exactly as its backend serves them:
 *
 *   const api = createClient('my-service')
 *   api.get<Foo[]>('/api/foo')                       // parsed JSON, throws ApiError
 *   api.get<Foo[]>('/api/foo', { query: { q } })
 *
 * The session cookie is the only credential, and same-origin fetches send it on
 * their own — there is no token to attach. `req` throws {@link ApiError} on any
 * non-2xx (401 gets a friendly message and drops the cached identity), returns
 * `undefined` for empty/204 bodies, and otherwise parses JSON.
 */
export function createClient(service: string) {
  async function raw(method: string, path: string, body?: unknown, options?: RequestOptions): Promise<Response> {
    const url = resolve(service, path, buildQuery(options?.query))
    const hasBody = body !== undefined
    let res: Response
    try {
      res = await fetch(url, {
        method,
        headers: { ...(hasBody && { 'Content-Type': 'application/json' }), ...options?.headers },
        body: hasBody ? JSON.stringify(body) : undefined,
        signal: options?.signal,
        // The default, stated so nothing can widen it: the session cookie only
        // ever goes to this origin.
        credentials: 'same-origin',
      })
    } catch (e) {
      // Network / DNS failure or abort — normalise to ApiError (status 0) so callers
      // can rely on the "throws ApiError" contract uniformly.
      throw new ApiError(0, e instanceof Error ? e.message : 'Network request failed')
    }
    if (res.status === 401) {
      // The one place that observes a session dying: drop the cached identity so
      // the next guard check re-asks the server instead of trusting a stale signed-in.
      invalidateUser()
      throw new ApiError(401, 'Not authenticated — please sign in.')
    }
    if (!res.ok) {
      throw new ApiError(res.status, await errorText(res))
    }
    return res
  }

  async function req<T>(method: string, path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    const res = await raw(method, path, body, options)
    // Empty body (incl. 204) parses to undefined; JSON otherwise.
    const text = await res.text()
    if (!text) return undefined as T
    try {
      return JSON.parse(text) as T
    } catch {
      // A 2xx that isn't JSON is usually a proxy or SPA fallback answering for a
      // route that doesn't exist (index.html, 200). That's "could not tell", not an
      // answer: status 0, and the ApiError contract rather than a SyntaxError.
      throw new ApiError(0, `Expected JSON from ${method} ${path}, got something else`)
    }
  }

  return {
    get: <T>(path: string, options?: RequestOptions) => req<T>('GET', path, undefined, options),
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => req<T>('POST', path, body, options),
    put: <T>(path: string, body?: unknown, options?: RequestOptions) => req<T>('PUT', path, body, options),
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) => req<T>('PATCH', path, body, options),
    // DELETE takes an optional body: a destructive endpoint may reasonably demand a
    // typed confirmation in the payload rather than a query string, where it would end up
    // in access logs and browser history.
    del: <T>(path: string, body?: unknown, options?: RequestOptions) => req<T>('DELETE', path, body, options),
    // Raw text GET — downloads/exports, where the body is a file, not JSON to parse.
    // Same error handling as everything else.
    text: (path: string, options?: RequestOptions) => raw('GET', path, undefined, options).then((r) => r.text()),
  }
}

export type ApiClient = ReturnType<typeof createClient>
