import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import MerchantView from './MerchantView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

function setup(linkedId: string | null) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'merchant'
  // The logged-in user is named like merchant c1 on purpose: no name matching may apply.
  store.usuario = { nombre: 'Diablicos Fan', email: 'x@y.pa', telefono: '', consentimientoLey81: true }
  store.comercioPropioId = linkedId
  return mount(MerchantView, { global: { plugins: [pinia] } })
}

describe('MerchantView linked merchant', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unlinked account shows the empty state and no panel data', () => {
    const wrapper = setup(null)
    expect(wrapper.text()).toContain('Cuenta sin comercio asignado')
    expect(wrapper.text()).not.toContain('Panel de comercio')
    expect(wrapper.text()).not.toContain('Diablicos')
  })

  it('does not fall back to the first merchant (c1) when the link points nowhere', () => {
    const wrapper = setup('c-inexistente')
    expect(wrapper.text()).toContain('Cuenta sin comercio asignado')
  })

  it('linked account renders the server-linked merchant, not a name match', () => {
    const wrapper = setup('c2')
    const store = useGoEatsStore()
    const c2 = store.comercios.find((c: { id: string }) => c.id === 'c2')
    expect(wrapper.text()).not.toContain('Cuenta sin comercio asignado')
    expect(wrapper.find('h1').text()).toBe(c2.nombre)
  })
})
