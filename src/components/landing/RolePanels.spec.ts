import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import RolePanels from './RolePanels.vue'

async function mountPanels() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      { path: '/login', component: { render: () => null } },
    ],
  })
  await router.push('/')
  await router.isReady()
  return { w: mount(RolePanels, { global: { plugins: [router] } }), router }
}

describe('RolePanels', () => {
  it('renders two separate sections, merchants then couriers, each labelled by an h2', async () => {
    const { w } = await mountPanels()
    const sections = w.findAll('section')
    expect(sections).toHaveLength(2)
    expect(sections.map((s) => s.attributes('id'))).toEqual(['comercios', 'repartidores'])
    expect(sections.map((s) => s.find('h2').text())).toEqual([
      'Vende a tu zona con Go Eats',
      'Reparte los pedidos que te asignan',
    ])
    for (const s of sections) expect(s.attributes('aria-labelledby')).toBe(s.find('h2').attributes('id'))
  })

  it('gives each section its own colour band', async () => {
    const { w } = await mountPanels()
    const [m, c] = w.findAll('section')
    expect(m.classes()).toContain('lp-band-indigo')
    expect(c.classes()).toContain('lp-band-amber-tint')
  })

  it('has one secondary CTA per section, both to /login, never the solid primary', async () => {
    const { w } = await mountPanels()
    for (const s of w.findAll('section')) {
      const links = s.findAll('a')
      expect(links).toHaveLength(1)
      expect(links[0].attributes('href')).toBe('/login')
      expect(links[0].classes()).toContain('lp-btn-secondary')
    }
    expect(w.findAll('a').map((a) => a.text())).toEqual(['Ingresar como comercio', 'Ingresar como repartidor'])
  })

  it('navigates to /login when a CTA is activated', async () => {
    const { w, router } = await mountPanels()
    await w.findAll('section')[1].find('a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('lists three capabilities per role under h3 headings, grounded in the RF copy', async () => {
    const { w } = await mountPanels()
    const [m, c] = w.findAll('section')
    expect(m.findAll('h3').map((h) => h.text())).toEqual(['Gestiona tu catálogo', 'Asigna pedidos listos', 'Actualiza el estado'])
    expect(c.findAll('h3').map((h) => h.text())).toEqual(['Define tu disponibilidad', 'Consulta recogida y entrega', 'Actualiza el estado'])
  })

  it('hides decorative icons and has no article or digits', async () => {
    const { w } = await mountPanels()
    for (const svg of w.findAll('svg')) expect(svg.attributes('aria-hidden')).toBe('true')
    expect(w.findAll('article')).toHaveLength(0)
    expect(w.text()).not.toMatch(/\d/)
  })
})
