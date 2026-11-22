import { describe, expect, it } from 'vitest'
import { ESTADO_LABELS, ESTADOS_PEDIDO } from '../mockData'
import { CADENA, estadoVisual, etaDeComercio } from './orderStatus'

const CANONICOS = ['pendiente', 'confirmado', 'en_preparacion', 'listo_para_recoger', 'en_camino', 'entregado', 'rechazado', 'cancelado']

describe('estadoVisual: the 8 canonical API states', () => {
  it.each([
    ['pendiente', 'receipt', 'neutral', 0],
    ['confirmado', 'receipt', 'neutral', 1],
    ['en_preparacion', 'chef-hat', 'warning', 2],
    ['listo_para_recoger', 'user-check', 'indigo', 3],
    ['en_camino', 'bike', 'info', 4],
    ['entregado', 'circle-check', 'success', 5],
    ['rechazado', 'circle-x', 'danger', -1],
    ['cancelado', 'circle-x', 'danger', -1],
  ])('%s -> icon %s, tone %s, step %i', (estado, icon, tone, paso) => {
    const v = estadoVisual(estado)
    expect(v.icon).toBe(icon)
    expect(v.tone).toBe(tone)
    expect(v.paso).toBe(paso)
    expect(v.estado).toBe(estado)
  })

  it('every canonical state keeps the Spanish label from ESTADO_LABELS', () => {
    for (const e of CANONICOS) expect(estadoVisual(e).label).toBe(ESTADO_LABELS[e])
    expect(estadoVisual('en_preparacion').label).toBe('En preparación')
  })

  it('the step chain is the store chain, in order', () => {
    expect(CADENA).toEqual(ESTADOS_PEDIDO)
    expect(CADENA).toHaveLength(6)
  })

  it('classifies terminal, failed, in-progress and trackable states', () => {
    const flags = (e: string) => {
      const v = estadoVisual(e)
      return [v.terminal, v.fallido, v.enCurso, v.seguible]
    }
    expect(flags('pendiente')).toEqual([false, false, true, false])
    expect(flags('confirmado')).toEqual([false, false, true, false])
    expect(flags('en_preparacion')).toEqual([false, false, true, true])
    expect(flags('listo_para_recoger')).toEqual([false, false, true, true])
    expect(flags('en_camino')).toEqual([false, false, true, true])
    expect(flags('entregado')).toEqual([true, false, false, false])
    expect(flags('rechazado')).toEqual([true, true, false, false])
    expect(flags('cancelado')).toEqual([true, true, false, false])
  })

  it('step text says which step of how many, in Spanish', () => {
    expect(estadoVisual('en_preparacion').pasoTexto).toBe('Paso 3 de 6')
    expect(estadoVisual('entregado').pasoTexto).toBe('Paso 6 de 6')
    expect(estadoVisual('rechazado').pasoTexto).toBe('')
  })
})

describe('estadoVisual: inputs outside the canonical set fall back safely', () => {
  it.each(['en camino', 'En_Camino', 'preparando', '', '  ', 'constructor', '__proto__', 'toString'])('%j is unknown, never a state', (raw) => {
    const v = estadoVisual(raw)
    expect(v.icon).toBe('circle-question-mark')
    expect(v.tone).toBe('neutral')
    expect(v.paso).toBe(-1)
    expect(v.label).toBe('Estado desconocido')
    expect([v.terminal, v.fallido, v.enCurso, v.seguible]).toEqual([false, false, false, false])
  })

  it.each([null, undefined, 4, {}, []])('non-string %j does not throw', (raw) => {
    expect(estadoVisual(raw as unknown as string).label).toBe('Estado desconocido')
  })
})

describe('etaDeComercio: only what the merchant data says', () => {
  it('splits a delivery-time range into the big value and the unit', () => {
    expect(etaDeComercio('25-35 min')).toEqual({ valor: '25–35', unidad: 'min' })
    expect(etaDeComercio(' 15 – 25 min ')).toEqual({ valor: '15–25', unidad: 'min' })
  })

  it('keeps any other text as it came, without a unit', () => {
    expect(etaDeComercio('Una hora')).toEqual({ valor: 'Una hora', unidad: '' })
  })

  it.each([null, undefined, '', '   ', 12, {}])('nothing to show for %j (never an invented time)', (raw) => {
    expect(etaDeComercio(raw as unknown as string)).toBeNull()
  })
})
