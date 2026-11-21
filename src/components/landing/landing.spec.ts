import { describe, expect, it } from 'vitest'
import css from './landing.css?raw'
import { dark, light } from './tokens'

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

function decls(body: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of body.matchAll(/--lp-([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().toUpperCase()
  return out
}

const upper = (t: Record<string, string>) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v.toUpperCase()]))

describe('landing.css tokens', () => {
  it('light tokens on .landing match tokens.ts', () => {
    expect(decls(block('.landing {'))).toEqual(upper(light))
  })

  it('dark tokens in prefers-color-scheme match tokens.ts', () => {
    const media = block('@media (prefers-color-scheme: dark)')
    expect(media).toContain('.landing:not(.light)')
    expect(decls(media)).toEqual(upper(dark))
  })

  it('dark tokens for .dark and [data-theme="dark"] match tokens.ts', () => {
    const start = css.indexOf('.dark .landing')
    expect(start).toBeGreaterThanOrEqual(0)
    const selector = css.slice(start, css.indexOf('{', start))
    expect(selector).toContain('.landing.dark')
    expect(selector).toContain('[data-theme="dark"] .landing')
    expect(decls(block('.dark .landing'))).toEqual(upper(dark))
  })
})

describe('landing.css rules', () => {
  it('has no gradient, backdrop-filter or blur', () => {
    expect(css).not.toMatch(/gradient|backdrop-filter|blur/i)
  })

  it('kills transitions and animations under reduced motion, including the lip press', () => {
    const rm = block('@media (prefers-reduced-motion: reduce)')
    expect(rm).toContain('.landing')
    expect(rm).toMatch(/transition:\s*none\s*!important/)
    expect(rm).toMatch(/animation:\s*none\s*!important/)
    expect(rm).toMatch(/\.lp-btn[^{]*:active|transform:\s*none/)
  })

  it('keeps 44px touch targets and a visible focus ring on buttons', () => {
    const btn = block('.lp-btn {')
    expect(btn).toContain('min-height: 44px')
    expect(btn).toContain('min-width: 44px')
    expect(css).toMatch(/\.lp-btn:focus-visible\s*\{[^}]*outline/)
  })

  it('limits transitions to 150ms by default', () => {
    expect(block('.lp-btn {')).toMatch(/transition:[^;]*150ms/)
  })
})
