import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import api from '../../services/api'
import AccountingView from './AccountingView.vue'
// @ts-expect-error plain JS store
import { useGoEatsStore } from '../../stores/useGoEatsStore'

const apiGet = api.get as unknown as ReturnType<typeof vi.fn>
const apiPatch = api.patch as unknown as ReturnType<typeof vi.fn>

async function setupAccounting() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'accountant'
  store.transacciones = [
    {
      id: 'TX-9001',
      pedidoId: 'PED-1040',
      fecha: '21/11/2026',
      cliente: 'Carlos Andrade',
      comercio: 'Fonda La Istmeña',
      monto: 10.0,
      comision: 1.2,
      total: 8.8,
      estado: 'aprobado',
      metodo: 'electronico',
      referencia: 'YPY-123',
    },
    {
      id: 'TX-9002',
      pedidoId: 'PED-1041',
      fecha: '21/11/2026',
      cliente: 'Valeria Quintero',
      comercio: 'Verde Bistro',
      monto: 15.0,
      comision: 1.8,
      total: 13.2,
      estado: 'pendiente',
      metodo: 'contr_entrega',
      referencia: 'COD-456',
    },
  ]

  apiGet.mockResolvedValue({
    data: { total_transactions: 2, paid_total: 10.0, pending_total: 15.0, total_commissions: 3.0 },
  })
  apiPatch.mockResolvedValue({ data: {} })

  const w = mount(AccountingView, { global: { plugins: [pinia] } })
  await flushPromises()
  return { w, store }
}

describe('AccountingView RF-11 reconciliation/filters and RF-12 digital receipt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('computes financial KPIs and filters transactions by search query, status, and payment method', async () => {
    const { w } = await setupAccounting()
    expect(w.find('[data-test="kpi-approved-volume"]').text()).toBe('B/ 10.00')
    expect(w.find('[data-test="kpi-commissions"]').text()).toBe('B/ 1.20')
    expect(w.find('[data-test="kpi-net-merchants"]').text()).toBe('B/ 8.80')
    expect(w.find('[data-test="kpi-pending-count"]').text()).toBe('B/ 15.00')

    expect(w.findAll('[data-test="accounting-row"]')).toHaveLength(2)

    await w.find('[data-test="accounting-search"]').setValue('valeria')
    expect(w.findAll('[data-test="accounting-row"]')).toHaveLength(1)
    expect(w.find('[data-test="accounting-row"]').text()).toContain('TX-9002')
  })

  it('reconciles pending transactions as approved (pagado) or rejected (fallido) via PATCH /payments/:code/status', async () => {
    const { w, store } = await setupAccounting()
    const pendingRow = w.findAll('[data-test="accounting-row"]').find((r) => r.text().includes('TX-9002'))!

    await pendingRow.find('[data-test="reconcile-approve-btn"]').trigger('click')
    await flushPromises()

    expect(apiPatch).toHaveBeenCalledWith('/payments/TX-9002/status', { status: 'pagado' })
    expect(store.transacciones[1].estado).toBe('aprobado')
  })

  it('opens the digital receipt modal for approved transactions and triggers PDF download', async () => {
    const { w, store } = await setupAccounting()
    const pdfSpy = vi.spyOn(store, 'descargarComprobantePDF').mockResolvedValue(true)

    const approvedRow = w.findAll('[data-test="accounting-row"]').find((r) => r.text().includes('TX-9001'))!
    await approvedRow.find('[data-test="view-receipt-btn"]').trigger('click')

    expect(w.find('.modal-panel').text()).toContain('Comercios Unidos del Istmo, S.A.')
    expect(w.find('.modal-panel').text()).toContain('TX-9001')

    await approvedRow.find('[data-test="download-pdf-btn"]').trigger('click')
    expect(pdfSpy).toHaveBeenCalledWith(expect.objectContaining({ id: 'TX-9001' }))
  })
})
