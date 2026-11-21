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

/**
 * Static proof only: jsdom cannot compute the Tailwind cascade, so we compare
 * selector specificity in the CSS text. A real-browser check is still required.
 */
function specificity(selector: string): [number, number, number] {
  let s = selector.trim()
  // :is() takes the specificity of its most specific argument
  let extra: [number, number, number] = [0, 0, 0]
  s = s.replace(/:is\(([^)]*)\)/g, (_m, args: string) => {
    for (const a of args.split(',')) {
      const sp = specificity(a)
      if (sp[0] > extra[0] || (sp[0] === extra[0] && (sp[1] > extra[1] || (sp[1] === extra[1] && sp[2] > extra[2])))) extra = sp
    }
    return ''
  })
  s = s.replace(/:not\(([^)]*)\)/g, (_m, a: string) => {
    const sp = specificity(a)
    extra = [extra[0] + sp[0], extra[1] + sp[1], extra[2] + sp[2]]
    return ''
  })
  const ids = (s.match(/#[\w-]+/g) ?? []).length
  const cls = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length
  const tags = (s.replace(/[#.][\w-]+|\[[^\]]+\]|::?[\w-]+/g, ' ').match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length
  return [ids + extra[0], cls + extra[1], tags + extra[2]]
}

const gte = (a: number[], b: number[]) => a[0] !== b[0] ? a[0] > b[0] : a[1] !== b[1] ? a[1] > b[1] : a[2] >= b[2]

// vitest returns '' for style.css?raw and the project has no node types, so the selector of the
// global rule (src/style.css, @layer base) is mirrored here. Update it if that rule changes.
const GLOBAL_HEADING_SELECTOR = 'h1, h2, h3, h4'

describe('landing headings are not captured by the app global heading rule', () => {
  const landingRule = css.match(/(\.landing\s+:is\(h1,\s*h2,\s*h3,\s*h4\))\s*\{([^}]*)\}/)

  it('has a .landing heading rule that sets color to --lp-ink', () => {
    expect(landingRule).not.toBeNull()
    expect(landingRule![2]).toMatch(/color:\s*var\(--lp-ink\)/)
  })

  it('beats the global heading rule on specificity', () => {
    const g = specificity(GLOBAL_HEADING_SELECTOR.split(',')[0])
    expect(g).toEqual([0, 0, 1])
    const l = specificity('.landing :is(h1, h2, h3, h4)')
    expect(l).toEqual([0, 1, 1])
    expect(gte(l, g) && l.join() !== g.join()).toBe(true)
  })

  it('forces the Nunito family inherited from .landing on headings', () => {
    expect(landingRule![2]).toMatch(/font-family:\s*inherit/)
    expect(block('.landing {')).toContain("font-family: 'Nunito'")
  })

  it('keeps .lp-display font-weight and letter-spacing above the global heading rule', () => {
    expect(specificity('.lp-display')).toEqual([0, 1, 0])
    expect(block('.lp-display {')).toMatch(/font-weight:\s*800/)
  })
})
