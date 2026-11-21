import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { routes } from '../../router'
import LandingView from './LandingView.vue'
import api from '../../services/api'

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(() => Promise.reject(new Error('offline'))),
  },
}))

async function mountView() {
  const { w } = await mountWithRouter()
  return w
}

async function mountWithRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      { path: '/tiendas', component: { render: () => null } },
      { path: '/login', component: { render: () => null } },
    ],
  })
  await router.push('/')
  await router.isReady()
  return { w: mount(LandingView, { global: { plugins: [router] } }), router }
}

describe('LandingView', () => {
  it('has one header, one nav, one main and one footer', async () => {
    const w = await mountView()
    for (const tag of ['header', 'nav', 'main', 'footer']) expect(w.findAll(tag), tag).toHaveLength(1)
  })

  it('names the nav Principal and keeps it inside the header', async () => {
    const w = await mountView()
    expect(w.find('header nav').attributes('aria-label')).toBe('Principal')
    expect(w.find('footer nav').exists()).toBe(false)
  })

  it('renders the skip link first in the landing root, targeting the focusable main', async () => {
    const w = await mountView()
    const first = w.element.firstElementChild!
    expect(first.getAttribute('href')).toBe('#contenido')
    const main = w.find('main')
    expect(main.attributes('id')).toBe('contenido')
    expect(main.attributes('tabindex')).toBe('-1')
  })

  it('holds the hero inside main, with a single h1 and nothing in header or footer', async () => {
    const w = await mountView()
    expect(w.findAll('h1')).toHaveLength(1)
    expect(w.find('main h1').exists()).toBe(true)
    expect(w.find('header h1').exists()).toBe(false)
    expect(w.find('footer h1').exists()).toBe(false)
  })

  it('orders hero content after the header and before the footer', async () => {
    const w = await mountView()
    const kids = Array.from(w.element.children as HTMLCollection).map((e) => e.tagName)
    expect(kids).toEqual(['A', 'HEADER', 'MAIN', 'FOOTER'])
    const sections = w.findAll('main > section')
    expect(sections[sections.length - 1].find('.lp-btn').exists()).toBe(true)
  })

  it('shows the hero CTAs to /tiendas and /login only', async () => {
    const w = await mountView()
    expect(w.findAll('main section:first-child a.lp-btn').map((a) => a.attributes('href'))).toEqual(['/tiendas', '/login'])
  })

  it('orders the sections: hero, categories, steps, stores, coverage, merchants, couriers, install, faq, cta band', async () => {
    const w = await mountView()
    const sections = w.findAll('main > section')
    expect(sections.map((s) => s.attributes('id') ?? s.attributes('aria-label') ?? s.attributes('aria-labelledby'))).toEqual([
      'lp-hero-title',
      'Tipos de comercio',
      'como-funciona',
      'tiendas',
      'cobertura',
      'comercios',
      'repartidores',
      'instalar',
      'preguntas',
      'lp-cta-title',
    ])
  })

  it('keeps headings in order under the single h1: h2 per section, h3 inside', async () => {
    const w = await mountView()
    const levels = w.findAll('main h1, main h2, main h3').map((h) => h.element.tagName)
    expect(levels[0]).toBe('H1')
    expect(levels.filter((l) => l === 'H1')).toHaveLength(1)
    expect(w.findAll('main h2').map((h) => h.text())).toEqual([
      'Así funciona',
      'Comercios en Go Eats',
      'Zonas donde opera Go Eats',
      'Vende a tu zona con Go Eats',
      'Reparte los pedidos que te asignan',
      'Lleva Go Eats en tu pantalla de inicio',
      'Preguntas frecuentes',
      'Empieza tu pedido en Go Eats',
    ])
    expect(levels.slice(0, 3)).toEqual(['H1', 'H2', 'H3'])
  })

  it('keeps one solid primary per viewport: only the hero and the final band use a non-secondary lp-btn, both to /tiendas', async () => {
    const w = await mountView()
    const primaries = w.findAll('main a.lp-btn:not(.lp-btn-secondary)')
    expect(primaries.map((a) => a.attributes('href'))).toEqual(['/tiendas', '/tiendas'])
    expect(w.findAll('header .lp-btn:not(.lp-btn-secondary), footer .lp-btn')).toHaveLength(0)
    expect(w.findAll('main > section').map((s) => s.findAll('a.lp-btn:not(.lp-btn-secondary)').length)).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 1])
  })

  it('provides the como-funciona anchor the nav links to', async () => {
    const w = await mountView()
    expect(w.find('main #como-funciona').exists()).toBe(true)
  })

  it('provides the cobertura anchor the nav links to', async () => {
    const w = await mountView()
    expect(w.find('main #cobertura').exists()).toBe(true)
    expect(w.find('header a[href="#cobertura"]').exists()).toBe(true)
  })

  it('shows the sobre-indigo wordmark on the indigo footer band', async () => {
    const w = await mountView()
    const footer = w.find('footer')
    expect(footer.classes()).toContain('lp-band-indigo')
    expect(footer.find('img').attributes('alt')).toBe('Go Eats')
    expect(footer.find('img').attributes('src')).toContain('sobre-indigo')
  })

  it('scopes tokens through the .landing root and has no gradient or blur', async () => {
    const w = await mountView()
    expect(w.classes()).toContain('landing')
    expect(w.html()).not.toMatch(/gradient|blur/i)
  })

  it('does not include the old six-tile content', async () => {
    const w = await mountView()
    expect(w.findAll('article')).toHaveLength(0)
    expect(w.html()).not.toMatch(/lp-tile|lp-icon-chip/)
  })

  it('falls back to static stores content when the API is down, with a single warn', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = await mountView()
    await flushPromises()
    expect(w.find('#tiendas [data-test="stores-fallback"]').exists()).toBe(true)
    expect(w.find('#cobertura [data-test="coverage-fallback"]').exists()).toBe(true)
    expect(w.findAll('main > section')).toHaveLength(10)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  it('reuses the single zones request for the coverage chips', async () => {
    const get = vi.mocked(api.get)
    get.mockReset()
    get.mockImplementation(((url: string) =>
      Promise.resolve({
        data:
          url === '/zones/'
            ? [
                { id: 1, slug: 'bella-vista', name: 'Bella Vista', is_active: true },
                { id: 2, slug: 'clayton', name: 'Clayton', is_active: false },
              ]
            : [],
      })) as typeof api.get)
    const w = await mountView()
    await flushPromises()
    expect(w.findAll('#cobertura [data-test="zone-chip"]').map((c) => c.text())).toEqual(['Bella Vista'])
    expect(get.mock.calls.filter(([url]) => url === '/zones/')).toHaveLength(1)
  })

  it('resolves every footer and CTA route link to the stores or login route, never the catch-all', async () => {
    const { w, router } = await mountWithRouter()
    const real = createRouter({ history: createMemoryHistory(), routes })
    const targets = w
      .findAll('footer a, main > section:last-child a')
      .map((a) => a.attributes('href')!)
      .filter((h) => !h.startsWith('#') && h !== '/')
    expect(targets.sort()).toEqual(['/login', '/login', '/tiendas', '/tiendas'])
    for (const href of targets) {
      const name = real.resolve(href).name
      expect(name, href).toBe(href === '/login' ? 'login' : 'stores')
      expect(router.resolve(href).matched.length, href).toBe(1)
    }
  })

  it('has an element on the page for every in-page anchor of the nav, band and footer', async () => {
    const w = await mountView()
    const anchors = w.findAll('header a[href^="#"], footer a[href^="#"]').map((a) => a.attributes('href')!.slice(1))
    expect(new Set(anchors)).toEqual(
      new Set(['como-funciona', 'cobertura', 'preguntas', 'tiendas', 'comercios', 'repartidores']),
    )
    for (const id of new Set(anchors)) expect(w.find(`#${id}`).exists(), id).toBe(true)
  })

  it('ends with the FAQ and the CTA band before the footer, with the footer holding the rich link lists', async () => {
    const w = await mountView()
    expect(w.findAll('main > section').slice(-2).map((s) => s.attributes('id') ?? s.attributes('aria-labelledby'))).toEqual(['preguntas', 'lp-cta-title'])
    expect(w.findAll('footer ul')).toHaveLength(2)
  })

  describe('copy integrity over the whole rendered page', () => {
    // Includes aria-hidden text (phone mock) and every aria-label / alt / title.
    function everything(w: Awaited<ReturnType<typeof mountView>>): string {
      const el = w.element as HTMLElement
      const attrs = Array.from(el.querySelectorAll('[aria-label],[alt],[title]')).flatMap((e) =>
        ['aria-label', 'alt', 'title'].map((a) => e.getAttribute(a) ?? ''),
      )
      return [el.textContent ?? '', ...attrs].join(' | ')
    }

    const FORBIDDEN =
      /[$€£]|B\/\.|\bUSD\b|\bmin(utos?)?\b|\bhoras?\b|\d+\s*%|por ciento|★|☆|estrellas?|calificaci|rese[nñ]as?|yappy|paguelo|rappi|uber|pedidosya|glovo|\bvisa\b|mastercard|tarjetas?|cr[eé]dito|d[eé]bito|en vivo|tiempo real|en directo|rastre|\bkm\b|kil[oó]metros?|metros|cercan[ií]a|testimonio|gratis|barato|oferta|descuento|garant[ií]a|tel[eé]fono|correo|whatsapp/i

    it('contains no prohibited claim, with the API down', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const w = await mountView()
      await flushPromises()
      expect(everything(w).match(FORBIDDEN)).toBeNull()
      vi.mocked(console.warn).mockRestore()
    })

    it('contains no prohibited claim with API data, and digits only as step numerals', async () => {
      const get = vi.mocked(api.get)
      get.mockReset()
      get.mockImplementation(((url: string) =>
        Promise.resolve({
          data:
            url === '/zones/'
              ? [{ id: 1, slug: 'bella-vista', name: 'Bella Vista', is_active: true }]
              : [{ id: 1, name: 'Casa Típica', category_type: 'Comida típica', zone_slug: 'bella-vista', affiliation_status: 'activo', icon: 'Store' }],
        })) as typeof api.get)
      const w = await mountView()
      await flushPromises()
      expect(everything(w).match(FORBIDDEN)).toBeNull()
      const numerals = w.findAll('[data-test="step-number"]')
      expect(numerals.map((n) => n.text())).toEqual(['1', '2', '3', '4'])
      for (const n of numerals) n.element.remove()
      expect(everything(w).match(/\d/)).toBeNull()
    })

    it('keeps the exact shipping sentence wherever shipping is mentioned', async () => {
      const w = await mountView()
      const text = (w.element as HTMLElement).textContent ?? ''
      const sentence = 'El costo de envío depende de tu zona y lo ves antes de confirmar el pedido.'
      expect(text.split(sentence).length - 1).toBe(2)
      expect(text.split(sentence).join('').replace('¿Cómo se calcula el costo de envío?', '')).not.toMatch(/costo|tarifa|cuesta|cobr/i)
    })
  })
})
