import { describe, expect, it } from 'vitest'
import css from '../../components/catalog/catalog.css?raw'
import view from './OrdersView.vue?raw'
import active from '../../components/orders/OrderActive.vue?raw'
import timeline from '../../components/orders/OrderTimeline.vue?raw'
import progress from '../../components/orders/OrderProgress.vue?raw'
import stars from '../../components/orders/RatingStars.vue?raw'
import chip from '../../components/orders/StatusChip.vue?raw'
import { contrast } from '../../components/landing/tokens'
import { catalogTheme, ordersPairs } from '../../components/catalog/tokens'
import { TONOS } from '../../utils/orderStatus'

const template = (src: string) => src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>') + '</template>'.length)

const sources = {
  OrdersView: view,
  OrderActive: active,
  OrderTimeline: timeline,
  OrderProgress: progress,
  RatingStars: stars,
  StatusChip: chip,
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

const LEGACY = /(^|[\s"'`])(btn-primary|btn-secondary|btn-danger-ghost|card|input|label|modal-panel)(?=[\s"'`])/
const TAILWIND_LOOK = /\b(bg|text|border|ring|from|to|via|divide|accent|placeholder)-(ink|brand|canvas|line|slatebody|coral|red|emerald|amber|sky|slate|gray|white|black|blue|\[#)/
const TAILWIND_SHAPE = /(^|[\s"'`])(rounded|shadow|border|ring)(-[\w[\]./]+)?(?=[\s"'`])/

describe('restyled order sources follow the Friendly Bento rules', () => {
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

      it('has no blur, backdrop-filter, translucency or gradients', () => {
        expect(src).not.toMatch(/backdrop-|backdrop-filter|bg-white\/|bg-gradient|linear-gradient|radial-gradient|\bblur\b|blur\(/)
        expect(tpl).not.toMatch(/bg-ink\/\d+/)
      })

      it('uses only Lucide stroke icons (no inline svg)', () => {
        expect(tpl).not.toMatch(/<svg/)
      })

      it('has no hard-coded hex colors (tokens only)', () => {
        expect(src).not.toMatch(/#[0-9A-Fa-f]{6}\b/)
      })

      it('invents no data: no rating, ETA or phone fallbacks', () => {
        expect(src).not.toMatch(/(\|\||\?\?)\s*4\.\d/) // `rating || 4.9`
        expect(src).not.toMatch(/\b\d{4}-\d{4}\b/) // a hard-coded phone
        expect(src).not.toMatch(/(placa|plate|vehiculo|vehículo)\s*[:=]\s*['"`]/i) // a hard-coded vehicle or plate
        expect(src).not.toMatch(/\b\d{1,2}\s*[-–]\s*\d{1,2}\s*min/) // a hard-coded ETA range
      })
    })
  }

  it('imports Lucide only from @lucide/vue', () => {
    for (const [name, src] of Object.entries(sources)) {
      const icons = [...src.matchAll(/import\s*\{[^}]*\}\s*from\s*'([^']*(lucide|icons|heroicons|fontawesome)[^']*)'/gi)].map((m) => m[1])
      for (const from of icons) expect(from, name).toBe('@lucide/vue')
    }
  })

  it('the view brings the scoped .cx system and its fonts', () => {
    expect(view).toMatch(/catalog\/catalog\.css/)
    expect(template(view)).toMatch(/class="cx"/)
    expect(template(view)).toMatch(/class="cx cx-overlay/)
    expect(view).toMatch(/useDialogo/)
  })

  it('the scoped h1..h4 rule that protects every heading is still there', () => {
    expect(css).toMatch(/\.cx :is\(h1, h2, h3, h4\)\s*\{/)
  })
})

describe('orders css', () => {
  it('the active-order tile is the only rule that uses the active shadow, on --bg with a 24px radius', () => {
    expect(css.match(/var\(--cx-shadow-active\)/g)).toHaveLength(1)
    const b = block('.cx-active {')
    expect(b).toMatch(/box-shadow:\s*var\(--cx-shadow-active\)/)
    expect(b).toMatch(/background:\s*var\(--cx-bg\)/)
    expect(b).toMatch(/border-radius:\s*24px/)
  })

  it('no other order rule declares a shadow except the button lip and overlays', () => {
    const shadows = [...css.matchAll(/box-shadow\s*:\s*([^;]+);/g)].map((m) => m[1].trim())
    for (const s of shadows) expect(s, s).toMatch(/^(none|var\(--cx-shadow-(active|overlay)\)|0 [24]px 0 var\(--cx-primary-lip\)|var\(--cx-primary-lip\) [\w\s.-]+)$/)
  })

  it('timeline: 24px circles joined by a 2px --border line; done primary, current primary-tint with a primary ring, pending surface-strong', () => {
    const dot = block('.cx-step-dot {')
    expect(dot).toMatch(/width:\s*24px/)
    expect(dot).toMatch(/height:\s*24px/)
    expect(dot).toMatch(/border-radius:\s*999px/)
    expect(block(".cx-step[data-state='done'] .cx-step-dot {")).toMatch(/background:\s*var\(--cx-primary\)/)
    const cur = block(".cx-step[data-state='current'] .cx-step-dot {")
    expect(cur).toMatch(/background:\s*var\(--cx-primary-tint\)/)
    expect(cur).toMatch(/var\(--cx-primary-text\)/)
    expect(block(".cx-step[data-state='pending'] .cx-step-dot {")).toMatch(/background:\s*var\(--cx-surface-strong\)/)
    expect(block('.cx-step::before {')).toMatch(/width:\s*2px/)
    expect(block('.cx-step::before {')).toMatch(/background:\s*var\(--cx-border\)/)
  })

  it('timeline step title is 14px 600 and the time a 12px caption; pending text is --ink-faint', () => {
    expect(block('.cx-step-title {')).toMatch(/font-size:\s*0\.875rem[\s\S]*font-weight:\s*600/)
    expect(block('.cx-step-time {')).toMatch(/font-size:\s*0\.75rem/)
    expect(block(".cx-step[data-state='pending'] .cx-step-title {")).toMatch(/color:\s*var\(--cx-ink-faint\)/)
  })

  it('progress bar: 8px pill, surface-strong track, primary fill, dots in the track', () => {
    const track = block('.cx-progress-track {')
    expect(track).toMatch(/height:\s*8px/)
    expect(track).toMatch(/border-radius:\s*999px/)
    expect(track).toMatch(/background:\s*var\(--cx-surface-strong\)/)
    expect(block('.cx-progress-fill {')).toMatch(/background:\s*var\(--cx-primary\)/)
    expect(block('.cx-progress-fill {')).toMatch(/transition:[^;]*400ms ease-in-out/)
    expect(block('.cx-progress-dot {')).toMatch(/border-radius:\s*999px/)
  })

  it('ETA figures use tabular numbers and the .cx-eta display type', () => {
    expect(block('.cx-eta {')).toMatch(/font-variant-numeric:\s*tabular-nums/)
    expect(block('.cx-track-eta .cx-eta-unit {')).toMatch(/font-variant-numeric:\s*tabular-nums/)
  })

  it('courier tile: 48px avatar, 48px circular call button on --primary-tint, mono vehicle line', () => {
    const av = block('.cx-courier-avatar {')
    expect(av).toMatch(/width:\s*48px/)
    expect(av).toMatch(/height:\s*48px/)
    const call = block('.cx-round-btn {')
    expect(call).toMatch(/width:\s*48px/)
    expect(call).toMatch(/height:\s*48px/)
    expect(call).toMatch(/border-radius:\s*999px/)
    expect(call).toMatch(/background:\s*var\(--cx-primary-tint\)/)
  })

  it('rating stars are 44px targets with at least 8px between them', () => {
    const star = block('.cx-star {')
    expect(star).toMatch(/min-width:\s*44px/)
    expect(star).toMatch(/min-height:\s*44px/)
    expect(block('.cx-stars {')).toMatch(/gap:\s*8px/)
  })

  it('map tile clips the map at 16px inside a 24px tile and drops the legacy border and shadow of the map root', () => {
    expect(block('.cx-trackmap {')).toMatch(/border-radius:\s*16px/)
    const inner = block('.cx-trackmap > div {')
    expect(inner).toMatch(/border:\s*0/)
    expect(inner).toMatch(/box-shadow:\s*none/)
  })

  it('terminal banner is a danger alert (tint, 4px side bar) and the delivered tile a success tint', () => {
    expect(block('.cx-alert-danger {')).toMatch(/background:\s*var\(--cx-danger-tint\)/)
    expect(block('.cx-alert::before {')).toMatch(/width:\s*4px/)
    expect(block('.cx-delivered-icon {')).toMatch(/background:\s*var\(--cx-success-tint\)/)
  })

  it('status chips: one class per tone, always a pill with icon room', () => {
    expect(block('.cx-estado {')).toMatch(/border-radius:\s*999px/)
    for (const t of TONOS) expect(css, t).toContain(`.cx-estado-${t} {`)
  })
})

describe('orders contrast', () => {
  for (const p of ordersPairs()) {
    it(`${p.label} >= ${p.min}`, () => {
      expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min)
    })
  }

  // Read the real pairs out of the stylesheet: a chip tone cannot drift below AA unnoticed.
  for (const tone of TONOS) {
    it(`chip tone ${tone}: text >= 4.5 and icon >= 3 on its own background (from catalog.css)`, () => {
      const b = block(`.cx-estado-${tone} {`)
      const bg = b.match(/background:\s*var\(--cx-([\w-]+)\)/)?.[1]
      const fg = b.match(/(?<![-\w])color:\s*var\(--cx-([\w-]+)\)/)?.[1]
      expect(bg, 'background token').toBeTruthy()
      expect(fg, 'color token').toBeTruthy()
      expect(contrast(catalogTheme[fg!], catalogTheme[bg!])).toBeGreaterThanOrEqual(4.5)
      const icon = css.match(new RegExp(`\\.cx-estado-${tone} svg \\{[^}]*color:\\s*var\\(--cx-([\\w-]+)\\)`))?.[1]
      expect(icon, 'icon token').toBeTruthy()
      expect(contrast(catalogTheme[icon!], catalogTheme[bg!])).toBeGreaterThanOrEqual(3)
    })
  }
})
