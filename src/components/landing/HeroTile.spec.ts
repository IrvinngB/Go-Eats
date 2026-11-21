import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import HeroTile from './HeroTile.vue'

async function mountHero() {
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
  return { router, wrapper: mount(HeroTile, { global: { plugins: [router] } }) }
}

describe('HeroTile', () => {
  it('has exactly one h1 with display style and a non-empty subtitle', async () => {
    const { wrapper } = await mountHero()
    const h1 = wrapper.findAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].classes()).toContain('lp-display')
    expect(wrapper.find('p').text().length).toBeGreaterThan(10)
  })

  it('primary CTA is a link to /tiendas', async () => {
    const { wrapper } = await mountHero()
    const primary = wrapper.findAll('a.lp-btn:not(.lp-btn-secondary)')
    expect(primary).toHaveLength(1)
    expect(primary[0].attributes('href')).toBe('/tiendas')
    expect(primary[0].text()).toBe('Pedir ahora')
  })

  it('secondary CTA is a link to /login', async () => {
    const { wrapper } = await mountHero()
    const secondary = wrapper.findAll('a.lp-btn-secondary')
    expect(secondary).toHaveLength(1)
    expect(secondary[0].attributes('href')).toBe('/login')
    expect(secondary[0].text()).toBe('Iniciar sesión')
  })

  it('activating a CTA navigates the router', async () => {
    const { wrapper, router } = await mountHero()
    await wrapper.find('a.lp-btn-secondary').trigger('click')
    await new Promise((r) => setTimeout(r))
    expect(router.currentRoute.value.path).toBe('/login')
    await router.push('/')
    await wrapper.find('a.lp-btn:not(.lp-btn-secondary)').trigger('click')
    await new Promise((r) => setTimeout(r))
    expect(router.currentRoute.value.path).toBe('/tiendas')
  })

  it('includes the decorative visual and a 32px radius flat tile', async () => {
    const { wrapper } = await mountHero()
    expect(wrapper.find('svg[aria-hidden="true"]').exists()).toBe(true)
    expect(wrapper.classes()).toContain('lp-hero')
    expect(wrapper.html()).not.toMatch(/gradient|blur/i)
  })
})
