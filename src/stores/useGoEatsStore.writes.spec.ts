import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
const patch = vi.hoisted(() => vi.fn())
const put = vi.hoisted(() => vi.fn())
const tokenStorage = vi.hoisted(() => ({ setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() }))
vi.mock('../services/api', () => ({
  default: { get, post, patch, put, delete: vi.fn() },
  tokenStorage,
}))

// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from './useGoEatsStore'

function http(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } })
}
const networkError = () => Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK', request: {} })

const MSG = {
  forbidden: 'No tienes permiso para realizar esta acción.',
  not_found: 'No se encontró lo solicitado. Puede que ya no exista.',
  conflict: 'La acción choca con el estado actual. Actualiza e inténtalo de nuevo.',
  validation: 'Los datos no son válidos o la acción no está permitida.',
  network: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  session: 'Tu sesión expiró. Inicia sesión de nuevo.',
}

function seeded() {
  const store = useGoEatsStore()
  store.autenticado = true
  store.pedidos = [{ id: 'PED-1', estado: 'pendiente', repartidorId: null, comercioId: 'c1' }]
  store.eventos = []
  return store
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const m of [get, post, patch, put]) m.mockReset()
})
afterEach(() => vi.useRealTimers())

describe('notificar auto-dismiss (F5)', () => {
  it('clears the toast after its timeout', () => {
    vi.useFakeTimers()
    const store = useGoEatsStore()
    store.notificar('Hola')
    expect(store.notificacion.texto).toBe('Hola')
    vi.advanceTimersByTime(2799)
    expect(store.notificacion?.texto).toBe('Hola')
    vi.advanceTimersByTime(2)
    expect(store.notificacion).toBeNull()
  })

  it('an older timer never removes a newer toast', () => {
    vi.useFakeTimers()
    const store = useGoEatsStore()
    store.notificar('Primero')
    vi.advanceTimersByTime(2000)
    store.notificar('Segundo')
    vi.advanceTimersByTime(1000) // first timer fires here
    expect(store.notificacion.texto).toBe('Segundo')
    vi.advanceTimersByTime(1900)
    expect(store.notificacion).toBeNull()
  })

  it('same-millisecond toasts get distinct ids', () => {
    vi.useFakeTimers()
    const store = useGoEatsStore()
    store.notificar('A')
    const a = store.notificacion.id
    store.notificar('B')
    expect(store.notificacion.id).not.toBe(a)
  })

  it('error toasts carry the error style', () => {
    const store = useGoEatsStore()
    store.notificar('Fallo', 'error')
    expect(store.notificacion).toMatchObject({ texto: 'Fallo', tipo: 'error' })
    store.notificar('Bien')
    expect(store.notificacion.tipo).toBe('info')
  })
})

