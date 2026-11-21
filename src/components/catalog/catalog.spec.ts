import { describe, expect, it } from 'vitest'
import css from './catalog.css?raw'
import { contrast, dark, light } from '../landing/tokens'
import { catalogPairs, catalogTheme } from './tokens'

function block(selectorStart: string, from = 0): string {
  const i = css.indexOf(selectorStart, from)
  expect(i, `missing ${selectorStart}`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', i)
  let depth = 0
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++
    if (css[j] === '}' && --depth === 0) return css.slice(open + 1, j)
  }
  throw new Error(`unclosed ${selectorStart}`)
}

function hexDecls(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/--cx-([\w-]+)\s*:\s*(#[0-9A-Fa-f]{6})\s*;/g)) out[m[1]] = m[2].toUpperCase()
  return out
}

const upper = (t: Record<string, string>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.toUpperCase()]))

describe('catalog.css tokens', () => {
  it('hex tokens on .cx are exactly tokens.ts light plus the catalog extras', () => {
    expect(hexDecls(block('.cx {'))).toEqual(upper(catalogTheme))
  })

  it('every landing light token keeps its landing value (cannot drift)', () => {
    const declared = hexDecls(block('.cx {'))
    for (const [key, value] of Object.entries(upper(light))) expect(declared[key], key).toBe(value)
  })
})

describe('catalog.css is light only', () => {
  it('has no prefers-color-scheme, .dark or data-theme rules', () => {
    expect(css).not.toMatch(/prefers-color-scheme/)
    expect(css).not.toMatch(/\.dark\b/)
    expect(css).not.toMatch(/data-theme/)
  })

  it('contains no dark token values', () => {
    const lightValues = new Set([...Object.values(upper(catalogTheme))])
    for (const [key, value] of Object.entries(upper(dark))) {
      if (lightValues.has(value)) continue
      expect(css.toUpperCase(), `dark ${key} ${value} leaked`).not.toContain(value)
    }
  })
})

describe('catalog.css rules', () => {
  it('has no gradient, backdrop-filter or blur', () => {
    expect(css).not.toMatch(/gradient|backdrop-filter|blur\(/i)
  })

  it('only uses radii from the 8/12/16/24/32/999 scale', () => {
    const radii = [...css.matchAll(/border-radius\s*:\s*([^;]+);/g)].map((m) => m[1].trim())
    expect(radii.length).toBeGreaterThan(5)
    for (const r of radii) {
      for (const v of r.split(/\s+/)) expect(['0', '8px', '12px', '16px', '24px', '32px', '999px']).toContain(v)
    }
  })

  it('shadows only appear on the primary lip, the active tile and overlays', () => {
    const shadows = [...css.matchAll(/(?<![\w-])box-shadow\s*:\s*([^;]+);/g)].map((m) => m[1].trim())
    for (const s of shadows) {
      expect(s, `unexpected shadow ${s}`).toMatch(/^(none|0 (4|2|0)px 0 var\(--cx-primary-lip\)|var\(--cx-shadow-(active|overlay)\))$/)
    }
  })

  it('primary buttons use the dark on-primary token with the solid lip, never white', () => {
    const btn = block('.cx-btn {')
    expect(btn).toMatch(/background:\s*var\(--cx-primary\)/)
    expect(btn).toMatch(/color:\s*var\(--cx-on-primary\)/)
    expect(btn).toMatch(/box-shadow:\s*0 4px 0 var\(--cx-primary-lip\)/)
    expect(btn).not.toMatch(/#fff|white/i)
    expect(block('.cx-chip-selected {')).toMatch(/color:\s*var\(--cx-on-primary\)/)
  })

  it('re-scopes the global h1..h4 color so headings use the catalog ink and Nunito', () => {
    const h = block('.cx :is(h1, h2, h3, h4) {')
    expect(h).toMatch(/color:\s*var\(--cx-ink\)/)
    expect(h).toMatch(/font-family:\s*var\(--cx-font-heading\)/)
  })

  it('declares a visible focus ring and kills motion under reduced motion', () => {
    expect(css).toMatch(/outline:\s*2px solid var\(--cx-primary-text\)/)
    expect(css).toMatch(/outline-offset:\s*2px/)
    const rm = block('@media (prefers-reduced-motion: reduce)')
    expect(rm).toMatch(/transition:\s*none !important/)
    expect(rm).toMatch(/animation:\s*none !important/)
    expect(rm).toMatch(/transform:\s*none !important/)
  })

  it('gives prices tabular figures and chips and buttons a 44px touch target', () => {
    expect(block('.cx-price {')).toMatch(/font-variant-numeric:\s*tabular-nums/)
    expect(block('.cx-chip {')).toMatch(/min-height:\s*44px/)
    expect(block('.cx-btn {')).toMatch(/min-height:\s*44px/)
  })

  it('marks disabled and aria-disabled controls with a flat surface-strong fill', () => {
    expect(css).toMatch(/\.cx-btn\[aria-disabled='true'\]/)
    expect(css).toMatch(/\.cx-tile\[aria-disabled='true'\]/)
  })
})

describe('catalog contrast pairs', () => {
  for (const p of catalogPairs()) {
    it(`${p.label} >= ${p.min}`, () => {
      expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min)
    })
  }

  it('documents why status text uses a darker step than the design semantic color', () => {
    // desing.md values fail 4.5 on their own tints; if this ever passes the *-text tokens can be dropped.
    expect(contrast(catalogTheme.success, catalogTheme['success-tint'])).toBeLessThan(4.5)
    expect(contrast(catalogTheme.danger, catalogTheme['danger-tint'])).toBeLessThan(4.5)
  })
})
