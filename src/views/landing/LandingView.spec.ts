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
  it('has one header, one main and one footer', async () => {
    const w = await mountView()
    expect(w.findAll('header')).toHaveLength(1)
    expect(w.findAll('main')).toHaveLength(1)
    expect(w.findAll('footer')).toHaveLength(1)
  })

  it('header exposes a navigation landmark with the login link', async () => {
    const w = await mountView()
    const nav = w.find('header nav')
    expect(nav.attributes('aria-label')).toBe('Principal')
    expect(nav.find('a[href="/login"]').exists()).toBe(true)
  })

  it('main holds the hero and the six tiles, header/footer hold neither', async () => {
    const w = await mountView()
    const main = w.find('main')
    expect(main.find('h1').exists()).toBe(true)
    expect(main.findAll('article')).toHaveLength(6)
    expect(w.find('header').find('h1').exists()).toBe(false)
    expect(w.find('footer').findAll('article')).toHaveLength(0)
  })

  it('has a single h1 followed by six h2 and no skipped levels', async () => {
    const w = await mountView()
    const levels = w.findAll('h1,h2,h3,h4,h5,h6').map((h) => Number(h.element.tagName[1]))
    expect(levels).toEqual([1, 2, 2, 2, 2, 2, 2])
  })

  it('exposes exactly the primary and secondary hero CTAs to /tiendas and /login', async () => {
    const w = await mountView()
    const hrefs = w.findAll('main a.lp-btn').map((a) => a.attributes('href'))
    expect(hrefs).toEqual(['/tiendas', '/login'])
  })

  it('scopes tokens through the .landing root', async () => {
    const w = await mountView()
    expect(w.classes()).toContain('landing')
  })

  it('shows Spanish copy and decorative icons only', async () => {
    const w = await mountView()
    expect(w.find('h1').text()).toMatch(/pide|tienda|comercio/i)
    const svgs = w.findAll('svg')
    expect(svgs.length).toBeGreaterThanOrEqual(7)
    for (const s of svgs) expect(s.attributes('aria-hidden')).toBe('true')
    expect(w.html()).not.toMatch(/gradient|blur/i)
  })
})
