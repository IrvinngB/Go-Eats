import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent, h } from 'vue'

vi.mock('./stores/useGoEatsStore', () => ({
  useGoEatsStore: () => ({ sincronizarConBackend: vi.fn(), notificacion: null }),
}))

import App from './App.vue'

const Landing = defineComponent({
  render: () =>
    h('div', { class: 'landing' }, [h('header'), h('main', { id: 'landing-main' }), h('footer')]),
})
const Stores = defineComponent({ render: () => h('section', { id: 'stores' }) })

const mountAt = async (path: string) => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'landing', component: Landing },
      { path: '/tiendas', name: 'stores', component: Stores },
    ],
  })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, {
    global: {
      plugins: [router],
      stubs: {
        TopBar: { template: '<header data-test="topbar" />' },
        PwaStatus: true,
        transition: false,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('App shell', () => {
  it('hides TopBar and renders exactly one main on the landing', async () => {
    const wrapper = await mountAt('/')
    expect(wrapper.find('[data-test="topbar"]').exists()).toBe(false)
    expect(wrapper.findAll('main')).toHaveLength(1)
    expect(wrapper.find('main#landing-main').exists()).toBe(true)
    expect(wrapper.find('.flex-1').element.tagName).toBe('DIV')
  })

  it('shows TopBar and wraps the view in main on /tiendas', async () => {
    const wrapper = await mountAt('/tiendas')
    expect(wrapper.find('[data-test="topbar"]').exists()).toBe(true)
    expect(wrapper.findAll('main')).toHaveLength(1)
    expect(wrapper.find('main.flex-1 #stores').exists()).toBe(true)
  })
})
