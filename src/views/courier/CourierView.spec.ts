import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import CourierView from './CourierView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

function setup(linkedId: string | null) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'courier'
  store.usuario = { nombre: 'María Fan', email: 'x@y.pa', telefono: '', consentimientoLey81: true }
  store.repartidorPropioId = linkedId
  return {
    store,
    wrapper: mount(CourierView, { global: { plugins: [pinia], stubs: { CoverageMap: true } } }),
  }
}

describe('CourierView linked courier', () => {
  beforeEach(() => vi.clearAllMocks())

  it('unlinked account shows the empty state and no courier data', () => {
    const { wrapper } = setup(null)
    expect(wrapper.text()).toContain('Cuenta sin repartidor asignado')
    expect(wrapper.find('h1').text()).toBe('Cuenta sin repartidor asignado')
    expect(wrapper.text()).not.toContain('Disponible')
  })

  it('does not fall back to r2 when the link points nowhere', () => {
    const { wrapper } = setup('r-inexistente')
    expect(wrapper.text()).toContain('Cuenta sin repartidor asignado')
  })

  it('linked account renders the server-linked courier, not a name match', () => {
    const { store, wrapper } = setup('r3')
    const r3 = store.repartidores.find((r: { id: string }) => r.id === 'r3')
    expect(wrapper.text()).not.toContain('Cuenta sin repartidor asignado')
    expect(wrapper.find('h1').text()).toBe(r3.nombre)
  })
})
