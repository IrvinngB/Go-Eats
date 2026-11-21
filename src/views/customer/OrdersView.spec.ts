import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import OrdersView from './OrdersView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

function pedido(estado: string, extra: Record<string, unknown> = {}) {
  return {
    id: 'PED-1', comercioId: 'c1', comercioNombre: 'Diablicos', clienteNombre: 'Ana', clienteTelefono: '', zona: 'z',
    direccion: 'Calle 1', items: [], subtotal: 1, tarifaEnvio: 1, total: 2, estado, metodoPago: 'contr_entrega',
    repartidorId: null, observaciones: '', motivoCancelacion: null, calificacion: null, fecha: 'hoy', ...extra,
  }
}

function setup(p: ReturnType<typeof pedido>) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'customer'
  store.usuario = { nombre: 'Ana', email: 'ana@t.pa', telefono: '', consentimientoLey81: true }
  store.pedidos = [p]
  return mount(OrdersView, { global: { plugins: [pinia], stubs: { CoverageMap: true, RouterLink: true } } })
}

const stepNodes = (w: ReturnType<typeof setup>) => w.findAll('[data-test="timeline-step"]')

describe('OrdersView timeline with canonical states', () => {
  beforeEach(() => vi.clearAllMocks())

  it('en_preparacion highlights its step and completes the earlier ones', () => {
    const steps = stepNodes(setup(pedido('en_preparacion')))
    expect(steps).toHaveLength(6)
    expect(steps.map((s) => s.attributes('data-state'))).toEqual([
      'done', 'done', 'current', 'pending', 'pending', 'pending',
    ])
    expect(steps[2].text()).toContain('En preparación')
  })

  it('listo_para_recoger and en_camino map to their own steps', () => {
    expect(stepNodes(setup(pedido('listo_para_recoger'))).map((s) => s.attributes('data-state'))).toEqual([
      'done', 'done', 'done', 'current', 'pending', 'pending',
    ])
    expect(stepNodes(setup(pedido('en_camino'))).map((s) => s.attributes('data-state'))).toEqual([
      'done', 'done', 'done', 'done', 'current', 'pending',
    ])
  })

  it('entregado completes the whole chain', () => {
    expect(stepNodes(setup(pedido('entregado'))).map((s) => s.attributes('data-state'))).toEqual([
      'done', 'done', 'done', 'done', 'done', 'current',
    ])
  })

  it('rechazado renders a terminal box with the reason and no timeline steps', () => {
    const w = setup(pedido('rechazado', { motivoCancelacion: 'Cerrado' }))
    const box = w.find('[data-test="estado-terminal"]')
    expect(box.text()).toBe('Rechazado: Cerrado')
    expect(stepNodes(w)).toHaveLength(0)
    expect(w.find('[data-test="timeline-progress"]').exists()).toBe(false)
  })

  it('cancelado keeps its own label and reason', () => {
    const w = setup(pedido('cancelado', { motivoCancelacion: 'Sin stock' }))
    expect(w.find('[data-test="estado-terminal"]').text()).toBe('Cancelado: Sin stock')
    expect(stepNodes(w)).toHaveLength(0)
  })

  it('terminal order without a reason says so', () => {
    const w = setup(pedido('rechazado'))
    expect(w.find('[data-test="estado-terminal"]').text()).toBe('Rechazado: Sin motivo registrado.')
  })

  it('live tracking is offered for the three in-progress canonical states only', () => {
    for (const e of ['en_preparacion', 'listo_para_recoger', 'en_camino']) {
      expect(setup(pedido(e)).text()).toContain('Ver recorrido en el mapa')
    }
    for (const e of ['pendiente', 'entregado', 'rechazado', 'cancelado', 'en camino']) {
      expect(setup(pedido(e)).text()).not.toContain('Ver recorrido en el mapa')
    }
  })

  it('shows the assigned courier only while en_camino', () => {
    const rep = { repartidorId: 'r2', repartidorNombre: 'María' }
    expect(setup(pedido('en_camino', rep)).text()).toContain('Tu repartidor en camino')
    expect(setup(pedido('listo_para_recoger', rep)).text()).not.toContain('Tu repartidor en camino')
  })
})

describe('OrdersView payment status from the API', () => {
  it.each([
    ['pagado', 'Pagado'],
    ['pendiente', 'Pago pendiente'],
    ['fallido', 'Pago fallido'],
  ])('shows "%s" as "%s"', (pagoEstado, label) => {
    const w = setup(pedido('pendiente', { pagoEstado }))
    expect(w.find('[data-test="estado-pago"]').text()).toBe(label)
  })

  it('shows no payment line while the order has no payment', () => {
    expect(setup(pedido('pendiente', { pagoEstado: null })).find('[data-test="estado-pago"]').exists()).toBe(false)
  })
})

describe('OrdersView rating write does not assume success', () => {
  async function rate(apiResult: 'ok' | 'fail') {
    const { default: api } = await import('../../services/api')
    const post = api.post as unknown as ReturnType<typeof vi.fn>
    post.mockReset()
    if (apiResult === 'ok') post.mockResolvedValue({ data: {} })
    else post.mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { status: 409 } }))
    const w = setup(pedido('entregado'))
    await w.find('[data-test="rate-open"]').trigger('click')
    await w.find('[data-test="rate-submit"]').trigger('click')
    await vi.waitFor(() => expect(post).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 0))
    return { w, store: useGoEatsStore() }
  }

  it('failure keeps the modal open, rolls back the rating and shows the typed error (no thanks toast)', async () => {
    const { w, store } = await rate('fail')
    expect(w.text()).toContain('Atención del repartidor')
    expect(store.pedidos[0].calificacion).toBeNull()
    expect(store.notificacion).toMatchObject({ texto: 'La acción choca con el estado actual. Actualiza e inténtalo de nuevo.', tipo: 'error' })
  })

  it('success closes the modal and thanks the user', async () => {
    const { w, store } = await rate('ok')
    expect(w.text()).not.toContain('Atención del repartidor')
    expect(store.pedidos[0].calificacion).toBe(5)
    expect(store.notificacion.texto).toBe('¡Gracias por calificar tu pedido!')
  })
})
