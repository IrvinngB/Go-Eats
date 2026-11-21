import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import CtaBand from './CtaBand.vue'

async function mountBand() {
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
  return mount(CtaBand, { global: { plugins: [router] } })
}

describe('CtaBand', () => {
  it('is a primary-tint band labelled by a single h2', async () => {
    const w = await mountBand()
    const s = w.get('section')
    expect(s.classes()).toContain('lp-band-primary-tint')
    expect(w.findAll('h2')).toHaveLength(1)
    expect(s.attributes('aria-labelledby')).toBe(w.get('h2').attributes('id'))
    expect(w.get('h2').text()).toBe('Empieza tu pedido en Go Eats')
  })

  it('links to /tiendas as the single solid primary and /login as secondary', async () => {
    const w = await mountBand()
    const links = w.findAll('a')
    expect(links.map((a) => a.attributes('href'))).toEqual(['/tiendas', '/login'])
    expect(links.map((a) => a.classes().includes('lp-btn-secondary'))).toEqual([false, true])
    expect(links.every((a) => a.classes().includes('lp-btn'))).toBe(true)
  })

  it('has no gradient or blur and no digits', async () => {
    const w = await mountBand()
    expect(w.html()).not.toMatch(/gradient|blur/i)
    expect(w.text()).not.toMatch(/\d/)
  })
})
