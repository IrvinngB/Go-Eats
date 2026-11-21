import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PaymentGatewayModal, { type GatewayOrderResult } from './PaymentGatewayModal.vue'
import { TEST_CARD_APPROVE, TEST_CARD_DECLINE } from '../utils/card'

function fillValidCard(w: ReturnType<typeof mount>, numero = TEST_CARD_APPROVE) {
  return Promise.all([
    w.find('[data-test="card-holder"]').setValue('Carlos Andrade'),
    w.find('[data-test="card-number"]').setValue(numero),
    w.find('[data-test="card-expiry"]').setValue('12/29'),
    w.find('[data-test="card-cvv"]').setValue('123'),
  ])
}

describe('PaymentGatewayModal (simulated gateway)', () => {
  it('progresses card -> OTP -> processing -> approved result and includes "simulado" copy', async () => {
    setActivePinia(createPinia())
    let resolvePay!: (v: GatewayOrderResult | null) => void
    const onProcess = vi.fn(
      () =>
        new Promise<GatewayOrderResult | null>((r) => {
          resolvePay = r
        }),
    )

    const w = mount(PaymentGatewayModal, {
      props: { open: true, total: 14.5, onProcess },
    })

    expect(w.text().toLowerCase()).toContain('simulado')
    expect(w.find('[data-test="step-card"]').exists()).toBe(true)

    await fillValidCard(w)
    await w.find('[data-test="card-submit"]').trigger('click')

    expect(w.find('[data-test="step-otp"]').exists()).toBe(true)
    expect(onProcess).not.toHaveBeenCalled()

    await w.find('[data-test="otp-code"]').setValue('123456')
    await w.find('[data-test="otp-submit"]').trigger('click')

    expect(w.find('[data-test="step-processing"]').exists()).toBe(true)
    expect(onProcess).toHaveBeenCalledTimes(1)
    expect(onProcess).toHaveBeenCalledWith({ simulateFailure: false })

    resolvePay({ id: 'PED-101', pagoEstado: 'pagado', estado: 'pendiente', referenciaPasarela: 'YPY-999' })
    await flushPromises()

    expect(w.find('[data-test="step-result"]').exists()).toBe(true)
    expect(w.text()).toContain('Pago aprobado')
    expect(w.find('[data-test="referencia-pago"]').text()).toBe('YPY-999')
  })

  it('blocks advancing from card step when Luhn, expiry, or CVV is invalid and from OTP when code is not 6 digits', async () => {
    const onProcess = vi.fn()
    const w = mount(PaymentGatewayModal, {
      props: { open: true, total: 10, onProcess },
    })

    await w.find('[data-test="card-holder"]').setValue('A')
    await w.find('[data-test="card-number"]').setValue('4111111111111112')
    await w.find('[data-test="card-expiry"]').setValue('01/20')
    await w.find('[data-test="card-cvv"]').setValue('12')
    await w.find('[data-test="card-submit"]').trigger('click')

    expect(w.find('[data-test="step-card"]').exists()).toBe(true)
    expect(w.find('[data-test="step-otp"]').exists()).toBe(false)
    expect(w.find('[data-test="card-errors"]').text()).toContain('Número de tarjeta inválido')

    await fillValidCard(w, TEST_CARD_DECLINE)
    await w.find('[data-test="card-submit"]').trigger('click')
    expect(w.find('[data-test="step-otp"]').exists()).toBe(true)

    await w.find('[data-test="otp-code"]').setValue('12')
    await w.find('[data-test="otp-submit"]').trigger('click')
    expect(onProcess).not.toHaveBeenCalled()

    await w.find('[data-test="otp-code"]').setValue('654321')
    onProcess.mockResolvedValueOnce({ id: 'PED-102', pagoEstado: 'fallido', estado: 'cancelado' })
    await w.find('[data-test="otp-submit"]').trigger('click')
    await flushPromises()

    expect(onProcess).toHaveBeenCalledWith({ simulateFailure: true })
    expect(w.text()).toContain('Pago rechazado')
  })

  it('clears card fields on close and never leaks card data to Pinia, storage, or console', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const logSpy = vi.spyOn(console, 'log')
    const infoSpy = vi.spyOn(console, 'info')
    const warnSpy = vi.spyOn(console, 'warn')
    const errorSpy = vi.spyOn(console, 'error')
    const storageSetSpy = typeof Storage !== 'undefined' ? vi.spyOn(Storage.prototype, 'setItem') : null

    const onProcess = vi.fn().mockResolvedValue({
      id: 'PED-103',
      pagoEstado: 'pagado',
      estado: 'pendiente',
      referenciaPasarela: 'YPY-103',
    })

    const w = mount(PaymentGatewayModal, {
      props: { open: true, total: 20, onProcess },
    })

    await fillValidCard(w, TEST_CARD_APPROVE)
    await w.setProps({ open: false })
    await w.setProps({ open: true })

    expect((w.find('[data-test="card-holder"]').element as HTMLInputElement).value).toBe('')
    expect((w.find('[data-test="card-number"]').element as HTMLInputElement).value).toBe('')
    expect((w.find('[data-test="card-expiry"]').element as HTMLInputElement).value).toBe('')
    expect((w.find('[data-test="card-cvv"]').element as HTMLInputElement).value).toBe('')

    await fillValidCard(w, TEST_CARD_APPROVE)
    await w.find('[data-test="card-submit"]').trigger('click')
    await w.find('[data-test="otp-code"]').setValue('123456')
    await w.find('[data-test="otp-submit"]').trigger('click')
    await flushPromises()

    const secretTokens = [TEST_CARD_APPROVE, '4111 1111 1111 1111', 'Carlos Andrade', '12/29']
    const dump = JSON.stringify({
      pinia: pinia.state.value,
      storageWrites: storageSetSpy ? storageSetSpy.mock.calls : [],
      calls: onProcess.mock.calls,
      logs: [...logSpy.mock.calls, ...infoSpy.mock.calls, ...warnSpy.mock.calls, ...errorSpy.mock.calls],
    })
    for (const token of secretTokens) {
      expect(dump).not.toContain(token)
    }

    storageSetSpy?.mockRestore()
    logSpy.mockRestore()
    infoSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })
})
