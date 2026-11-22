import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

const get = vi.hoisted(() => vi.fn())
vi.mock('./services/api', () => ({
  default: { get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  api: { get, post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}))

import App from './App.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from './stores/useGoEatsStore'

const Landing = defineComponent({ render: () => h('div', { class: 'landing' }) })

describe('App anonymous landing with backend down', () => {
  beforeEach(() => {
    get.mockReset()
    get.mockRejectedValue(new Error('Network Error'))
  })

  it('syncs on mount, swallows the failure and shows no toast', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', name: 'landing', component: Landing }],
    })
    await router.push('/')
    await router.isReady()
    const wrapper = mount(App, {
      global: { plugins: [pinia, router], stubs: { TopBar: true, PwaStatus: true } },
    })
    await flushPromises()

    expect(get).toHaveBeenCalled()
    expect(useGoEatsStore().notificacion).toBeNull()
    expect(wrapper.find('.fixed.bottom-5').exists()).toBe(false)
  })
})
