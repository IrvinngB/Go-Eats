import { test, expect, type Browser, type Locator, type Page } from '@playwright/test'

// Real browser against the production build (service worker blocked). The API is mocked with page.route.
const INK = 'rgb(11, 43, 51)'
const BG = 'rgb(255, 255, 255)'
const SURFACE = 'rgb(242, 247, 247)'
const SURFACE_STRONG = 'rgb(227, 238, 238)'
const PRIMARY = 'rgb(0, 177, 157)'
const PRIMARY_TINT = 'rgb(214, 245, 240)'
const PRIMARY_TEXT = 'rgb(0, 121, 107)'
const DANGER = 'rgb(220, 38, 38)'
const DANGER_TEXT = 'rgb(185, 28, 28)'
const LIP = 'rgb(0, 143, 125) 0px 4px 0px 0px'
const MOBILE = { width: 360, height: 800 }
const DESKTOP = { width: 1440, height: 900 }

const TILE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

type Arco = { id: number; user_id: number; user_name: string; request_type: string; detail: string; status: string; admin_response: string | null; created_at: string; resolved_at: string | null }

const arcoRow = (id: number, type: string, status = 'pendiente', response: string | null = null): Arco => ({
  id, user_id: 1, user_name: 'Carlos Andrade', request_type: type, detail: `Detalle de la solicitud ${id}`, status,
  admin_response: response, created_at: '2026-11-19T10:00:00Z', resolved_at: response ? '2026-11-20T10:00:00Z' : null,
})

interface Mock {
  user: Record<string, unknown>
  consent: { accepted: boolean }
  arco: Arco[]
  puts: Array<Record<string, unknown>>
  consentPuts: boolean[]
  arcoPosts: Array<Record<string, unknown>>
  failConsent: boolean
}

async function mockApi(page: Page, init: { arco?: Arco[]; consent?: boolean; address?: boolean } = {}): Promise<Mock> {
  const m: Mock = {
    user: { id: 1, full_name: 'Carlos Andrade', email: 'carlos@ejemplo.pa', phone: '6000-0000', role: 'customer', address: init.address === false ? null : 'Calle 50, Piso 3', lat: init.address === false ? null : 8.9824, lng: init.address === false ? null : -79.5199 },
    consent: { accepted: init.consent ?? true },
    arco: init.arco ?? [arcoRow(3, 'Oposición', 'respondida', 'Ya dejamos de usar tus datos para publicidad.'), arcoRow(1, 'Acceso')],
    puts: [],
    consentPuts: [],
    arcoPosts: [],
    failConsent: false,
  }
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ contentType: 'image/png', body: TILE_PNG }))
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace('/api/v1', '')
    const body = req.method() === 'GET' ? null : (req.postDataJSON() as Record<string, unknown>)
    if (req.method() === 'POST' && path === '/auth/login') return route.fulfill({ json: { access_token: 'access-1', refresh_token: 'refresh-1', user: m.user } })
    if (path === '/users/me' && req.method() === 'GET') return req.headers().authorization === 'Bearer access-1' ? route.fulfill({ json: m.user }) : route.fulfill({ status: 401, json: { detail: 'No autenticado' } })
    if (path === '/users/me' && req.method() === 'PUT') {
      m.puts.push(body!)
      const next = { ...m.user }
      if ('full_name' in body!) next.full_name = body!.full_name
      if ('phone' in body!) next.phone = body!.phone
      if ('address' in body!) next.address = body!.address
      if ('lat' in body!) next.lat = body!.lat
      if ('lng' in body!) next.lng = body!.lng
      m.user = next
      return route.fulfill({ json: next })
    }
    if (path === '/users/me/consent' && req.method() === 'GET') return route.fulfill({ json: { accepted: m.consent.accepted, policy_version: 'ley81-v1', updated_at: '2026-11-20T00:00:00Z' } })
    if (path === '/users/me/consent' && req.method() === 'PUT') {
      if (m.failConsent) return route.fulfill({ status: 500, json: { detail: 'boom' } })
      m.consentPuts.push(body!.accepted as boolean)
      m.consent.accepted = body!.accepted as boolean
      return route.fulfill({ json: { accepted: m.consent.accepted, policy_version: 'ley81-v1', updated_at: '2026-11-21T00:00:00Z' } })
    }
    if (path === '/users/me/arco' && req.method() === 'GET') return route.fulfill({ json: m.arco })
    if (path === '/users/me/arco' && req.method() === 'POST') {
      m.arcoPosts.push(body!)
      const row = arcoRow(10 + m.arco.length, String(body!.request_type))
      row.detail = String(body!.detail)
      row.created_at = '2026-11-21T09:00:00Z'
      m.arco = [row, ...m.arco]
      return route.fulfill({ status: 201, json: row })
    }
    return route.fulfill({ json: [] })
  })
  return m
}

