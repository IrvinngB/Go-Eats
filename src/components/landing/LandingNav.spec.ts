import { afterEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { defineComponent, h } from 'vue'
import LandingNav from './LandingNav.vue'

let mounted: VueWrapper | undefined
afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  document.body.innerHTML = ''
})

// Hosts the nav next to a main target, as LandingView does.
const Host = defineComponent({
  render: () => h('div', { class: 'landing' }, [h(LandingNav), h('main', { id: 'contenido', tabindex: '-1' })]),
})

async function mountNav() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { render: () => null } },
      { path: '/login', component: { render: () => null } },
    ],
  })
  await router.push('/')
  await router.isReady()
  mounted = mount(Host, { global: { plugins: [router] }, attachTo: document.body })
  return { wrapper: mounted, router }
}

describe('LandingNav', () => {
  it('puts the skip link before the header', async () => {
    const { wrapper } = await mountNav()
    const first = wrapper.find('.landing').element.firstElementChild!
    expect(first.tagName).toBe('A')
    expect(first.getAttribute('href')).toBe('#contenido')
    expect(first.textContent).toBe('Saltar al contenido')
    expect(first.nextElementSibling!.tagName).toBe('HEADER')
  })

  it('moves focus to main when the skip link is activated', async () => {
    const { wrapper } = await mountNav()
    await wrapper.find('a[href="#contenido"]').trigger('click')
    expect(document.activeElement).toBe(wrapper.find('main').element)
  })

  it('has one nav labelled Principal inside a sticky header', async () => {
    const { wrapper } = await mountNav()
    expect(wrapper.findAll('nav')).toHaveLength(1)
    expect(wrapper.find('header nav').attributes('aria-label')).toBe('Principal')
    expect(wrapper.find('header').classes()).toContain('sticky')
  })

  it('shows the colour wordmark linking home', async () => {
    const { wrapper } = await mountNav()
    const brand = wrapper.find('header a[href="/"]')
    expect(brand.find('img').attributes('alt')).toBe('Go Eats')
  })

  it('shows section anchors only from md up', async () => {
    const { wrapper } = await mountNav()
    const list = wrapper.find('ul')
    expect(list.classes()).toEqual(expect.arrayContaining(['hidden', 'md:flex']))
    expect(list.findAll('a').map((a) => a.attributes('href'))).toEqual(['#como-funciona', '#cobertura', '#preguntas'])
  })

  it('offers a single secondary login CTA and no primary button', async () => {
    const { wrapper } = await mountNav()
    const ctas = wrapper.findAll('header a.lp-btn')
    expect(ctas).toHaveLength(1)
    expect(ctas[0].attributes('href')).toBe('/login')
    expect(ctas[0].classes()).toContain('lp-btn-secondary')
    expect(ctas[0].text()).toBe('Iniciar sesión')
  })
})
