import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../../components/CoverageMap.vue', () => ({
  default: { template: '<div data-test="coverage-map-stub" />' },
}))

import StoresView from './StoresView.vue'
// @ts-expect-error plain JS store
import { useGoEatsStore } from '../../stores/useGoEatsStore'

async function setupStores() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.zonas = [{ id: 'san-francisco', nombre: 'San Francisco', tarifa: 2.5, distanciaKm: 3.2 }]
  store.zonaSeleccionada = 'san-francisco'
  store.comercios = [
    {
      id: 'c1',
      nombre: 'Fonda La Istmeña',
      tipo: 'Comida típica panameña',
      zona: 'san-francisco',
      rating: 4.8,
      tiempoEntrega: '25-35 min',
      activo: true,
      estadoAfiliacion: 'activo',
      descripcion: 'Sancocho y ropa vieja.',
      icono: 'Utensils',
    },
    {
      id: 'c2',
      nombre: 'Verde Bistro',
      tipo: 'Opciones saludables',
      zona: 'san-francisco',
      rating: 4.9,
      tiempoEntrega: '20-30 min',
      activo: false,
      estadoAfiliacion: 'activo',
      descripcion: 'Bowls y ensaladas.',
      icono: 'Salad',
    },
    {
      id: 'c3',
      nombre: 'Asados El Istmo',
      tipo: 'Comida típica panameña',
      zona: 'san-francisco',
      rating: 4.5,
      tiempoEntrega: '30-40 min',
      activo: true,
      estadoAfiliacion: 'activo',
      descripcion: 'Carnes a la parrilla.',
      icono: 'Flame',
    },
  ]

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/tiendas', component: StoresView },
      { path: '/tiendas/:id', component: StoresView },
    ],
  })
  await router.push('/tiendas')
  await router.isReady()
  const w = mount(StoresView, { global: { plugins: [pinia, router] } })
  return { w, store, router }
}

describe('StoresView catalog browsing', () => {
  it('filters merchants by accent-insensitive search query and shows empty state with clear action', async () => {
    const { w } = await setupStores()
    expect(w.findAll('[data-test="merchant-card"]')).toHaveLength(3)

    const search = w.find('[data-test="stores-search"]')
    await search.setValue('istmena')
    const cards = w.findAll('[data-test="merchant-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0].text()).toContain('Fonda La Istmeña')

    await search.setValue('sushi inexistente')
    expect(w.findAll('[data-test="merchant-card"]')).toHaveLength(0)
    expect(w.find('[data-test="stores-empty"]').exists()).toBe(true)

    await w.find('[data-test="stores-clear-filters"]').trigger('click')
    expect(w.findAll('[data-test="merchant-card"]')).toHaveLength(3)
  })

  it('filters merchants by category_type chips and sorts by rating or name', async () => {
    const { w } = await setupStores()
    const chips = w.findAll('[data-test="stores-category"]')
    expect(chips.map((c) => c.text())).toEqual([
      'Todos',
      'Comida típica panameña',
      'Opciones saludables',
    ])

    await chips[1].trigger('click')
    expect(w.findAll('[data-test="merchant-card"]').map((c) => c.find('h3').text())).toEqual([
      'Fonda La Istmeña',
      'Asados El Istmo',
    ])

    await w.find('[data-test="stores-sort"]').setValue('nombre')
    expect(w.findAll('[data-test="merchant-card"]').map((c) => c.find('h3').text())).toEqual([
      'Asados El Istmo',
      'Fonda La Istmeña',
    ])

    await chips[0].trigger('click')
    await w.find('[data-test="stores-sort"]').setValue('rating')
    expect(w.findAll('[data-test="merchant-card"]').map((c) => c.find('h3').text())).toEqual([
      'Verde Bistro',
      'Fonda La Istmeña',
      'Asados El Istmo',
    ])
  })

  it('renders open/closed status labels and keeps closed merchants visibly disabled', async () => {
    const { w, router } = await setupStores()
    const cards = w.findAll('[data-test="merchant-card"]')
    const openCard = cards.find((c) => c.text().includes('Fonda La Istmeña'))!
    const closedCard = cards.find((c) => c.text().includes('Verde Bistro'))!

    expect(openCard.find('[data-test="merchant-status"]').text()).toBe('Abierto')
    expect((openCard.element as HTMLButtonElement).disabled).toBe(false)

    expect(closedCard.find('[data-test="merchant-status"]').text()).toBe('Cerrado')
    expect((closedCard.element as HTMLButtonElement).disabled).toBe(true)

    await closedCard.trigger('click')
    expect(router.currentRoute.value.fullPath).toBe('/tiendas')
  })
})
