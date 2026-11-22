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

describe('CourierView RF-02 tri-state availability and RF-19 package details', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiPatch.mockResolvedValue({ data: {} })
  })

  it('displays En línea when online and idle, Ocupado when an order is en_camino, and Desconectado when offline', async () => {
    const { store, wrapper } = setup('r2', [pedido('PED-1', 'listo_para_recoger')])
    const r2 = store.repartidores.find((r: { id: string }) => r.id === 'r2')
    r2.disponible = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="courier-operational-status"]').text()).toBe('En línea')

    store.pedidos = [pedido('PED-1', 'en_camino')]
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="courier-operational-status"]').text()).toBe('Ocupado')

    await wrapper.find('[data-test="toggle-courier-availability"]').trigger('click')
    expect(apiPatch).toHaveBeenCalledWith('/delivery/couriers/r2/availability', { is_available: false })
    expect(wrapper.find('[data-test="courier-operational-status"]').text()).toBe('Desconectado')
  })

  it('renders RF-19 pickup merchant, customer details, package items, item notes, order notes, and frozen GPS coordinates', () => {
    const fullOrder = {
      ...pedido('PED-99', 'listo_para_recoger'),
      comercioNombre: 'Fonda La Istmeña',
      clienteNombre: 'Carlos Andrade',
      clienteTelefono: '6123-4567',
      direccion: 'Calle 50, PH Global',
      lat: 8.9824,
      lng: -79.5199,
      observaciones: 'Portón negro, tocar timbre 2',
      items: [
        { cantidad: 2, nombre: 'Sancocho de gallina', observacion: 'Sin culantro' },
        { cantidad: 1, nombre: 'Chicha de maracuyá', observacion: '' },
      ],
    }
    const { wrapper } = setup('r2', [fullOrder])

    expect(wrapper.find('[data-test="pickup-merchant"]').text()).toBe('Fonda La Istmeña')
    expect(wrapper.find('[data-test="dropoff-customer"]').text()).toBe('Carlos Andrade')
    expect(wrapper.find('[data-test="dropoff-address"]').text()).toContain('Calle 50, PH Global')
    expect(wrapper.find('[data-test="dropoff-coords"]').text()).toContain('8.9824, -79.5199')
    expect(wrapper.find('[data-test="courier-order-items"]').text()).toContain('2× Sancocho de gallina')
    expect(wrapper.find('[data-test="courier-order-items"]').text()).toContain('Sin culantro')
    expect(wrapper.find('[data-test="courier-order-notes"]').text()).toContain('Portón negro, tocar timbre 2')
  })
})
