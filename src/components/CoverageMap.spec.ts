import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import L from 'leaflet'
import CoverageMap from './CoverageMap.vue'
// @ts-expect-error geo.js ships no type declarations
import { CENTRO_PANAMA, COORDENADAS_ZONAS as ZONAS_RAW } from '../utils/geo'

const COORDENADAS_ZONAS = ZONAS_RAW as Record<string, { lat: number; lng: number }>

/**
 * Characterization of the default (non-estatico) behavior used by StoresView (coverage),
 * OrdersView and CourierView (tracking). Runs real Leaflet in jsdom with the map instance
 * captured through a spy on L.map. jsdom has no layout (container size 0) and no real tiles,
 * so nothing here asserts pixels, projected positions or tile loading.
 */
let instances: L.Map[] = []
let wrappers: VueWrapper[] = []

function mountMap(props: Record<string, unknown> = {}) {
  const w = mount(CoverageMap, { props, attachTo: document.body })
  wrappers.push(w)
  return { w, map: instances[instances.length - 1] }
}

function circleCount(map: L.Map) {
  let n = 0
  map.eachLayer((l) => {
    if (l instanceof L.Circle) n++
  })
  return n
}

const PEDIDO = {
  zona: 'san-francisco',
  comercioId: 'c1',
  comercioNombre: 'Fonda Doña Rosa',
  repartidorNombre: 'Carlos',
  direccionEntrega: 'Calle 50',
}

beforeEach(() => {
  instances = []
  wrappers = []
  const original = L.map.bind(L)
  vi.spyOn(L, 'map').mockImplementation(((...args: Parameters<typeof L.map>) => {
    const m = original(...args)
    instances.push(m)
    return m
  }) as typeof L.map)
})

afterEach(() => {
  for (const w of wrappers) w.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('CoverageMap default (coverage mode)', () => {
  it('creates an interactive map initially set to Panama at zoom 13', () => {
    const setView = vi.spyOn(L.Map.prototype, 'setView')
    const { map } = mountMap()
    expect(setView.mock.calls[0]).toEqual([[CENTRO_PANAMA.lat, CENTRO_PANAMA.lng], 13])
    expect(map.dragging.enabled()).toBe(true)
    expect(map.scrollWheelZoom.enabled()).toBe(true)
    expect(map.touchZoom.enabled()).toBe(true)
    expect(map.doubleClickZoom.enabled()).toBe(true)
    expect(map.boxZoom.enabled()).toBe(true)
    expect(map.keyboard.enabled()).toBe(true)
  })

  it('adds the zoom control bottom-right and no attribution control or caption', () => {
    const { w } = mountMap()
    expect(w.find('.leaflet-bottom.leaflet-right .leaflet-control-zoom').exists()).toBe(true)
    expect(w.find('.leaflet-control-attribution').exists()).toBe(false)
    expect(w.text()).not.toContain('OpenStreetMap')
  })

  it('draws one circle per static zone and the OSM tile layer', () => {
    const { map } = mountMap()
    expect(circleCount(map)).toBe(Object.keys(COORDENADAS_ZONAS).length)
    const urls: string[] = []
    map.eachLayer((l) => {
      if (l instanceof L.TileLayer) urls.push((l as unknown as { _url: string })._url)
    })
    expect(urls).toEqual(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'])
  })

  it('never uses a cartocdn tile URL', () => {
    const { map } = mountMap()
    const urls: string[] = []
    map.eachLayer((l) => {
      if (l instanceof L.TileLayer) urls.push((l as unknown as { _url: string })._url)
    })
    expect(urls).toHaveLength(1)
    expect(urls.join(' ')).not.toContain('cartocdn')
  })

  it('shows the Mi ubicación and Centrar buttons in the control bar', () => {
    const { w } = mountMap()
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Mi ubicación', 'Centrar'])
  })

  it('flies to the selected zone on mount (zoom 14, animated)', () => {
    const fly = vi.spyOn(L.Map.prototype, 'flyTo')
    mountMap({ zonaSeleccionada: 'bella-vista' })
    const z = COORDENADAS_ZONAS['bella-vista']
    expect(fly).toHaveBeenCalledWith([z.lat, z.lng], 14, { duration: 0.8 })
  })

  it('does not call fitBounds', () => {
    const fit = vi.spyOn(L.Map.prototype, 'fitBounds')
    mountMap()
    expect(fit).not.toHaveBeenCalled()
  })

  it('Centrar flies back to the selected zone at zoom 13', async () => {
    const { w } = mountMap({ zonaSeleccionada: 'obarrio' })
    const fly = vi.spyOn(L.Map.prototype, 'flyTo')
    await w.findAll('button')[1].trigger('click')
    const z = COORDENADAS_ZONAS.obarrio
    expect(fly).toHaveBeenCalledWith([z.lat, z.lng], 13, { duration: 0.8 })
  })

  it('Mi ubicación alerts when geolocation is unsupported', async () => {
    const alertSpy = vi.fn()
    vi.stubGlobal('alert', alertSpy)
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined })
    const { w } = mountMap()
    await w.findAll('button')[0].trigger('click')
    expect(alertSpy).toHaveBeenCalledWith('Tu navegador no soporta geolocalización.')
  })

  it('Mi ubicación resolves the nearest zone, emits it and shows the GPS badge', async () => {
    const z = COORDENADAS_ZONAS['bella-vista']
    const getCurrentPosition = vi.fn((ok: (p: unknown) => void, _err?: unknown, _options?: unknown) => ok({ coords: { latitude: z.lat, longitude: z.lng } }))
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } })
    const { w } = mountMap()
    await w.findAll('button')[0].trigger('click')
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(getCurrentPosition.mock.calls[0][2]).toEqual({ timeout: 7000, enableHighAccuracy: true })
    expect(w.emitted('seleccionar-zona')).toEqual([['bella-vista']])
    expect(w.emitted('geolocalizado')).toEqual([[{ lat: z.lat, lng: z.lng, zona: 'bella-vista' }]])
    expect(w.text()).toContain('Zona más cercana:')
    expect(w.find('strong').text()).toBe('bella-vista')
  })

  it('re-renders the selected-zone circle when zonaSeleccionada changes', async () => {
    const { w, map } = mountMap({ zonaSeleccionada: 'obarrio' })
    const fillOf = (slug: string) => {
      const z = COORDENADAS_ZONAS[slug]
      let fill = -1
      map.eachLayer((l) => {
        if (l instanceof L.Circle && Math.abs(l.getLatLng().lat - z.lat) < 1e-9 && Math.abs(l.getLatLng().lng - z.lng) < 1e-9) {
          fill = l.options.fillOpacity as number
        }
      })
      return fill
    }
    expect(fillOf('obarrio')).toBe(0.25)
    expect(fillOf('marbella')).toBe(0.08)
    await w.setProps({ zonaSeleccionada: 'marbella' })
    expect(fillOf('obarrio')).toBe(0.08)
    expect(fillOf('marbella')).toBe(0.25)
  })

  it('removes the map on unmount', () => {
    const { w, map } = mountMap()
    const remove = vi.spyOn(map, 'remove')
    w.unmount()
    wrappers = []
    expect(remove).toHaveBeenCalledTimes(1)
  })
})

