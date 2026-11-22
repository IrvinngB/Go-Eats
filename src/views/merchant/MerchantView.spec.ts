import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import api from '../../services/api'
import MerchantView from './MerchantView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

function setup(linkedId: string | null, pedidos?: unknown[]) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'merchant'
  // The logged-in user is named like merchant c1 on purpose: no name matching may apply.
  store.usuario = { nombre: 'Diablicos Fan', email: 'x@y.pa', telefono: '', consentimientoLey81: true }
  store.comercioPropioId = linkedId
  if (pedidos) store.pedidos = pedidos
  return mount(MerchantView, { global: { plugins: [pinia] } })
}

describe('MerchantView linked merchant', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unlinked account shows the empty state and no panel data', () => {
    const wrapper = setup(null)
    expect(wrapper.text()).toContain('Cuenta sin comercio asignado')
    expect(wrapper.text()).not.toContain('Panel de comercio')
    expect(wrapper.text()).not.toContain('Diablicos')
  })

  it('does not fall back to the first merchant (c1) when the link points nowhere', () => {
    const wrapper = setup('c-inexistente')
    expect(wrapper.text()).toContain('Cuenta sin comercio asignado')
  })

  it('linked account renders the server-linked merchant, not a name match', () => {
    const wrapper = setup('c2')
    const store = useGoEatsStore()
    const c2 = store.comercios.find((c: { id: string }) => c.id === 'c2')
    expect(wrapper.text()).not.toContain('Cuenta sin comercio asignado')
    expect(wrapper.find('h1').text()).toBe(c2.nombre)
  })
})

const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>

function pedido(id: string, estado: string, extra: Record<string, unknown> = {}) {
  return {
    id, comercioId: 'c2', comercioNombre: 'X', clienteNombre: 'Ana', clienteTelefono: '', zona: 'z', direccion: 'd',
    items: [], subtotal: 1, tarifaEnvio: 1, total: 2, estado, metodoPago: 'contr_entrega', repartidorId: null,
    observaciones: '', motivoCancelacion: null, fecha: 'hoy', ...extra,
  }
}

function withOrders(pedidos: ReturnType<typeof pedido>[]) {
  return setup('c2', pedidos)
}

const button = (wrapper: ReturnType<typeof setup>, label: string) =>
  wrapper.findAll('button').find((b) => b.text().includes(label))

describe('MerchantView canonical states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiPatch.mockResolvedValue({ data: {} })
  })

  it('confirm button sends confirmado', async () => {
    const w = withOrders([pedido('PED-1', 'pendiente')])
    await button(w, 'Confirmar pedido')!.trigger('click')
    expect(apiPatch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'confirmado', reason: null })
  })

  it('shows "Empezar preparación" for confirmado and sends en_preparacion', async () => {
    const w = withOrders([pedido('PED-1', 'confirmado')])
    await button(w, 'Empezar preparación')!.trigger('click')
    expect(apiPatch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'en_preparacion', reason: null })
  })

  it('shows "Marcar listo para recoger" for en_preparacion and sends listo_para_recoger', async () => {
    const w = withOrders([pedido('PED-1', 'en_preparacion')])
    expect(w.text()).toContain('En preparación')
    await button(w, 'Marcar listo para recoger')!.trigger('click')
    expect(apiPatch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'listo_para_recoger', reason: null })
  })

  it('listo_para_recoger offers the courier picker; with a courier it shows the assignment', () => {
    const free = withOrders([pedido('PED-1', 'listo_para_recoger')])
    expect(free.text()).toContain('Asignar repartidor disponible')
    const assigned = withOrders([pedido('PED-1', 'listo_para_recoger', { repartidorId: 'r1' })])
    expect(assigned.text()).toContain('Asignado a')
  })

  it('en_camino shows the in-transit note', () => {
    const w = withOrders([pedido('PED-1', 'en_camino', { repartidorId: 'r1' })])
    expect(w.text()).toContain('En camino con')
  })

  it('rechazar is offered while the order is not yet on the road and sends rechazado with the reason', async () => {
    for (const estado of ['pendiente', 'confirmado', 'en_preparacion']) {
      const w = withOrders([pedido('PED-1', estado)])
      expect(button(w, 'Rechazar')).toBeTruthy()
    }
    apiPatch.mockClear()
    const w = withOrders([pedido('PED-1', 'en_preparacion')])
    await button(w, 'Rechazar')!.trigger('click')
    await w.find('textarea').setValue('Sin insumos')
    await button(w, 'Rechazar pedido')!.trigger('click')
    expect(apiPatch).toHaveBeenCalledWith('/orders/PED-1/status', { status: 'rechazado', reason: 'Sin insumos' })
    const store = useGoEatsStore()
    expect(store.pedidos[0].estado).toBe('rechazado')
  })

  it('every terminal state (entregado, rechazado, cancelado) is history, never active', () => {
    const w = withOrders([
      pedido('PED-1', 'entregado'),
      pedido('PED-2', 'rechazado', { motivoCancelacion: 'Cerrado' }),
      pedido('PED-3', 'cancelado'),
      pedido('PED-4', 'pendiente'),
    ])
    expect(w.text()).toContain('Activos (1)')
    const rows = w.findAll('tbody tr').map((r) => r.text())
    expect(rows.some((r) => r.includes('PED-2') && r.includes('Rechazado'))).toBe(true)
    expect(rows.some((r) => r.includes('PED-1'))).toBe(true)
    expect(rows.some((r) => r.includes('PED-3'))).toBe(true)
    expect(rows.some((r) => r.includes('PED-4'))).toBe(false)
  })

  it('shows no action buttons for spaced (legacy) states', () => {
    const w = withOrders([pedido('PED-1', 'en preparación')])
    expect(button(w, 'Marcar listo para recoger')).toBeUndefined()
  })
})

