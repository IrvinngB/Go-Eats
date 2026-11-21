import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }))

import api from '../services/api'
import { selectFeatured, useLandingData } from './useLandingData'

const get = vi.mocked(api.get)

function merchant(n: number, over: Record<string, unknown> = {}) {
  return {
    id: n,
    code: `M-${n}`,
    name: `Comercio ${n}`,
    category_type: 'Pizzería',
    zone_slug: 'bella-vista',
    rating: 4.9,
    delivery_time: '25 min',
    is_open: true,
    affiliation_status: 'activo',
    opens_at: '08:00',
    closes_at: '20:00',
    description: 'texto',
    icon: 'Pizza',
    ...over,
  }
}

const ZONES = [
  { id: 1, slug: 'bella-vista', name: 'Bella Vista', delivery_fee: 2.5, distance_km: 3, is_active: true },
  { id: 2, slug: 'el-cangrejo', name: 'El Cangrejo', delivery_fee: 3, distance_km: 5, is_active: true },
  { id: 3, slug: 'zona-cerrada', name: 'Zona Cerrada', delivery_fee: 9, distance_km: 40, is_active: false },
]

function respond(merchants: unknown, zones: unknown = ZONES) {
  get.mockImplementation((url: string) => {
    if (url === '/merchants/') return typeof merchants === 'function' ? (merchants as () => Promise<unknown>)() : Promise.resolve({ data: merchants })
    if (url === '/zones/') return typeof zones === 'function' ? (zones as () => Promise<unknown>)() : Promise.resolve({ data: zones })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

function setup() {
  let data!: ReturnType<typeof useLandingData>
  const wrapper = mount(
    defineComponent({
      setup() {
        data = useLandingData()
        return () => h('div')
      },
    }),
  )
  return { data, wrapper }
}

describe('selectFeatured', () => {
  it('keeps only activo, in API order, capped at 6, with only the five public fields', () => {
    const raw = [
      merchant(1, { affiliation_status: 'pendiente' }),
      ...[2, 3, 4, 5, 6, 7, 8, 9].map((n) => merchant(n)),
      merchant(10, { affiliation_status: 'suspendido' }),
    ]
    const out = selectFeatured(raw as never, [])
    expect(out.map((t) => t.id)).toEqual([2, 3, 4, 5, 6, 7])
    expect(Object.keys(out[0]).sort()).toEqual(['category', 'icon', 'id', 'name', 'zoneName'])
  })

  it('resolves the zone name from the zones list and humanizes the slug when unknown', () => {
    const out = selectFeatured(
      [merchant(1, { zone_slug: 'el-cangrejo' }), merchant(2, { zone_slug: 'costa-del-este' })] as never,
      [{ id: 2, slug: 'el-cangrejo', name: 'El Cangrejo' }],
    )
    expect(out.map((t) => t.zoneName)).toEqual(['El Cangrejo', 'Costa del este'])
  })
})

describe('useLandingData', () => {
  beforeEach(() => {
    get.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts loading, then exposes active stores and active zones', async () => {
    respond([merchant(1), merchant(2, { affiliation_status: 'pendiente' }), merchant(3)])
    const { data } = setup()
    expect(data.estado.value).toBe('loading')
    expect(data.loading.value).toBe(true)
    await flushPromises()
    expect(data.estado.value).toBe('ready')
    expect(data.tiendas.value.map((t) => t.id)).toEqual([1, 3])
    expect(data.tiendas.value[0].zoneName).toBe('Bella Vista')
    expect(data.zonas.value.map((z) => z.slug)).toEqual(['bella-vista', 'el-cangrejo'])
  })

  it('calls /merchants/ and /zones/ with a 5 s timeout and an abort signal', async () => {
    respond([merchant(1)])
    setup()
    await flushPromises()
    const calls = get.mock.calls
    expect(calls.map((c) => c[0]).sort()).toEqual(['/merchants/', '/zones/'])
    for (const [, config] of calls) {
      expect(config?.timeout).toBe(5000)
      expect(config?.signal).toBeInstanceOf(AbortSignal)
    }
  })

  it('caps the stores at 6', async () => {
    respond([1, 2, 3, 4, 5, 6, 7, 8].map((n) => merchant(n)))
    const { data } = setup()
    await flushPromises()
    expect(data.tiendas.value).toHaveLength(6)
  })

  it('reports empty when no store is activo', async () => {
    respond([merchant(1, { affiliation_status: 'pendiente' })])
    const { data } = setup()
    await flushPromises()
    expect(data.estado.value).toBe('empty')
    expect(data.empty.value).toBe(true)
    expect(data.tiendas.value).toEqual([])
  })

  it('reports empty for an empty or non-array payload', async () => {
    respond({ detail: 'x' })
    const { data } = setup()
    await flushPromises()
    expect(data.estado.value).toBe('empty')
  })

  it('reports error and warns exactly once when the stores request fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    respond(() => Promise.reject(new Error('Network Error')), () => Promise.reject(new Error('Network Error')))
    const { data } = setup()
    await flushPromises()
    expect(data.estado.value).toBe('error')
    expect(data.error.value).toBe(true)
    expect(data.zonas.value).toEqual([])
    expect(data.zonasError.value).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(error).not.toHaveBeenCalled()
  })

  it('keeps the stores when only /zones/ fails, falling back to the slug label', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    respond([merchant(1)], () => Promise.reject(new Error('500')))
    const { data } = setup()
    await flushPromises()
    expect(data.estado.value).toBe('ready')
    expect(data.tiendas.value[0].zoneName).toBe('Bella vista')
    expect(data.zonasError.value).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('aborts both requests on unmount and stays silent', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const signals: AbortSignal[] = []
    get.mockImplementation(((_url: string, config?: { signal?: AbortSignal }) => {
      signals.push(config!.signal!)
      return new Promise((_, reject) => config!.signal!.addEventListener('abort', () => reject(new Error('canceled'))))
    }) as never)
    const { data, wrapper } = setup()
    expect(signals).toHaveLength(2)
    expect(signals.map((s) => s.aborted)).toEqual([false, false])
    wrapper.unmount()
    await flushPromises()
    expect(signals.map((s) => s.aborted)).toEqual([true, true])
    expect(warn).not.toHaveBeenCalled()
    expect(data.estado.value).toBe('loading')
  })
})
