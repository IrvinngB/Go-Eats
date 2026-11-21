import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import api from '../../services/api'
import CourierView from './CourierView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

function setup(linkedId: string | null, pedidos?: unknown[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'courier'
  store.usuario = { nombre: 'María Fan', email: 'x@y.pa', telefono: '', consentimientoLey81: true }
  store.repartidorPropioId = linkedId
  if (pedidos) store.pedidos = pedidos
  return {
    store,
    wrapper: mount(CourierView, { global: { plugins: [pinia], stubs: { CoverageMap: true } } }),
  }
}

describe('CourierView linked courier', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unlinked account shows the empty state and no courier data', () => {
    const { wrapper } = setup(null)
    expect(wrapper.text()).toContain('Cuenta sin repartidor asignado')
    expect(wrapper.find('h1').text()).toBe('Cuenta sin repartidor asignado')
    expect(wrapper.text()).not.toContain('Disponible')
  })

  it('does not fall back to r2 when the link points nowhere', () => {
    const { wrapper } = setup('r-inexistente')
    expect(wrapper.text()).toContain('Cuenta sin repartidor asignado')
  })

  it('linked account renders the server-linked courier, not a name match', () => {
    const { store, wrapper } = setup('r3')
    const r3 = store.repartidores.find((r: { id: string }) => r.id === 'r3')
    expect(wrapper.text()).not.toContain('Cuenta sin repartidor asignado')
    expect(wrapper.find('h1').text()).toBe(r3.nombre)
  })
})

const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>

function pedido(id: string, estado: string) {
  return {
    id, comercioId: 'c1', comercioNombre: 'Comercio', clienteNombre: 'Ana', clienteTelefono: '6000', zona: 'z', direccion: 'd',
    items: [], subtotal: 1, tarifaEnvio: 1, total: 2, estado, metodoPago: 'contr_entrega', repartidorId: 'r2',
    observaciones: '', fecha: 'hoy',
  }
}

function withOrders(estados: Record<string, string>) {
  return setup('r2', Object.entries(estados).map(([id, e]) => pedido(id, e)))
}

const button = (wrapper: ReturnType<typeof setup>['wrapper'], label: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(label))

describe('CourierView canonical states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiPatch.mockResolvedValue({ data: {} })
  })

  it('listo_para_recoger offers "Marcar en camino" and sends en_camino', async () => {
    const { wrapper } = withOrders({ 'PED-1': 'listo_para_recoger' })
    expect(wrapper.text()).toContain('Listo para recoger')
    await button(wrapper, 'Marcar en camino')!.trigger('click')
    expect(apiPatch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'en_camino', reason: null })
  })

  it('en_camino offers "Marcar entregado" and sends entregado', async () => {
    const { wrapper } = withOrders({ 'PED-1': 'en_camino' })
    await button(wrapper, 'Marcar entregado')!.trigger('click')
    expect(apiPatch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'entregado', reason: null })
  })

  it('reporting a problem sends cancelado with the reason', async () => {
    const { wrapper } = withOrders({ 'PED-1': 'en_camino' })
    await button(wrapper, 'Reportar problema')!.trigger('click')
    await wrapper.find('textarea').setValue('Cliente no responde')
    const confirm = wrapper.findAll('button').filter((b) => b.text().includes('Reportar')).pop()!
    await confirm.trigger('click')
    expect(apiPatch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'cancelado', reason: 'Cliente no responde' })
  })

  it('terminal orders (entregado, rechazado, cancelado) leave the active list and go to history', () => {
    const { wrapper } = withOrders({
      A: 'en_camino', B: 'rechazado', C: 'cancelado', D: 'entregado', E: 'listo_para_recoger',
    })
    expect(wrapper.text()).toContain('Entregas asignadas (2)')
    const history = wrapper.find('.divide-y').text()
    for (const id of ['B', 'C', 'D']) expect(history).toContain(id)
  })

  it('offers no actions for spaced (legacy) states', () => {
    const { wrapper } = withOrders({ 'PED-1': 'en camino' })
    expect(button(wrapper, 'Marcar entregado')).toBeUndefined()
  })
})
