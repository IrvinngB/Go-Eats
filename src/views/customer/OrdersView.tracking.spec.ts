import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import OrdersView from './OrdersView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

type Pedido = Record<string, unknown>

function pedido(estado: string, extra: Pedido = {}): Pedido {
  return {
    id: 'PED-1', comercioId: 'c1', comercioNombre: 'Diablicos', clienteNombre: 'Ana', clienteTelefono: '', zona: 'z',
    direccion: 'Calle 1', items: [{ nombre: 'Arroz', cantidad: 2, precio: 3.5, observacion: '' }], subtotal: 7, tarifaEnvio: 1, total: 8, estado,
    metodoPago: 'contr_entrega', repartidorId: null, observaciones: '', motivoCancelacion: null, calificacion: null, fecha: '20 nov, 10:30', ...extra,
  }
}

interface Datos {
  pedidos: Pedido[]
  comercios?: Array<Record<string, unknown>>
  repartidores?: Array<Record<string, unknown>>
}

const montados: Array<{ unmount: () => void }> = []

function setup(d: Datos | Pedido) {
  const datos: Datos = Array.isArray((d as Datos).pedidos) ? (d as Datos) : { pedidos: [d as Pedido] }
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'customer'
  store.usuario = { nombre: 'Ana', email: 'ana@t.pa', telefono: '', consentimientoLey81: true }
  store.pedidos = datos.pedidos
  store.comercios = datos.comercios ?? [{ id: 'c1', nombre: 'Diablicos', tiempoEntrega: '25-35 min' }]
  store.repartidores = datos.repartidores ?? []
  const wrapper = mount(OrdersView, { attachTo: document.body, global: { plugins: [pinia], stubs: { CoverageMap: true, RouterLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } } })
  montados.push(wrapper)
  return { wrapper, store }
}

const find = (w: ReturnType<typeof setup>, sel: string) => w.wrapper.find(sel)
const all = (w: ReturnType<typeof setup>, sel: string) => w.wrapper.findAll(sel)

const repartidor = { id: 'r2', nombre: 'María Cedeño', telefono: '6234-9876', rating: 4.8 }

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  // Dialogs hold a document keydown listener and a scroll-lock counter: unmount every wrapper.
  while (montados.length) montados.pop()!.unmount()
  document.body.innerHTML = ''
})

describe('ETA tile: only what the merchant data has', () => {
  it('shows the merchant delivery range for an order in progress, labelled as the merchant estimate', () => {
    const w = setup(pedido('en_preparacion'))
    const tile = find(w, '[data-test="eta-tile"]')
    expect(tile.exists()).toBe(true)
    expect(tile.find('.cx-eta').text()).toBe('25–35')
    expect(tile.text()).toContain('min')
    expect(tile.text()).toContain('Tiempo estimado del comercio')
  })

  it('renders no ETA tile when the merchant has no delivery time (no fake minutes)', () => {
    const w = setup({ pedidos: [pedido('en_camino')], comercios: [{ id: 'c1', nombre: 'Diablicos' }] })
    expect(find(w, '[data-test="eta-tile"]').exists()).toBe(false)
    expect(find(w, '[data-test="status-tile"]').exists()).toBe(true)
  })

  it('renders no ETA tile when the merchant is unknown', () => {
    const w = setup({ pedidos: [pedido('en_camino')], comercios: [] })
    expect(find(w, '[data-test="eta-tile"]').exists()).toBe(false)
  })

  it.each(['entregado', 'rechazado', 'cancelado'])('terminal state %s has no ETA tile even when the merchant has a delivery time', (estado) => {
    expect(find(setup(pedido(estado, { motivoCancelacion: 'x' })), '[data-test="eta-tile"]').exists()).toBe(false)
  })

  it('never prints the invented 12-18 min', () => {
    expect(setup(pedido('en_camino')).wrapper.text()).not.toMatch(/12\s*[-–]\s*18/)
  })
})