const apiPut = api.put as unknown as ReturnType<typeof vi.fn>
const apiPost = api.post as unknown as ReturnType<typeof vi.fn>
const apiDelete = api.delete as unknown as ReturnType<typeof vi.fn>

describe('MerchantView RF-13 catalog, promos, schedule and open/close toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiPut.mockResolvedValue({ data: {} })
    apiPost.mockResolvedValue({ data: { code: 'c2-p105' } })
    apiDelete.mockResolvedValue({ data: null })
  })

  it('toggles store is_open from the header and calls PUT /merchants/:code/schedule', async () => {
    const w = setup('c2')
    const store = useGoEatsStore()
    const c2 = store.comercios.find((c: { id: string }) => c.id === 'c2')
    const inicial = Boolean(c2.activo)

    await w.find('[data-test="toggle-store-open"]').trigger('click')
    await flushPromises()

    expect(apiPut).toHaveBeenCalledWith('/merchants/c2/schedule', {
      opens_at: c2.horario.abre,
      closes_at: c2.horario.cierra,
      is_open: !inicial,
    })
    expect(c2.activo).toBe(!inicial)
  })

  it('creates and edits products with category and promo_price, validates promo < regular, and supports deleting', async () => {
    const w = setup('c2')
    const store = useGoEatsStore()
    store.catalogo.c2 = [
      { id: 'p-1', nombre: 'Bowl Verde', categoria: 'Bowls', precio: 8, precioRegular: 8, descripcion: 'Fresco', disponible: true },
    ]
    await w.find('[data-test="tab-catalogo"]').trigger('click')

    // Open New Product modal
    await w.find('[data-test="new-product-btn"]').trigger('click')
    await w.find('[data-test="product-name-input"]').setValue('Jugo Detox')
    await w.find('[data-test="product-category-input"]').setValue('Bebidas')
    await w.find('[data-test="product-price-input"]').setValue('4.50')
    // Invalid promo >= regular blocks submission
    await w.find('[data-test="product-promo-input"]').setValue('5.00')
    await w.find('[data-test="save-product-btn"]').trigger('click')
    expect(w.find('[data-test="product-form-error"]').text()).toContain('menor al precio regular')
    expect(apiPost).not.toHaveBeenCalled()

    // Valid promo < regular submits to API
    await w.find('[data-test="product-promo-input"]').setValue('3.50')
    await w.find('[data-test="product-description-input"]').setValue('Con jengibre')
    await w.find('[data-test="save-product-btn"]').trigger('click')
    await flushPromises()

    expect(apiPost).toHaveBeenCalledWith('/catalog/merchants/c2/products', {
      name: 'Jugo Detox',
      category: 'Bebidas',
      price: 4.5,
      promo_price: 3.5,
      description: 'Con jengibre',
      is_available: true,
    })
    expect(store.catalogo.c2).toHaveLength(2)

    // Filter by category chip
    const chips = w.findAll('[data-test="merchant-category-chip"]')
    const bebidasChip = chips.find((c) => c.text() === 'Bebidas')!
    await bebidasChip.trigger('click')
    expect(w.findAll('[data-test="merchant-product-card"]')).toHaveLength(1)
    expect(w.find('[data-test="merchant-product-promo"]').text()).toContain('Promo')

    // Delete product calls DELETE /catalog/products/:id and removes from catalog
    await w.find('[data-test="delete-product-btn"]').trigger('click')
    await flushPromises()
    expect(apiDelete).toHaveBeenCalledWith('/catalog/products/c2-p105')
    expect(store.catalogo.c2).toHaveLength(1)
  })
})
