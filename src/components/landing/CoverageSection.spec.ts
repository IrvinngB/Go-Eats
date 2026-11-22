import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import CoverageSection from './CoverageSection.vue'
import { COVERAGE_COPY } from './content'
import type { Zona } from '../../composables/useLandingData'

vi.mock('../CoverageMap.vue', () => ({
  __esModule: true,
  default: defineComponent({
    name: 'CoverageMapStub',
    props: { estatico: Boolean, altura: { type: String, default: '' } },
    setup: (props) => () => h('div', { 'data-test': 'map-stub', 'data-estatico': String(props.estatico) }),
  }),
}))

const ZONAS: Zona[] = [
  { id: 1, slug: 'bella-vista', name: 'Bella Vista' },
  { id: 2, slug: 'el-cangrejo', name: 'El Cangrejo' },
  { id: 3, slug: 'obarrio', name: 'Obarrio' },
]

interface Observed {
  callback: IntersectionObserverCallback
  options?: IntersectionObserverInit
  target: Element | null
  disconnected: boolean
}
let observers: Observed[] = []

function stubObserver() {
  class FakeObserver {
    record: Observed
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.record = { callback, options, target: null, disconnected: false }
      observers.push(this.record)
    }
    observe(el: Element) {
      this.record.target = el
    }
    unobserve() {}
    disconnect() {
      this.record.disconnected = true
    }
    takeRecords() {
      return []
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeObserver)
}

function intersect(i = 0, isIntersecting = true) {
  const o = observers[i]
  o.callback([{ isIntersecting, target: o.target } as unknown as IntersectionObserverEntry], {} as IntersectionObserver)
}

/** The observer is created in a ref watcher, so it is armed one tick after mount. */
async function mountSectionArmed(props: { zonas?: Zona[]; zonasError?: boolean; cargando?: boolean } = {}) {
  const w = mountSection(props)
  await flushPromises()
  return w
}

function mountSection(props: { zonas?: Zona[]; zonasError?: boolean; cargando?: boolean } = {}) {
  return mount(CoverageSection, {
    props: { zonas: ZONAS, zonasError: false, cargando: false, ...props },
    attachTo: document.body,
  })
}

beforeEach(() => {
  observers = []
})
afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('CoverageSection structure', () => {
  it('is the #cobertura section on the surface band, labelled by its h2', () => {
    stubObserver()
    const w = mountSection()
    expect(w.element.tagName).toBe('SECTION')
    expect(w.attributes('id')).toBe('cobertura')
    expect(w.classes()).toContain('lp-band-surface')
    expect(w.attributes('aria-labelledby')).toBe('lp-coverage-title')
    expect(w.find('h2#lp-coverage-title').text()).toBe('Zonas donde opera Go Eats')
  })

  it('shows one chip per zone name, in order, and nothing else in the list', () => {
    stubObserver()
    const w = mountSection()
    expect(w.findAll('[data-test="zone-chip"]').map((c) => c.text())).toEqual(['Bella Vista', 'El Cangrejo', 'Obarrio'])
    expect(w.findAll('ul li')).toHaveLength(3)
  })

  it('makes no claim beyond the zones list in any state', () => {
    stubObserver()
    const states = [{}, { zonas: [] }, { zonasError: true, zonas: [] }, { cargando: true, zonas: [] }]
    for (const s of states) {
      const text = mountSection(s).text()
      expect(text, JSON.stringify(s)).not.toMatch(/\d|min\b|minutos|\$|B\/|km|gratis|rápid|tiempo real|en vivo/i)
    }
  })

  it('has no button, link or geolocation affordance', () => {
    stubObserver()
    const w = mountSection()
    expect(w.findAll('button, a')).toHaveLength(0)
    expect(w.text()).not.toMatch(/ubicación|GPS/i)
  })
})

describe('CoverageSection fallback', () => {
  it('shows the error text, no chips and no map when zones failed', async () => {
    stubObserver()
    const w = mountSection({ zonas: [], zonasError: true })
    expect(w.find('[data-test="coverage-fallback"]').text()).toBe(COVERAGE_COPY.error)
    expect(w.findAll('[data-test="zone-chip"]')).toHaveLength(0)
    expect(observers).toHaveLength(0)
    await flushPromises()
    expect(w.find('[data-test="map-stub"]').exists()).toBe(false)
  })

  it('shows the empty text when the API returned no active zones', () => {
    stubObserver()
    const w = mountSection({ zonas: [] })
    expect(w.find('[data-test="coverage-fallback"]').text()).toBe(COVERAGE_COPY.empty)
  })

  it('shows neither chips nor fallback while loading', () => {
    stubObserver()
    const w = mountSection({ zonas: [], cargando: true })
    expect(w.find('[data-test="coverage-fallback"]').exists()).toBe(false)
    expect(w.findAll('[data-test="zone-chip"]')).toHaveLength(0)
  })

  it('never renders role=alert', () => {
    stubObserver()
    expect(mountSection({ zonas: [], zonasError: true }).find('[role="alert"]').exists()).toBe(false)
  })
})

describe('CoverageSection lazy map', () => {
  it('does not render the map before the section nears the viewport', async () => {
    stubObserver()
    const w = mountSection()
    await flushPromises()
    expect(w.find('[data-test="map-stub"]').exists()).toBe(false)
  })

  it('observes the map wrapper with a 200px root margin', async () => {
    stubObserver()
    const w = await mountSectionArmed()
    expect(observers).toHaveLength(1)
    expect(observers[0].options?.rootMargin).toBe('200px')
    expect(observers[0].target).toBe(w.find('[data-test="map-wrapper"]').element)
  })

  it('renders the static map once the wrapper intersects, and stops observing', async () => {
    stubObserver()
    const w = await mountSectionArmed()
    intersect()
    await flushPromises()
    const map = w.find('[data-test="map-stub"]')
    expect(map.exists()).toBe(true)
    expect(map.attributes('data-estatico')).toBe('true')
    expect(observers[0].disconnected).toBe(true)
  })

  it('ignores entries that are not intersecting', async () => {
    stubObserver()
    const w = await mountSectionArmed()
    intersect(0, false)
    await flushPromises()
    expect(w.find('[data-test="map-stub"]').exists()).toBe(false)
    expect(observers[0].disconnected).toBe(false)
  })

  it('wraps the map in role=img with an aria-label naming the zones, even before it loads', () => {
    stubObserver()
    const w = mountSection()
    const wrapper = w.find('[data-test="map-wrapper"]')
    expect(wrapper.attributes('role')).toBe('img')
    expect(wrapper.attributes('aria-label')).toBe(COVERAGE_COPY.mapLabel)
  })

  it('shows only the chips, never the map, when IntersectionObserver is unsupported', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const w = mountSection()
    await flushPromises()
    expect(w.findAll('[data-test="zone-chip"]')).toHaveLength(3)
    expect(w.find('[data-test="map-wrapper"]').exists()).toBe(false)
    expect(w.find('[data-test="map-stub"]').exists()).toBe(false)
  })

  it('starts observing when the zones arrive after mount, and disconnects on unmount', async () => {
    stubObserver()
    const w = mountSection({ zonas: [], cargando: true })
    expect(observers).toHaveLength(0)
    await w.setProps({ zonas: ZONAS, cargando: false })
    expect(observers).toHaveLength(1)
    w.unmount()
    expect(observers[0].disconnected).toBe(true)
  })
})
