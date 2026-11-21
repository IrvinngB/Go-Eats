import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import LandingFooter from './LandingFooter.vue'
import { FOOTER_COPY } from './content'

async function mountFooter() {
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
  return mount(LandingFooter, { global: { plugins: [router] } })
}

describe('LandingFooter', () => {
  it('is one indigo footer with the sobre-indigo wordmark linking to /', async () => {
    const w = await mountFooter()
    expect(w.findAll('footer')).toHaveLength(1)
    expect(w.get('footer').classes()).toContain('lp-band-indigo')
    const img = w.get('img')
    expect(img.attributes('alt')).toBe('Go Eats')
    expect(img.attributes('src')).toContain('sobre-indigo')
    expect(w.get('a:has(img)').attributes('href')).toBe('/')
  })

  it('has no nav landmark, no h1 and no headings (group labels are paragraphs)', async () => {
    const w = await mountFooter()
    expect(w.find('nav').exists()).toBe(false)
    expect(w.findAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0)
  })

  it('shows the tagline and the copyright line without a year or legal entity', async () => {
    const w = await mountFooter()
    expect(w.text()).toContain(FOOTER_COPY.tagline)
    expect(w.get('[data-test="footer-copyright"]').text()).toBe('© Go Eats')
    expect(w.text()).not.toMatch(/S\.A\.|Comercios Unidos/)
  })

  it('lists plain links limited to /tiendas, /login and same-page anchors', async () => {
    const w = await mountFooter()
    const hrefs = w.findAll('ul a').map((a) => a.attributes('href')!)
    expect(hrefs.length).toBeGreaterThanOrEqual(6)
    for (const h of hrefs) expect(h, h).toMatch(/^(\/tiendas|\/login|#[a-z-]+)$/)
    expect(hrefs).toContain('/tiendas')
    expect(hrefs).toContain('/login')
    expect(hrefs).toContain('#preguntas')
  })

  it('keeps every list labelled by its group paragraph', async () => {
    const w = await mountFooter()
    const uls = w.findAll('ul')
    expect(uls).toHaveLength(2)
    for (const ul of uls) {
      const label = w.get(`#${ul.attributes('aria-labelledby')}`)
      expect(label.element.tagName).toBe('P')
      expect(label.text().length).toBeGreaterThan(0)
    }
  })

  it('has no legal, social or contact links and no digits', async () => {
    const w = await mountFooter()
    expect(w.html()).not.toMatch(/mailto:|tel:|https?:|privacidad|t[eé]rminos|facebook|instagram|twitter|whatsapp|tiktok|contacto/i)
    expect(w.text()).not.toMatch(/\d/)
    expect(w.html()).not.toMatch(/gradient|blur/i)
  })
})
