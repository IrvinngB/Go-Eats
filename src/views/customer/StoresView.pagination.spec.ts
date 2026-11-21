import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'

vi.mock('../../components/CoverageMap.vue', () => ({
  default: { template: '<div data-test="coverage-map-stub" />' },
}))

import StoresView from './StoresView.vue'
// @ts-expect-error plain JS store
import { useGoEatsStore } from '../../stores/useGoEatsStore'

const TIPOS = ['Pizza', 'Café', 'Sushi']

function merchants(n: number, zona = 'san-francisco') {
  return Array.from({ length: n }, (_, i) => ({
    id: `${zona}-${i + 1}`,
    nombre: `Comercio ${String(i + 1).padStart(2, '0')}`,
    tipo: TIPOS[i % TIPOS.length],
    zona,
    rating: 4,
    tiempoEntrega: '20-30 min',
    activo: true,
    estadoAfiliacion: 'activo',
    descripcion: 'Descripción',
    icono: 'Utensils',
  }))
}

async function setup(count: number) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.zonas = [
    { id: 'san-francisco', nombre: 'San Francisco', tarifa: 2.5, distanciaKm: 3.2 },
    { id: 'obarrio', nombre: 'Obarrio', tarifa: 2, distanciaKm: 2 },
  ]
  store.zonaSeleccionada = 'san-francisco'
  store.comercios = [...merchants(count), ...merchants(20, 'obarrio')]
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/tiendas', component: StoresView }] })
  await router.push('/tiendas')
  await router.isReady()
  const w = mount(StoresView, { global: { plugins: [pinia, router] }, attachTo: document.body })
  return { w, store }
}

const cards = (w: ReturnType<typeof mount>) => w.findAll('[data-test="merchant-card"]')
const more = (w: ReturnType<typeof mount>) => w.find('[data-test="merchants-more"]')

describe('StoresView "Ver más" pagination', () => {
  it('shows 12 of 40, a 44px-class secondary button with the remaining count, and a polite live count', async () => {
    const { w } = await setup(40)
    expect(cards(w)).toHaveLength(12)
    expect(more(w).text()).toBe('Ver más comercios (28 restantes)')
    expect(more(w).classes()).toEqual(expect.arrayContaining(['cx-btn', 'cx-btn-secondary']))
    expect(more(w).classes()).not.toContain('cx-btn-lg')
    expect(w.find('[data-test="stores-shown"]').attributes('aria-live')).toBe('polite')
    expect(w.find('[data-test="stores-shown"]').text()).toBe('Mostrando 12 de 40 comercios')
    expect(w.find('[data-test="stores-count"]').text()).toBe('40 comercios')
    w.unmount()
  })

  it('each click reveals 12 more and the button disappears when everything is shown', async () => {
    const { w } = await setup(40)
    const seen: number[] = []
    for (let i = 0; i < 3; i++) {
      await more(w).trigger('click')
      seen.push(cards(w).length)
    }
    expect(seen).toEqual([24, 36, 40])
    expect(more(w).exists()).toBe(false)
    expect(w.find('[data-test="stores-shown"]').text()).toBe('Mostrando 40 de 40 comercios')
    w.unmount()
  })

  it('has no button for 12 merchants or fewer', async () => {
    const { w } = await setup(12)
    expect(cards(w)).toHaveLength(12)
    expect(more(w).exists()).toBe(false)
    w.unmount()
  })

  it('says "restante" in the singular', async () => {
    const { w } = await setup(13)
    expect(more(w).text()).toBe('Ver más comercios (1 restante)')
    w.unmount()
  })

  it('search, category, sort and zone changes go back to the first 12', async () => {
    const { w, store } = await setup(40)
    await more(w).trigger('click')
    expect(cards(w)).toHaveLength(24)

    await w.find('[data-test="stores-search"]').setValue('Comercio')
    expect(cards(w)).toHaveLength(12)

    await more(w).trigger('click')
    expect(cards(w)).toHaveLength(24)
    await w.findAll('[data-test="stores-category"]')[1].trigger('click') // Pizza: 14 of 40 after the "Comercio" search
    expect(cards(w).length).toBeLessThanOrEqual(14)
    expect(more(w).exists()).toBe(true) // 14 > 12: first page again, 2 remaining
    expect(more(w).text()).toBe('Ver más comercios (2 restantes)')

    await w.findAll('[data-test="stores-category"]')[0].trigger('click')
    await more(w).trigger('click')
    expect(cards(w)).toHaveLength(24)
    await w.find('[data-test="stores-sort"]').setValue('nombre')
    expect(cards(w)).toHaveLength(12)

    await more(w).trigger('click')
    expect(cards(w)).toHaveLength(24)
    store.seleccionarZona('obarrio')
    await flushPromises()
    expect(cards(w)).toHaveLength(12)
    expect(more(w).text()).toBe('Ver más comercios (8 restantes)')
    w.unmount()
  })

  it('the grid lays out only the visible subset: every desktop row of every page is complete', async () => {
    const { w } = await setup(40)
    const spanSum = () => cards(w).reduce((n, c) => n + Number(/cx-cell-(\d)/.exec(c.classes().join(' '))![1]), 0)
    expect(cards(w).every((c) => c.classes().includes('cx-cell-2'))).toBe(true) // 12 = four rows of three
    for (let i = 0; i < 3; i++) {
      expect(spanSum() % 6, `page ${i + 1}`).toBe(0)
      await more(w).trigger('click')
    }
    expect(cards(w)).toHaveLength(40)
    expect(spanSum() % 6).toBe(0) // 40 = 36 + a 2x2 tail of four spans of 3
    w.unmount()
  })

  it('a filtered first page of 1..12 merchants always packs complete rows', async () => {
    const { w } = await setup(40)
    for (const q of ['Comercio 01', 'Comercio 0', 'Comercio 1']) {
      await w.find('[data-test="stores-search"]').setValue(q)
      const total = cards(w).reduce((n, c) => n + Number(/cx-cell-(\d)/.exec(c.classes().join(' '))![1]), 0)
      expect(total % 6, q).toBe(0)
    }
    w.unmount()
  })

  it('moves focus to the first newly revealed merchant', async () => {
    const { w } = await setup(40)
    await more(w).trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(cards(w)[12].element)
    w.unmount()
  })

  it('prints ratings with one decimal', async () => {
    const { w } = await setup(3)
    expect(cards(w)[0].find('[data-test="merchant-rating"]').text()).toBe('4.0')
    w.unmount()
  })
})