describe('status tile and progress', () => {
  it('shows the chip with icon + Spanish text, a polite live region and the progress bar with step dots', () => {
    const w = setup(pedido('en_preparacion'))
    const tile = find(w, '[data-test="status-tile"]')
    expect(tile.find('.cx-estado').text()).toContain('En preparación')
    expect(tile.find('.cx-estado svg').exists()).toBe(true)
    expect(tile.find('[aria-live="polite"]').text()).toContain('En preparación')
    const bar = tile.find('[data-test="timeline-progress"]')
    expect(bar.attributes('role')).toBe('progressbar')
    expect(bar.attributes('aria-valuenow')).toBe('3')
    expect(tile.findAll('[data-test="progress-dot"]')).toHaveLength(6)
  })

  it('rechazado and cancelado have no progress bar and no timeline steps', () => {
    for (const e of ['rechazado', 'cancelado']) {
      const w = setup(pedido(e, { motivoCancelacion: 'x' }))
      expect(find(w, '[data-test="timeline-progress"]').exists()).toBe(false)
      expect(all(w, '[data-test="timeline-step"]')).toHaveLength(0)
    }
  })

  it('updates when the order state changes (the live region follows the store)', async () => {
    const w = setup(pedido('en_preparacion'))
    w.store.pedidos[0].estado = 'en_camino'
    await nextTick()
    expect(find(w, '[data-test="status-tile"] [aria-live="polite"]').text()).toContain('En camino')
    expect(find(w, '[data-test="timeline-progress"]').attributes('aria-valuenow')).toBe('5')
  })
})

describe('terminal banner', () => {
  it('rechazado: danger alert with the label and the reason', () => {
    const w = setup(pedido('rechazado', { motivoCancelacion: 'Cerrado' }))
    const b = find(w, '[data-test="estado-terminal"]')
    expect(b.text()).toBe('Rechazado: Cerrado')
    expect(b.classes()).toContain('cx-alert-danger')
    expect(b.find('svg').exists()).toBe(true)
  })

  it('cancelado without a reason says so', () => {
    expect(find(setup(pedido('cancelado')), '[data-test="estado-terminal"]').text()).toBe('Cancelado: Sin motivo registrado.')
  })
})

describe('courier tile: only data the API has', () => {
  const enCamino = (extra: Pedido = {}) => pedido('en_camino', { repartidorId: 'r2', ...extra })

  it('full data: 48px avatar slot, name, rating with one decimal, a call link with a name', () => {
    const w = setup({ pedidos: [enCamino()], repartidores: [repartidor] })
    const tile = find(w, '[data-test="courier-tile"]')
    expect(tile.find('.cx-h3').text()).toBe('María Cedeño')
    expect(tile.text()).toContain('Tu repartidor en camino')
    expect(tile.find('[data-test="courier-rating"]').text()).toBe('4.8')
    const call = tile.find('a[data-test="courier-call"]')
    expect(call.attributes('href')).toBe('tel:6234-9876')
    expect(call.attributes('aria-label')).toBe('Llamar a María Cedeño')
  })

  it('formats the rating with formatRating (one decimal)', () => {
    const w = setup({ pedidos: [enCamino()], repartidores: [{ ...repartidor, rating: 4 }] })
    expect(find(w, '[data-test="courier-rating"]').text()).toBe('4.0')
  })

  it('missing phone: no call link at all, and no invented number', () => {
    const w = setup({ pedidos: [enCamino()], repartidores: [{ ...repartidor, telefono: '' }] })
    expect(all(w, 'a[href^="tel:"]')).toHaveLength(0)
    expect(w.wrapper.text()).not.toContain('6812-3344')
    expect(find(w, '[data-test="courier-tile"]').exists()).toBe(true)
  })

  it('missing rating: says "Sin calificaciones", never 4.9', () => {
    const w = setup({ pedidos: [enCamino()], repartidores: [{ ...repartidor, rating: null }] })
    const tile = find(w, '[data-test="courier-tile"]')
    expect(tile.find('[data-test="courier-rating"]').exists()).toBe(false)
    expect(tile.text()).toContain('Sin calificaciones')
    expect(w.wrapper.text()).not.toContain('4.9')
  })

  it('zero rating counts as no rating', () => {
    const w = setup({ pedidos: [enCamino()], repartidores: [{ ...repartidor, rating: 0 }] })
    expect(find(w, '[data-test="courier-tile"]').text()).toContain('Sin calificaciones')
  })

  it('courier missing from the store: falls back to the order name, no phone, no rating number', () => {
    const w = setup({ pedidos: [enCamino({ repartidorNombre: 'José' })], repartidores: [] })
    const tile = find(w, '[data-test="courier-tile"]')
    expect(tile.find('.cx-h3').text()).toBe('José')
    expect(all(w, 'a[href^="tel:"]')).toHaveLength(0)
    expect(tile.text()).toContain('Sin calificaciones')
  })

  it('courier with no name anywhere: neutral title, still no invented data', () => {
    const w = setup({ pedidos: [enCamino()], repartidores: [] })
    expect(find(w, '[data-test="courier-tile"] .cx-h3').text()).toBe('Tu repartidor')
  })

  it('has no chat button (there is no chat feature) and no vehicle or plate', () => {
    const w = setup({ pedidos: [enCamino()], repartidores: [repartidor] })
    expect(w.wrapper.html()).not.toMatch(/chat/i)
    expect(find(w, '[data-test="courier-tile"] .cx-mono').exists()).toBe(false)
  })

  it('only while en_camino and assigned', () => {
    expect(find(setup({ pedidos: [pedido('listo_para_recoger', { repartidorId: 'r2' })], repartidores: [repartidor] }), '[data-test="courier-tile"]').exists()).toBe(false)
    expect(find(setup({ pedidos: [pedido('en_camino')], repartidores: [repartidor] }), '[data-test="courier-tile"]').exists()).toBe(false)
  })
})