describe('order status write: rollback and typed toast', () => {
  it('success keeps the new state, no error toast, returns ok with data', async () => {
    const store = seeded()
    patch.mockResolvedValue({ data: { code: 'PED-1' } })
    const r = await store.avanzarEstadoPedido('PED-1', 'confirmado')
    expect(r).toEqual({ ok: true, data: { code: 'PED-1' } })
    expect(store.pedidos[0].estado).toBe('confirmado')
    expect(store.notificacion).toBeNull()
    expect(store.eventos).toHaveLength(1)
    expect(patch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'confirmado', reason: null })
  })

  it('applies the optimistic change before the API answers', async () => {
    const store = seeded()
    let release: (v: unknown) => void = () => {}
    patch.mockReturnValue(new Promise((res) => { release = res }))
    const pending = store.avanzarEstadoPedido('PED-1', 'confirmado')
    expect(store.pedidos[0].estado).toBe('confirmado')
    release({ data: {} })
    await pending
  })

  it.each([
    ['403', http(403), 'forbidden', MSG.forbidden],
    ['404', http(404), 'not_found', MSG.not_found],
    ['409', http(409), 'conflict', MSG.conflict],
    ['422', http(422, { detail: [{ msg: 'x' }] }), 'validation', MSG.validation],
    ['400 with detail', http(400, { detail: 'Invalid transition' }), 'validation', 'Los datos no son válidos o la acción no está permitida: Invalid transition'],
    ['network', networkError(), 'network', MSG.network],
  ])('%s restores the previous state, toasts the typed message and returns ok:false', async (_n, err, kind, message) => {
    const store = seeded()
    patch.mockRejectedValue(err)
    const r = await store.avanzarEstadoPedido('PED-1', 'cancelado', { motivoCancelacion: 'x' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatchObject({ kind, message })
    expect(store.pedidos[0]).toEqual({ id: 'PED-1', estado: 'pendiente', repartidorId: null, comercioId: 'c1' })
    expect(store.notificacion).toMatchObject({ texto: message, tipo: 'error' })
    expect(store.eventos).toHaveLength(0)
  })

  it('401 surfaces the expired session and leaves state consistent', async () => {
    const store = seeded()
    patch.mockRejectedValue(http(401))
    const r = await store.avanzarEstadoPedido('PED-1', 'confirmado')
    expect(r.error.kind).toBe('unauthorized')
    expect(store.notificacion.texto).toBe(MSG.session)
    expect(store.pedidos[0].estado).toBe('pendiente')
  })

  it('rechazarPedido rolls back estado and motivo', async () => {
    const store = seeded()
    patch.mockRejectedValue(http(409))
    const r = await store.rechazarPedido('PED-1', 'Sin insumos')
    expect(r.ok).toBe(false)
    expect(store.pedidos[0].estado).toBe('pendiente')
    expect('motivoCancelacion' in store.pedidos[0]).toBe(false)
    expect(patch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'rechazado', reason: 'Sin insumos' })
  })

  it('unknown order id returns ok:false without calling the API or toasting', async () => {
    const store = seeded()
    const r = await store.avanzarEstadoPedido('PED-404', 'confirmado')
    expect(r).toEqual({ ok: false, error: null })
    expect(patch).not.toHaveBeenCalled()
    expect(store.notificacion).toBeNull()
  })
})

