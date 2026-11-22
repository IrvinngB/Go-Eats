import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import css from '../../components/catalog/catalog.css?raw'
import view from './ProfileView.vue?raw'
import { contrast } from '../../components/landing/tokens'
import { catalogTheme, profilePairs } from '../../components/catalog/tokens'

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
const put = vi.hoisted(() => vi.fn())
vi.mock('../../services/api', () => ({
  default: { get, post, patch: vi.fn(), put, delete: vi.fn() },
  tokenStorage: { setTokens: vi.fn(), clear: vi.fn(), getAccessToken: vi.fn(), getRefreshToken: vi.fn() },
}))

import ProfileView from './ProfileView.vue'
// @ts-expect-error the store is plain JS without declarations
import { useGoEatsStore } from '../../stores/useGoEatsStore'

const template = (src: string) => src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>') + '</template>'.length)
const tpl = template(view)

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

describe('ProfileView source follows the Friendly Bento rules', () => {
  const classes = [...tpl.matchAll(/(?<![\w-])(?::class|class)="([^"]*)"/g)].map((m) => m[1])

  it('has class lists to scan', () => {
    expect(classes.length).toBeGreaterThan(20)
  })

  it('never puts white text on the primary fill', () => {
    expect(tpl).not.toMatch(/\btext-white\b/)
    expect(tpl).not.toMatch(/bg-brand/)
  })

  it('uses none of the legacy global classes (.btn-primary, .card, .input, .label)', () => {
    for (const c of classes) expect(c, `class="${c}"`).not.toMatch(LEGACY)
  })

  it('has no Tailwind colors, radii, shadows or borders in class lists', () => {
    for (const c of classes) {
      expect(c, `class="${c}"`).not.toMatch(TAILWIND_LOOK)
      expect(c, `class="${c}"`).not.toMatch(TAILWIND_SHAPE)
    }
  })

  it('has no blur, backdrop-filter, translucency, gradients, inline svg or hex colors', () => {
    expect(view).not.toMatch(/backdrop-|bg-white\/|bg-gradient|linear-gradient|radial-gradient|\bblur\b|blur\(/)
    expect(tpl).not.toMatch(/<svg/)
    expect(view).not.toMatch(/#[0-9A-Fa-f]{6}\b/)
  })

  it('imports icons only from @lucide/vue and brings the scoped .cx system with its fonts', () => {
    for (const m of view.matchAll(/from\s*'([^']*(lucide|icons|heroicons|fontawesome)[^']*)'/gi)) expect(m[1]).toBe('@lucide/vue')
    expect(view).toMatch(/catalog\/catalog\.css/)
    expect(view).toMatch(/@fontsource\/nunito\/latin-800\.css/)
    expect(tpl).toMatch(/class="cx"/)
  })

  it('keeps the address picker lazy-loaded', () => {
    expect(view).toMatch(/defineAsyncComponent\(\(\) => import\('\.\.\/\.\.\/components\/AddressPickerMap\.vue'\)\)/)
  })
})

// ---- behavior of the rendered component ----

function http(status: number, data?: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), { isAxiosError: true, response: { status, data } })
}
const row = (id: number, type: string, status = 'pendiente', response: string | null = null) => ({
  id, user_id: 1, user_name: 'Ana', request_type: type, detail: `detalle ${id}`, status,
  admin_response: response, created_at: '2026-01-01T10:00:00Z', resolved_at: null,
})
function serve(consent: boolean | 'fail', arco: unknown[] = []) {
  get.mockImplementation(async (url: string) => {
    if (url === '/users/me/consent') {
      if (consent === 'fail') throw http(500)
      return { data: { accepted: consent, policy_version: 'v1', accepted_at: '2026-01-01T10:00:00Z' } }
    }
    if (url === '/users/me/arco') return { data: arco }
    throw new Error(`unexpected ${url}`)
  })
}
async function setup(usuario: Record<string, unknown> = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useGoEatsStore()
  store.autenticado = true
  store.rol = 'customer'
  store.usuario = { nombre: 'Ana', email: 'ana@t.pa', telefono: '600', consentimientoLey81: null, ...usuario }
  const w = mount(ProfileView, { attachTo: document.body, global: { plugins: [pinia], stubs: { RouterLink: true } } })
  await flushPromises()
  return { w, store }
}
beforeEach(() => {
  for (const m of [get, post, put]) m.mockReset()
  document.body.innerHTML = ''
})

