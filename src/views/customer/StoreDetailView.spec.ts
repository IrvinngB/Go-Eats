import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import StoreDetailView from './StoreDetailView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

async function setup(promo = false) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'customer'
  store.comercios = [{ id: 'c9', nombre: 'Comercio', tipo: 'Restaurante', zona: 'san-francisco', rating: 4, tiempoEntrega: '20', abierto: true, descripcion: '', icono: 'Store', estadoAfiliacion: 'activo' }]
  store.catalogo = {
    c9: [{ id: 'p1', nombre: 'Plato', precio: promo ? 4 : 5, precioRegular: 5, descripcion: '', categoria: 'x', disponible: true }],
  }
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/tiendas/:id', component: StoreDetailView }, { path: '/tiendas', component: StoreDetailView }, { path: '/pedidos', component: StoreDetailView }] })
  await router.push('/tiendas/c9')
  await router.isReady()
  const w = mount(StoreDetailView, { global: { plugins: [pinia, router] } })
  return { w, store }
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