async function open(browser: Browser, viewport = DESKTOP, init: Parameters<typeof mockApi>[1] = {}, options: Parameters<Browser['newContext']>[0] = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport, ...options })
  const page = await context.newPage()
  const mock = await mockApi(page, init)
  await page.goto('/login?redirect=/perfil')
  await page.locator('input[type="email"]').fill('carlos@ejemplo.pa')
  await page.locator('input[type="password"]').fill('secret-pass-1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/perfil')
  await expect(page.locator('h1')).toHaveText('Mi perfil')
  await expect(page.locator('[data-test="lat-input"]')).toBeVisible() // lazy picker loaded
  await expect(page.locator('[data-test="consent-state"]')).not.toHaveText('Cargando…')
  return { context, page, mock }
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const css = (loc: Locator, prop: string) => loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)
const toggle = (page: Page) => page.locator('[data-test="consent-toggle"]')
const radios = (page: Page) => page.locator('[data-test="arco-type"]')

test.describe('profile: computed styles', () => {
  test('headings are Nunito in ink, not overridden by the global h1..h4 rule', async ({ browser }) => {
    const { context, page } = await open(browser)
    for (const sel of ['h1', 'h2', 'h3']) {
      await expect(page.locator(`.cx ${sel}`).first()).toHaveCSS('font-family', /Nunito/)
      await expect(page.locator(`.cx ${sel}`).first()).toHaveCSS('color', INK)
      await expect(page.locator(`.cx ${sel}`).first()).toHaveCSS('letter-spacing', 'normal')
    }
    await expect(page.locator('h1')).toHaveCSS('font-weight', '800')
    await expect(page.locator('.cx h2').first()).toHaveCSS('font-weight', '700')
    await expect(page.locator('.cx h3').first()).toHaveCSS('font-weight', '700')
    await context.close()
  })

  test('tiles: four flat 24px --surface tiles with no border and no shadow; fields are white 16px with a 2px transparent border', async ({ browser }) => {
    const { context, page } = await open(browser)
    const tiles = page.locator('.cx-profile-tile')
    await expect(tiles).toHaveCount(4)
    for (const t of await tiles.all()) {
      await expect(t).toHaveCSS('background-color', SURFACE)
      await expect(t).toHaveCSS('border-top-left-radius', '24px')
      await expect(t).toHaveCSS('box-shadow', 'none')
      await expect(t).toHaveCSS('border-top-width', '0px')
    }
    const name = page.locator('[data-test="name-input"]')
    await expect(name).toHaveCSS('background-color', BG)
    await expect(name).toHaveCSS('border-top-left-radius', '16px')
    await expect(name).toHaveCSS('border-top-width', '2px')
    await expect(name).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
    expect((await name.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect(page.locator('[data-test="email-input"]')).toHaveCSS('background-color', SURFACE_STRONG)
    await context.close()
  })

  test('fields are 52px tall on a phone and 44px on desktop, with the label above the field', async ({ browser }) => {
    const mobile = await open(browser, MOBILE)
    await expect.poll(async () => (await mobile.page.locator('[data-test="name-input"]').boundingBox())!.height).toBe(52)
    await mobile.context.close()
    const { context, page } = await open(browser)
    await expect.poll(async () => (await page.locator('[data-test="name-input"]').boundingBox())!.height).toBe(44)
    const label = (await page.locator('label[for="perfil-nombre"]').boundingBox())!
    const input = (await page.locator('[data-test="name-input"]').boundingBox())!
    expect(label.y + label.height).toBeLessThanOrEqual(input.y)
    await context.close()
  })

  test('buttons: exactly one primary (turquoise, dark text, 4px lip) in the view; the other actions are tonal', async ({ browser }) => {
    const { context, page } = await open(browser)
    const primaries = await page.locator('main .cx-btn:not(.cx-btn-secondary):not(.cx-btn-ghost)').evaluateAll((els) => els.map((e) => e.getAttribute('data-test')))
    expect(primaries).toEqual(['profile-save'])
    const save = page.locator('[data-test="profile-save"]')
    await expect(save).toHaveCSS('background-color', PRIMARY)
    await expect(save).toHaveCSS('color', INK)
    await expect(save).toHaveCSS('box-shadow', LIP)
    await expect(save).toHaveCSS('border-top-left-radius', '999px')
    for (const t of ['address-save', 'arco-submit']) {
      await expect(page.locator(`[data-test="${t}"]`)).toHaveCSS('background-color', PRIMARY_TINT)
      await expect(page.locator(`[data-test="${t}"]`)).toHaveCSS('color', PRIMARY_TEXT)
      await expect(page.locator(`[data-test="${t}"]`)).toHaveCSS('box-shadow', 'none')
    }
    await context.close()
  })

  test('no blur, backdrop-filter, gradient or shadow other than the primary lip anywhere in the profile', async ({ browser }) => {
    const { context, page } = await open(browser)
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('main, main *')]
        .filter((el) => !el.closest('.leaflet-container'))
        .map((el) => ({ cls: el.className?.toString?.() ?? '', s: getComputedStyle(el) }))
        .filter(({ s }) => (s.backdropFilter && s.backdropFilter !== 'none') || (s.filter && s.filter !== 'none') || s.backgroundImage.includes('gradient') || (s.boxShadow !== 'none' && !/^rgb\(0, 143, 125\) 0px [24]px 0px 0px$/.test(s.boxShadow)))
        .map((x) => x.cls),
    )
    expect(bad).toEqual([])
    await context.close()
  })

  test('light only: a dark color scheme and html.dark do not recolor the page', async ({ browser }) => {
    const { context, page } = await open(browser, DESKTOP, {}, { colorScheme: 'dark' })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await expect(page.locator('[data-test="profile-root"]')).toHaveCSS('background-color', BG)
    await expect(page.locator('[data-test="profile-root"]')).toHaveCSS('color', INK)
    await expect(page.locator('h1')).toHaveCSS('color', INK)
    await expect(page.locator('.cx-profile-tile').first()).toHaveCSS('background-color', SURFACE)
    await expect(page.locator('[data-test="name-input"]')).toHaveCSS('background-color', BG)
    await context.close()
  })
})

