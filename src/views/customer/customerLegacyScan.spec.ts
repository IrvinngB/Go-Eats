import { describe, expect, it } from 'vitest'

// One scan over the SOURCE of every customer-facing file. Merchant, courier, admin and accountant panels keep the
// old look on purpose (their classes stay defined in src/style.css), so they are not in this list.
const sources = {
  ...import.meta.glob('/src/views/customer/*.vue', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('/src/views/LoginView.vue', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('/src/components/{TopBar,PwaStatus,PaymentGatewayModal,AddressPickerMap}.vue', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('/src/components/orders/*.vue', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob('/src/App.vue', { query: '?raw', import: 'default', eager: true }),
} as Record<string, string>

const files = Object.entries(sources)

// Class tokens of every `class="..."` and `:class="..."` attribute.
function classTokens(src: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(/(?<![\w-])(?::class|class)="([^"]*)"/g)) out.push(...m[1].split(/[\s'"`[\]{}(),:?|&!=+]+/).filter(Boolean))
  return out
}
const classAttrs = (src: string) => [...src.matchAll(/(?<![\w-])(?::class|class)="([^"]*)"/g)].map((m) => m[1])

// `modal-panel` is NOT listed: it is only the hook of the modal enter/leave transition in src/style.css (no look).
const LEGACY = new Set(['btn-primary', 'btn-secondary', 'btn-danger-ghost', 'card', 'input', 'label'])

describe('customer-facing scan: the files are really being scanned', () => {
  it('covers every customer view, the shell, the payment modal, the picker and the order components', () => {
    const names = files.map(([p]) => p.replace('/src/', ''))
    for (const n of [
      'views/customer/ProfileView.vue',
      'views/customer/OrdersView.vue',
      'views/customer/StoresView.vue',
      'views/customer/StoreDetailView.vue',
      'views/LoginView.vue',
      'components/TopBar.vue',
      'components/PwaStatus.vue',
      'components/PaymentGatewayModal.vue',
      'components/AddressPickerMap.vue',
      'components/orders/OrderActive.vue',
      'App.vue',
    ]) expect(names, n).toContain(n)
  })
})

describe.each(files)('legacy scan: %s', (_path, src) => {
  it('never combines text-white with a primary fill', () => {
    for (const c of classAttrs(src)) {
      if (/\btext-white\b/.test(c)) expect(c, `class="${c}"`).not.toMatch(/\bbg-(brand|primary|teal|\[#00B19D\])|\bcx-btn\b|\bcx-chip-selected\b/)
    }
    expect(src).not.toMatch(/bg-brand\b[^"']*\btext-white|\btext-white\b[^"']*bg-brand\b/)
  })

  it('uses none of the legacy global classes (.btn-primary, .btn-secondary, .btn-danger-ghost, .card, .input, .label)', () => {
    for (const t of classTokens(src)) expect(LEGACY.has(t), `legacy class "${t}"`).toBe(false)
  })

  it('has no blur, backdrop-filter or gradients', () => {
    expect(src).not.toMatch(/backdrop-|backdrop-filter|bg-gradient|linear-gradient|radial-gradient|conic-gradient|\bblur\b|blur\(/)
  })

  it('draws no inline svg (icons come from @lucide/vue)', () => {
    expect(src).not.toMatch(/<svg\b/)
  })

  it('imports icon packages only from @lucide/vue', () => {
    for (const m of src.matchAll(/from\s*'([^']*(lucide|icons|heroicons|fontawesome|feather|material)[^']*)'/gi)) expect(m[1]).toBe('@lucide/vue')
  })

  it('invents no data: no rating, ETA, phone or vehicle fallbacks', () => {
    expect(src).not.toMatch(/(\|\||\?\?)\s*4\.\d/)
    expect(src).not.toMatch(/\b\d{4}-\d{4}\b/)
    expect(src).not.toMatch(/(placa|plate|vehiculo|vehículo)\s*[:=]\s*['"`]/i)
    expect(src).not.toMatch(/\b\d{1,2}\s*[-–]\s*\d{1,2}\s*min/)
    expect(src).not.toMatch(/Estimado:/)
  })
})

describe('customer-facing honesty: nothing claims live tracking', () => {
  it('no customer file promises live or real-time tracking', () => {
    for (const [p, src] of files) {
      const tpl = src.slice(src.indexOf('<template>'))
      expect(tpl, p).not.toMatch(/seguimiento en mapa en vivo|mapa en vivo|tiempo real|en vivo/i)
    }
  })
})