describe('CoverageMap default (tracking mode)', () => {
  it('hides Mi ubicación, keeps Centrar and shows the order badge', () => {
    const { w } = mountMap({ modo: 'tracking', pedido: PEDIDO })
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Centrar'])
    expect(w.text()).toContain('Carlos')
    expect(w.text()).toContain('En tránsito')
  })

  it('fits the route with padding 40 (not animate:false) and draws no zone circles', () => {
    const fit = vi.spyOn(L.Map.prototype, 'fitBounds')
    const { map } = mountMap({ modo: 'tracking', pedido: PEDIDO })
    expect(fit).toHaveBeenCalledTimes(1)
    expect(fit.mock.calls[0][1]).toEqual({ padding: [40, 40] })
    expect(circleCount(map)).toBe(0)
  })

  it('advances the courier every 3.5 s and stops after unmount', () => {
    vi.useFakeTimers()
    try {
      const fit = vi.spyOn(L.Map.prototype, 'fitBounds')
      const { w } = mountMap({ modo: 'tracking', pedido: PEDIDO })
      expect(fit).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(3500)
      expect(fit).toHaveBeenCalledTimes(2)
      w.unmount()
      wrappers = []
      vi.advanceTimersByTime(7000)
      expect(fit).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('CoverageMap estatico', () => {
  it('turns every pointer, touch and keyboard interaction off so the page scrolls', () => {
    const { map } = mountMap({ estatico: true })
    expect(map.dragging.enabled()).toBe(false)
    expect(map.touchZoom.enabled()).toBe(false)
    expect(map.scrollWheelZoom.enabled()).toBe(false)
    expect(map.doubleClickZoom.enabled()).toBe(false)
    expect(map.boxZoom.enabled()).toBe(false)
    expect(map.keyboard.enabled()).toBe(false)
  })

  it('renders no zoom control, no control bar and no buttons at all', () => {
    const { w } = mountMap({ estatico: true })
    expect(w.find('.leaflet-control-zoom').exists()).toBe(false)
    expect(w.findAll('button')).toHaveLength(0)
    expect(w.text()).not.toMatch(/Mi ubicación|Centrar/)
  })

  it('shows the visible attribution caption', () => {
    const { w } = mountMap({ estatico: true })
    expect(w.find('[data-test="map-attribution"]').text()).toBe('© OpenStreetMap contributors')
  })

  it('fits the zone circles without animation and never flies', () => {
    const fit = vi.spyOn(L.Map.prototype, 'fitBounds')
    const fly = vi.spyOn(L.Map.prototype, 'flyTo')
    const { map } = mountMap({ estatico: true })
    expect(circleCount(map)).toBe(Object.keys(COORDENADAS_ZONAS).length)
    expect(fit).toHaveBeenCalledTimes(1)
    const [bounds, options] = fit.mock.calls[0] as [L.LatLngBounds, L.FitBoundsOptions]
    expect(options.animate).toBe(false)
    for (const z of Object.values(COORDENADAS_ZONAS)) {
      expect(bounds.contains([z.lat, z.lng])).toBe(true)
    }
    expect(fly).not.toHaveBeenCalled()
  })

  it('keeps the default caption-free, interactive map when estatico is false', () => {
    const { w, map } = mountMap({ estatico: false })
    expect(map.dragging.enabled()).toBe(true)
    expect(w.find('[data-test="map-attribution"]').exists()).toBe(false)
    expect(w.findAll('button')).toHaveLength(2)
  })
})