test.describe('profile: layout', () => {
  for (const [name, vp] of [['mobile 360x800', MOBILE], ['desktop 1440x900', DESKTOP]] as const) {
    test(`${name}: no horizontal overflow, even with errors and the revoked notice open`, async ({ browser }) => {
      const { context, page } = await open(browser, vp, { consent: false })
      expect(await overflow(page)).toBe(0)
      await page.locator('[data-test="name-input"]').fill('A')
      await page.locator('[data-test="profile-save"]').click()
      await page.locator('[data-test="arco-detail"]').fill('abc')
      await page.locator('[data-test="arco-submit"]').click()
      await expect(page.locator('[data-test="name-error"]')).toBeVisible()
      await expect(page.locator('[data-test="arco-error"]')).toBeVisible()
      await expect(page.locator('[data-test="consent-revoked"]')).toBeVisible()
      expect(await overflow(page)).toBe(0)
      await context.close()
    })
  }

  test('desktop: two columns (personal + address | consent + ARCO); mobile: one column in reading order', async ({ browser }) => {
    const d = await open(browser, DESKTOP)
    const box = async (page: Page, t: string) => (await page.locator(`[data-test="${t}"]`).boundingBox())!
    const [p, a, c, r] = [await box(d.page, 'personal-section'), await box(d.page, 'address-section'), await box(d.page, 'consent-section'), await box(d.page, 'arco-section')]
    expect(p.x).toBeLessThan(c.x)
    expect(Math.abs(p.x - a.x)).toBeLessThan(2)
    expect(Math.abs(c.x - r.x)).toBeLessThan(2)
    expect(p.y + p.height).toBeLessThanOrEqual(a.y)
    await d.context.close()
    const m = await open(browser, MOBILE)
    const ys = [await box(m.page, 'personal-section'), await box(m.page, 'address-section'), await box(m.page, 'consent-section'), await box(m.page, 'arco-section')]
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i].y).toBeGreaterThanOrEqual(ys[i - 1].y + ys[i - 1].height)
      expect(Math.abs(ys[i].x - ys[0].x)).toBeLessThan(2)
    }
    await m.context.close()
  })

  test('every interactive target is at least 44px (the map keeps its own zoom control)', async ({ browser }) => {
    for (const vp of [MOBILE, DESKTOP]) {
      const { context, page } = await open(browser, vp)
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('main button, main a, main input:not([type="checkbox"]):not([type="radio"]), main textarea, main summary, main .cx-switch-row, main .cx-option')]
          .filter((el) => !el.closest('.leaflet-container') && el.offsetParent !== null)
          .map((el) => ({ t: (el.getAttribute('aria-label') || el.getAttribute('data-test') || el.textContent || '').trim().slice(0, 30), h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width }))
          .filter((x) => x.h < 43.5 || x.w < 43.5),
      )
      expect(small, JSON.stringify(small)).toEqual([])
      await context.close()
    }
  })
})

