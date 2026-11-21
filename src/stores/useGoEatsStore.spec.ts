import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
const tokenStorage = vi.hoisted(() => ({
  setTokens: vi.fn(),
  clear: vi.fn(),
  getAccessToken: vi.fn(),
  getRefreshToken: vi.fn(),
}))
vi.mock('../services/api', () => ({
  default: { get, post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  api: { get, post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage,
}))

// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from './useGoEatsStore'

const PUBLIC = ['/zones/', '/merchants/', '/delivery/couriers', '/catalog/products']

const zone = { slug: 'z1', name: 'Zona Uno', delivery_fee: 2, distance_km: 3 }
const merchant = { code: 'c9', name: 'Comercio Nueve', category_type: 'Restaurante', zone_slug: 'z1', rating: 4, delivery_time: '20', is_open: true, affiliation_status: 'activo', opens_at: '08:00', closes_at: '20:00', description: '', icon: '' }
const product = { code: 'p1', merchant_code: 'c9', name: 'Plato', price: 5, description: '', category: 'x', is_available: true }
const order = { code: 'PED-1', merchant_code: 'c9', merchant_name: 'Comercio Nueve', customer_name: 'Ana', customer_phone: '', zone_slug: 'z1', delivery_address: 'Calle', items: [], subtotal: 5, delivery_fee: 2, total: 7, status: 'pendiente', payment_method: 'contr_entrega', courier_code: null, notes: '', cancellation_reason: null, rating: null, created_at: '2026-01-01T10:00:00Z' }

function forbidden() {
  return Object.assign(new Error('Forbidden'), { response: { status: 403 } })
}

function serve(overrides: Record<string, unknown> = {}) {
  const table: Record<string, unknown> = {
    '/zones/': [zone],
    '/merchants/': [merchant],
    '/delivery/couriers': [],
    '/catalog/products': [product],
    '/orders/': [order],
    ...overrides,
  }
  get.mockImplementation(async (url: string) => {
    const value = table[url]
    if (value instanceof Error) throw value
    if (value === undefined) throw Object.assign(new Error('nope'), { response: { status: 404 } })
    return { data: value }
  })
}

const calls = () => get.mock.calls.map((c) => c[0] as string).sort()

function loggedIn(rol: string) {
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = rol
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  get.mockReset()
  post.mockReset()
  Object.values(tokenStorage).forEach((f) => f.mockReset())
})

describe('sincronizarConBackend', () => {
  it('anonymous calls only the public endpoints', async () => {
    serve()
    const store = useGoEatsStore()
    await store.sincronizarConBackend()
    expect(calls()).toEqual([...PUBLIC].sort())
    expect(store.comercios.map((c: { id: string }) => c.id)).toEqual(['c9'])
  })

  it.each([
    ['customer', ['/orders/']],
    ['merchant', ['/orders/', '/merchants/mine']],
    ['courier', ['/delivery/couriers/me', '/orders/']],
    ['accountant', ['/orders/', '/payments/', '/reports/audit-logs']],
    ['admin', ['/orders/', '/payments/', '/reports/audit-logs', '/users/arco']],
  ])('%s requests only its permitted private endpoints', async (rol, extra) => {
    serve({ '/merchants/mine': merchant, '/delivery/couriers/me': { code: 'r1' }, '/payments/': [], '/reports/audit-logs': [], '/users/arco': [] })
    const store = loggedIn(rol)
    await store.sincronizarConBackend()
    expect(calls()).toEqual([...PUBLIC, ...extra].sort())
  })

  it('a 403 on private calls does not drop zones, merchants or products', async () => {
    serve({
      '/payments/': forbidden(),
      '/users/arco': forbidden(),
      '/reports/audit-logs': forbidden(),
    })
    const store = loggedIn('admin')
    await store.sincronizarConBackend()
    expect(store.zonas.map((z: { id: string }) => z.id)).toEqual(['z1'])
    expect(store.comercios.map((c: { id: string }) => c.id)).toEqual(['c9'])
    expect(Object.keys(store.catalogo)).toEqual(['c9'])
    expect(store.pedidos.map((p: { id: string }) => p.id)).toEqual(['PED-1'])
  })

  it('an orders 403 keeps public data and shows no toast', async () => {
    serve({ '/orders/': forbidden() })
    const store = loggedIn('customer')
    await store.sincronizarConBackend()
    expect(store.comercios.map((c: { id: string }) => c.id)).toEqual(['c9'])
    expect(store.notificacion).toBeNull()
  })

  it('empty orders from the server replace the mock orders', async () => {
    serve({ '/orders/': [] })
    const store = loggedIn('customer')
    expect(store.pedidos.length).toBeGreaterThan(0)
    await store.sincronizarConBackend()
    expect(store.pedidos).toEqual([])
  })

  it('backend fully down: no toast, no throw', async () => {
    get.mockRejectedValue(new Error('Network Error'))
    const store = loggedIn('admin')
    await expect(store.sincronizarConBackend()).resolves.toBeUndefined()
    expect(store.notificacion).toBeNull()
  })

  it('merchant: stores the linked merchant from /merchants/mine', async () => {
    serve({ '/merchants/mine': merchant })
    const store = loggedIn('merchant')
    await store.sincronizarConBackend()
    expect(store.comercioPropio?.id).toBe('c9')
    expect(store.repartidorPropio).toBeNull()
  })

  it('merchant without link (404): comercioPropio is null', async () => {
    serve()
    const store = loggedIn('merchant')
    await store.sincronizarConBackend()
    expect(store.comercioPropio).toBeNull()
  })

  it('courier: stores the linked courier from /delivery/couriers/me', async () => {
    serve({
      '/delivery/couriers': [{ code: 'r7', name: 'Rita', phone: '1', zone_slug: 'z1', rating: 5, is_available: true, affiliation_status: 'activo' }],
      '/delivery/couriers/me': { code: 'r7' },
    })
    const store = loggedIn('courier')
    await store.sincronizarConBackend()
    expect(store.repartidorPropio?.id).toBe('r7')
    expect(store.comercioPropio).toBeNull()
  })

  it('courier without link (404): repartidorPropio is null', async () => {
    serve()
    const store = loggedIn('courier')
    await store.sincronizarConBackend()
    expect(store.repartidorPropio).toBeNull()
  })
})

describe('restaurarSesion', () => {
  it('no tokens: stays anonymous and does not call the API', async () => {
    tokenStorage.getAccessToken.mockReturnValue(null)
    const store = useGoEatsStore()
    await store.restaurarSesion()
    expect(get).not.toHaveBeenCalled()
    expect(store.autenticado).toBe(false)
  })

  it('token: GET /users/me restores user and role', async () => {
    tokenStorage.getAccessToken.mockReturnValue('tok')
    get.mockResolvedValue({ data: { id: 3, full_name: 'Héctor Endara', email: 'h@e.pa', phone: '6111-1111', role: 'merchant' } })
    const store = useGoEatsStore()
    await store.restaurarSesion()
    expect(get).toHaveBeenCalledWith('/users/me')
    expect(store.autenticado).toBe(true)
    expect(store.rol).toBe('merchant')
    expect(store.usuario.email).toBe('h@e.pa')
    expect(store.usuario.nombre).toBe('Héctor Endara')
  })

  it('401: becomes anonymous and clears the tokens', async () => {
    tokenStorage.getAccessToken.mockReturnValue('stale')
    get.mockRejectedValue(Object.assign(new Error('Unauthorized'), { response: { status: 401 } }))
    const store = useGoEatsStore()
    await store.restaurarSesion()
    expect(store.autenticado).toBe(false)
    expect(tokenStorage.clear).toHaveBeenCalledTimes(1)
  })

  it('network error: keeps the tokens and does not log out or show a toast', async () => {
    tokenStorage.getAccessToken.mockReturnValue('tok')
    get.mockRejectedValue(new Error('Network Error'))
    const store = useGoEatsStore()
    await store.restaurarSesion()
    expect(tokenStorage.clear).not.toHaveBeenCalled()
    expect(store.autenticado).toBe(false)
    expect(store.notificacion).toBeNull()
  })
})

describe('autenticarUsuario without offline fake login', () => {
  it('network error is a real error: stays anonymous, role untouched', async () => {
    post.mockRejectedValue(new Error('Network Error'))
    const store = useGoEatsStore()
    const res = await store.autenticarUsuario({ email: 'a@b.pa', password: 'x' })
    expect(res.ok).toBe(false)
    expect(res.mensaje).toMatch(/conectar/i)
    expect(store.autenticado).toBe(false)
    expect(store.rol).toBe('customer')
  })

  it('invalid credentials still return the server message', async () => {
    post.mockRejectedValue({ response: { status: 401, data: { detail: 'Credenciales inválidas.' } } })
    const store = useGoEatsStore()
    const res = await store.autenticarUsuario({ email: 'a@b.pa', password: 'x' })
    expect(res).toEqual({ ok: false, mensaje: 'Credenciales inválidas.' })
  })

  it('logout clears linked entities', async () => {
    serve({ '/merchants/mine': merchant })
    const store = loggedIn('merchant')
    await store.sincronizarConBackend()
    store.cerrarSesion()
    expect(store.comercioPropio).toBeNull()
    expect(store.autenticado).toBe(false)
  })
})

describe('canonical states in order actions', () => {
  function withOrders(estados: Record<string, string>) {
    const store = useGoEatsStore()
    store.pedidos = Object.entries(estados).map(([id, estado]) => ({
      id,
      estado,
      repartidorId: 'r1',
      comercioId: 'c1',
    }))
    return store
  }

  it('rechazarPedido stores rechazado with the reason (not cancelado) and sends the same value', async () => {
    const { default: api } = await import('../services/api')
    const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>
    apiPatch.mockReset()
    apiPatch.mockResolvedValue({ data: {} })
    const store = withOrders({ 'PED-1': 'pendiente' })
    store.rechazarPedido('PED-1', 'Sin insumos')
    expect(store.pedidos[0].estado).toBe('rechazado')
    expect(store.pedidos[0].motivoCancelacion).toBe('Sin insumos')
    expect(apiPatch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'rechazado', reason: 'Sin insumos' })
  })

  it('avanzarEstadoPedido sends the canonical value it stores', async () => {
    const { default: api } = await import('../services/api')
    const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>
    apiPatch.mockReset()
    apiPatch.mockResolvedValue({ data: {} })
    const store = withOrders({ 'PED-1': 'confirmado' })
    store.avanzarEstadoPedido('PED-1', 'en_preparacion')
    expect(store.pedidos[0].estado).toBe('en_preparacion')
    expect(apiPatch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'en_preparacion', reason: null })
  })

  it('siguienteEstado walks the canonical chain and stops at every terminal state', () => {
    const store = useGoEatsStore()
    expect(store.siguienteEstado('pendiente')).toBe('confirmado')
    expect(store.siguienteEstado('confirmado')).toBe('en_preparacion')
    expect(store.siguienteEstado('en_preparacion')).toBe('listo_para_recoger')
    expect(store.siguienteEstado('listo_para_recoger')).toBe('en_camino')
    expect(store.siguienteEstado('en_camino')).toBe('entregado')
    for (const t of ['entregado', 'rechazado', 'cancelado']) expect(store.siguienteEstado(t)).toBeNull()
    expect(store.siguienteEstado('en preparación')).toBeNull() // spaced variants are unknown
  })

  it('pedidosAsignadosA excludes every terminal state including rechazado', () => {
    const store = withOrders({ A: 'en_camino', B: 'rechazado', C: 'cancelado', D: 'entregado', E: 'listo_para_recoger' })
    expect(store.pedidosAsignadosA('r1').map((p: { id: string }) => p.id)).toEqual(['A', 'E'])
  })

  it('sync keeps canonical server states untouched, including rechazado with its reason', async () => {
    serve({ '/orders/': [{ ...order, status: 'rechazado', cancellation_reason: 'Cerrado' }] })
    const store = loggedIn('customer')
    await store.sincronizarConBackend()
    expect(store.pedidos[0].estado).toBe('rechazado')
    expect(store.pedidos[0].motivoCancelacion).toBe('Cerrado')
  })
})
