import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import L from 'leaflet'
import AddressPickerMap from './AddressPickerMap.vue'
// @ts-expect-error geo.js ships no type declarations
import { CENTRO_PANAMA } from '../utils/geo'

/**
 * jsdom + real Leaflet with the map instance captured through a spy on L.map (same pattern as
 * CoverageMap.spec). jsdom has no layout and does not load tiles, so nothing here asserts pixels.
 */
let instances: L.Map[] = []
let wrappers: VueWrapper[] = []

function mountPicker(props: Record<string, unknown> = {}) {
  const w = mount(AddressPickerMap, { props: { modelValue: null, ...props }, attachTo: document.body })
  wrappers.push(w)
  return { w, map: instances[instances.length - 1] }
}

function markers(map: L.Map) {
  const found: L.Marker[] = []
  map.eachLayer((l) => {
    if (l instanceof L.Marker) found.push(l)
  })
  return found
}

const lat = (w: VueWrapper) => w.find<HTMLInputElement>('[data-test="lat-input"]')
const lng = (w: VueWrapper) => w.find<HTMLInputElement>('[data-test="lng-input"]')
const last = (w: VueWrapper) => {
  const all = w.emitted('update:modelValue')
  return all ? all[all.length - 1] : undefined
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

describe('AddressPickerMap map interaction', () => {
  it('starts centred on Panama with no pin when there is no value', () => {
    const setView = vi.spyOn(L.Map.prototype, 'setView')
    const { map } = mountPicker()
    expect(setView.mock.calls[0]).toEqual([[CENTRO_PANAMA.lat, CENTRO_PANAMA.lng], 13])
    expect(markers(map)).toHaveLength(0)
  })

  it('shows the saved pin and fills the inputs from modelValue', () => {
    const { w, map } = mountPicker({ modelValue: { lat: 8.9824, lng: -79.5199 } })
    const [pin] = markers(map)
    expect(pin.getLatLng()).toMatchObject({ lat: 8.9824, lng: -79.5199 })
    expect(lat(w).element.value).toBe('8.9824')
    expect(lng(w).element.value).toBe('-79.5199')
  })

  it('a map click places the pin and emits the rounded coordinates', async () => {
    const { w, map } = mountPicker()
    map.fire('click', { latlng: L.latLng(8.98765432, -79.51234567) })
    await w.vm.$nextTick()
    expect(last(w)).toEqual([{ lat: 8.987654, lng: -79.512346 }])
    expect(markers(map)).toHaveLength(1)
  })

  it('dragging the marker emits the new position', async () => {
    const { w, map } = mountPicker({ modelValue: { lat: 8.98, lng: -79.5 } })
    const [pin] = markers(map)
    pin.setLatLng([9.01, -79.45])
    pin.fire('dragend')
    await w.vm.$nextTick()
    expect(last(w)).toEqual([{ lat: 9.01, lng: -79.45 }])
    expect(pin.dragging?.enabled()).toBe(true)
  })

  it('wraps a click made on a repeated world copy back into -180..180', () => {
    const { w, map } = mountPicker()
    map.fire('click', { latlng: L.latLng(8.99, -79.5 + 360) })
    expect(last(w)).toEqual([{ lat: 8.99, lng: -79.5 }])
  })

  it('moves the pin and the inputs when the parent changes modelValue', async () => {
    const { w, map } = mountPicker({ modelValue: { lat: 8.98, lng: -79.5 } })
    await w.setProps({ modelValue: { lat: 9.02, lng: -79.46 } })
    expect(markers(map)[0].getLatLng()).toMatchObject({ lat: 9.02, lng: -79.46 })
    expect(lat(w).element.value).toBe('9.02')
    expect(markers(map)).toHaveLength(1)
  })

  it('removes the pin when modelValue becomes null', async () => {
    const { w, map } = mountPicker({ modelValue: { lat: 8.98, lng: -79.5 } })
    await w.setProps({ modelValue: null })
    expect(markers(map)).toHaveLength(0)
    expect(lat(w).element.value).toBe('')
  })

  it('disabled ignores clicks, locks the inputs and the drag handle', () => {
    const { w, map } = mountPicker({ modelValue: { lat: 8.98, lng: -79.5 }, disabled: true })
    map.fire('click', { latlng: L.latLng(9, -79.4) })
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(lat(w).element.disabled).toBe(true)
    expect(lng(w).element.disabled).toBe(true)
    expect(markers(map)[0].dragging?.enabled()).toBe(false)
  })

  it('removes the map on unmount', () => {
    const { w, map } = mountPicker()
    const remove = vi.spyOn(map, 'remove')
    w.unmount()
    wrappers = []
    expect(remove).toHaveBeenCalledTimes(1)
  })
})

describe('AddressPickerMap typed coordinates (the non-map path)', () => {
  it('valid latitude and longitude emit and move the pin', async () => {
    const { w } = mountPicker()
    await lat(w).setValue('8.99')
    expect(w.emitted('update:modelValue')).toBeUndefined() // a lone value never emits
    await lng(w).setValue('-79.51')
    expect(last(w)).toEqual([{ lat: 8.99, lng: -79.51 }])
    expect(w.find('[data-test="coord-error"]').exists()).toBe(false)
  })

  it('moves the pin even when the parent does not echo modelValue back', async () => {
    const { w, map } = mountPicker()
    await lat(w).setValue('8.99')
    await lng(w).setValue('-79.51')
    expect(markers(map)[0].getLatLng()).toMatchObject({ lat: 8.99, lng: -79.51 })
  })

  it.each([
    ['91', '-79.5', 'La latitud debe estar entre -90 y 90.'],
    ['-90.5', '-79.5', 'La latitud debe estar entre -90 y 90.'],
    ['8.9', '181', 'La longitud debe estar entre -180 y 180.'],
    ['abc', '-79.5', 'La latitud debe ser un número.'],
    ['8.9', '1e999', 'La longitud debe ser un número.'],
  ])('lat %s / lng %s shows "%s" and does not emit', async (a, b, message) => {
    const { w } = mountPicker()
    await lat(w).setValue(a)
    await lng(w).setValue(b)
    expect(w.find('[data-test="coord-error"]').text()).toBe(message)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('accepts the exact range limits', async () => {
    const { w } = mountPicker()
    await lat(w).setValue('-90')
    await lng(w).setValue('180')
    expect(last(w)).toEqual([{ lat: -90, lng: 180 }])
  })

  it('one value without the other asks for both and flags the empty field', async () => {
    const { w } = mountPicker({ modelValue: { lat: 8.98, lng: -79.5 } })
    await lng(w).setValue('')
    expect(w.find('[data-test="coord-error"]').text()).toBe('Ingresa latitud y longitud juntas, o deja ambas vacías.')
    expect(lng(w).attributes('aria-invalid')).toBe('true')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('clearing both inputs emits null', async () => {
    const { w } = mountPicker({ modelValue: { lat: 8.98, lng: -79.5 } })
    await lat(w).setValue('')
    await lng(w).setValue('')
    expect(last(w)).toEqual([null])
    expect(w.find('[data-test="coord-error"]').exists()).toBe(false)
  })

  it('the clear button emits null and empties the inputs', async () => {
    const { w } = mountPicker({ modelValue: { lat: 8.98, lng: -79.5 } })
    await w.find('[data-test="clear-pin"]').trigger('click')
    expect(last(w)).toEqual([null])
    expect(lat(w).element.value).toBe('')
  })
})

describe('AddressPickerMap accessibility and copy', () => {
  it('labels the region, the map and both inputs', () => {
    const { w } = mountPicker()
    expect(w.find('[role="group"]').attributes('aria-label')).toBe('Ubicación de entrega en el mapa')
    expect(w.find('[data-test="map-canvas"]').attributes('aria-label')).toBe('Mapa: haz clic para fijar la ubicación de entrega')
    expect(lat(w).attributes('aria-label')).toBe('Latitud')
    expect(lng(w).attributes('aria-label')).toBe('Longitud')
    expect(w.find(`label[for="${lat(w).attributes('id')}"]`).text()).toBe('Latitud')
    expect(w.find(`label[for="${lng(w).attributes('id')}"]`).text()).toBe('Longitud')
  })

  it('shows a visible hint explaining both paths and a visible attribution caption', () => {
    const { w } = mountPicker()
    expect(w.find('[data-test="map-hint"]').text()).toBe(
      'Haz clic en el mapa o arrastra el marcador para fijar tu ubicación. También puedes escribir la latitud y la longitud.',
    )
    expect(w.find('[data-test="map-attribution"]').text()).toBe('© OpenStreetMap contributors')
    expect(w.find('.leaflet-control-attribution').exists()).toBe(false)
  })

  it('inputs and the clear button are native, keyboard focusable controls (no negative tabindex)', () => {
    const { w } = mountPicker({ modelValue: { lat: 8.98, lng: -79.5 } })
    const controls = [lat(w), lng(w), w.find('[data-test="clear-pin"]')]
    expect(controls.map((c) => c.element.tagName)).toEqual(['INPUT', 'INPUT', 'BUTTON'])
    expect(controls.map((c) => c.attributes('tabindex'))).toEqual([undefined, undefined, undefined])
  })

  it('links an input error to the input through aria-describedby', async () => {
    const { w } = mountPicker()
    await lat(w).setValue('99')
    await lng(w).setValue('-79.5')
    const errorId = w.find('[data-test="coord-error"]').attributes('id')
    expect(lat(w).attributes('aria-describedby')).toContain(errorId)
    expect(lat(w).attributes('aria-invalid')).toBe('true')
  })
})

describe('AddressPickerMap coverage hint (soft, never a block)', () => {
  const MSG = 'Esta ubicación está fuera de las zonas de cobertura'

  it('shows an info message for a pin outside every zone and still emits it', async () => {
    const { w } = mountPicker()
    await lat(w).setValue('9.3547')
    await lng(w).setValue('-79.9')
    const hint = w.find('[data-test="coverage-hint"]')
    expect(hint.text()).toBe(MSG)
    // the live region is always rendered, so the screen reader announces the message when it appears
    expect(w.find('[role="status"] [data-test="coverage-hint"]').exists()).toBe(true)
    expect(last(w)).toEqual([{ lat: 9.3547, lng: -79.9 }])
  })

  it('shows nothing for a pin inside a zone', () => {
    const { w } = mountPicker({ modelValue: { lat: 8.9865, lng: -79.4975 } })
    expect(w.find('[data-test="coverage-hint"]').exists()).toBe(false)
  })

  it('shows nothing when there is no pin yet', () => {
    const { w } = mountPicker()
    expect(w.find('[data-test="coverage-hint"]').exists()).toBe(false)
  })
})

describe('AddressPickerMap network', () => {
  it('only the OSM tile layer exists and no fetch or XHR is made (no geocoding, no keys)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const xhr = vi.spyOn(XMLHttpRequest.prototype, 'open')
    const { w, map } = mountPicker()
    map.fire('click', { latlng: L.latLng(8.99, -79.5) })
    await lat(w).setValue('9.01')
    await lng(w).setValue('-79.45')
    const urls: string[] = []
    map.eachLayer((l) => {
      if (l instanceof L.TileLayer) urls.push((l as unknown as { _url: string })._url)
    })
    expect(urls).toEqual(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'])
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhr).not.toHaveBeenCalled()
  })
})