test.describe('profile: consent switch', () => {
  test('is a real switch with a name, a description, a 52x32 pill track and a dark knob when on', async ({ browser }) => {
    const { context, page } = await open(browser)
    const sw = toggle(page)
    await expect(sw).toHaveAttribute('role', 'switch')
    await expect(sw).toBeChecked()
    await expect(page.getByRole('switch', { name: 'Consentimiento informado' })).toHaveCount(1)
    await expect(page.getByRole('switch', { name: 'Consentimiento informado' })).toHaveAccessibleDescription(/Comercios Unidos del Istmo/)
    const track = page.locator('.cx-switch-track')
    const tb = (await track.boundingBox())!
    expect([tb.width, tb.height]).toEqual([52, 32])
    await expect(track).toHaveCSS('background-color', PRIMARY)
    await expect(track).toHaveCSS('border-top-color', PRIMARY_TEXT)
    await expect(track).toHaveCSS('border-top-left-radius', '999px')
    await expect(page.locator('.cx-switch-knob')).toHaveCSS('background-color', INK)
    await expect(page.locator('[data-test="consent-state"]')).toHaveText('Activo')
    const row = (await page.locator('.cx-switch-row').boundingBox())!
    expect(row.height).toBeGreaterThanOrEqual(44)
    await context.close()
  })

  test('keyboard only: Space revokes (PUT accepted=false, notice appears), Space again re-grants', async ({ browser }) => {
    const { context, page, mock } = await open(browser)
    await page.locator('[data-test="phone-input"]').focus()
    for (let i = 0; i < 20 && !(await toggle(page).evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab')
    await expect(toggle(page)).toBeFocused()
    await expect(page.locator('.cx-switch-row')).toHaveCSS('outline-style', 'solid')
    await expect(page.locator('.cx-switch-row')).toHaveCSS('outline-color', PRIMARY_TEXT)
    await expect(page.locator('.cx-switch-row')).toHaveCSS('outline-width', '2px')
    await page.keyboard.press('Space')
    await expect(page.locator('[data-test="consent-revoked"]')).toBeVisible()
    await expect(toggle(page)).not.toBeChecked()
    await expect(page.locator('[data-test="consent-state"]')).toHaveText('Revocado')
    await expect(page.locator('.cx-switch-track')).toHaveCSS('background-color', BG)
    await expect(toggle(page)).not.toHaveAttribute('aria-busy', 'true') // the write finished; a flip during it is ignored on purpose
    expect(mock.consentPuts).toEqual([false])
    const note = page.locator('[data-test="consent-revoked"]')
    await expect(note).toContainText('No podrás hacer nuevos pedidos')
    await expect(note).toContainText('tus datos se conservan')
    await expect(note).toHaveCSS('background-color', 'rgb(253, 241, 214)')
    await expect(note).toHaveCSS('border-top-left-radius', '16px')
    expect(await note.evaluate((el) => getComputedStyle(el, '::before').width)).toBe('4px')
    await expect(note.locator('svg')).toHaveCount(1)
    await expect(toggle(page)).toBeFocused() // still focused after the write: the input was never disabled
    await page.keyboard.press('Space')
    await expect(toggle(page)).toBeChecked()
    await expect(page.locator('[data-test="consent-revoked"]')).toHaveCount(0)
    await expect.poll(() => mock.consentPuts).toEqual([false, true])
    await context.close()
  })

  test('a failed write rolls the switch back and shows a persistent error toast with its close button', async ({ browser }) => {
    const { context, page, mock } = await open(browser)
    mock.failConsent = true
    await toggle(page).focus()
    await page.keyboard.press('Space')
    const toast = page.locator('.cx-toast[data-tipo="error"]')
    await expect(toast).toBeVisible()
    await expect(toast).toHaveAttribute('role', 'alert')
    await expect(toast.getByRole('button', { name: 'Cerrar notificación' })).toBeVisible()
    await expect(toggle(page)).toBeChecked()
    await expect(page.locator('[data-test="consent-state"]')).toHaveText('Activo')
    await context.close()
  })
})

test.describe('profile: ARCO', () => {
  test('keyboard only: arrows pick the type, Tab to the text, type, Enter on send; POST carries them and the history shows it first', async ({ browser }) => {
    const { context, page, mock } = await open(browser)
    await expect(radios(page)).toHaveCount(4)
    await radios(page).nth(0).focus()
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight') // Oposición
    await expect(radios(page).nth(3)).toBeFocused()
    await expect(radios(page).nth(3)).toBeChecked()
    await expect(page.locator('.cx-option-selected')).toHaveCount(1)
    await expect(page.locator('.cx-option-selected')).toHaveCSS('background-color', PRIMARY_TINT)
    await expect(page.locator('.cx-option-selected')).toHaveCSS('border-top-color', PRIMARY_TEXT)
    await expect(page.locator('.cx-option:has([data-test="arco-type"]:focus-visible)')).toHaveCSS('outline-width', '2px')
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-test="arco-detail"]')).toBeFocused()
    await page.keyboard.type('No quiero que usen mis datos para publicidad')
    await page.keyboard.press('Tab')
    await expect(page.locator('[data-test="arco-submit"]')).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-test="arco-sent"]')).toBeVisible()
    expect(mock.arcoPosts).toEqual([{ request_type: 'Oposición', detail: 'No quiero que usen mis datos para publicidad' }])
    const items = page.locator('[data-test="arco-item"]')
    await expect(items).toHaveCount(3)
    await expect(items.first()).toContainText('Oposición')
    await expect(items.first()).toContainText('No quiero que usen mis datos para publicidad')
    await expect(items.first().locator('.cx-estado')).toHaveText('Pendiente')
    await expect(page.locator('[data-test="arco-detail"]')).toHaveValue('')
    await context.close()
  })

  test('history: status chips with icon + text in their tone, the admin response in a tinted block', async ({ browser }) => {
    const { context, page } = await open(browser)
    const items = page.locator('[data-test="arco-item"]')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0).locator('.cx-estado')).toHaveText('Respondida')
    await expect(items.nth(0).locator('.cx-estado')).toHaveCSS('background-color', 'rgb(221, 243, 228)')
    await expect(items.nth(0).locator('.cx-estado')).toHaveCSS('border-top-left-radius', '999px')
    await expect(items.nth(0).locator('.cx-estado svg')).toHaveCount(1)
    await expect(items.nth(1).locator('.cx-estado')).toHaveText('Pendiente')
    await expect(items.nth(1).locator('.cx-estado')).toHaveCSS('background-color', 'rgb(253, 241, 214)')
    await expect(items.nth(1).locator('.cx-estado svg')).toHaveCount(1)
    await expect(items.nth(0).locator('[data-test="arco-reply"]')).toContainText('Ya dejamos de usar tus datos para publicidad.')
    await expect(items.nth(0).locator('[data-test="arco-reply"]')).toHaveCSS('background-color', PRIMARY_TINT)
    await expect(items.nth(1).locator('[data-test="arco-reply"]')).toHaveCount(0)
    await expect(items.nth(0)).toHaveCSS('background-color', BG)
    await expect(items.nth(0)).toHaveCSS('border-top-left-radius', '16px')
    await context.close()
  })

  test('empty history: a calm empty state', async ({ browser }) => {
    const { context, page } = await open(browser, DESKTOP, { arco: [] })
    await expect(page.locator('[data-test="arco-item"]')).toHaveCount(0)
    const empty = page.locator('[data-test="arco-empty"]')
    await expect(empty).toContainText('Aún no has enviado solicitudes')
    await expect(empty.locator('.cx-arco-empty-icon')).toHaveCSS('background-color', PRIMARY_TINT)
    await expect(empty.locator('svg')).toHaveCount(1)
    await context.close()
  })

  test('a short detail: 2px danger border + icon + message below, wired with aria-describedby; typing clears it', async ({ browser }) => {
    const { context, page, mock } = await open(browser)
    const ta = page.locator('[data-test="arco-detail"]')
    await ta.focus()
    await page.keyboard.type('abc')
    await page.locator('[data-test="arco-submit"]').focus()
    await page.keyboard.press('Enter')
    const err = page.locator('[data-test="arco-error"]')
    await expect(err).toHaveText('Describe tu solicitud con al menos 5 caracteres para continuar.')
    await expect(err.locator('svg')).toHaveCount(1)
    await expect(err).toHaveCSS('color', DANGER_TEXT)
    await expect(ta).toHaveAttribute('aria-invalid', 'true')
    await expect(ta).toHaveCSS('border-top-color', DANGER)
    await expect(ta).toHaveCSS('border-top-width', '2px')
    await expect(ta).toHaveAccessibleDescription('Describe tu solicitud con al menos 5 caracteres para continuar.')
    expect(mock.arcoPosts).toEqual([])
    const a = (await ta.boundingBox())!
    const e = (await err.boundingBox())!
    expect(e.y).toBeGreaterThanOrEqual(a.y + a.height)
    await ta.focus()
    await page.keyboard.type('de')
    await expect(err).toHaveCount(0)
    await context.close()
  })
})