describe('ProfileView structure and accessibility', () => {
  it('has one h1, a heading per section and Nunito classes only (no Tailwind type)', async () => {
    serve(true)
    const { w } = await setup()
    expect(w.findAll('h1').map((h) => h.text())).toEqual(['Mi perfil'])
    expect(w.findAll('h2').map((h) => h.text())).toEqual([
      'Datos personales',
      'Dirección de entrega predeterminada',
      'Protección de datos — Ley 81 de 2019',
      'Solicitudes ARCO',
    ])
    expect(w.find('.cx').exists()).toBe(true)
  })

  it('every field has a visible label tied by for/id, and placeholders are examples, never labels', async () => {
    serve(true)
    const { w } = await setup()
    for (const input of w.findAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], input[type="tel"], input[type="email"], textarea')) {
      const id = input.attributes('id')
      if (input.attributes('data-test') === 'lat-input' || input.attributes('data-test') === 'lng-input') continue // the picker brings its own labels
      expect(id, input.html()).toBeTruthy()
      const label = w.find(`label[for="${id}"]`)
      expect(label.exists(), `label for ${id}`).toBe(true)
      expect(label.text().length).toBeGreaterThan(2)
      const ph = input.attributes('placeholder') ?? ''
      expect(ph.toLowerCase(), `placeholder "${ph}" must not repeat its label`).not.toBe(label.text().toLowerCase())
    }
  })

  it('the email is read-only and says why (the server only accepts name, phone and address)', async () => {
    serve(true)
    const { w } = await setup()
    const email = w.find<HTMLInputElement>('[data-test="email-input"]')
    expect(email.element.value).toBe('ana@t.pa')
    expect(email.attributes('readonly')).toBeDefined()
    expect(email.attributes('aria-describedby')).toBeTruthy()
    expect(w.find(`#${email.attributes('aria-describedby')}`).text()).toContain('no se puede cambiar')
  })

  it('personal data save sends only name and phone (never the email) and stays the ONE primary button of the view', async () => {
    serve(true)
    put.mockResolvedValue({ data: {} })
    const { w } = await setup()
    await w.find('[data-test="name-input"]').setValue('Ana María')
    await w.find('[data-test="phone-input"]').setValue('6111-2222')
    await w.find('[data-test="profile-save"]').trigger('click')
    await flushPromises()
    expect(put).toHaveBeenCalledWith('/users/me', { full_name: 'Ana María', phone: '6111-2222' })
    const primaries = w.findAll('button.cx-btn:not(.cx-btn-secondary):not(.cx-btn-ghost)')
    expect(primaries.map((b) => b.attributes('data-test'))).toEqual(['profile-save'])
  })

  it('a name shorter than 2 characters shows icon + message + aria-describedby and does not call the API', async () => {
    serve(true)
    const { w } = await setup()
    await w.find('[data-test="name-input"]').setValue('A')
    await w.find('[data-test="profile-save"]').trigger('click')
    await flushPromises()
    expect(put).not.toHaveBeenCalled()
    const input = w.find('[data-test="name-input"]')
    const err = w.find('[data-test="name-error"]')
    expect(err.text()).toBe('Escribe tu nombre completo (mínimo 2 caracteres).')
    expect(err.find('svg').exists()).toBe(true)
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain(err.attributes('id'))
    await input.setValue('Ana')
    expect(w.find('[data-test="name-error"]').exists()).toBe(false)
  })

  it('the address error is icon + text, wired with aria-describedby on the input', async () => {
    serve(true)
    const { w } = await setup()
    await vi.waitFor(() => expect(w.find('[data-test="lat-input"]').exists()).toBe(true))
    await w.find('[data-test="address-input"]').setValue('abc')
    await w.find('[data-test="address-save"]').trigger('click')
    await flushPromises()
    const err = w.find('[data-test="address-error"]')
    expect(err.find('svg').exists()).toBe(true)
    expect(err.attributes('role')).toBe('alert')
    expect(w.find('[data-test="address-input"]').attributes('aria-describedby')).toContain(err.attributes('id'))
    expect(w.find('[data-test="address-save"]').classes()).toContain('cx-btn-secondary')
  })

  it('the consent toggle is a real switch: native checkbox role=switch with a name, a description and its state written out', async () => {
    serve(true)
    const { w } = await setup()
    const sw = w.find<HTMLInputElement>('[data-test="consent-toggle"]')
    expect(sw.element.tagName).toBe('INPUT')
    expect(sw.attributes('type')).toBe('checkbox')
    expect(sw.attributes('role')).toBe('switch')
    expect(w.find(`#${sw.attributes('aria-labelledby')}`).text()).toBe('Consentimiento informado')
    expect(w.find(`#${sw.attributes('aria-describedby')}`).text()).toContain('Comercios Unidos del Istmo')
    expect(sw.element.checked).toBe(true)
    expect(w.find('[data-test="consent-state"]').text()).toBe('Activo')
  })

  it('the consent state word follows the server: Revocado when off, Sin cargar when the read failed', async () => {
    serve(false)
    const { w } = await setup()
    expect(w.find('[data-test="consent-state"]').text()).toBe('Revocado')
    serve('fail')
    const { w: w3 } = await setup()
    expect(w3.find('[data-test="consent-state"]').text()).toBe('Sin cargar')
  })

  it('the revoked notice and the load error are persistent alerts with an icon and text', async () => {
    serve(false)
    const { w } = await setup()
    const note = w.find('[data-test="consent-revoked"]')
    expect(note.classes()).toContain('cx-alert')
    expect(note.find('svg').exists()).toBe(true)
    expect(note.text()).toContain('tus datos se conservan')
    serve('fail')
    const { w: w2 } = await setup()
    const fail = w2.find('[data-test="consent-load-error"]')
    expect(fail.classes()).toEqual(expect.arrayContaining(['cx-alert', 'cx-alert-danger']))
    expect(fail.attributes('role')).toBe('alert')
    expect(fail.find('svg').exists()).toBe(true)
  })

  it('ARCO types are four real radios of one named group inside a labelled radiogroup (arrow keys come with it)', async () => {
    serve(true)
    const { w } = await setup()
    const group = w.find('[role="radiogroup"]')
    expect(group.exists()).toBe(true)
    expect(group.attributes('aria-labelledby') || group.find('legend').exists()).toBeTruthy()
    const radios = w.findAll<HTMLInputElement>('input[type="radio"][data-test="arco-type"]')
    expect(radios.map((r) => r.attributes('data-type'))).toEqual(['Acceso', 'Rectificación', 'Cancelación', 'Oposición'])
    expect(new Set(radios.map((r) => r.attributes('name'))).size).toBe(1)
    expect(radios.map((r) => r.element.checked)).toEqual([true, false, false, false])
    await radios[2].setValue(true)
    expect(radios.map((r) => r.element.checked)).toEqual([false, false, true, false])
    expect(w.findAll('.cx-option-selected')).toHaveLength(1)
  })

  it('the ARCO detail is a labelled textarea; a short one gives icon + message below and aria-describedby', async () => {
    serve(true)
    const { w } = await setup()
    const ta = w.find('textarea')
    expect(w.find(`label[for="${ta.attributes('id')}"]`).text()).toBe('Cuéntanos qué necesitas')
    expect(ta.attributes('placeholder')).toMatch(/^Ejemplo:/)
    await ta.setValue('abc')
    await w.find('[data-test="arco-submit"]').trigger('click')
    await flushPromises()
    const err = w.find('[data-test="arco-error"]')
    expect(err.text()).toBe('Describe tu solicitud con al menos 5 caracteres para continuar.')
    expect(err.find('svg').exists()).toBe(true)
    expect(w.find('textarea').attributes('aria-invalid')).toBe('true')
    expect(w.find('textarea').attributes('aria-describedby')).toContain(err.attributes('id'))
    await w.find('textarea').setValue('abcde')
    expect(w.find('[data-test="arco-error"]').exists()).toBe(false)
  })

  it('a sent request announces itself in a polite status region and clears the text', async () => {
    serve(true)
    post.mockResolvedValue({ data: row(5, 'Acceso') })
    const { w } = await setup()
    expect(w.find('[data-test="arco-sent-region"]').attributes('role')).toBe('status')
    await w.find('textarea').setValue('Quiero conocer mis datos')
    await w.find('[data-test="arco-submit"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="arco-sent"]').text()).toContain('Tu solicitud fue enviada')
    expect(w.find('[data-test="arco-sent"]').find('svg').exists()).toBe(true)
    expect(w.find<HTMLTextAreaElement>('textarea').element.value).toBe('')
  })

  it('history rows carry a status chip with icon + text per state and the admin response', async () => {
    serve(true, [row(3, 'Oposición', 'respondida', 'Ya está resuelto'), row(1, 'Acceso'), row(2, 'Cancelación', 'otro')])
    const { w } = await setup()
    const items = w.findAll('[data-test="arco-item"]')
    const chip = (i: number) => items[i].find('.cx-estado')
    expect(chip(0).text()).toBe('Respondida')
    expect(chip(0).classes()).toContain('cx-estado-success')
    expect(chip(1).text()).toBe('Pendiente')
    expect(chip(1).classes()).toContain('cx-estado-warning')
    expect(chip(2).text()).toBe('otro')
    expect(chip(2).classes()).toContain('cx-estado-neutral')
    for (let i = 0; i < 3; i++) expect(chip(i).find('svg').exists(), `chip ${i} icon`).toBe(true)
    expect(items[0].find('[data-test="arco-reply"]').text()).toContain('Ya está resuelto')
    expect(items[1].find('[data-test="arco-reply"]').exists()).toBe(false)
  })

  it('an empty history shows a calm empty state instead of nothing', async () => {
    serve(true, [])
    const { w } = await setup()
    expect(w.findAll('[data-test="arco-item"]')).toHaveLength(0)
    const empty = w.find('[data-test="arco-empty"]')
    expect(empty.text()).toContain('Aún no has enviado solicitudes')
    expect(empty.find('svg').exists()).toBe(true)
  })

  it('with a history the empty state is gone', async () => {
    serve(true, [row(1, 'Acceso')])
    const { w } = await setup()
    expect(w.find('[data-test="arco-empty"]').exists()).toBe(false)
  })

  it('the address section still mounts the lazy picker with the saved point', async () => {
    serve(true)
    const { w } = await setup({ direccion: 'Calle 50', lat: 8.9824, lng: -79.5199 })
    await vi.waitFor(() => expect(w.find<HTMLInputElement>('[data-test="lat-input"]').exists()).toBe(true))
    expect(w.find<HTMLInputElement>('[data-test="lat-input"]').element.value).toBe('8.9824')
  })

  it('while the write is in flight the switch stays enabled (a disabled input drops keyboard focus), is aria-busy and ignores a second toggle', async () => {
    serve(true)
    let release: (v: unknown) => void = () => undefined
    put.mockReturnValue(new Promise((r) => (release = r)))
    const { w } = await setup()
    const sw = w.find<HTMLInputElement>('[data-test="consent-toggle"]')
    await sw.setValue(false)
    expect(sw.attributes('disabled')).toBeUndefined()
    expect(sw.attributes('aria-busy')).toBe('true')
    await sw.setValue(true) // a second flip while saving
    expect(put).toHaveBeenCalledTimes(1)
    expect(sw.element.checked).toBe(false) // the second flip is undone: it mirrors the store's pending value
    release({ data: { accepted: false, policy_version: 'v1', accepted_at: '2026-01-02T10:00:00Z' } })
    await flushPromises()
    expect(sw.attributes('aria-busy')).toBeUndefined()
    expect(sw.element.checked).toBe(false)
  })

  it('failing consent write rolls the switch back and puts the persistent error toast in the store', async () => {
    serve(true)
    put.mockRejectedValue(http(500))
    const { w, store } = await setup()
    await w.find('[data-test="consent-toggle"]').setValue(false)
    await flushPromises()
    expect(w.find<HTMLInputElement>('[data-test="consent-toggle"]').element.checked).toBe(true)
    expect(w.find('[data-test="consent-state"]').text()).toBe('Activo')
    expect(store.notificacion.tipo).toBe('error')
  })
})