describe('map tile', () => {
  it('offers the live map for the three in-progress states and toggles the embedded CoverageMap', async () => {
    const w = setup(pedido('en_preparacion'))
    expect(find(w, '[data-test="map-tile"]').exists()).toBe(true)
    expect(find(w, '[data-test="map-toggle"]').text()).toContain('Ver seguimiento en mapa en vivo')
    expect(find(w, '[data-test="map-toggle"]').attributes('aria-expanded')).toBe('false')
    await find(w, '[data-test="map-toggle"]').trigger('click')
    expect(find(w, '.cx-trackmap').exists()).toBe(true)
    expect(find(w, '[data-test="map-toggle"]').attributes('aria-expanded')).toBe('true')
    expect(find(w, '[data-test="map-toggle"]').text()).toContain('Ocultar mapa')
    await find(w, '[data-test="map-toggle"]').trigger('click')
    expect(find(w, '.cx-trackmap').exists()).toBe(false)
  })

  it.each(['pendiente', 'confirmado', 'entregado', 'rechazado', 'cancelado'])('no map tile for %s', (e) => {
    expect(find(setup(pedido(e)), '[data-test="map-tile"]').exists()).toBe(false)
  })
})

describe('layout roles: one hero, one primary', () => {
  it('only the first order in progress is the active tile (the one with the shadow)', () => {
    const w = setup({ pedidos: [pedido('en_camino', { id: 'PED-2' }), pedido('en_preparacion', { id: 'PED-1' })] })
    const activos = all(w, '.cx-active')
    expect(activos).toHaveLength(1)
    expect(activos[0].text()).toContain('PED-2')
    expect(all(w, '[data-test="order-card"]')).toHaveLength(2)
  })

  it('at most one primary button on the whole view (map action while something is in progress)', () => {
    const w = setup({ pedidos: [pedido('en_camino', { id: 'PED-2' }), pedido('en_preparacion', { id: 'PED-1' }), pedido('entregado', { id: 'PED-3' }), pedido('entregado', { id: 'PED-4' })] })
    const primarios = all(w, '.cx-btn').filter((b) => !b.classes().includes('cx-btn-secondary') && !b.classes().includes('cx-btn-ghost'))
    expect(primarios).toHaveLength(1)
    expect(primarios[0].attributes('data-test')).toBe('map-toggle')
  })

  it('with nothing in progress the first unrated delivered order carries the one primary "Calificar"', () => {
    const w = setup({ pedidos: [pedido('entregado', { id: 'PED-3' }), pedido('entregado', { id: 'PED-4' })] })
    const primarios = all(w, '.cx-btn').filter((b) => !b.classes().includes('cx-btn-secondary') && !b.classes().includes('cx-btn-ghost'))
    expect(primarios).toHaveLength(1)
    expect(primarios[0].text()).toBe('Calificar')
  })

  it('splits the list into in progress and past orders with real headings', () => {
    const w = setup({ pedidos: [pedido('en_camino', { id: 'PED-2' }), pedido('entregado', { id: 'PED-3' })] })
    expect(all(w, 'h2').map((h) => h.text())).toEqual(expect.arrayContaining(['En curso', 'Anteriores']))
    expect(w.wrapper.find('h1').text()).toBe('Mis pedidos')
  })
})

