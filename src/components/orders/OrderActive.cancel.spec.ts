import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OrderActive from './OrderActive.vue'

const base = {
  id: 'PED-1', comercioNombre: 'Comercio', fecha: '20 nov', direccion: 'Calle 1',
  items: [], total: 7, metodoPago: 'contr_entrega',
}
const card = (estado: string, pagoEstado: string | null = null) =>
  mount(OrderActive, {
    props: { pedido: { ...base, estado, pagoEstado } },
    global: { stubs: { CoverageMap: true } },
  })

describe('OrderActive: customer cancellation', () => {
  it('a pending, unpaid order offers "Cancelar pedido"', () => {
    expect(card('pendiente', 'pendiente').find('[data-test="order-cancel"]').exists()).toBe(true)
  })

  it.each(['confirmado', 'en_preparacion', 'en_camino'])('%s offers no cancel button', (estado) => {
    expect(card(estado).find('[data-test="order-cancel"]').exists()).toBe(false)
  })

  it('a paid pending order offers no cancel button (the merchant handles it)', () => {
    expect(card('pendiente', 'pagado').find('[data-test="order-cancel"]').exists()).toBe(false)
  })

  it('the first tap only asks for confirmation; the second emits "cancelar"', async () => {
    const w = card('pendiente')
    await w.find('[data-test="order-cancel"]').trigger('click')
    expect(w.emitted('cancelar')).toBeUndefined()
    expect(w.find('[data-test="order-cancel"]').text()).toMatch(/confirmar/i)
    await w.find('[data-test="order-cancel"]').trigger('click')
    expect(w.emitted('cancelar')).toHaveLength(1)
  })
})
