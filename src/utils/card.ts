export const TEST_CARD_APPROVE = '4111111111111111'
export const TEST_CARD_DECLINE = '4000000000000002'

export type CardBrand = 'Visa' | 'Mastercard' | 'Amex' | 'Tarjeta'

export function normalizarNumeroTarjeta(raw: string): string {
  return raw.replace(/[\s-]/g, '')
}

export function detectarMarcaTarjeta(raw: string): CardBrand {
  const digits = normalizarNumeroTarjeta(raw)
  if (digits.startsWith('4')) return 'Visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard'
  if (/^3[47]/.test(digits)) return 'Amex'
  return 'Tarjeta'
}

export function validarLuhn(raw: string): boolean {
  const digits = normalizarNumeroTarjeta(raw)
  if (!/^\d{13,19}$/.test(digits) || /^0+$/.test(digits)) return false
  let sum = 0
  let doubleIt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i])
    if (doubleIt) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
    doubleIt = !doubleIt
  }
  return sum % 10 === 0
}

export function validarVencimiento(raw: string, ahora: Date = new Date()): boolean {
  const m = raw.trim().match(/^(\d{2})\/(\d{2}|\d{4})$/)
  if (!m) return false
  const mes = Number(m[1])
  if (mes < 1 || mes > 12) return false
  const anioRaw = Number(m[2])
  const anio = m[2].length === 2 ? 2000 + anioRaw : anioRaw
  const anioActual = ahora.getFullYear()
  const mesActual = ahora.getMonth() + 1
  return anio > anioActual || (anio === anioActual && mes >= mesActual)
}

export function validarCvv(raw: string): boolean {
  return /^\d{3,4}$/.test(raw.trim())
}

export function esTarjetaRechazoSimulado(raw: string): boolean {
  return normalizarNumeroTarjeta(raw) === TEST_CARD_DECLINE
}

export interface CardFormInput {
  titular: string
  numero: string
  vencimiento: string
  cvv: string
}

export interface CardFormErrors {
  titular?: string
  numero?: string
  vencimiento?: string
  cvv?: string
}

export function validarFormularioTarjeta(
  input: CardFormInput,
  ahora: Date = new Date(),
): { valido: boolean; errores: CardFormErrors } {
  const errores: CardFormErrors = {}
  if (input.titular.trim().length < 2) errores.titular = 'Ingresa el nombre del titular.'
  if (!validarLuhn(input.numero)) errores.numero = 'Número de tarjeta inválido.'
  if (!validarVencimiento(input.vencimiento, ahora)) errores.vencimiento = 'Fecha de vencimiento inválida (MM/AA).'
  if (!validarCvv(input.cvv)) errores.cvv = 'CVV de 3 o 4 dígitos requerido.'
  return { valido: Object.keys(errores).length === 0, errores }
}
