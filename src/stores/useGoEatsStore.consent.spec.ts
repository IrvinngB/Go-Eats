import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
const put = vi.hoisted(() => vi.fn())
vi.mock('../services/api', () => ({
  default: { get, post, patch: vi.fn(), put, delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from './useGoEatsStore'

function http(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const m of [get, post, put]) m.mockReset()
})

describe('consent state comes from the server', () => {
  it('starts unknown, never true', () => {
    expect(useGoEatsStore().usuario.consentimientoLey81).not.toBe(true)
  })

  it('login does not assume consent', async () => {
    post.mockResolvedValue({ data: { access_token: 'a', refresh_token: 'r', user: { full_name: 'Ana', email: 'a@t.pa', phone: '1', role: 'customer' } } })
    get.mockRejectedValue(http(401))
    const store = useGoEatsStore()
    await store.autenticarUsuario({ email: 'a@t.pa', password: 'x' })
    expect(store.usuario.consentimientoLey81).not.toBe(true)
  })

  it.each([[true], [false]])('cargarConsentimiento reflects accepted=%s', async (accepted) => {
    get.mockResolvedValue({ data: { accepted, policy_version: 'v1', accepted_at: '2026-01-01T10:00:00Z' } })
    const store = useGoEatsStore()
    const r = await store.cargarConsentimiento()
    expect(get).toHaveBeenCalledWith('/users/me/consent')
    expect(r.ok).toBe(true)
    expect(store.usuario.consentimientoLey81).toBe(accepted)
  })

  it('cargarConsentimiento failure leaves the state unknown and does not toast', async () => {
    get.mockRejectedValue(http(500))
    const store = useGoEatsStore()
    const r = await store.cargarConsentimiento()
    expect(r.ok).toBe(false)
    expect(store.usuario.consentimientoLey81).toBeNull()
    expect(store.notificacion).toBeNull()
  })

  it('cambiarConsentimiento PUTs the flag and keeps the server answer', async () => {
    put.mockResolvedValue({ data: { accepted: false, policy_version: 'v1', accepted_at: '2026-01-01T10:00:00Z' } })
    const store = useGoEatsStore()
    store.usuario.consentimientoLey81 = true
    const r = await store.cambiarConsentimiento(false)
    expect(put).toHaveBeenCalledWith('/users/me/consent', { accepted: false })
    expect(r.ok).toBe(true)
    expect(store.usuario.consentimientoLey81).toBe(false)
  })

  it('cambiarConsentimiento rolls back and toasts on failure', async () => {
    put.mockRejectedValue(http(500))
    const store = useGoEatsStore()
    store.usuario.consentimientoLey81 = true
    const r = await store.cambiarConsentimiento(false)
    expect(r.ok).toBe(false)
    expect(store.usuario.consentimientoLey81).toBe(true)
    expect(store.notificacion).toMatchObject({ texto: 'El servidor tuvo un problema. Inténtalo más tarde.', tipo: 'error' })
  })

  it('guardarPerfil never overwrites the consent state with a stale form copy', async () => {
    put.mockResolvedValue({ data: {} })
    const store = useGoEatsStore()
    store.usuario = { nombre: 'Ana', email: 'a@t.pa', telefono: '1', consentimientoLey81: false }
    await store.guardarPerfil({ nombre: 'Ana B', email: 'a@t.pa', telefono: '1', consentimientoLey81: true })
    expect(store.usuario.nombre).toBe('Ana B')
    expect(store.usuario.consentimientoLey81).toBe(false)
  })
})

describe('own ARCO history', () => {
  const row = (id: number, t = 'Acceso') => ({ id, user_id: 1, user_name: 'Ana', request_type: t, detail: 'detalle', status: 'pendiente', admin_response: null, created_at: '2026-01-01T10:00:00Z', resolved_at: null })

  it('cargarMisSolicitudesARCO maps GET /users/me/arco keeping the server order', async () => {
    get.mockResolvedValue({ data: [row(3, 'Oposición'), row(1)] })
    const store = useGoEatsStore()
    await store.cargarMisSolicitudesARCO()
    expect(get).toHaveBeenCalledWith('/users/me/arco')
    expect(store.misSolicitudesARCO.map((s: { id: number; tipo: string; estado: string }) => [s.id, s.tipo, s.estado])).toEqual([[3, 'Oposición', 'pendiente'], [1, 'Acceso', 'pendiente']])
  })

  it('enviarSolicitudARCO adds the server row on success and removes the optimistic one on failure', async () => {
    const store = useGoEatsStore()
    store.autenticado = true
    post.mockRejectedValueOnce(http(403, { detail: 'consent_required' }))
    const bad = await store.enviarSolicitudARCO('Acceso', 'detalle largo')
    expect(bad.ok).toBe(false)
    expect(store.misSolicitudesARCO).toHaveLength(0)
    post.mockResolvedValueOnce({ data: row(9, 'Cancelación') })
    const ok = await store.enviarSolicitudARCO('Cancelación', 'detalle largo')
    expect(ok.ok).toBe(true)
    expect(post).toHaveBeenLastCalledWith('/users/me/arco', { request_type: 'Cancelación', detail: 'detalle largo' })
    expect(store.misSolicitudesARCO.map((s: { id: number }) => s.id)).toEqual([9])
  })
})

describe('crearPedido is retry-safe and consent aware', () => {
  const orderBody = { code: 'PED-7', merchant_code: 'c9', merchant_name: 'C', customer_name: 'Ana', customer_phone: '', zone_slug: 'z1', delivery_address: 'Calle', items: [], subtotal: 5, delivery_fee: 2, total: 7, status: 'pendiente', payment_method: 'yappy', courier_code: null, notes: '', cancellation_reason: null, rating: null, created_at: '2026-01-01T10:00:00Z' }
  const payBody = { code: 'TX-9', order_code: 'PED-7', method: 'yappy', subtotal: 5, delivery_fee: 2, commission: 1, total: 7, status: 'pagado', provider_reference: 'YPY-1', created_at: '2026-01-01T10:00:00Z' }
  const datos = { direccion: 'Calle 45', metodoPago: 'electronico', observaciones: '' }
  const calls = (url: string) => post.mock.calls.filter((c) => c[0] === url)

  function withCart(qty = 2) {
    const store = useGoEatsStore()
    store.autenticado = true
    store.comercios = [{ id: 'c9', nombre: 'C' }]
    store.zonaSeleccionada = 'z1'
    store.agregarAlCarrito('c9', { id: 'p1', nombre: 'Plato', precio: 5 }, qty, '')
    return store
  }

  function payFailsOnce(err: unknown) {
    let payAttempts = 0
    post.mockImplementation(async (url: string) => {
      if (url === '/orders/') return { data: orderBody }
      payAttempts += 1
      if (payAttempts === 1) throw err
      return { data: payBody }
    })
  }

  it('POST /orders is called once across a failed payment and its retry', async () => {
    const store = withCart()
    payFailsOnce(http(500))
    expect(await store.crearPedido(datos)).toBeNull()
    const pedido = await store.crearPedido(datos)
    expect(calls('/orders/')).toHaveLength(1)
    expect(calls('/payments/')).toHaveLength(2)
    expect(calls('/payments/')[1][1]).toEqual({ order_code: 'PED-7', method: 'yappy' })
    expect(pedido.id).toBe('PED-7')
    expect(pedido.pagoEstado).toBe('pagado')
    expect(store.pedidos.filter((p: { id: string }) => p.id === 'PED-7')).toHaveLength(1)
    expect(store.carrito).toEqual([])
  })

  it('a success clears the memory so the next order creates a new one', async () => {
    const store = withCart()
    post.mockImplementation(async (url: string) => ({ data: url === '/orders/' ? orderBody : payBody }))
    await store.crearPedido(datos)
    store.agregarAlCarrito('c9', { id: 'p1', nombre: 'Plato', precio: 5 }, 1, '')
    await store.crearPedido(datos)
    expect(calls('/orders/')).toHaveLength(2)
  })

  it.each([
    ['changes the cart', (s: any) => s.actualizarCantidad(0, 1)],
    ['empties the cart', (s: any) => { s.vaciarCarrito(); s.agregarAlCarrito('c9', { id: 'p1', nombre: 'Plato', precio: 5 }, 2, '') }],
  ])('user %s after a failed payment: a new order is created', async (_n, mutate) => {
    const store = withCart()
    payFailsOnce(http(500))
    await store.crearPedido(datos)
    mutate(store)
    post.mockImplementation(async (url: string) => ({ data: url === '/orders/' ? { ...orderBody, code: 'PED-8' } : payBody }))
    await store.crearPedido(datos)
    expect(calls('/orders/')).toHaveLength(2)
  })

  it('changing the delivery data after a failed payment also creates a new order', async () => {
    const store = withCart()
    payFailsOnce(http(500))
    await store.crearPedido(datos)
    post.mockImplementation(async (url: string) => ({ data: url === '/orders/' ? { ...orderBody, code: 'PED-8' } : payBody }))
    await store.crearPedido({ ...datos, direccion: 'Otra calle' })
    expect(calls('/orders/')).toHaveLength(2)
  })

  it('the same pin after a failed payment reuses the order', async () => {
    const store = withCart()
    const conPin = { ...datos, lat: 8.9824, lng: -79.5199 }
    payFailsOnce(http(500))
    await store.crearPedido(conPin)
    await store.crearPedido({ ...conPin })
    expect(calls('/orders/')).toHaveLength(1)
  })

  it.each([
    ['moves the pin', { lat: 9.0, lng: -79.5199 }],
    ['moves only the longitude', { lat: 8.9824, lng: -79.4 }],
    ['removes the pin', { lat: null, lng: null }],
  ])('user %s after a failed payment: a new order is created', async (_n, otro) => {
    const store = withCart()
    payFailsOnce(http(500))
    await store.crearPedido({ ...datos, lat: 8.9824, lng: -79.5199 })
    post.mockImplementation(async (url: string) => ({ data: url === '/orders/' ? { ...orderBody, code: 'PED-8' } : payBody }))
    await store.crearPedido({ ...datos, ...otro })
    expect(calls('/orders/')).toHaveLength(2)
  })

  it('adding a pin where there was none after a failed payment is a new order', async () => {
    const store = withCart()
    payFailsOnce(http(500))
    await store.crearPedido(datos)
    post.mockImplementation(async (url: string) => ({ data: url === '/orders/' ? { ...orderBody, code: 'PED-8' } : payBody }))
    await store.crearPedido({ ...datos, lat: 8.9824, lng: -79.5199 })
    expect(calls('/orders/')).toHaveLength(2)
  })

  it.each([
    ['frozen coordinates', { delivery_lat: 8.9824, delivery_lng: -79.5199 }, 8.9824, -79.5199],
    ['no coordinates', { delivery_lat: null, delivery_lng: null }, null, null],
  ])('the created order maps %s from the server', async (_n, coords, lat, lng) => {
    const store = withCart()
    post.mockImplementation(async (url: string) => ({ data: url === '/orders/' ? { ...orderBody, ...coords } : payBody }))
    const pedido = await store.crearPedido(datos)
    expect([pedido.lat, pedido.lng]).toEqual([lat, lng])
  })

  it('logging out forgets the pending order', async () => {
    const store = withCart()
    payFailsOnce(http(500))
    await store.crearPedido(datos)
    store.cerrarSesion()
    store.autenticado = true
    store.comercios = [{ id: 'c9', nombre: 'C' }]
    store.agregarAlCarrito('c9', { id: 'p1', nombre: 'Plato', precio: 5 }, 2, '')
    post.mockImplementation(async (url: string) => ({ data: url === '/orders/' ? { ...orderBody, code: 'PED-8' } : payBody }))
    await store.crearPedido(datos)
    expect(calls('/orders/')).toHaveLength(2)
  })

  it('consent_required on the order POST shows the specific message and raises the profile flag', async () => {
    const store = withCart()
    post.mockRejectedValue(http(403, { detail: 'consent_required' }))
    expect(await store.crearPedido(datos)).toBeNull()
    expect(store.notificacion).toMatchObject({ texto: 'Debes aceptar el tratamiento de tus datos para continuar.', tipo: 'error' })
    expect(store.consentimientoRequerido).toBe(true)
    expect(store.carrito).toHaveLength(1)
  })

  it('consent_required on the payment POST keeps the order for retry and a later success clears the flag', async () => {
    const store = withCart()
    payFailsOnce(http(403, { detail: 'consent_required' }))
    await store.crearPedido(datos)
    expect(store.consentimientoRequerido).toBe(true)
    expect(store.notificacion.texto).toBe('El pedido PED-7 se creó, pero el pago falló. Debes aceptar el tratamiento de tus datos para continuar.')
    await store.crearPedido(datos)
    expect(calls('/orders/')).toHaveLength(1)
    expect(store.consentimientoRequerido).toBe(false)
  })

  it('re-granting consent clears the flag', async () => {
    const store = withCart()
    store.consentimientoRequerido = true
    put.mockResolvedValue({ data: { accepted: true, policy_version: 'v1', accepted_at: '2026-01-01T10:00:00Z' } })
    await store.cambiarConsentimiento(true)
    expect(store.consentimientoRequerido).toBe(false)
  })
})
