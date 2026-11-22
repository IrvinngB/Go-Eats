import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import api from '../../services/api'
import AdminView from './AdminView.vue'
// @ts-expect-error plain JS store
import { useGoEatsStore } from '../../stores/useGoEatsStore'

const apiGet = api.get as unknown as ReturnType<typeof vi.fn>
const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>

async function setupAdmin() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'admin'
  store.usuario = { id: 99, nombre: 'Admin General', email: 'admin@goeats.pa', telefono: '', consentimientoLey81: true }

  apiGet.mockImplementation(async (url: string) => {
    if (url === '/users/') {
      return {
        data: [
          { id: 1, full_name: 'Carlos Andrade', email: 'carlos@ejemplo.pa', phone: '6000', role: 'customer', is_active: true },
          { id: 99, full_name: 'Admin General', email: 'admin@goeats.pa', phone: '6001', role: 'admin', is_active: true },
        ],
      }
    }
    if (url === '/reports/kpis') {
      return {
        data: { orders_today: 42, total_revenue: 512.75, avg_delivery_time: '24 min', active_merchants: 7 },
      }
    }
    return { data: [] }
  })
  apiPatch.mockResolvedValue({ data: {} })

  const w = mount(AdminView, { global: { plugins: [pinia] } })
  await flushPromises()
  return { w, store }
}

describe('AdminView RF-17 KPIs and RF-18 user, merchant, and courier governance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads live KPIs from /reports/kpis and displays them in the executive cards', async () => {
    const { w } = await setupAdmin()
    const kpiText = w.find('[data-test="admin-kpis"]').text()
    expect(kpiText).toContain('42')
    expect(kpiText).toContain('B/ 512.75')
    expect(kpiText).toContain('24 min')
    expect(kpiText).toContain('7')
  })

  it('suspends and reactivates merchants and couriers via their affiliation endpoints', async () => {
    const { w, store } = await setupAdmin()
    store.comercios = [{ id: 'c1', nombre: 'Fonda Uno', tipo: 'Típica', zona: 'san-francisco', activo: true, estadoAfiliacion: 'activo' }]
    store.repartidores = [{ id: 'r1', nombre: 'Javier Morales', zona: 'san-francisco', disponible: true, estadoAfiliacion: 'activo' }]
    await flushPromises()

    await w.find('[data-test="suspend-merchant-btn"]').trigger('click')
    await flushPromises()
    expect(apiPatch).toHaveBeenCalledWith('/merchants/c1/affiliation', { affiliation_status: 'suspendido', is_open: false })
    expect(store.comercios[0].estadoAfiliacion).toBe('suspendido')

    await w.find('[data-test="suspend-courier-btn"]').trigger('click')
    await flushPromises()
    expect(apiPatch).toHaveBeenCalledWith('/delivery/couriers/r1/affiliation', { affiliation_status: 'suspendido' })
    expect(store.repartidores[0].estadoAfiliacion).toBe('suspendido')
    expect(store.repartidores[0].disponible).toBe(false)
  })

  it('lists platform user accounts, filters by role, and suspends/reactivates non-self users', async () => {
    const { w, store } = await setupAdmin()
    await w.find('[data-test="admin-tab-usuarios"]').trigger('click')

    const rows = w.findAll('[data-test="admin-user-row"]')
    expect(rows).toHaveLength(2)

    // Admin's own row has its suspend button disabled
    const adminRow = rows.find((r) => r.text().includes('admin@goeats.pa'))!
    expect((adminRow.find('[data-test="toggle-user-status"]').element as HTMLButtonElement).disabled).toBe(true)

    // Suspend customer account -> PATCH /users/1/status { is_active: false }
    const customerRow = rows.find((r) => r.text().includes('carlos@ejemplo.pa'))!
    await customerRow.find('[data-test="toggle-user-status"]').trigger('click')
    await flushPromises()

    expect(apiPatch).toHaveBeenCalledWith('/users/1/status', { is_active: false })
    expect(store.usuariosAdmin[0].activo).toBe(false)
    expect(customerRow.find('[data-test="admin-user-status"]').text()).toBe('Suspendido')
  })
})
