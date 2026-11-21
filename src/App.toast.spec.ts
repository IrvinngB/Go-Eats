import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { defineComponent, h, reactive } from 'vue'

const state = reactive<{ notificacion: { texto: string; tipo?: string; id: number } | null; sincronizarConBackend: () => void }>({
  notificacion: null,
  sincronizarConBackend: vi.fn(),
})
vi.mock('./stores/useGoEatsStore', () => ({ useGoEatsStore: () => state }))

import App from './App.vue'

const Stores = defineComponent({ render: () => h('section', { id: 'stores' }) })

async function mountApp() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/tiendas', name: 'stores', component: Stores }] })
  await router.push('/tiendas')
  await router.isReady()
  const wrapper = mount(App, {
    global: { plugins: [router], stubs: { TopBar: true, PwaStatus: true, transition: false } },
  })
  await flushPromises()
  return wrapper
}

describe('global toast (Friendly Bento)', () => {
  it('keeps a persistent polite live region and renders no toast when there is no notification', async () => {
    state.notificacion = null
    const w = await mountApp()
    const region = w.find('.cx-toast-region')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(w.find('.cx-toast').exists()).toBe(false)
  })

  it.each([
    ['info', 'cx-toast-info', 'status'],
    [undefined, 'cx-toast-info', 'status'],
    ['success', 'cx-toast-success', 'status'],
    ['error', 'cx-toast-error', 'alert'],
  ])('tipo %s: text + one icon, class %s, role %s', async (tipo, klass, role) => {
    state.notificacion = { texto: 'Mensaje de prueba', tipo, id: 1 }
    const w = await mountApp()
    const toast = w.find('.cx-toast')
    expect(toast.classes()).toContain(klass)
    expect(toast.attributes('role')).toBe(role)
    expect(toast.attributes('data-tipo')).toBe(tipo || 'info')
    expect(toast.text()).toContain('Mensaje de prueba')
    expect(toast.findAll('svg')).toHaveLength(1 + (tipo === 'error' ? 1 : 0)) // status icon (+ the dismiss X on errors)
  })

  it('error toasts carry a dismiss button that clears the notification; info toasts do not', async () => {
    state.notificacion = { texto: 'Falló', tipo: 'error', id: 2 }
    const w = await mountApp()
    const close = w.find('.cx-toast button[aria-label="Cerrar notificación"]')
    expect(close.exists()).toBe(true)
    await close.trigger('click')
    expect(state.notificacion).toBeNull()

    w.unmount()
    state.notificacion = { texto: 'Hecho', tipo: 'info', id: 3 }
    const info = await mountApp()
    expect(info.find('.cx-toast button').exists()).toBe(false)
  })
})