describe('profile css', () => {
  it('switch is a pill: 52x32 track, 24px knob, 44px minimum target, input stretched over the whole row', () => {
    const track = block('.cx-switch-track {')
    expect(track).toMatch(/width:\s*52px/)
    expect(track).toMatch(/height:\s*32px/)
    expect(track).toMatch(/border-radius:\s*999px/)
    const knob = block('.cx-switch-knob {')
    expect(knob).toMatch(/width:\s*24px/)
    expect(knob).toMatch(/height:\s*24px/)
    expect(knob).toMatch(/border-radius:\s*999px/)
    expect(block('.cx-switch-row {')).toMatch(/min-height:\s*(44|56|64)px/)
    const input = block('.cx-switch-input {')
    expect(input).toMatch(/inset:\s*0/)
    expect(input).toMatch(/opacity:\s*0/)
  })

  it('checked = --primary track with a dark knob and a visible edge; focus draws the 2px --primary-text ring', () => {
    const on = block('.cx-switch-input:checked ~ .cx-switch-side .cx-switch-track {')
    expect(on).toMatch(/background:\s*var\(--cx-primary\)/)
    expect(on).toMatch(/border-color:\s*var\(--cx-primary-text\)/)
    expect(block('.cx-switch-input:checked ~ .cx-switch-side .cx-switch-knob {')).toMatch(/background:\s*var\(--cx-ink\)/)
    const focus = block('.cx-switch-row:has(.cx-switch-input:focus-visible) {')
    expect(focus).toMatch(/outline:\s*2px solid var\(--cx-primary-text\)/)
  })

  it('profile inputs are white on the surface tile (so they read as fields), read-only ones surface-strong', () => {
    expect(block('.cx-profile-tile .cx-input {')).toMatch(/background:\s*var\(--cx-bg\)/)
    expect(block('.cx-profile-tile .cx-input[readonly] {')).toMatch(/background:\s*var\(--cx-surface-strong\)/)
  })

  it('profile tiles are flat 24px --surface tiles; the page is one column on phones and two from 1024px', () => {
    const tile = block('.cx-profile-tile {')
    expect(tile).toMatch(/border-radius:\s*24px/)
    expect(tile).not.toMatch(/box-shadow|border:/)
    expect(css).toMatch(/@media \(min-width: 1024px\)\s*\{\s*\.cx-profile\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/)
  })

  it('history rows are 16px --bg tiles with a 4px accent-free reply block (no side stripes, no shadow)', () => {
    const item = block('.cx-arco-item {')
    expect(item).toMatch(/border-radius:\s*16px/)
    expect(item).toMatch(/background:\s*var\(--cx-bg\)/)
    expect(item).not.toMatch(/box-shadow|border-left/)
    expect(block('.cx-arco-reply {')).toMatch(/background:\s*var\(--cx-primary-tint\)/)
  })

  it('the success alert is a success tint with a 4px side bar', () => {
    expect(block('.cx-alert-success {')).toMatch(/background:\s*var\(--cx-success-tint\)/)
    expect(block('.cx-alert-success::before {')).toMatch(/background:\s*var\(--cx-success\)/)
  })

  it('adds no shadow, blur or gradient of its own', () => {
    const start = css.indexOf('/* ================= Profile')
    expect(start).toBeGreaterThan(0)
    expect(css.slice(start)).not.toMatch(/box-shadow|backdrop|blur|gradient/)
  })
})

describe('profile contrast', () => {
  for (const p of profilePairs()) {
    it(`${p.label} >= ${p.min}`, () => {
      expect(contrast(p.fg, p.bg)).toBeGreaterThanOrEqual(p.min)
    })
  }
  it('catalogTheme carries every token the profile pairs read', () => {
    for (const p of profilePairs()) expect(p.fg && p.bg, p.label).toBeTruthy()
    expect(catalogTheme['ink']).toBeTruthy()
  })
})
