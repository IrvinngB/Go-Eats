import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import StoreDetailView from './StoreDetailView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

async function setup(promo = false, autenticado = true) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = autenticado
  store.rol = 'customer'
  store.comercios = [{ id: 'c9', nombre: 'Comercio', tipo: 'Restaurante', zona: 'san-francisco', rating: 4, tiempoEntrega: '20', abierto: true, descripcion: '', icono: 'Store', estadoAfiliacion: 'activo' }]
  store.catalogo = {
    c9: [{ id: 'p1', nombre: 'Plato', precio: promo ? 4 : 5, precioRegular: 5, descripcion: '', categoria: 'x', disponible: true }],
  }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/login', name: 'login', component: StoreDetailView }, { path: '/tiendas/:id', component: StoreDetailView }, { path: '/tiendas', component: StoreDetailView }, { path: '/pedidos', component: StoreDetailView }, { path: '/perfil', name: 'profile', component: StoreDetailView }] })
  await router.push('/tiendas/c9')
  await router.isReady()
  const w = mount(StoreDetailView, { global: { plugins: [pinia, router] } })
  return { w, store, router }
}

async function openCheckout(w: Awaited<ReturnType<typeof setup>>['w']) {
  await w.find('button.btn-primary').trigger('click') // add the product
  await w.findAll('button').find((b) => b.text() === 'Continuar')!.trigger('click')
}

describe('StoreDetailView checkout', () => {
  it('labels the electronic option "Pago electrónico (simulado)" without naming a provider', async () => {
    const { w } = await setup()
    await openCheckout(w)
    const label = w.findAll('label').find((l) => l.find('input[value="electronico"]').exists())!
    expect(label.text()).toContain('Pago electrónico (simulado)')
    expect(label.text()).toContain('sin datos reales de tarjeta')
    expect(w.text()).not.toMatch(/yappy|paguelo/i)
  })

  it('shows the effective promo price and the regular one struck through', async () => {
    const { w } = await setup(true)
    expect(w.find('[data-test="precio-efectivo"]').text()).toBe('B/ 4.00')
    expect(w.find('[data-test="precio-regular"]').text()).toBe('B/ 5.00')
  })

  it('shows a single price when there is no promo', async () => {
    const { w } = await setup(false)
    expect(w.find('[data-test="precio-efectivo"]').text()).toBe('B/ 5.00')
    expect(w.find('[data-test="precio-regular"]').exists()).toBe(false)
  })
})

describe('StoreDetailView payment flow', () => {
  const pedido = (extra = {}) => ({ id: 'PED-7', total: 12, estado: 'pendiente', pagoEstado: 'pagado', referenciaPasarela: 'YPY-ABC', ...extra })

  async function toCheckout(w: Awaited<ReturnType<typeof setup>>['w'], metodo: string) {
    await openCheckout(w)
    await w.find('input.input').setValue('Calle 45')
    await w.find(`input[value="${metodo}"]`).setValue(true)
    await w.findAll('button').find((b) => b.text() === 'Realizar pedido')!.trigger('click')
    await flushPromises()
  }

  it('electronic opens a modal with a single "Pagar (simulado)" action and no outcome buttons', async () => {
    const { w, store } = await setup()
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    await toCheckout(w, 'electronico')
    const labels = w.findAll('.modal-panel button').map((b) => b.text())
    expect(labels).toEqual(['Pagar (simulado)'])
    expect(w.text()).not.toMatch(/Simular (rechazo|aprobación)/)
    expect(crear).not.toHaveBeenCalled() // nothing is created until the user pays
  })

  it('paying calls crearPedido once with the electronic method and shows the server reference', async () => {
    const { w, store } = await setup()
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido())
    await toCheckout(w, 'electronico')
    await w.find('.modal-panel button').trigger('click')
    await flushPromises()
    expect(crear).toHaveBeenCalledTimes(1)
    expect(crear).toHaveBeenCalledWith({ direccion: 'Calle 45', metodoPago: 'electronico', observaciones: '' })
    expect(w.find('.modal-panel').text()).toContain('Pago aprobado')
    expect(w.find('.modal-panel').text()).toContain('YPY-ABC')
  })

  it('shows the rejection when the server reports a failed payment', async () => {
    const { w, store } = await setup()
    vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido({ pagoEstado: 'fallido', estado: 'cancelado' }))
    await toCheckout(w, 'electronico')
    await w.find('.modal-panel button').trigger('click')
    await flushPromises()
    expect(w.find('.modal-panel').text()).toContain('Pago rechazado')
  })

  it('cash on delivery goes through the same call without a payment modal', async () => {
    const { w, store } = await setup()
    const crear = vi.spyOn(store, 'crearPedido').mockResolvedValue(pedido({ pagoEstado: 'pendiente', referenciaPasarela: 'COD-1' }))
    await toCheckout(w, 'contr_entrega')
    expect(crear).toHaveBeenCalledWith({ direccion: 'Calle 45', metodoPago: 'contr_entrega', observaciones: '' })
    expect(w.find('.modal-panel').exists()).toBe(false)
  })

  it('anonymous checkout redirects to login with the store as target and keeps the cart', async () => {
    const { w, store, router } = await setup(false, false)
    const crear = vi.spyOn(store, 'crearPedido')
    await toCheckout(w, 'contr_entrega')
    expect(crear).not.toHaveBeenCalled()
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/tiendas/c9')
    expect(store.carrito).toHaveLength(1)
  })
})

describe('StoreDetailView consent_required', () => {
  async function toCheckout(w: Awaited<ReturnType<typeof setup>>['w'], metodo: string) {
    await openCheckout(w)
    await w.find('input.input').setValue('Calle 45')
    await w.find(`input[value="${metodo}"]`).setValue(true)
    await w.findAll('button').find((b) => b.text() === 'Realizar pedido')!.trigger('click')
    await flushPromises()
  }

  function blocked(store: { consentimientoRequerido: boolean }) {
    return async () => {
      store.consentimientoRequerido = true
      return null
    }
  }

  it('cash: the drawer shows the specific message and a link to Perfil that navigates there', async () => {
    const { w, store, router } = await setup()
    vi.spyOn(store, 'crearPedido').mockImplementation(blocked(store))
    await toCheckout(w, 'contr_entrega')
    const box = w.find('[data-test="consent-required"]')
    expect(box.text()).toContain('Debes aceptar el tratamiento de tus datos')
    await box.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('profile')
  })

  it('electronic: the modal explains the consent block instead of the generic payment error', async () => {
    const { w, store, router } = await setup()
    vi.spyOn(store, 'crearPedido').mockImplementation(blocked(store))
    await toCheckout(w, 'electronico')
    await w.findAll('.modal-panel button').find((b) => b.text() === 'Pagar (simulado)')!.trigger('click')
    await flushPromises()
    const box = w.find('.modal-panel [data-test="consent-required"]')
    expect(box.text()).toContain('Debes aceptar el tratamiento de tus datos')
    expect(w.find('.modal-panel').text()).not.toContain('No pudimos procesar el pago')
    await box.find('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('profile')
  })

  it('no consent message while the flag is off', async () => {
    const { w, store } = await setup()
    vi.spyOn(store, 'crearPedido').mockResolvedValue(null)
    await toCheckout(w, 'contr_entrega')
    expect(w.find('[data-test="consent-required"]').exists()).toBe(false)
  })
})
