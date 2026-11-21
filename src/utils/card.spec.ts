import { describe, it, expect } from 'vitest'
import {
  TEST_CARD_APPROVE,
  TEST_CARD_DECLINE,
  detectarMarcaTarjeta,
  esTarjetaRechazoSimulado,
  validarCvv,
  validarFormularioTarjeta,
  validarLuhn,
  validarVencimiento,
} from './card'

describe('card validators (simulated gateway)', () => {
  it('validates Luhn numbers including approve/decline test cards and formatted strings', () => {
    expect(validarLuhn(TEST_CARD_APPROVE)).toBe(true)
    expect(validarLuhn('4111 1111 1111 1111')).toBe(true)
    expect(validarLuhn(TEST_CARD_DECLINE)).toBe(true)
    expect(validarLuhn('5555-5555-5555-4444')).toBe(true)
    expect(validarLuhn('4111111111111112')).toBe(false)
    expect(validarLuhn('123456')).toBe(false)
    expect(validarLuhn('0000000000000000')).toBe(false)
    expect(validarLuhn('4111abcd11111111')).toBe(false)
  })

  it('detects card brand and simulated decline test card', () => {
    expect(detectarMarcaTarjeta(TEST_CARD_APPROVE)).toBe('Visa')
    expect(detectarMarcaTarjeta('5555555555554444')).toBe('Mastercard')
    expect(detectarMarcaTarjeta('378282246310005')).toBe('Amex')
    expect(detectarMarcaTarjeta('6011111111111117')).toBe('Tarjeta')
    expect(esTarjetaRechazoSimulado('4000 0000 0000 0002')).toBe(true)
    expect(esTarjetaRechazoSimulado(TEST_CARD_APPROVE)).toBe(false)
  })

  it('validates MM/YY expiry against reference date (current month valid, past rejected)', () => {
    const ref = new Date(2026, 10, 20) // Nov 2026 (month index 10 = November)
    expect(validarVencimiento('11/26', ref)).toBe(true)
    expect(validarVencimiento('12/26', ref)).toBe(true)
    expect(validarVencimiento('01/27', ref)).toBe(true)
    expect(validarVencimiento('10/26', ref)).toBe(false)
    expect(validarVencimiento('11/25', ref)).toBe(false)
    expect(validarVencimiento('00/27', ref)).toBe(false)
    expect(validarVencimiento('13/27', ref)).toBe(false)
    expect(validarVencimiento('1127', ref)).toBe(false)
  })

  it('validates CVV of 3 to 4 digits', () => {
    expect(validarCvv('123')).toBe(true)
    expect(validarCvv('1234')).toBe(true)
    expect(validarCvv('12')).toBe(false)
    expect(validarCvv('12345')).toBe(false)
    expect(validarCvv('12a')).toBe(false)
  })

  it('validates full card form and returns Spanish field errors', () => {
    const ref = new Date(2026, 10, 20)
    const ok = validarFormularioTarjeta(
      { titular: 'Carlos Andrade', numero: TEST_CARD_APPROVE, vencimiento: '12/28', cvv: '123' },
      ref,
    )
    expect(ok.valido).toBe(true)
    expect(ok.errores).toEqual({})

    const bad = validarFormularioTarjeta(
      { titular: ' ', numero: '4111111111111112', vencimiento: '01/20', cvv: '1' },
      ref,
    )
    expect(bad.valido).toBe(false)
    expect(bad.errores.titular).toBeTruthy()
    expect(bad.errores.numero).toBeTruthy()
    expect(bad.errores.vencimiento).toBeTruthy()
    expect(bad.errores.cvv).toBeTruthy()
  })
})
