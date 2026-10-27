import { createPinia, setActivePinia } from 'pinia'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const assign = vi.fn()

function me(body: unknown, ok = true) {
  return { ok, status: ok ? 200 : 502, json: async () => body } as Response
}

// The auth module keeps module-level cache state, so each test gets a fresh copy.
async function freshAuth() {
  vi.resetModules()
  return import('.')
}

beforeEach(() => {
  fetchMock.mockReset()
  assign.mockReset()
  vi.unstubAllEnvs()
  vi.stubEnv('VITE_DEV_USER', '')
  vi.stubGlobal('location', { ...window.location, pathname: '/tool/7', search: '?tab=a', hash: '', assign })
})

describe('getUser', () => {
  it('maps an authenticated /auth/me to a user', async () => {
    fetchMock.mockResolvedValue(me({ authenticated: true, sub: 's', email: 'a@b', name: 'Ada' }))
    const { getUser } = await freshAuth()
    expect(await getUser()).toEqual({ sub: 's', email: 'a@b', name: 'Ada' })
  })

  it('returns null when signed out', async () => {
    fetchMock.mockResolvedValue(me({ authenticated: false }))
    const { getUser } = await freshAuth()
    expect(await getUser()).toBeNull()
  })

  it('single-flights concurrent callers and caches the answer', async () => {
    fetchMock.mockResolvedValue(me({ authenticated: true, email: 'a@b' }))
    const { getUser } = await freshAuth()
    await Promise.all([getUser(), getUser(), getUser()])
    await getUser()
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('treats an unreachable server or a non-2xx as signed out, never throwing', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    let { getUser } = await freshAuth()
    expect(await getUser()).toBeNull()

    fetchMock.mockResolvedValueOnce(me('<html>', false))
    ;({ getUser } = await freshAuth())
    expect(await getUser()).toBeNull()
  })

  it('caches failures only briefly', async () => {
    vi.useFakeTimers()
    try {
      fetchMock.mockRejectedValueOnce(new TypeError('down'))
      const { getUser } = await freshAuth()
      await getUser()
      fetchMock.mockResolvedValue(me({ authenticated: true, email: 'a@b' }))
      await getUser() // still inside the 5 s error window
      expect(fetchMock).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(5_001)
      expect(await getUser()).toEqual({ email: 'a@b', sub: undefined, name: undefined })
    } finally {
      vi.useRealTimers()
    }
  })

  it('invalidateUser forces a refetch, and a fetch begun before it cannot repopulate the cache', async () => {
    let release!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (release = r)))
    const { getUser, invalidateUser } = await freshAuth()
    const stale = getUser() // in flight, signed in
    invalidateUser() // the session died meanwhile
    release(me({ authenticated: true, email: 'stale@b' }))
    await stale

    fetchMock.mockResolvedValueOnce(me({ authenticated: false }))
    expect(await getUser()).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('answers with the dev identity when VITE_DEV_USER is set in dev', async () => {
    vi.stubEnv('VITE_DEV_USER', 'dev@local')
    const { getUser } = await freshAuth()
    expect(await getUser()).toEqual({ email: 'dev@local', name: 'Local dev' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('navigation', () => {
  it('login returns to the current location by default', async () => {
    const { login } = await freshAuth()
    login()
    expect(assign).toHaveBeenCalledWith('/auth/login?returnTo=%2Ftool%2F7%3Ftab%3Da')
  })

  it('stepUp asks the server for a fresh authentication', async () => {
    const { stepUp } = await freshAuth()
    stepUp('/danger')
    expect(assign).toHaveBeenCalledWith('/auth/login?returnTo=%2Fdanger&stepUp=1')
  })

  it('never navigates off-origin, whatever destination it is handed', async () => {
    const { login, logout } = await freshAuth()
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/x\nSet-Cookie']) {
      login(bad)
      expect(assign).toHaveBeenLastCalledWith('/auth/login?returnTo=%2F')
      fetchMock.mockResolvedValue({ ok: true } as Response)
      await logout(bad)
      expect(assign).toHaveBeenLastCalledWith('/')
    }
  })

  it('logout leaves the page even when the POST fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('down'))
    const { logout } = await freshAuth()
    await logout()
    expect(fetchMock).toHaveBeenCalledWith('/auth/logout', { method: 'POST' })
    expect(assign).toHaveBeenCalledWith('/')
  })
})

describe('session store', () => {
  it('exposes name, email and initials from the identity', async () => {
    fetchMock.mockResolvedValue(me({ authenticated: true, email: 'ada@b', name: 'Ada Lovelace' }))
    await freshAuth()
    const { useSessionStore } = await import('./session')
    setActivePinia(createPinia())
    const session = useSessionStore()
    await session.load()
    expect(session.signedIn).toBe(true)
    expect(session.name).toBe('Ada Lovelace')
    expect(session.initials).toBe('AL')
  })

  it('re-reads by itself when the identity is invalidated (e.g. a 401)', async () => {
    fetchMock.mockResolvedValueOnce(me({ authenticated: true, email: 'ada@b' }))
    const { invalidateUser } = await freshAuth()
    const { useSessionStore } = await import('./session')
    setActivePinia(createPinia())
    const session = useSessionStore()
    await session.load()
    expect(session.signedIn).toBe(true)

    fetchMock.mockResolvedValueOnce(me({ authenticated: false }))
    invalidateUser()
    await vi.waitFor(() => expect(session.signedIn).toBe(false))
  })

  it('a slow load that started before an invalidation cannot overwrite the newer answer', async () => {
    let release!: (r: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((r) => (release = r)))
    const { invalidateUser } = await freshAuth()
    const { useSessionStore } = await import('./session')
    setActivePinia(createPinia())
    const session = useSessionStore()
    const slow = session.load() // e.g. the layout's mount-time load

    fetchMock.mockResolvedValueOnce(me({ authenticated: false }))
    invalidateUser() // a 401 arrives meanwhile; the watcher re-loads
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    release(me({ authenticated: true, email: 'dead@session' }))
    await slow
    await vi.waitFor(() => expect(session.signedIn).toBe(false))
    expect(session.email).toBeNull()
  })

  it('initialsOf copes with emails and empty input', async () => {
    const { initialsOf } = await import('./session')
    expect(initialsOf('ada@b')).toBe('A')
    expect(initialsOf('')).toBe('')
  })
})
