import { describe, expect, it } from 'vitest'
import { contrast, dark, light, pairsFor } from './tokens'

describe('contrast()', () => {
  it('matches the WCAG reference values', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrast('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5)
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 1)
  })

  it('is symmetric', () => {
    expect(contrast('#00796B', '#D6F5F0')).toBeCloseTo(contrast('#D6F5F0', '#00796B'), 10)
  })
})

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('%s theme contrast', (name, theme) => {
  const pairs = pairsFor(theme)

  it('covers the required pairs', () => {
    const labels = pairs.map((p) => p.label)
    for (const needed of [
      'ink on bg',
      'ink on surface',
      'ink on primary-tint',
      'on-primary on primary',
      'on-primary on primary-hover',
      'primary-text on bg',
      'primary-text on primary-tint',
    ]) {
      expect(labels, `${name} missing ${needed}`).toContain(needed)
    }
  })

  it.each(pairs.map((p) => [p.label, p] as const))('%s meets its minimum', (_label, p) => {
    expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min)
  })

  it('never lowers the text threshold below 4.5', () => {
    const textPairs = pairs.filter((p) => !p.ui)
    expect(textPairs.length).toBeGreaterThan(0)
    expect(Math.min(...textPairs.map((p) => p.min))).toBe(4.5)
  })
})

describe('primary hover', () => {
  it('is darker than primary yet keeps 4.5:1 with on-primary (light)', () => {
    expect(contrast(light['on-primary'], light['primary-hover'])).toBeGreaterThanOrEqual(4.5)
    expect(contrast(light['on-primary'], light['primary-hover'])).toBeLessThan(
      contrast(light['on-primary'], light.primary),
    )
  })

  it('rejects the clarify suggestion #009C8A', () => {
    expect(contrast(light['on-primary'], '#009C8A')).toBeLessThan(4.5)
  })

  it('light primary-text on white is at least 4.5 and primary alone fails as text', () => {
    expect(contrast(light['primary-text'], light.bg)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(light.primary, light.bg)).toBeLessThan(3)
  })
})
