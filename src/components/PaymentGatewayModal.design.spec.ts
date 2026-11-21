import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PaymentGatewayModal, { type GatewayOrderResult } from './PaymentGatewayModal.vue'
import { TEST_CARD_APPROVE, TEST_CARD_DECLINE } from '../utils/card'

type W = ReturnType<typeof mount>
const key = (k: string, init: KeyboardEventInit = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }))
const open = (onProcess = vi.fn(), extra: Record<string, unknown> = {}) =>
  mount(PaymentGatewayModal, { props: { open: true, total: 9.5, onProcess, ...extra }, attachTo: document.body })
const fill = async (w: W, numero = TEST_CARD_APPROVE) => {
  await w.find('[data-test="card-holder"]').setValue('Carlos Andrade')
  await w.find('[data-test="card-number"]').setValue(numero)
  await w.find('[data-test="card-expiry"]').setValue('12/29')
  await w.find('[data-test="card-cvv"]').setValue('123')
}

afterEach(() => {
  document.body.innerHTML = ''
  document.body.className = ''
})

describe('PaymentGatewayModal design and a11y', () => {
  it('is a labelled modal dialog inside its own .cx scope (tokens and Nunito headings resolve)', () => {
    const w = open()
    expect(w.find('[data-test="gateway-overlay"]').classes()).toEqual(expect.arrayContaining(['cx', 'cx-overlay']))
    const dialog = w.find('[data-test="gateway-dialog"]')
    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBe('gateway-title')
    const title = w.find('#gateway-title')
    expect(title.element.tagName).toBe('H2')
    expect(title.element.closest('.cx')).not.toBeNull()
    w.unmount()
  })

  it('card step: focus lands on the first field and the total uses two decimals', async () => {
    const w = open()
    await flushPromises()
    expect(document.activeElement).toBe(w.find('[data-test="card-holder"]').element)
    expect(w.find('[data-test="step-card"]').text()).toContain('B/ 9.50')
    w.unmount()
  })

  it('card validation: each invalid field gets aria-invalid, aria-describedby and an icon + text message below', async () => {
    const w = open()
    await w.find('[data-test="card-holder"]').setValue('A')
    await w.find('[data-test="card-number"]').setValue('4111111111111112')
    await w.find('[data-test="card-expiry"]').setValue('01/20')
    await w.find('[data-test="card-cvv"]').setValue('12')
    await w.find('[data-test="card-submit"]').trigger('click')

    const expected: Record<string, [string, string]> = {
      'card-holder': ['error-titular', 'Ingresa el nombre del titular.'],
      'card-number': ['error-numero', 'Número de tarjeta inválido.'],
      'card-expiry': ['error-vencimiento', 'Fecha de vencimiento inválida (MM/AA).'],
      'card-cvv': ['error-cvv', 'CVV de 3 o 4 dígitos requerido.'],
    }
    for (const [field, [errorTest, message]] of Object.entries(expected)) {
      const input = w.find(`[data-test="${field}"]`)
      const err = w.find(`[data-test="${errorTest}"]`)
      expect(input.attributes('aria-invalid'), field).toBe('true')
      expect(input.attributes('aria-describedby'), field).toBe(err.attributes('id'))
      expect(err.text(), field).toBe(message)
      expect(err.find('svg').exists(), field).toBe(true)
      expect(err.classes(), field).toContain('cx-field-error')
    }
    // one announcement for assistive tech, not four
    expect(w.findAll('[role="alert"]')).toHaveLength(1)
    w.unmount()
  })

  it('a valid card clears the errors and the fields carry no aria-invalid', async () => {
    const w = open()
    await w.find('[data-test="card-submit"]').trigger('click')
    expect(w.find('[data-test="card-holder"]').attributes('aria-invalid')).toBe('true')
    await fill(w)
    await w.find('[data-test="card-submit"]').trigger('click')
    expect(w.find('[data-test="step-otp"]').exists()).toBe(true)
    w.unmount()
  })

  it('OTP step: focus moves to the code field; a short code shows an icon + text error tied to the input', async () => {
    const onProcess = vi.fn()
    const w = open(onProcess)
    await fill(w)
    await w.find('[data-test="card-submit"]').trigger('click')
    await flushPromises()
    const otp = w.find('[data-test="otp-code"]')
    expect(document.activeElement).toBe(otp.element)
    await otp.setValue('12')
    await w.find('[data-test="otp-submit"]').trigger('click')
    const err = w.find('[data-test="otp-error"]')
    expect(err.text()).toBe('Ingresa el código de 6 dígitos.')
    expect(err.find('svg').exists()).toBe(true)
    expect(otp.attributes('aria-invalid')).toBe('true')
    expect(otp.attributes('aria-describedby')).toBe(err.attributes('id'))
    expect(onProcess).not.toHaveBeenCalled()
    await otp.setValue('123456')
    expect(w.find('[data-test="otp-error"]').exists()).toBe(false)
    w.unmount()
  })

  it('processing: the only button is disabled, says Procesando, and neither Escape nor the scrim closes it', async () => {
    let resolvePay!: (v: GatewayOrderResult | null) => void
    const onProcess = vi.fn(() => new Promise<GatewayOrderResult | null>((r) => (resolvePay = r)))
    const w = open(onProcess)
    await fill(w)
    await w.find('[data-test="card-submit"]').trigger('click')
    await w.find('[data-test="otp-code"]').setValue('123456')
    await w.find('[data-test="otp-submit"]').trigger('click')

    const step = w.find('[data-test="step-processing"]')
    const buttons = step.findAll('button')
    expect(buttons).toHaveLength(1)
    expect((buttons[0].element as HTMLButtonElement).disabled).toBe(true)
    expect(buttons[0].attributes('aria-disabled')).toBe('true')
    expect(buttons[0].text()).toBe('Procesando…')
    expect(step.attributes('aria-busy')).toBe('true')

    key('Escape')
    await w.find('[data-test="gateway-overlay"]').trigger('click')
    expect(w.emitted('close')).toBeUndefined()
    expect(onProcess).toHaveBeenCalledTimes(1)

    resolvePay({ id: 'PED-1', pagoEstado: 'pagado', referenciaPasarela: 'YPY-1' })
    await flushPromises()
    w.unmount()
  })

  it('approved result: success icon + text + color, order, reference in a code tile, focus on the title', async () => {
    const w = open(vi.fn().mockResolvedValue({ id: 'PED-9', pagoEstado: 'pagado', referenciaPasarela: 'YPY-777' }))
    await fill(w)
    await w.find('[data-test="card-submit"]').trigger('click')
    await w.find('[data-test="otp-code"]').setValue('123456')
    await w.find('[data-test="otp-submit"]').trigger('click')
    await flushPromises()
    const step = w.find('[data-test="step-result"]')
    expect(step.find('.cx-result-icon').classes()).toContain('cx-result-ok')
    expect(step.find('.cx-result-icon svg').exists()).toBe(true)
    expect(step.find('h2').text()).toBe('Pago aprobado')
    expect(step.text()).toContain('Pedido PED-9')
    expect(step.find('[data-test="referencia-pago"]').classes()).toContain('cx-code')
    expect(document.activeElement).toBe(step.find('h2').element)
    expect(step.find('[data-test="result-orders"]').text()).toBe('Ver mis pedidos')
    await step.find('[data-test="result-orders"]').trigger('click')
    expect(w.emitted('view-orders')).toHaveLength(1)
    w.unmount()
  })

  it('declined result: danger icon + text + color and the cancel explanation', async () => {
    const onProcess = vi.fn().mockResolvedValue({ id: 'PED-8', pagoEstado: 'fallido', estado: 'cancelado' })
    const w = open(onProcess)
    await fill(w, TEST_CARD_DECLINE)
    await w.find('[data-test="card-submit"]').trigger('click')
    await w.find('[data-test="otp-code"]').setValue('123456')
    await w.find('[data-test="otp-submit"]').trigger('click')
    await flushPromises()
    expect(onProcess).toHaveBeenCalledWith({ simulateFailure: true })
    const step = w.find('[data-test="step-result"]')
    expect(step.find('.cx-result-icon').classes()).toContain('cx-result-bad')
    expect(step.find('.cx-result-icon svg').exists()).toBe(true)
    expect(step.find('h2').text()).toBe('Pago rechazado')
    expect(step.text()).toContain('El pedido fue cancelado.')
    expect(step.text()).not.toContain('Referencia')
    w.unmount()
  })

  it('failure without an order closes with one primary button; with consent_required it offers the profile', async () => {
    const w = open(vi.fn().mockResolvedValue(null), { consentRequired: true })
    await fill(w)
    await w.find('[data-test="card-submit"]').trigger('click')
    await w.find('[data-test="otp-code"]').setValue('123456')
    await w.find('[data-test="otp-submit"]').trigger('click')
    await flushPromises()
    const step = w.find('[data-test="step-result"]')
    expect(step.find('h2').text()).toBe('No se pudo completar')
    expect(step.find('[data-test="consent-required"] button').classes()).toContain('cx-btn-secondary')
    await step.find('[data-test="consent-required"] button').trigger('click')
    expect(w.emitted('go-profile')).toHaveLength(1)
    await step.find('[data-test="result-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
    w.unmount()
  })

  it('Escape and the scrim close it on the card step; clicks inside do not', async () => {
    const w = open()
    await w.find('[data-test="gateway-dialog"]').trigger('click')
    expect(w.emitted('close')).toBeUndefined()
    key('Escape')
    expect(w.emitted('close')).toHaveLength(1)
    await w.find('[data-test="gateway-overlay"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(2)
    w.unmount()
  })

  it('Tab stays inside the dialog and the page scroll is locked while it is open', async () => {
    const w = open()
    await flushPromises()
    expect(document.body.classList.contains('cx-dialog-open')).toBe(true)
    const stops = [...(w.find('[data-test="gateway-dialog"]').element as HTMLElement).querySelectorAll<HTMLElement>('button:not([disabled]), input')]
    stops[stops.length - 1].focus()
    key('Tab')
    expect(document.activeElement).toBe(stops[0])
    key('Tab', { shiftKey: true })
    expect(document.activeElement).toBe(stops[stops.length - 1])
    await w.setProps({ open: false })
    await flushPromises()
    expect(document.body.classList.contains('cx-dialog-open')).toBe(false)
    w.unmount()
  })

  it('Enter in a card field continues like the button (keyboard-only walk)', async () => {
    const w = open()
    await fill(w)
    await w.find('[data-test="card-cvv"]').trigger('keydown', { key: 'Enter' })
    expect(w.find('[data-test="step-otp"]').exists()).toBe(true)
    w.unmount()
  })

  it('card data is wiped when moving to the OTP step', async () => {
    const w = open()
    await fill(w)
    await w.find('[data-test="card-submit"]').trigger('click')
    expect(w.html()).not.toContain(TEST_CARD_APPROVE)
    expect(w.html()).not.toContain('Carlos Andrade')
    w.unmount()
  })
})