describe('other writes roll back', () => {
  it('asignarRepartidor: restores the courier, no success toast on failure, success toast on ok', async () => {
    const store = seeded()
    store.repartidores = [{ id: 'r1', nombre: 'Rosa' }]
    patch.mockRejectedValueOnce(http(403))
    const bad = await store.asignarRepartidor('PED-1', 'r1')
    expect(bad.ok).toBe(false)
    expect(store.pedidos[0].repartidorId).toBeNull()
    expect(store.notificacion.texto).toBe(MSG.forbidden)
    patch.mockResolvedValueOnce({ data: {} })
    const ok = await store.asignarRepartidor('PED-1', 'r1')
    expect(ok.ok).toBe(true)
    expect(store.pedidos[0].repartidorId).toBe('r1')
    expect(store.notificacion).toMatchObject({ texto: 'Rosa fue asignado al pedido PED-1.', tipo: 'info' })
  })

  it('calificarPedido restores the rating fields', async () => {
    const store = seeded()
    put.mockReset()
    post.mockRejectedValue(http(409))
    const r = await store.calificarPedido('PED-1', 5, 4, 'Muy bien')
    expect(r.ok).toBe(false)
    expect(store.pedidos[0]).toEqual({ id: 'PED-1', estado: 'pendiente', repartidorId: null, comercioId: 'c1' })
    expect(post).toHaveBeenCalledWith('/orders/PED-1/rating', { merchant_stars: 5, courier_stars: 4, comment: 'Muy bien' })
  })

  it('guardarPerfil restores the user and only confirms after ok', async () => {
    const store = seeded()
    store.usuario = { nombre: 'Ana', email: 'a@x.pa', telefono: '600', consentimientoLey81: true }
    put.mockRejectedValueOnce(networkError())
    const bad = await store.guardarPerfil({ nombre: 'Zed', telefono: '999' })
    expect(bad.ok).toBe(false)
    expect(store.usuario).toEqual({ nombre: 'Ana', email: 'a@x.pa', telefono: '600', consentimientoLey81: true })
    expect(store.notificacion.texto).toBe(MSG.network)
    put.mockResolvedValueOnce({ data: {} })
    const ok = await store.guardarPerfil({ nombre: 'Zed', telefono: '999' })
    expect(ok.ok).toBe(true)
    expect(store.usuario.nombre).toBe('Zed')
    expect(store.notificacion.texto).toBe('Perfil actualizado correctamente.')
  })

  it('actualizarEstadoProducto restores disponible', async () => {
    const store = seeded()
    store.catalogo = { c1: [{ id: 'p1', disponible: true }] }
    put.mockRejectedValue(http(404))
    const r = await store.actualizarEstadoProducto('c1', 'p1', false)
    expect(r.ok).toBe(false)
    expect(store.catalogo.c1[0].disponible).toBe(true)
    expect(put).toHaveBeenCalledWith('/catalog/products/p1', { is_available: false })
  })

  it('guardarProducto: failed update restores fields, failed create removes the new product', async () => {
    const store = seeded()
    store.catalogo = { c1: [{ id: 'p1', nombre: 'Viejo', precio: 3, descripcion: 'd', disponible: true }] }
    put.mockRejectedValue(http(422, { detail: [] }))
    await store.guardarProducto('c1', { nombre: 'Nuevo', precio: 9, descripcion: 'z' }, 'p1')
    expect(store.catalogo.c1[0]).toEqual({ id: 'p1', nombre: 'Viejo', precio: 3, descripcion: 'd', disponible: true })
    post.mockRejectedValue(http(403))
    const r = await store.guardarProducto('c1', { nombre: 'Otro', precio: 1, descripcion: '' })
    expect(r.ok).toBe(false)
    expect(store.catalogo.c1).toHaveLength(1)
  })

  it('guardarProducto success adds the product', async () => {
    const store = seeded()
    store.catalogo = { c1: [] }
    post.mockResolvedValue({ data: { code: 'p9' } })
    const r = await store.guardarProducto('c1', { nombre: 'Otro', precio: 1, descripcion: '' })
    expect(r.ok).toBe(true)
    expect(store.catalogo.c1).toHaveLength(1)
    expect(store.catalogo.c1[0].nombre).toBe('Otro')
  })

  it('guardarHorarioComercio and toggleRepartidorDisponible restore on failure', async () => {
    const store = seeded()
    store.comercios = [{ id: 'c1', horario: { abre: '08:00', cierra: '20:00' } }]
    store.repartidores = [{ id: 'r1', disponible: true }]
    put.mockRejectedValue(http(403))
    patch.mockRejectedValue(http(403))
    await store.guardarHorarioComercio('c1', { abre: '10:00', cierra: '11:00' })
    expect(store.comercios[0].horario).toEqual({ abre: '08:00', cierra: '20:00' })
    await store.toggleRepartidorDisponible('r1')
    expect(store.repartidores[0].disponible).toBe(true)
  })

  it('conciliarTransaccion, cambiarEstadoComercio and resolverAfiliacion restore on failure', async () => {
    const store = seeded()
    store.transacciones = [{ id: 'TX-1', estado: 'pendiente' }]
    store.comercios = [{ id: 'c1', nombre: 'Uno', activo: true, estadoAfiliacion: 'activo' }]
    store.afiliaciones = [{ id: 'A1', tipo: 'comercio', nombre: 'Uno', estado: 'pendiente' }]
    patch.mockRejectedValue(http(409))
    await store.conciliarTransaccion('TX-1', 'aprobado')
    expect(store.transacciones[0].estado).toBe('pendiente')
    await store.cambiarEstadoComercio('c1', true)
    expect(store.comercios[0]).toEqual({ id: 'c1', nombre: 'Uno', activo: true, estadoAfiliacion: 'activo' })
    store.comercios[0].estadoAfiliacion = 'pendiente'
    store.comercios[0].activo = false
    await store.resolverAfiliacion('A1', true)
    expect(store.afiliaciones[0].estado).toBe('pendiente')
    expect(store.comercios[0]).toMatchObject({ estadoAfiliacion: 'pendiente', activo: false })
  })

  it('enviarSolicitudARCO removes the optimistic request on failure and confirms only on success', async () => {
    const store = seeded()
    store.solicitudesARCO = []
    post.mockRejectedValueOnce(http(403, { detail: 'consent_required' }))
    const bad = await store.enviarSolicitudARCO('Acceso', 'detalle')
    expect(bad.ok).toBe(false)
    expect(bad.error.code).toBe('consent_required')
    expect(store.solicitudesARCO).toHaveLength(0)
    expect(store.notificacion.texto).toBe('Debes aceptar el tratamiento de tus datos para continuar.')
    post.mockResolvedValueOnce({ data: {} })
    const ok = await store.enviarSolicitudARCO('Acceso', 'detalle')
    expect(ok.ok).toBe(true)
    expect(store.solicitudesARCO).toHaveLength(1)
    expect(store.notificacion.texto).toBe('Tu solicitud fue enviada. El administrador la responderá pronto.')
  })

  it('responderARCO restores the request on failure', async () => {
    const store = seeded()
    store.solicitudesARCO = [{ id: 7, usuario: 'Ana', estado: 'pendiente' }]
    post.mockRejectedValue(http(500))
    const r = await store.responderARCO(7, 'ok')
    expect(r.ok).toBe(false)
    expect(store.solicitudesARCO[0]).toEqual({ id: 7, usuario: 'Ana', estado: 'pendiente' })
    expect(store.notificacion.texto).toBe('El servidor tuvo un problema. Inténtalo más tarde.')
  })

  it('every failing write resolves (no unhandled rejection)', async () => {
    const store = seeded()
    store.catalogo = { c1: [{ id: 'p1', disponible: true }] }
    patch.mockRejectedValue(networkError())
    put.mockRejectedValue(networkError())
    post.mockRejectedValue(networkError())
    const results = await Promise.all([
      store.avanzarEstadoPedido('PED-1', 'confirmado'),
      store.rechazarPedido('PED-1', 'x'),
      store.actualizarEstadoProducto('c1', 'p1', false),
      store.calificarPedido('PED-1', 3),
    ])
    expect(results.map((r: { ok: boolean }) => r.ok)).toEqual([false, false, false, false])
  })
})

