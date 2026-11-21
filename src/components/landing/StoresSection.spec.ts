import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { Cake, Store } from '@lucide/vue'
import StoresSection from './StoresSection.vue'
import { resolveStoreIcon } from './storeIcons'
import { STORES_COPY } from './content'
import type { LandingEstado, Tienda } from '../../composables/useLandingData'

const TIENDAS: Tienda[] = [
  { id: 1, name: 'Fonda Doña Rosa', category: 'Comida típica', zoneName: 'Bella Vista', icon: 'Soup' },
  { id: 2, name: 'Café Casco', category: 'Café y panadería', zoneName: 'El Cangrejo', icon: 'Coffee' },
  { id: 3, name: 'Dulces del Istmo', category: 'Snacks y postres', zoneName: 'Costa del Este', icon: 'Cake' },
]

function mountSection(estado: LandingEstado, tiendas: Tienda[] = []) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/tiendas', name: 'stores', component: { render: () => null } }],
  })
  return mount(StoresSection, { props: { estado, tiendas }, global: { plugins: [router] } })
}

describe('resolveStoreIcon', () => {
  it('maps a known API icon name to its Lucide component', () => {
    expect(resolveStoreIcon('Cake')).toBe(Cake)
  })

  it('falls back to Store for unknown, empty and prototype names', () => {
    expect(resolveStoreIcon('NoExiste')).toBe(Store)
    expect(resolveStoreIcon('')).toBe(Store)
    expect(resolveStoreIcon('constructor')).toBe(Store)
  })
})

describe('StoresSection', () => {
  it('is a labelled section on the white band titled "Comercios en Go Eats" by an h2', () => {
    const w = mountSection('ready', TIENDAS)
    expect(w.element.tagName).toBe('SECTION')
    expect(w.attributes('aria-labelledby')).toBe('lp-stores-title')
    expect(w.classes()).toContain('lp-band-bg')
    expect(w.find('h2#lp-stores-title').text()).toBe('Comercios en Go Eats')
  })

  it('never uses promotional words in any state', () => {
    for (const estado of ['loading', 'ready', 'empty', 'error'] as const) {
      expect(mountSection(estado, TIENDAS).text(), estado).not.toMatch(/destacad|popular|top\b|mejor/i)
    }
  })

  it('renders one tile per store with an h3 name, category, zone and a hidden icon, nothing else', () => {
    const w = mountSection('ready', TIENDAS)
    const tiles = w.findAll('[data-test="store-tile"]')
    expect(tiles).toHaveLength(3)
    expect(w.findAll('li h3').map((h) => h.text())).toEqual(['Fonda Doña Rosa', 'Café Casco', 'Dulces del Istmo'])
    expect(tiles[1].findAll('h3, p').map((e) => e.text())).toEqual(['Café Casco', 'Café y panadería', 'El Cangrejo'])
    for (const t of tiles) {
      expect(t.findAll('svg').length).toBeGreaterThan(0)
      for (const s of t.findAll('svg')) expect(s.attributes('aria-hidden')).toBe('true')
    }
  })

  it('shows no price, rating, ETA, fee, distance or open/closed claim', () => {
    const text = mountSection('ready', TIENDAS).text()
    expect(text).not.toMatch(/\$|B\/|min\b|km\b|abierto|cerrado|envío|★|\d/i)
  })

  it('uses a single secondary link to /tiendas', () => {
    const w = mountSection('ready', TIENDAS)
    const links = w.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0].attributes('href')).toBe('/tiendas')
    expect(links[0].classes()).toContain('lp-btn-secondary')
  })

  it('shows a busy, text-labelled flat skeleton while loading', () => {
    const w = mountSection('loading')
    expect(w.find('[aria-busy="true"]').exists()).toBe(true)
    expect(w.findAll('[data-test="store-skeleton"]')).toHaveLength(3)
    expect(w.find('[role="status"]').text()).toBe(STORES_COPY.loading)
    expect(w.findAll('[data-test="store-tile"]')).toHaveLength(0)
  })

  it('shows the static empty message when there are no stores', () => {
    const w = mountSection('empty')
    expect(w.find('[data-test="stores-fallback"]').text()).toContain(STORES_COPY.empty)
    expect(w.findAll('[data-test="store-tile"]')).toHaveLength(0)
    expect(w.find('[role="alert"]').exists()).toBe(false)
  })

  it('shows the static error message without alert or toast semantics', () => {
    const w = mountSection('error')
    expect(w.find('[data-test="stores-fallback"]').text()).toContain(STORES_COPY.error)
    expect(w.find('[role="alert"]').exists()).toBe(false)
    expect(w.find('h2').text()).toBe('Comercios en Go Eats')
  })

  it('has no gradient or blur', () => {
    expect(mountSection('ready', TIENDAS).html()).not.toMatch(/gradient|blur/i)
  })
})
