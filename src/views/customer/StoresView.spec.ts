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

  it('closed merchant is visibly disabled and announces it: disabled + aria-disabled, icon and text', async () => {
    const { w } = await setupStores()
    const closedCard = w.findAll('[data-test="merchant-card"]').find((c) => c.text().includes('Verde Bistro'))!
    const openCard = w.findAll('[data-test="merchant-card"]').find((c) => c.text().includes('Fonda La Istmeña'))!

    expect(closedCard.attributes('aria-disabled')).toBe('true')
    expect(closedCard.attributes('disabled')).toBeDefined()
    expect(closedCard.classes()).toContain('cx-tile')
    const status = closedCard.find('[data-test="merchant-status"]')
    expect(status.classes()).toContain('cx-badge-closed')
    expect(status.find('svg').exists()).toBe(true)
    expect(status.text()).toBe('Cerrado')

    expect(openCard.attributes('aria-disabled')).toBeUndefined()
    expect(openCard.find('[data-test="merchant-status"]').classes()).toContain('cx-badge-open')
    expect(openCard.find('[data-test="merchant-status"] svg').exists()).toBe(true)
  })

  it('empty state: tinted icon circle, title, one line and exactly one primary button', async () => {
    const { w } = await setupStores()
    await w.find('[data-test="stores-search"]').setValue('sushi inexistente')
    const empty = w.find('[data-test="stores-empty"]')
    expect(empty.classes()).toContain('cx-empty')
    expect(empty.find('.cx-empty-icon svg').exists()).toBe(true)
    expect(empty.find('h3').text()).toBe('No encontramos comercios con esos filtros')
    expect(empty.findAll('p')).toHaveLength(1)
    const buttons = empty.findAll('button')
    expect(buttons).toHaveLength(1)
    expect(buttons[0].classes()).toContain('cx-btn')
    expect(buttons[0].text()).toBe('Limpiar filtros')
  })

  it('selected category chip is marked with check icon, fill and aria-pressed (not color alone)', async () => {
    const { w } = await setupStores()
    const chips = w.findAll('[data-test="stores-category"]')
    expect(chips[0].classes()).toContain('cx-chip-selected')
    expect(chips[0].attributes('aria-pressed')).toBe('true')
    expect(chips[0].find('svg').exists()).toBe(true)
    expect(chips[1].classes()).not.toContain('cx-chip-selected')
    expect(chips[1].attributes('aria-pressed')).toBe('false')
    expect(chips[1].find('svg').exists()).toBe(false)
  })
})
