import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'

const post = vi.hoisted(() => vi.fn())
const get = vi.hoisted(() => vi.fn())
vi.mock('../services/api', () => ({
  default: { get, post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  api: { get, post, patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import LoginView from './LoginView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../stores/useGoEatsStore'

const Stub = defineComponent({ render: () => h('div') })

function session(role: string) {
  return {
    data: {
      access_token: 'a',
      refresh_token: 'r',
      user: { id: 1, full_name: 'Carlos', email: 'carlos@ejemplo.pa', phone: '', role },
    },
  }
}

async function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/login', component: LoginView },
      { path: '/tiendas', component: Stub },
      { path: '/panel-admin', component: Stub },
      { path: '/panel-comercio', component: Stub },
    ],
  })
  await router.push('/login')
  await router.isReady()
  const wrapper = mount(LoginView, { global: { plugins: [pinia, router] } })
  return { wrapper, router, store: useGoEatsStore() }
}

describe('LoginView', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
    get.mockRejectedValue(new Error('sync skipped'))
  })

  it('navigates by the server role (customer) and sends no role in the payload', async () => {
    post.mockResolvedValue(session('customer'))
    const { wrapper, router } = await setup()
    await wrapper.find('button.btn-primary').trigger('click')
    await flushPromises()
    expect(post).toHaveBeenCalledWith('/auth/login', {
      email: 'carlos@ejemplo.pa',
      password: 'demo1234',
    })
    expect(router.currentRoute.value.path).toBe('/tiendas')
  })

  it('navigates to the server role home for a merchant', async () => {
    post.mockResolvedValue(session('merchant'))
    const { wrapper, router } = await setup()
    await wrapper.find('button.btn-primary').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/panel-comercio')
  })

  it('renders no role picker and no consent checkbox in login mode', async () => {
    const { wrapper } = await setup()
    expect(wrapper.text()).not.toContain('Administrador')
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
  })

  it('register requires the consent checkbox and sends the value the user set', async () => {
    post.mockResolvedValue(session('customer'))
    const { wrapper } = await setup()
    await wrapper.findAll('button').find((b) => b.text() === 'Regístrate')!.trigger('click')
    await wrapper.find('button.btn-primary').trigger('click')
    await flushPromises()
    expect(post).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Ley 81')

    await wrapper.find('input[type="checkbox"]').setValue(true)
    await wrapper.find('button.btn-primary').trigger('click')
    await flushPromises()
    const [endpoint, body] = post.mock.calls[0]
    expect(endpoint).toBe('/auth/register')
    expect(body.accepts_privacy_policy).toBe(true)
    expect('role' in body).toBe(false)
  })
})

describe('LoginView privacy policy control (PR9)', () => {
  it('the register consent text has no inert button and still names Ley 81', async () => {
    const { wrapper } = await setup()
    await wrapper.findAll('button').find((b) => b.text() === 'Regístrate')!.trigger('click')
    const label = wrapper.find('label:has(input[type="checkbox"])')
    expect(label.findAll('button')).toHaveLength(0)
    expect(label.text()).toContain('Ley 81 de 2019')
  })
})

describe('store autenticarUsuario payloads', () => {
  beforeEach(() => {
    post.mockReset()
    get.mockReset()
    get.mockRejectedValue(new Error('x'))
  })

  it('demo account switch logs in by email+password without role and takes the server role', async () => {
    setActivePinia(createPinia())
    post.mockResolvedValue(session('merchant'))
    const store = useGoEatsStore()
    await store.cambiarACuentaDemo({ email: 'hector.endara@ejemplo.pa', role: 'merchant', name: 'H' })
    expect(post).toHaveBeenCalledWith('/auth/login', {
      email: 'hector.endara@ejemplo.pa',
      password: 'demo1234',
    })
    expect(store.rol).toBe('merchant')
  })

  it('register does not default consent to true', async () => {
    setActivePinia(createPinia())
    post.mockResolvedValue(session('customer'))
    const store = useGoEatsStore()
    await store.autenticarUsuario({ email: 'a@b.pa', password: 'secret1', nombre: 'A B', modoRegistro: true })
    expect(post.mock.calls[0][1].accepts_privacy_policy).toBe(false)
  })
})
