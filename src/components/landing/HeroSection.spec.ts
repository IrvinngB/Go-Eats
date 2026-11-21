import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import HeroSection from './HeroSection.vue'

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
  return { router, wrapper: mount(HeroSection, { global: { plugins: [router] } }) }
}

describe('HeroSection', () => {
  it('is a section labelled by its single display h1', async () => {
    const { wrapper } = await mountHero()
    const h1 = wrapper.findAll('h1')
    expect(h1).toHaveLength(1)
    expect(h1[0].classes()).toContain('lp-display')
    expect(wrapper.attributes('aria-labelledby')).toBe(h1[0].attributes('id'))
    expect(wrapper.element.tagName).toBe('SECTION')
  })

  it('has a subtitle paragraph', async () => {
    const { wrapper } = await mountHero()
    expect(wrapper.find('p.lp-lead').text().length).toBeGreaterThan(30)
  })

  it('primary CTA is the only primary button and links to /tiendas', async () => {
    const { wrapper } = await mountHero()
    const primary = wrapper.findAll('a.lp-btn:not(.lp-btn-secondary)')
    expect(primary).toHaveLength(1)
    expect(primary[0].attributes('href')).toBe('/tiendas')
    expect(primary[0].text()).toBe('Pedir ahora')
  })

  it('secondary CTA links to /login', async () => {
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

  it('sits on the primary-tint band and embeds the decorative visual', async () => {
    const { wrapper } = await mountHero()
    expect(wrapper.classes()).toContain('lp-band-primary-tint')
    expect(wrapper.find('[aria-hidden="true"] .lp-phone').exists()).toBe(true)
    expect(wrapper.html()).not.toMatch(/gradient|blur/i)
  })

  it('states cash payment (RF-10) without prices, times or digits', async () => {
    const { wrapper } = await mountHero()
    expect(wrapper.find('[data-test="hero-note"]').text()).toBe('Pagas en efectivo al recibir tu pedido.')
    expect(wrapper.find('[data-test="hero-note"]').text()).not.toMatch(/\d|\$|min/)
  })
})
