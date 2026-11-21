import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
const put = vi.hoisted(() => vi.fn())
const tokenStorage = vi.hoisted(() => ({ setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() }))
vi.mock('../services/api', () => ({
  default: { get, post, patch: vi.fn(), put, delete: vi.fn() },
  tokenStorage,
}))

// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from './useGoEatsStore'

function http(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } })
}

const BASE = { nombre: 'Ana', email: 'a@t.pa', telefono: '600' }

function withUser(extra: Record<string, unknown> = {}) {
  const store = useGoEatsStore()
  store.autenticado = true
  store.usuario = { ...BASE, consentimientoLey81: true, direccion: '', lat: null, lng: null, ...extra }
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const m of [get, post, put]) m.mockReset()
  tokenStorage.getAccessToken.mockReturnValue('tok')
})

describe('usuario mapping of the default delivery address', () => {
  const me = { id: 1, full_name: 'Ana', email: 'a@t.pa', phone: '600', role: 'customer' }

  it('restaurarSesion maps address, lat and lng', async () => {
    get.mockResolvedValue({ data: { ...me, address: 'Calle 50, Edificio X', lat: 8.9824, lng: -79.5199 } })
    const store = useGoEatsStore()
    await store.restaurarSesion()
    expect(store.usuario).toMatchObject({ direccion: 'Calle 50, Edificio X', lat: 8.9824, lng: -79.5199 })
  })

  it('restaurarSesion maps a user without a saved address to empty text and null coordinates', async () => {
    get.mockResolvedValue({ data: { ...me, address: null, lat: null, lng: null } })
    const store = useGoEatsStore()
    await store.restaurarSesion()
    expect(store.usuario).toMatchObject({ direccion: '', lat: null, lng: null })
    expect(store.usuario.lat).toBeNull()
  })

  it('login maps the caller own address too', async () => {
    post.mockResolvedValue({
      data: { access_token: 'a', refresh_token: 'r', user: { ...me, address: 'Av. Balboa', lat: 8.97, lng: -79.52 } },
    })
    get.mockResolvedValue({ data: [] })
    const store = useGoEatsStore()
    const r = await store.autenticarUsuario({ email: 'a@t.pa', password: 'x' })
    expect(r.ok).toBe(true)
    expect(store.usuario).toMatchObject({ direccion: 'Av. Balboa', lat: 8.97, lng: -79.52 })
  })
})

describe('guardarPerfil with address', () => {
  it('PUTs address, lat and lng next to the personal data and applies them', async () => {
    put.mockResolvedValue({ data: { address: 'Calle 50', lat: 8.98, lng: -79.5 } })
    const store = withUser()
    const r = await store.guardarPerfil({ ...BASE, direccion: 'Calle 50', lat: 8.98, lng: -79.5 })
    expect(r.ok).toBe(true)
    expect(put).toHaveBeenCalledWith('/users/me', { full_name: 'Ana', phone: '600', address: 'Calle 50', lat: 8.98, lng: -79.5 })
    expect(store.usuario).toMatchObject({ direccion: 'Calle 50', lat: 8.98, lng: -79.5 })
    expect(store.notificacion).toMatchObject({ texto: 'Perfil actualizado correctamente.' })
  })

  it('clearing sends address null and lat/lng null together', async () => {
    put.mockResolvedValue({ data: { address: null, lat: null, lng: null } })
    const store = withUser({ direccion: 'Calle 50', lat: 8.98, lng: -79.5 })
    await store.guardarPerfil({ ...BASE, direccion: '', lat: null, lng: null })
    expect(put).toHaveBeenCalledWith('/users/me', { full_name: 'Ana', phone: '600', address: null, lat: null, lng: null })
    expect(store.usuario).toMatchObject({ direccion: '', lat: null, lng: null })
  })

  it('never sends one coordinate without the other (a lone value clears both)', async () => {
    put.mockResolvedValue({ data: {} })
    const store = withUser()
    await store.guardarPerfil({ ...BASE, lat: 8.98, lng: null })
    const body = put.mock.calls[0][1]
    expect(body.lat).toBeNull()
    expect(body.lng).toBeNull()
  })

  it('a personal-data save does not touch the address keys', async () => {
    put.mockResolvedValue({ data: {} })
    const store = withUser({ direccion: 'Calle 50', lat: 8.98, lng: -79.5 })
    await store.guardarPerfil({ nombre: 'Ana B', email: 'a@t.pa', telefono: '601' })
    expect(Object.keys(put.mock.calls[0][1]).sort()).toEqual(['full_name', 'phone'])
    expect(store.usuario).toMatchObject({ nombre: 'Ana B', direccion: 'Calle 50', lat: 8.98, lng: -79.5 })
  })

  it('trims the address before sending it', async () => {
    put.mockResolvedValue({ data: {} })
    const store = withUser()
    await store.guardarPerfil({ ...BASE, direccion: '  Calle 50  ' })
    expect(put.mock.calls[0][1].address).toBe('Calle 50')
  })

  it('a failed write rolls the address back and shows the typed error', async () => {
    put.mockRejectedValue(http(422, { detail: [{ type: 'string_too_short', loc: ['body', 'address'], msg: 'x' }] }))
    const store = withUser({ direccion: 'Calle 50', lat: 8.98, lng: -79.5 })
    const r = await store.guardarPerfil({ ...BASE, direccion: 'Otra', lat: 9.1, lng: -79.4 })
    expect(r.ok).toBe(false)
    expect(r.error.kind).toBe('validation')
    expect(store.usuario).toEqual({ ...BASE, consentimientoLey81: true, direccion: 'Calle 50', lat: 8.98, lng: -79.5 })
    expect(store.notificacion).toMatchObject({ texto: 'Los datos no son válidos o la acción no está permitida.', tipo: 'error' })
  })

  it('a network failure rolls back too', async () => {
    put.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK', request: {} }))
    const store = withUser()
    const r = await store.guardarPerfil({ ...BASE, direccion: 'Calle 50', lat: 8.98, lng: -79.5 })
    expect(r.ok).toBe(false)
    expect(store.usuario).toMatchObject({ direccion: '', lat: null, lng: null })
    expect(store.notificacion?.tipo).toBe('error')
  })
})
