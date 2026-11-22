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

  it('logout toasts the default message, and a custom one when the session expired', () => {
    const store = loggedIn('customer')
    store.cerrarSesion()
    expect(store.notificacion.texto).toBe('Has cerrado sesión.')
    store.cerrarSesion('Tu sesión expiró. Inicia sesión de nuevo.')
    expect(store.notificacion.texto).toBe('Tu sesión expiró. Inicia sesión de nuevo.')
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

function serverPost(paymentStatus = 'pagado') {
  post.mockImplementation(async (url: string, body: Record<string, unknown>) => {
    if (url === '/orders/') return { data: { ...order, code: 'PED-7', payment_method: body.payment_method, total: 12, subtotal: 10, delivery_fee: 2 } }
    if (url === '/payments/') {
      return {
        data: {
          code: 'TX-9100', order_code: body.order_code, merchant_name: 'Comercio Nueve', customer_name: 'Ana',
          method: body.method, subtotal: 10, delivery_fee: 2, commission: 1.2, total: 12,
          status: body.method === 'contr_entrega' ? 'pendiente' : paymentStatus,
          provider_reference: body.method === 'contr_entrega' ? 'COD-1' : 'YPY-1', created_at: '2026-01-01T10:00:00Z',
        },
      }
    }
    throw new Error(`unexpected ${url}`)
  })
}

describe('crearPedido wire payload and promo mapping', () => {
  async function ready(products: unknown[] = [product]) {
    serve({ '/catalog/products': products })
    serverPost()
    const store = loggedIn('customer')
    await store.sincronizarConBackend()
    store.zonaSeleccionada = 'z1'
    return store
  }

  const sent = () => post.mock.calls.find((c) => c[0] === '/orders/')![1] as Record<string, unknown>
  const sentPayment = () => post.mock.calls.find((c) => c[0] === '/payments/')![1] as Record<string, unknown>

  it('electronic checkout sends yappy and no price, fee or name fields', async () => {
    const store = await ready()
    store.agregarAlCarrito('c9', store.productosDe('c9')[0], 2, 'sin sal')
    await store.crearPedido({ direccion: 'Calle 45', metodoPago: 'electronico', observaciones: 'timbre' })
    expect(sent()).toEqual({
      merchant_code: 'c9',
      zone_slug: 'z1',
      delivery_address: 'Calle 45',
      notes: 'timbre',
      payment_method: 'yappy',
      items: [{ product_code: 'p1', quantity: 2, notes: 'sin sal' }],
    })
  })

  it('cash on delivery sends contr_entrega with the same trimmed shape', async () => {
    const store = await ready()
    store.agregarAlCarrito('c9', store.productosDe('c9')[0], 1, '')
    await store.crearPedido({ direccion: 'Calle 45', metodoPago: 'contr_entrega', observaciones: '' })
    expect(sent().payment_method).toBe('contr_entrega')
    expect(Object.keys(sent()).sort()).toEqual(['delivery_address', 'items', 'merchant_code', 'notes', 'payment_method', 'zone_slug'])
  })

  it('a pin travels as delivery_lat and delivery_lng next to the address', async () => {
    const store = await ready()
    store.agregarAlCarrito('c9', store.productosDe('c9')[0], 1, '')
    await store.crearPedido({ direccion: 'Calle 45', lat: 8.9824, lng: -79.5199, metodoPago: 'contr_entrega', observaciones: '' })
    expect(sent()).toMatchObject({ delivery_address: 'Calle 45', delivery_lat: 8.9824, delivery_lng: -79.5199 })
  })

  it.each([
    ['null coordinates', { lat: null, lng: null }],
    ['only the latitude', { lat: 8.9824, lng: null }],
    ['only the longitude', { lat: undefined, lng: -79.5199 }],
  ])('%s send neither coordinate key (both or none)', async (_n, pin) => {
    const store = await ready()
    store.agregarAlCarrito('c9', store.productosDe('c9')[0], 1, '')
    await store.crearPedido({ direccion: 'Calle 45', ...pin, metodoPago: 'contr_entrega', observaciones: '' })
    expect(Object.keys(sent())).not.toContain('delivery_lat')
    expect(Object.keys(sent())).not.toContain('delivery_lng')
  })

  it.each([
    ['electronico', 'yappy', 'pagado', 'YPY-1'],
    ['contr_entrega', 'contr_entrega', 'pendiente', 'COD-1'],
  ])('%s: POST /orders then POST /payments with the server order code and no amounts', async (ui, wire, estadoPago, ref) => {
    const store = await ready()
    store.agregarAlCarrito('c9', store.productosDe('c9')[0], 1, '')
    const pedido = await store.crearPedido({ direccion: 'Calle 45', metodoPago: ui, observaciones: '' })
    expect(post.mock.calls.map((c) => c[0])).toEqual(['/orders/', '/payments/'])
    expect(sentPayment()).toEqual({ order_code: 'PED-7', method: wire })
    expect(pedido.id).toBe('PED-7')
    expect(pedido.total).toBe(12)
    expect(pedido.pagoEstado).toBe(estadoPago)
    expect(pedido.referenciaPasarela).toBe(ref)
    expect(store.pedidos[0].id).toBe('PED-7')
    expect(store.transacciones[0]).toMatchObject({ id: 'TX-9100', pedidoId: 'PED-7' })
    expect(store.carrito).toEqual([])
  })

  it('a failed electronic payment shows the order cancelled with the reason', async () => {
    const store = await ready()
    serverPost('fallido')
    store.agregarAlCarrito('c9', store.productosDe('c9')[0], 1, '')
    const pedido = await store.crearPedido({ direccion: 'Calle 45', metodoPago: 'electronico', observaciones: '' })
    expect(pedido.pagoEstado).toBe('fallido')
    expect(pedido.estado).toBe('cancelado')
    expect(pedido.motivoCancelacion).toBe('Pago electrónico rechazado')
    expect(store.transacciones[0].estado).toBe('rechazado')
  })

  it('does not call payments and keeps the cart when the order POST fails', async () => {
    const store = await ready()
    post.mockRejectedValue(Object.assign(new Error('boom'), { response: { status: 400 } }))
    store.agregarAlCarrito('c9', store.productosDe('c9')[0], 1, '')
    const pedido = await store.crearPedido({ direccion: 'Calle 45', metodoPago: 'electronico', observaciones: '' })
    expect(pedido).toBeNull()
    expect(post.mock.calls.map((c) => c[0])).toEqual(['/orders/'])
    expect(store.carrito).toHaveLength(1)
    expect(store.pedidos.some((p: { id: string }) => p.id.startsWith('ORD'))).toBe(false)
  })

  it('anonymous checkout sends nothing and keeps the cart', async () => {
    const store = await ready()
    store.agregarAlCarrito('c9', store.productosDe('c9')[0], 1, '')
    store.autenticado = false
    expect(await store.crearPedido({ direccion: 'Calle 45', metodoPago: 'contr_entrega', observaciones: '' })).toBeNull()
    expect(post).not.toHaveBeenCalled()
    expect(store.carrito).toHaveLength(1)
  })

  it('maps a positive promo_price into the effective price used by the cart', async () => {
    const store = await ready([{ ...product, promo_price: 4 }])
    expect(store.productosDe('c9')[0].precio).toBe(4)
    store.agregarAlCarrito('c9', store.productosDe('c9')[0], 3, '')
    expect(store.carritoSubtotal).toBe(12)
  })

  it.each([[null], [0]])('promo_price %s keeps the regular price', async (promo) => {
    const store = await ready([{ ...product, promo_price: promo }])
    expect(store.productosDe('c9')[0].precio).toBe(5)
  })

  it('keeps the regular price and category for catalog browsing and promo display', async () => {
    const store = await ready([{ ...product, promo_price: 4, category: 'Especiales' }])
    expect(store.productosDe('c9')[0]).toMatchObject({
      precio: 4,
      precioRegular: 5,
      categoria: 'Especiales',
    })
  })
})
