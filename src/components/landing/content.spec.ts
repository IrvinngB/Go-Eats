import { describe, expect, it } from 'vitest'
import { CATEGORIES, ENVIO_COPY, ROLES, STEPS } from './content'

function allCopy(): string[] {
  const out: string[] = [ENVIO_COPY]
  for (const c of CATEGORIES) out.push(c.name)
  for (const s of STEPS) out.push(s.title, s.text)
  for (const r of Object.values(ROLES)) out.push(r.eyebrow, r.title, r.lead, r.cta, ...r.points.map((p) => p.title), ...r.points.map((p) => p.text))
  return out
}

describe('content', () => {
  it('keeps the approved shipping sentence exactly', () => {
    expect(ENVIO_COPY).toBe('El costo de envío depende de tu zona y lo ves antes de confirmar el pedido.')
  })

  it('has four steps numbered 1 to 4 in order', () => {
    expect(STEPS.map((s) => s.n)).toEqual([1, 2, 3, 4])
  })

  it('orders the steps: store, cart, confirm with cash on delivery, order status', () => {
    expect(STEPS.map((s) => s.title)).toEqual([
      'Elige un comercio',
      'Arma tu carrito',
      'Confirma y paga al recibir',
      'Sigue el estado de tu pedido',
    ])
    expect(STEPS[2].text).toContain('efectivo')
    expect(STEPS[2].text).toContain(ENVIO_COPY)
  })

  it('exposes one merchant and one courier role with three points each', () => {
    expect(Object.keys(ROLES)).toEqual(['merchant', 'courier'])
    expect(ROLES.merchant.points).toHaveLength(3)
    expect(ROLES.courier.points).toHaveLength(3)
  })

  it('contains no prohibited claims', () => {
    const joined = allCopy().join(' | ')
    expect(joined).not.toMatch(/[$€]|B\/\.|USD|\bmin(utos)?\b|\d+\s*%|★|estrellas?|yappy|paguelo|tarjeta|\bvisa\b|mastercard|en vivo|tiempo real|km\b|kil[oó]metros|testimonio/i)
    expect(joined).not.toMatch(/\d/)
  })

  it('names no price, fee amount or time inside the roles copy', () => {
    const roles = Object.values(ROLES).flatMap((r) => [r.lead, ...r.points.map((p) => p.text)]).join(' ')
    expect(roles).not.toMatch(/precio|costo|tarifa|gana/i)
  })
})
