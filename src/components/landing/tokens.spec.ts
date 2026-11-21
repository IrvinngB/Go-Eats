import { describe, expect, it } from 'vitest'
import { bandPairsFor, contrast, dark, light, pairsFor } from './tokens'

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

describe.each([
  ['light', light],
  ['dark', dark],
] as const)('%s heading text (ink) on every tile background', (_name, theme) => {
  it.each(['surface', 'primary-tint', 'bg'] as const)('ink on %s is at least 7:1 (AAA)', (bgKey) => {
    expect(contrast(theme.ink, theme[bgKey])).toBeGreaterThanOrEqual(7)
  })

  it('ink on bg-strong surface stays at least 4.5:1', () => {
    expect(contrast(theme.ink, theme['surface-strong'])).toBeGreaterThanOrEqual(4.5)
  })
})

describe('light band tokens', () => {
  it('adds the new band tokens to light only', () => {
    expect(light.indigo).toBe('#2E2A7A')
    expect(light['on-indigo']).toBe('#FFFFFF')
    expect(light['on-indigo-soft']).toBe('#C9C7F0')
    expect(light['amber-tint']).toBe('#FFF1D6')
    expect(light.amber).toBe('#FFB62E')
    for (const key of ['indigo', 'on-indigo', 'on-indigo-soft', 'amber-tint', 'amber']) {
      expect(dark[key], `dark must not define ${key}`).toBeUndefined()
    }
  })

  it('leaves pairsFor free of band pairs so the dark loop cannot read missing keys', () => {
    const labels = pairsFor(light).map((p) => p.label)
    expect(labels.some((l) => l.includes('indigo') || l.includes('amber-tint'))).toBe(false)
  })

  const pairs = bandPairsFor(light)

  it('covers the required band pairs', () => {
    expect(pairs.map((p) => p.label)).toEqual([
      'ink on amber-tint',
      'ink-soft on amber-tint',
      'ink-soft on primary-tint',
      'primary-text on amber-tint',
      'on-indigo on indigo',
      'on-indigo-soft on indigo',
      'primary vs indigo (UI)',
      'primary-lip on primary-tint (UI)',
    ])
  })

  it('uses 4.5 for text pairs and 3 for UI pairs', () => {
    expect(pairs.filter((p) => !p.ui).every((p) => p.min === 4.5)).toBe(true)
    expect(pairs.filter((p) => p.ui).map((p) => p.min)).toEqual([3, 3])
  })

  it.each(pairs.map((p) => [p.label, p] as const))('%s meets its minimum', (_label, p) => {
    expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min)
  })
})
