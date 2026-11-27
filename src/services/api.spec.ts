import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import api, { tokenStorage, setSessionExpiredHandler } from './api'

function respond(status: number, config: InternalAxiosRequestConfig) {
  const response = { status, statusText: '', data: {}, headers: {}, config }
  if (status < 400) return Promise.resolve(response)
  return Promise.reject(new AxiosError('fail', 'ERR_BAD_REQUEST', config, null, response))
}

function memoryStorage() {
  const data = new Map<string, string>()
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, String(v)),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  }
}

describe('session expired hook', () => {
  const handler = vi.fn()
  let calls: string[]

  beforeEach(() => {
    handler.mockReset()
    vi.stubGlobal('localStorage', memoryStorage())
    calls = []
    setSessionExpiredHandler(handler)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    setSessionExpiredHandler(null)
  })

  it('fires once and clears the tokens when the refresh is rejected', async () => {
    tokenStorage.setTokens('old-access', 'old-refresh')
    api.defaults.adapter = (config) => {
      calls.push(String(config.url))
      return respond(401, config)
    }
    vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('nope', 'ERR_BAD_REQUEST'))
    await expect(api.get('/orders/')).rejects.toBeTruthy()
    expect(handler).toHaveBeenCalledTimes(1)
    expect(tokenStorage.getAccessToken()).toBeNull()
    expect(tokenStorage.getRefreshToken()).toBeNull()
  })

  it('fires once even when two calls fail at the same time', async () => {
    tokenStorage.setTokens('old-access', 'old-refresh')
    api.defaults.adapter = (config) => respond(401, config)
    vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('nope', 'ERR_BAD_REQUEST'))
    await Promise.allSettled([api.get('/orders/'), api.get('/payments/')])
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('fires when an access token exists but there is no refresh token', async () => {
    localStorage.setItem('goeats_access_token', 'only-access')
    api.defaults.adapter = (config) => respond(401, config)
    await expect(api.get('/orders/')).rejects.toBeTruthy()
    expect(handler).toHaveBeenCalledTimes(1)
    expect(tokenStorage.getAccessToken()).toBeNull()
  })

  it('does NOT fire for an anonymous visitor (public sync 401)', async () => {
    api.defaults.adapter = (config) => respond(401, config)
    await expect(api.get('/zones/')).rejects.toBeTruthy()
    expect(handler).not.toHaveBeenCalled()
  })

  it('does NOT fire when the refresh succeeds and the call is retried', async () => {
    tokenStorage.setTokens('old-access', 'old-refresh')
    api.defaults.adapter = (config) => {
      calls.push(String(config.headers.Authorization))
      return respond(config.headers.Authorization === 'Bearer new-access' ? 200 : 401, config)
    }
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { access_token: 'new-access', refresh_token: 'new-refresh' } })
    const res = await api.get('/orders/')
    expect(res.status).toBe(200)
    expect(calls).toEqual(['Bearer old-access', 'Bearer new-access'])
    expect(tokenStorage.getRefreshToken()).toBe('new-refresh')
    expect(handler).not.toHaveBeenCalled()
  })

  it('does NOT fire for non-401 failures', async () => {
    tokenStorage.setTokens('a', 'r')
    api.defaults.adapter = (config) => respond(500, config)
    await expect(api.get('/orders/')).rejects.toBeTruthy()
    expect(handler).not.toHaveBeenCalled()
    expect(tokenStorage.getAccessToken()).toBe('a')
  })

  it('a throwing handler never masks the original rejection', async () => {
    tokenStorage.setTokens('a', 'r')
    handler.mockImplementation(() => {
      throw new Error('handler bug')
    })
    api.defaults.adapter = (config) => respond(401, config)
    vi.spyOn(axios, 'post').mockRejectedValue(new AxiosError('nope', 'ERR_BAD_REQUEST'))
    await expect(api.get('/orders/')).rejects.toMatchObject({ message: 'nope' })
  })
})

describe('request timeout', () => {
  it('waits long enough for a sleeping free-tier API to wake up (~1 min)', () => {
    expect(api.defaults.timeout).toBeGreaterThanOrEqual(60000)
  })
})
