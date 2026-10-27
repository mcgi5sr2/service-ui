vi.mock('../auth', () => ({ invalidateUser: vi.fn() }))

import { invalidateUser } from '../auth'
import { ApiError, createClient, isUnknown, setApiBase } from './client'

function mockResponse(opts: { ok: boolean; status: number; body?: string }) {
  return { ok: opts.ok, status: opts.status, text: async () => opts.body ?? '' } as Response
}

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
  vi.mocked(invalidateUser).mockClear()
  setApiBase('svc', '/svc/svc')
})

describe('createClient', () => {
  it('prefixes the registered base and parses JSON', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, body: JSON.stringify([{ id: 1 }]) }))
    const data = await createClient('svc').get<{ id: number }[]>('/api/things')
    expect(data).toEqual([{ id: 1 }])
    expect(fetchMock.mock.calls[0]![0]).toBe('/svc/svc/api/things')
  })

  it('resolves the base at request time, not at creation', async () => {
    const api = createClient('late') // created before any base exists
    setApiBase('late', '')
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, body: '[]' }))
    await api.get('/api/x')
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/x')
  })

  it('fails loudly when no base was registered', async () => {
    await expect(createClient('nobody').get('/api/x')).rejects.toThrow(/no API base registered/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows a doubled slash behind a non-empty base: it stays a same-origin path', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, body: '{}' }))
    await createClient('svc').get('//not-a-host/x')
    expect(fetchMock.mock.calls[0]![0]).toBe('/svc/svc//not-a-host/x')
  })

  it('refuses a base that would leave the origin or the path it names', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'svc', '/svc/', '/svc/..', '/svc/%2e%2e', '/a b']) {
      expect(() => setApiBase('other', bad), bad).toThrow(/must be/)
    }
  })

  it('refuses to re-point a registered service elsewhere', () => {
    setApiBase('svc', '/svc/svc') // same value again is fine (e.g. hot reload)
    expect(() => setApiBase('svc', '/svc/other')).toThrow(/already/)
  })

  it('refuses paths that leave the origin or climb out of the service base', async () => {
    setApiBase('root', '')
    const escapes: [string, string][] = [
      ['root', '//evil.example/x'],
      ['root', '/\\evil.example/x'],
      ['svc', '/../other/api/x'],
      ['svc', '/%2e%2e/other/api/x'],
      ['svc', '/api/../../other/x'],
    ]
    for (const [service, path] of escapes) {
      await expect(createClient(service).get(path), path).rejects.toThrow(/escapes|must start/)
    }
    await expect(createClient('svc').get('api/x')).rejects.toThrow(/must start with/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reports a missing base as a wiring error, not as "service unreachable"', async () => {
    const err = await createClient('unwired').get('/api/x').catch((e: unknown) => e)
    expect(err).not.toBeInstanceOf(ApiError)
  })

  it('pins credentials to same-origin', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, body: '{}' }))
    await createClient('svc').get('/api/x')
    expect(fetchMock.mock.calls[0]![1].credentials).toBe('same-origin')
  })

  it('keeps error text short and drops HTML error pages', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false, status: 500, body: 'x'.repeat(1000) }))
    const long = (await createClient('svc').get('/api/x').catch((e: unknown) => e)) as ApiError
    expect(long.message.length).toBeLessThanOrEqual(301)

    fetchMock.mockResolvedValueOnce({
      ...mockResponse({ ok: false, status: 502, body: '<html>stack trace</html>' }),
      headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
    } as Response)
    const html = (await createClient('svc').get('/api/x').catch((e: unknown) => e)) as ApiError
    expect(html.message).toBe('Request failed: 502')
  })

  it('sends no Authorization header — the session cookie is the credential', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, body: '{}' }))
    await createClient('svc').post('/api/x', { a: 1 })
    const [, init] = fetchMock.mock.calls[0]!
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
    expect(init.body).toBe('{"a":1}')
  })

  it('drops empty query params and serialises the rest', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, body: '[]' }))
    await createClient('svc').get('/api/x', { query: { a: 'y', b: undefined, c: '', d: 3 } })
    expect(fetchMock.mock.calls[0]![0]).toBe('/svc/svc/api/x?a=y&d=3')
  })

  it('maps 401 to a friendly ApiError and drops the cached identity', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 401 }))
    await expect(createClient('svc').get('/api/x')).rejects.toMatchObject({ status: 401 })
    expect(invalidateUser).toHaveBeenCalledOnce()
  })

  it('throws ApiError with the response body on other non-2xx', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: false, status: 500, body: 'boom' }))
    await expect(createClient('svc').get('/api/x')).rejects.toThrowError(new ApiError(500, 'boom'))
  })

  it('normalises a network failure to status 0', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(createClient('svc').get('/api/x')).rejects.toMatchObject({ status: 0 })
  })

  it('turns a non-JSON 2xx (e.g. an SPA fallback page) into an unknown ApiError', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, body: '<!doctype html>' }))
    const err = (await createClient('svc').get('/api/x').catch((e: unknown) => e)) as ApiError
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(0)
    expect(isUnknown(err)).toBe(true)
  })

  it('returns undefined for 204 without parsing', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 204 }))
    await expect(createClient('svc').del('/api/x/1')).resolves.toBeUndefined()
  })

  it('passes an abort signal through', async () => {
    fetchMock.mockResolvedValue(mockResponse({ ok: true, status: 200, body: '{}' }))
    const ctrl = new AbortController()
    await createClient('svc').get('/api/x', { signal: ctrl.signal })
    expect(fetchMock.mock.calls[0]![1].signal).toBe(ctrl.signal)
  })
})

describe('isUnknown', () => {
  it('separates "could not find out" from real answers', () => {
    for (const s of [0, 502, 503, 504]) expect(isUnknown(new ApiError(s, '')), String(s)).toBe(true)
    for (const s of [400, 401, 403, 404, 500]) expect(isUnknown(new ApiError(s, '')), String(s)).toBe(false)
    expect(isUnknown(new TypeError('x'))).toBe(true)
  })
})