describe('empty state', () => {
  it('tinted circle, title, one line and one primary "Explorar comercios"', () => {
    const w = setup({ pedidos: [] })
    const e = find(w, '[data-test="orders-empty"]')
    expect(e.find('.cx-empty-icon svg').exists()).toBe(true)
    expect(e.find('.cx-h3').text()).toBe('Aún no tienes pedidos')
    expect(e.find('p').text()).toBe('Cuando hagas tu primer pedido podrás seguirlo aquí.')
    const links = e.findAll('a')
    expect(links).toHaveLength(1)
    expect(links[0].text()).toBe('Explorar comercios')
    expect(links[0].attributes('href')).toBe('/tiendas')
    expect(links[0].classes()).toContain('cx-btn')
    expect(links[0].classes()).not.toContain('cx-btn-secondary')
  })

  it('has no empty state when there are orders', () => {
    expect(find(setup(pedido('en_camino')), '[data-test="orders-empty"]').exists()).toBe(false)
  })
})

describe('delivered orders and the rating entry', () => {
  it('unrated: a success-tinted icon tile, a title and "Calificar" that opens the dialog', async () => {
    const w = setup(pedido('entregado'))
    const t = find(w, '[data-test="delivered-tile"]')
    expect(t.find('.cx-delivered-icon svg').exists()).toBe(true)
    expect(t.find('.cx-h3').text()).toBe('Pedido entregado')
    expect(find(w, '[data-test="rate-open"]').text()).toBe('Calificar')
    await find(w, '[data-test="rate-open"]').trigger('click')
    expect(find(w, '[data-test="rate-dialog"]').exists()).toBe(true)
  })

  it('rated: read-only stars with formatRating numbers for the merchant and the courier', () => {
    const w = setup(pedido('entregado', { calificacion: 4, calificacionComercio: 4, calificacionRepartidor: 5 }))
    expect(find(w, '[data-test="rate-open"]').exists()).toBe(false)
    const r = find(w, '[data-test="rating-readonly"]')
    expect(r.text()).toContain('Comercio')
    expect(r.text()).toContain('4.0')
    expect(r.text()).toContain('Repartidor')
    expect(r.text()).toContain('5.0')
    expect(r.find('[role="img"]').attributes('aria-label')).toBe('Comercio: 4 de 5 estrellas')
  })

  it('rated without a courier score only shows the merchant score', () => {
    const w = setup(pedido('entregado', { calificacion: 3, calificacionComercio: 3, calificacionRepartidor: null }))
    const r = find(w, '[data-test="rating-readonly"]')
    expect(r.text()).toContain('3.0')
    expect(r.text()).not.toContain('Repartidor')
  })
})

