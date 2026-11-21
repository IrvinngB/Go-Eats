import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import LandingView from './LandingView.vue'

async function mountView() {
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
  return mount(LandingView, { global: { plugins: [router] } })
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
  })

  it('shows the hero CTAs to /tiendas and /login only', async () => {
    const w = await mountView()
    expect(w.findAll('main a.lp-btn').map((a) => a.attributes('href'))).toEqual(['/tiendas', '/login'])
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
})