test.describe('profile: personal data and address', () => {
  test('a name below 2 characters is refused with icon + message + aria-describedby, the email is read-only', async ({ browser }) => {
    const { context, page, mock } = await open(browser)
    const name = page.locator('[data-test="name-input"]')
    await name.fill('A')
    await page.locator('[data-test="profile-save"]').click()
    const err = page.locator('[data-test="name-error"]')
    await expect(err).toHaveText('Escribe tu nombre completo (mínimo 2 caracteres).')
    await expect(err.locator('svg')).toHaveCount(1)
    await expect(name).toHaveAccessibleDescription('Escribe tu nombre completo (mínimo 2 caracteres).')
    await expect(name).toHaveCSS('border-top-color', DANGER)
    expect(mock.puts).toEqual([])
    const email = page.locator('[data-test="email-input"]')
    await expect(email).toHaveAttribute('readonly', '')
    await expect(email).toHaveValue('carlos@ejemplo.pa')
    await expect(email).toHaveAccessibleDescription(/no se puede cambiar/)
    await context.close()
  })

  test('save name and phone with the keyboard: PUT carries only full_name and phone', async ({ browser }) => {
    const { context, page, mock } = await open(browser)
    await page.locator('[data-test="name-input"]').focus()
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('Carlos A. Andrade')
    await page.keyboard.press('Tab')
    await page.keyboard.press('ControlOrMeta+A')
    await page.keyboard.type('6111-2222')
    await page.locator('[data-test="profile-save"]').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.cx-toast')).toContainText('Perfil actualizado correctamente.')
    expect(mock.puts).toEqual([{ full_name: 'Carlos A. Andrade', phone: '6111-2222' }])
    await context.close()
  })

  test('save the address with the keyboard: text and coordinates travel together; clearing sends nulls together', async ({ browser }) => {
    const { context, page, mock } = await open(browser, DESKTOP, { address: false })
    await page.locator('[data-test="address-input"]').focus()
    await page.keyboard.type('Vía España, Torre Azul')
    await page.locator('[data-test="lat-input"]').focus()
    await page.keyboard.type('8.9936')
    await page.keyboard.press('Tab')
    await page.keyboard.type('-79.5197')
    await page.locator('[data-test="address-save"]').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.cx-toast')).toContainText('Perfil actualizado correctamente.')
    expect(mock.puts.at(-1)).toEqual({ full_name: 'Carlos Andrade', phone: '6000-0000', address: 'Vía España, Torre Azul', lat: 8.9936, lng: -79.5197 })
    await page.reload()
    await expect(page.locator('[data-test="address-input"]')).toHaveValue('Vía España, Torre Azul')
    await expect(page.locator('[data-test="lat-input"]')).toHaveValue('8.9936')
    await page.locator('[data-test="address-input"]').fill('')
    await page.locator('[data-test="clear-pin"]').focus()
    await page.keyboard.press('Enter')
    await page.locator('[data-test="address-save"]').focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => mock.puts.length).toBe(2)
    expect(mock.puts.at(-1)).toEqual({ full_name: 'Carlos Andrade', phone: '6000-0000', address: null, lat: null, lng: null })
    await context.close()
  })

  test('a too-short address shows the field error with an icon, the 2px danger border and aria-describedby', async ({ browser }) => {
    const { context, page } = await open(browser)
    const input = page.locator('[data-test="address-input"]')
    await input.fill('abc')
    await page.locator('[data-test="address-save"]').click()
    const err = page.locator('[data-test="address-error"]')
    await expect(err).toHaveText('La dirección debe tener al menos 4 caracteres.')
    await expect(err.locator('svg')).toHaveCount(1)
    await expect(err).toHaveCSS('color', DANGER_TEXT)
    await expect(input).toHaveCSS('border-top-color', DANGER)
    await expect(input).toHaveAccessibleDescription('La dirección debe tener al menos 4 caracteres.')
    await context.close()
  })

  test('placeholders are examples, never labels; every field keeps a visible label', async ({ browser }) => {
    const { context, page } = await open(browser, DESKTOP, { address: false })
    for (const [id, label] of [['perfil-nombre', 'Nombre completo'], ['perfil-telefono', 'Teléfono'], ['perfil-email', 'Correo electrónico'], ['perfil-direccion', 'Dirección'], ['perfil-arco-detalle', 'Cuéntanos qué necesitas']]) {
      await expect(page.locator(`label[for="${id}"]`)).toHaveText(label)
      await expect(page.locator(`label[for="${id}"]`)).toBeVisible()
    }
    await expect(page.locator('[data-test="address-input"]')).toHaveAttribute('placeholder', /^Ejemplo:/)
    await expect(page.locator('[data-test="arco-detail"]')).toHaveAttribute('placeholder', /^Ejemplo:/)
    await context.close()
  })
})