describe('rating dialog: accessible modal and the write through escribir', () => {
  async function abrir(p: Pedido = pedido('entregado')) {
    const w = setup(p)
    const opener = find(w, '[data-test="rate-open"]')
    ;(opener.element as HTMLElement).focus()
    await opener.trigger('click')
    await flushPromises()
    return w
  }
  const radiosDe = (w: ReturnType<typeof setup>, i: number) => all(w, '[role="radiogroup"]')[i].findAll('[role="radio"]')

  it('is a labelled modal dialog with two radiogroups, a labelled comment field and no legacy classes', async () => {
    const w = await abrir()
    const d = find(w, '[data-test="rate-dialog"]')
    expect(d.attributes('role')).toBe('dialog')
    expect(d.attributes('aria-modal')).toBe('true')
    const title = document.getElementById(d.attributes('aria-labelledby')!)!
    expect(title.textContent).toBe('¿Cómo fue tu pedido?')
    expect(d.element.closest('.cx')).not.toBeNull()
    expect(all(w, '[role="radiogroup"]').map((g) => g.attributes('aria-label'))).toEqual(['Servicio del comercio', 'Atención del repartidor'])
    const id = d.find('textarea').attributes('id')!
    expect(d.find(`label[for="${id}"]`).text()).toContain('Comentario')
    const clases = [...d.html().matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/))
    expect(clases.filter((c) => ['btn-primary', 'btn-secondary', 'card', 'input', 'label', 'modal-panel'].includes(c))).toEqual([])
  })

  it('traps focus inside, closes with Escape and gives focus back to the "Calificar" button; locks scroll while open', async () => {
    const w = await abrir()
    expect(document.body.classList.contains('cx-dialog-open')).toBe(true)
    expect(find(w, '[data-test="rate-dialog"]').element.contains(document.activeElement)).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(find(w, '[data-test="rate-dialog"]').exists()).toBe(false)
    expect(document.body.classList.contains('cx-dialog-open')).toBe(false)
    expect(document.activeElement).toBe(find(w, '[data-test="rate-open"]').element)
  })

  it('every icon-only button in the view and the dialog has an accessible name', async () => {
    await abrir()
    for (const b of document.body.querySelectorAll('button')) {
      const nombre = (b.getAttribute('aria-label') || b.textContent || '').trim()
      expect(nombre, b.outerHTML).not.toBe('')
    }
    for (const a of document.body.querySelectorAll('a')) {
      const nombre = (a.getAttribute('aria-label') || a.textContent || '').trim()
      expect(nombre, a.outerHTML).not.toBe('')
    }
  })

  it('starts on 5 and 5, and the radios reflect the chosen values', async () => {
    const w = await abrir()
    expect(radiosDe(w, 0).map((r) => r.attributes('aria-checked'))).toEqual(['false', 'false', 'false', 'false', 'true'])
    await radiosDe(w, 1)[1].trigger('click')
    expect(radiosDe(w, 1).map((r) => r.attributes('aria-checked'))).toEqual(['false', 'true', 'false', 'false', 'false'])
  })

  async function enviar(apiResult: 'ok' | 'fail', teclas?: (w: ReturnType<typeof setup>) => Promise<void>) {
    const { default: api } = await import('../../services/api')
    const post = api.post as unknown as ReturnType<typeof vi.fn>
    post.mockReset()
    if (apiResult === 'ok') post.mockResolvedValue({ data: {} })
    else post.mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { status: 409 } }))
    const w = await abrir()
    if (teclas) await teclas(w)
    await find(w, '[data-test="rate-submit"]').trigger('click')
    await vi.waitFor(() => expect(post).toHaveBeenCalled())
    await flushPromises()
    return { w, post }
  }

  it('success: posts both scores and the comment, closes, thanks, and keeps the rating', async () => {
    const { w, post } = await enviar('ok', async (v) => {
      await radiosDe(v, 0)[3].trigger('click')
      await radiosDe(v, 1)[1].trigger('click')
      await find(v, '[data-test="rate-dialog"] textarea').setValue('Todo bien')
    })
    expect(post).toHaveBeenCalledWith('/orders/PED-1/rating', { merchant_stars: 4, courier_stars: 2, comment: 'Todo bien' })
    expect(find(w, '[data-test="rate-dialog"]').exists()).toBe(false)
    expect(w.store.pedidos[0].calificacion).toBe(4)
    expect(w.store.notificacion.texto).toBe('¡Gracias por calificar tu pedido!')
  })

  it('failure: the dialog stays open, the rating rolls back and the typed error toast stays (no thanks toast)', async () => {
    const { w } = await enviar('fail')
    expect(find(w, '[data-test="rate-dialog"]').exists()).toBe(true)
    expect(w.store.pedidos[0].calificacion).toBeNull()
    expect(w.store.notificacion).toMatchObject({ texto: 'La acción choca con el estado actual. Actualiza e inténtalo de nuevo.', tipo: 'error' })
  })

  it('a second click while the write is in flight does not post twice', async () => {
    const { default: api } = await import('../../services/api')
    const post = api.post as unknown as ReturnType<typeof vi.fn>
    post.mockReset()
    let liberar: (v: unknown) => void = () => {}
    post.mockReturnValue(new Promise((r) => (liberar = r)))
    const w = await abrir()
    const btn = find(w, '[data-test="rate-submit"]')
    await btn.trigger('click')
    await btn.trigger('click')
    expect(post).toHaveBeenCalledTimes(1)
    liberar({ data: {} })
    await flushPromises()
    expect(find(w, '[data-test="rate-dialog"]').exists()).toBe(false)
  })

  it('Cancelar closes without writing', async () => {
    const { default: api } = await import('../../services/api')
    const post = api.post as unknown as ReturnType<typeof vi.fn>
    post.mockReset()
    const w = await abrir()
    await find(w, '[data-test="rate-cancel"]').trigger('click')
    expect(find(w, '[data-test="rate-dialog"]').exists()).toBe(false)
    expect(post).not.toHaveBeenCalled()
  })
})
