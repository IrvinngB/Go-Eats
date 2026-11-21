import { describe, it, expect } from 'vitest'
// @ts-expect-error mockData is plain JS
import { ESTADOS_PEDIDO, ESTADOS_TERMINALES, ESTADO_LABELS, ESTADO_BADGES, pedidosIniciales } from './mockData'

const CANONICAL = [
  'pendiente',
  'confirmado',
  'en_preparacion',
  'listo_para_recoger',
  'en_camino',
  'entregado',
  'rechazado',
  'cancelado',
]

describe('canonical order states in mockData', () => {
  it('the progress chain is the canonical forward chain', () => {
    expect(ESTADOS_PEDIDO).toEqual(CANONICAL.slice(0, 6))
  })

  it('terminal states are entregado, rechazado and cancelado', () => {
    expect([...ESTADOS_TERMINALES].sort()).toEqual(['cancelado', 'entregado', 'rechazado'])
  })

  it('ESTADO_LABELS has exactly the eight canonical keys with one Spanish label each', () => {
    expect(Object.keys(ESTADO_LABELS).sort()).toEqual([...CANONICAL].sort())
    expect(ESTADO_LABELS.en_preparacion).toBe('En preparación')
    expect(ESTADO_LABELS.listo_para_recoger).toBe('Listo para recoger')
    expect(ESTADO_LABELS.en_camino).toBe('En camino')
    expect(ESTADO_LABELS.rechazado).toBe('Rechazado')
  })

  it('every canonical state has a badge style', () => {
    for (const estado of CANONICAL) expect(ESTADO_BADGES[estado]).toMatch(/^bg-/)
  })

  it('initial mock orders only use canonical states (no spaced variants)', () => {
    const used = pedidosIniciales.map((p: { estado: string }) => p.estado)
    expect(used.filter((e: string) => !CANONICAL.includes(e))).toEqual([])
    expect(used).toContain('en_preparacion')
    expect(used).toContain('listo_para_recoger')
    expect(used).toContain('en_camino')
  })
})