test.describe('profile: focus and reduced motion', () => {
  test('keyboard focus draws the 2px --primary-text ring on buttons and the input border switches to --primary-text', async ({ browser }) => {
    const { context, page } = await open(browser)
    await page.locator('[data-test="phone-input"]').focus()
    await page.keyboard.press('Tab') // email (read-only, still focusable)
    await page.keyboard.press('Tab') // save
    const save = page.locator('[data-test="profile-save"]')
    await expect(save).toBeFocused()
    await expect(save).toHaveCSS('outline-style', 'solid')
    await expect(save).toHaveCSS('outline-color', PRIMARY_TEXT)
    await expect(save).toHaveCSS('outline-width', '2px')
    await expect(save).toHaveCSS('outline-offset', '2px')
    await page.locator('[data-test="phone-input"]').focus()
    await expect(page.locator('[data-test="phone-input"]')).toHaveCSS('border-top-color', PRIMARY_TEXT)
    await context.close()
  })

  test('prefers-reduced-motion: the switch and the buttons do not animate', async ({ browser }) => {
    const { context, page } = await open(browser, DESKTOP, {}, { reducedMotion: 'reduce' })
    await expect(page.locator('.cx-switch-knob')).toHaveCSS('transition-duration', '0s')
    await expect(page.locator('[data-test="profile-save"]')).toHaveCSS('transition-duration', '0s')
    await context.close()
  })
})
