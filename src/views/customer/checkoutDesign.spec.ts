import { describe, expect, it } from 'vitest'
import css from '../../components/catalog/catalog.css?raw'
import detail from './StoreDetailView.vue?raw'
import stores from './StoresView.vue?raw'
import modal from '../../components/PaymentGatewayModal.vue?raw'
import picker from '../../components/AddressPickerMap.vue?raw'
import { contrast } from '../../components/landing/tokens'
import { catalogTheme, checkoutPairs } from '../../components/catalog/tokens'

const template = (src: string) => src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>') + '</template>'.length)
const script = (src: string) => src.slice(0, src.indexOf('<template>'))

const sources = {
  StoreDetailView: detail,
  StoresView: stores,
  PaymentGatewayModal: modal,
  AddressPickerMap: picker,
}

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

// Tailwind color/shape utilities and the app's legacy global classes must not come back in restyled sources.
const LEGACY = /(^|[\s"'`])(btn-primary|btn-secondary|btn-danger-ghost|card|input|label|modal-panel-legacy)(?=[\s"'`])/
const TAILWIND_LOOK = /\b(bg|text|border|ring|from|to|via|divide|accent|placeholder)-(ink|brand|canvas|line|slatebody|coral|red|emerald|amber|sky|slate|gray|white|black|\[#)/
const TAILWIND_SHAPE = /(^|[\s"'`])(rounded|shadow|border|ring)(-[\w[\]./]+)?(?=[\s"'`])/

describe('restyled sources follow the Friendly Bento rules', () => {
  for (const [name, src] of Object.entries(sources)) {
    const tpl = template(src)
    describe(name, () => {
      it('never puts white text on the primary fill', () => {
        expect(tpl).not.toMatch(/\btext-white\b/)
        expect(tpl).not.toMatch(/bg-brand/)
      })

      it('uses none of the legacy global classes (.btn-primary, .card, .input, .label)', () => {
        const classes = [...tpl.matchAll(/class="([^"]*)"/g)].map((m) => m[1])
        for (const c of classes) expect(c, `class="${c}"`).not.toMatch(LEGACY)
      })

      it('has no Tailwind colors, radii, shadows or borders in class lists', () => {
        const classes = [...tpl.matchAll(/class="([^"]*)"/g)].map((m) => m[1])
        for (const c of classes) {
          expect(c, `class="${c}"`).not.toMatch(TAILWIND_LOOK)
          expect(c, `class="${c}"`).not.toMatch(TAILWIND_SHAPE)
        }
      })

      it('has no blur, backdrop-filter, translucency or gradients (template or script)', () => {
        expect(src).not.toMatch(/backdrop-|backdrop-filter|bg-white\/|bg-gradient|linear-gradient|radial-gradient|\bblur\b|blur\(/)
        expect(tpl).not.toMatch(/bg-ink\/\d+/)
      })

      it('uses only Lucide stroke icons (no inline svg)', () => {
        expect(tpl).not.toMatch(/<svg/)
      })

      it('has no hard-coded hex colors (tokens only)', () => {
        expect(src).not.toMatch(/#[0-9A-Fa-f]{6}\b/)
      })
    })
  }

  it('the dialogs and the picker bring their own .cx scope', () => {
    expect(template(modal)).toMatch(/class="cx cx-overlay/)
    expect(template(picker)).toMatch(/class="cx cx-embed/)
    expect(template(detail)).toMatch(/class="cx cx-overlay cx-overlay-side"/)
  })

  it('the scoped h1..h4 rule that protects every dialog heading is still there', () => {
    expect(css).toMatch(/\.cx :is\(h1, h2, h3, h4\)\s*\{/)
    // headings of the dialogs live inside the .cx overlay roots checked above, so the rule reaches them
    expect(template(modal)).not.toMatch(/<h[1-4][^>]*class="(?![^"]*cx-h)/)
  })

  it('the modal script does not depend on blur either', () => {
    expect(script(modal)).not.toMatch(/blur|backdrop/)
  })
})

describe('checkout css', () => {
  it('bottom sheet: top radius 32, 1px border, overlay shadow, max 90vh, grab handle 4x36 in --border', () => {
    const b = block('.cx-sheet {')
    expect(b).toMatch(/border-radius:\s*32px 32px 0 0/)
    expect(b).toMatch(/border:\s*1px solid var\(--cx-border\)/)
    expect(b).toMatch(/box-shadow:\s*var\(--cx-shadow-overlay\)/)
    expect(b).toMatch(/max-height:\s*90vh/)
    const h = block('.cx-sheet::before {')
    expect(h).toMatch(/width:\s*36px/)
    expect(h).toMatch(/height:\s*4px/)
    expect(h).toMatch(/background:\s*var\(--cx-border\)/)
  })

  it('scrim is flat: a token fill, no blur', () => {
    expect(block('.cx.cx-overlay {')).toMatch(/background:\s*var\(--cx-scrim\)/)
    expect(block('.cx {')).toMatch(/--cx-scrim:\s*rgba\(/)
    expect(block('.cx.cx-overlay {')).not.toMatch(/backdrop|blur/)
  })

  it('modal: radius 24 and 480px from the tablet breakpoint', () => {
    expect(css).toMatch(/\.cx-modal\s*\{[^}]*width:\s*480px[^}]*border-radius:\s*24px/s)
  })

  it('sticky bar: total left, big primary right, solid --bg with a 1px top border', () => {
    const b = block('.cx-sheet-bar {')
    expect(b).toMatch(/justify-content:\s*space-between/)
    expect(b).toMatch(/border-top:\s*1px solid var\(--cx-border\)/)
    expect(b).toMatch(/background:\s*var\(--cx-bg\)/)
  })

  it('quantity steppers, close and icon buttons are 44px targets', () => {
    expect(block('.cx-qty button {')).toMatch(/width:\s*44px;[\s\S]*height:\s*44px/)
    expect(block('.cx-icon-btn {')).toMatch(/min-height:\s*44px/)
    expect(block('.cx-option {')).toMatch(/min-height:\s*64px/)
    expect(block('.cx-mapbox .leaflet-bar a {')).toMatch(/width:\s*44px;[\s\S]*height:\s*44px/)
  })

  it('summary rows keep tabular figures right aligned', () => {
    const b = block('.cx-summary dd {')
    expect(b).toMatch(/font-variant-numeric:\s*tabular-nums/)
    expect(b).toMatch(/text-align:\s*right/)
  })

  it('selected payment option is a tonal tile with a 2px primary-text border (not color alone: the dot has a check)', () => {
    const b = block('.cx-option-selected,')
    expect(b).toMatch(/border-color:\s*var\(--cx-primary-text\)/)
    expect(b).toMatch(/background:\s*var\(--cx-primary-tint\)/)
    expect(block('.cx-option {')).toMatch(/border:\s*2px solid transparent/)
  })

  it('field errors use the danger text token with an icon slot; invalid fields get the 2px danger border', () => {
    expect(block('.cx-field-error {')).toMatch(/color:\s*var\(--cx-danger-text\)/)
    expect(block(".cx-input[aria-invalid='true'] {")).toMatch(/border-color:\s*var\(--cx-danger\)/)
  })

  it('persistent alerts keep a 4px side bar; the danger variant uses the danger tint', () => {
    expect(block('.cx-alert::before {')).toMatch(/width:\s*4px/)
    expect(block('.cx-alert-danger {')).toMatch(/background:\s*var\(--cx-danger-tint\)/)
  })

  it('an open dialog lifts the toast above the sticky bar', () => {
    expect(block('body.cx-dialog-open .cx-toast-region {')).toMatch(/bottom:\s*1[0-9]{2}px/)
  })

  it('"Ver más" row centers one 44px secondary button', () => {
    expect(block('.cx-more {')).toMatch(/justify-content:\s*center/)
  })
})

describe('checkout contrast pairs', () => {
  for (const p of checkoutPairs()) {
    it(`${p.label} >= ${p.min}`, () => {
      expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min)
    })
  }

  it('the scrim never carries text, so it is not a contrast pair (flat rgba token)', () => {
    expect(catalogTheme['scrim']).toBeUndefined()
  })
})