describe('crearPedido typed errors and cart', () => {
  const orderBody = { code: 'PED-7', merchant_code: 'c9', merchant_name: 'C', customer_name: 'Ana', customer_phone: '', zone_slug: 'z1', delivery_address: 'Calle', items: [], subtotal: 5, delivery_fee: 2, total: 7, status: 'pendiente', payment_method: 'contr_entrega', courier_code: null, notes: '', cancellation_reason: null, rating: null, created_at: '2026-01-01T10:00:00Z' }

  function withCart() {
    const store = useGoEatsStore()
    store.autenticado = true
    store.comercios = [{ id: 'c9', nombre: 'C' }]
    store.zonaSeleccionada = 'z1'
    store.agregarAlCarrito('c9', { id: 'p1', nombre: 'Plato', precio: 5 }, 2, '')
    return store
  }
  const datos = { direccion: 'Calle 45', metodoPago: 'contr_entrega', observaciones: '' }

  it.each([
    ['403', http(403), MSG.forbidden],
    ['409', http(409), MSG.conflict],
    ['422', http(422, { detail: [] }), MSG.validation],
    ['network', networkError(), MSG.network],
  ])('order POST %s keeps the cart and shows the real message', async (_n, err, message) => {
    const store = withCart()
    post.mockRejectedValue(err)
    expect(await store.crearPedido(datos)).toBeNull()
    expect(store.carrito).toHaveLength(1)
    expect(store.carritoComercioId).toBe('c9')
    expect(store.notificacion).toMatchObject({ texto: message, tipo: 'error' })
    expect(store.pedidos.some((p: { id: string }) => p.id === 'PED-7')).toBe(false)
  })

  it('payment POST failure keeps the cart, keeps the created order and shows the real message', async () => {
    const store = withCart()
    post.mockImplementation(async (url: string) => {
      if (url === '/orders/') return { data: orderBody }
      throw http(500)
    })
    expect(await store.crearPedido(datos)).toBeNull()
    expect(store.carrito).toHaveLength(1)
    expect(store.pedidos[0].id).toBe('PED-7')
    expect(store.notificacion.texto).toBe('El pedido PED-7 se creó, pero el pago falló. El servidor tuvo un problema. Inténtalo más tarde.')
    expect(store.notificacion.tipo).toBe('error')
  })

  it('the cart is cleared only when both calls succeed', async () => {
    const store = withCart()
    post.mockImplementation(async (url: string, body: Record<string, unknown>) => {
      if (url === '/orders/') return { data: orderBody }
      return { data: { code: 'TX-9', order_code: body.order_code, method: body.method, subtotal: 5, delivery_fee: 2, commission: 1, total: 7, status: 'pendiente', provider_reference: 'COD-1', created_at: '2026-01-01T10:00:00Z' } }
    })
    const pedido = await store.crearPedido(datos)
    expect(pedido.id).toBe('PED-7')
    expect(store.carrito).toEqual([])
    expect(store.carritoComercioId).toBeNull()
    expect(store.notificacion).toBeNull()
  })
})
