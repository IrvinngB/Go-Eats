import { describe, expect, it } from 'vitest'
// @ts-expect-error geo.js ships no type declarations
import { COORDENADAS_ZONAS as ZONAS_RAW, puntoEnCobertura } from './geo'

const ZONAS = ZONAS_RAW as Record<string, { lat: number; lng: number; radioM: number }>
const M_PER_DEG_LAT = 111_195 // 2 * pi * 6371 km / 360

describe('puntoEnCobertura', () => {
  it('is inside at the centre of a zone', () => {
    const z = ZONAS['san-francisco']
    expect(puntoEnCobertura(z.lat, z.lng)).toBe(true)
  })

  it('is inside just below the radius (about 10 m in from the edge)', () => {
    const z = ZONAS['clayton']
    const dLat = (z.radioM - 10) / M_PER_DEG_LAT
    expect(puntoEnCobertura(z.lat + dLat, z.lng)).toBe(true)
  })

  it('is outside just beyond the radius of the isolated zone (about 10 m out)', () => {
    const z = ZONAS['brisas-del-golf']
    // north of the zone nothing else overlaps; verified by the Colon-side point being far from every centre
    const dLat = (z.radioM + 10) / M_PER_DEG_LAT
    expect(puntoEnCobertura(z.lat + dLat, z.lng)).toBe(false)
  })

  it('is outside far from every zone (Colon, Panama)', () => {
    expect(puntoEnCobertura(9.3547, -79.9)).toBe(false)
  })

  it('is outside on the other side of the world', () => {
    expect(puntoEnCobertura(-33.87, 151.21)).toBe(false)
  })

  it('counts a point covered by any zone, not only the nearest', () => {
    // Inside Costa del Este (2.2 km) but beyond the 1.5 km of Punta Pacifica and the rest
    const z = ZONAS['costa-del-este']
    const dLat = 2000 / M_PER_DEG_LAT
    expect(puntoEnCobertura(z.lat, z.lng + 0)).toBe(true)
    expect(puntoEnCobertura(z.lat + dLat, z.lng)).toBe(true)
  })

  it('is not covered for non-finite input', () => {
    expect(puntoEnCobertura(Number.NaN, -79.5)).toBe(false)
    expect(puntoEnCobertura(8.98, Number.POSITIVE_INFINITY)).toBe(false)
  })
})
