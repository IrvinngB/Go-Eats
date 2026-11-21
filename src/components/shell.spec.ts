import { describe, expect, it } from 'vitest'
import css from './catalog/catalog.css?raw'
import topbar from './TopBar.vue?raw'
import pwa from './PwaStatus.vue?raw'
import app from '../App.vue?raw'
import login from '../views/LoginView.vue?raw'
import { contrast } from './landing/tokens'
import { catalogTheme, shellPairs } from './catalog/tokens'

function block(selectorStart: string): string {
  const i = css.indexOf(selectorStart)
  expect(i, `missing ${selectorStart}`).toBeGreaterThanOrEqual(0)
  const open = css.indexOf('{', i)
  let depth = 0
  for (let j = open; j < css.length; j++) {
    if (css[j] === '{') depth++
    if (css[j] === '}' && --depth === 0) return css.slice(open + 1, j)
  }
  throw new Error(`unclosed ${selectorStart}`)
}

const template = (src: string) => src.slice(src.indexOf('<template>'))
const shell = { TopBar: template(topbar), PwaStatus: template(pwa), App: template(app), LoginView: template(login) }

describe('customer shell markup follows the Friendly Bento rules', () => {
  for (const [name, src] of Object.entries(shell)) {
    describe(name, () => {
      it('lives inside the light .cx scope', () => {
        expect(src).toMatch(/class="[^"]*\bcx\b/)
      })

      it('never puts white text on the primary fill or uses the legacy global classes', () => {
        expect(src).not.toMatch(/\btext-white\b/)
        expect(src).not.toMatch(/bg-brand/)
        expect(src).not.toMatch(/[\s"'`](btn-primary|btn-secondary|card|input|label)[\s"'`]/)
      })

      it('has no blur, translucency, gradients, ad-hoc radii, shadows or borders', () => {
        expect(src).not.toMatch(/backdrop-|bg-white|bg-gradient|\bblur\b|\/9[05]\b/)
        expect(src).not.toMatch(/\brounded(-[\w[\]./]+)?\b/)
        expect(src).not.toMatch(/\bshadow(-[\w[\]./]+)?\b/)
        expect(src).not.toMatch(/\bborder(-[\w[\]./]+)?\b/)
      })

      it('uses only Lucide stroke icons (no inline svg)', () => {
        expect(src).not.toMatch(/<svg/)
      })
    })
  }

  it('the TopBar script has no backdrop-filter either', () => {
    expect(topbar).not.toMatch(/backdrop/)
  })
})

describe('shell css', () => {
  it('top bar: 64px, flat --bg, 1px bottom --border, sticky, no blur', () => {
    const b = block('.cx-topbar {')
    expect(b).toMatch(/height:\s*64px/)
    expect(b).toMatch(/background:\s*var\(--cx-bg\)/)
    expect(b).toMatch(/border-bottom:\s*1px solid var\(--cx-border\)/)
    expect(b).toMatch(/position:\s*sticky/)
    expect(b).not.toMatch(/backdrop|blur|opacity/)
  })

  it('top bar items: 44px targets, hover --surface, active --primary-tint + --primary-text', () => {
    expect(block('.cx-nav-item {')).toMatch(/min-height:\s*44px/)
    expect(block('.cx-nav-item:hover {')).toMatch(/background:\s*var\(--cx-surface\)/)
    const active = block(".cx-nav-item[aria-current='page'] {")
    expect(active).toMatch(/background:\s*var\(--cx-primary-tint\)/)
    expect(active).toMatch(/color:\s*var\(--cx-primary-text\)/)
  })

  it('account trigger, brand and menu rows are at least 44px', () => {
    for (const sel of ['.cx-brand {', '.cx-account {', '.cx-menu-item {', '.cx-icon-btn {']) {
      expect(block(sel), sel).toMatch(/min-height:\s*44px/)
    }
  })

  it('the account menu is an overlay: --bg, 1px --border, overlay shadow, 24px radius', () => {
    const b = block('.cx-menu {')
    expect(b).toMatch(/background:\s*var\(--cx-bg\)/)
    expect(b).toMatch(/border:\s*1px solid var\(--cx-border\)/)
    expect(b).toMatch(/box-shadow:\s*var\(--cx-shadow-overlay\)/)
    expect(b).toMatch(/border-radius:\s*24px/)
  })

  it('toast: --ink background, --bg text, 16px radius, bottom-centered, above everything', () => {
    const b = block('.cx-toast {')
    expect(b).toMatch(/background:\s*var\(--cx-ink\)/)
    expect(b).toMatch(/color:\s*var\(--cx-bg\)/)
    expect(b).toMatch(/border-radius:\s*16px/)
    expect(block('.cx-toast-region {')).toMatch(/position:\s*fixed/)
    expect(block('.cx-toast-region {')).toMatch(/bottom:\s*88px/)
    expect(block('.cx-toast-close {')).toMatch(/min-height:\s*44px/)
  })

  it('login inputs follow desing.md section 7: 52px, 16px radius, surface fill, 2px transparent border, 2px danger on error', () => {
    const input = block('.cx-input {')
    expect(input).toMatch(/min-height:\s*52px/)
    expect(input).toMatch(/border:\s*2px solid transparent/)
    expect(input).toMatch(/border-radius:\s*16px/)
    expect(input).toMatch(/background:\s*var\(--cx-surface\)/)
    expect(block('.cx-input:focus {')).toMatch(/border-color:\s*var\(--cx-primary-text\)/)
    expect(block(".cx-input[aria-invalid='true'] {")).toMatch(/border-color:\s*var\(--cx-danger\)/)
  })

  it('the consent control keeps a 44px hit area and a visible focus ring on its custom box', () => {
    expect(block('.cx-check {')).toMatch(/min-height:\s*44px/)
    expect(css).toMatch(/\.cx-check-input:focus-visible \+ \.cx-check-box/)
  })

  it('never removes outlines without replacement', () => {
    expect(css).not.toMatch(/outline\s*:\s*(none|0)\b/)
  })

  it('the login page and hero are tonal tiles (no extra shadows)', () => {
    expect(block('.cx-login {')).toMatch(/min-height:\s*100vh/)
    expect(css).toMatch(/\.cx-login-form\b/)
  })
})

describe('shell contrast pairs', () => {
  for (const p of shellPairs()) {
    it(`${p.label} >= ${p.min}`, () => {
      expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min)
    })
  }

  it('documents that primary-text on surface-strong misses 4.5, so hover states on it keep ink text', () => {
    expect(contrast(catalogTheme['primary-text'], catalogTheme['surface-strong'])).toBeLessThan(4.5)
    expect(contrast(catalogTheme.ink, catalogTheme['surface-strong'])).toBeGreaterThanOrEqual(7)
  })
})

