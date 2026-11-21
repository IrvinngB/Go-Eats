import { test, expect, type Browser, type Page } from '@playwright/test'

// Real browser against the production build (service worker blocked). The API is mocked with page.route.
const INK = 'rgb(11, 43, 51)'
const BG = 'rgb(255, 255, 255)'
const SURFACE = 'rgb(242, 247, 247)'
const PRIMARY_TINT = 'rgb(214, 245, 240)'
const PRIMARY_TEXT = 'rgb(0, 121, 107)'
const SHADOW_ACTIVE = 'rgba(11, 43, 51, 0.1) 0px 6px 20px 0px'
const MOBILE = { width: 360, height: 800 }
const DESKTOP = { width: 1440, height: 900 }

const TILE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

const zones = [{ id: 1, slug: 'san-francisco', name: 'San Francisco', delivery_fee: 2.5, distance_km: 3.2, is_active: true }]
const merchants = [
  { code: 'c1', name: 'Restaurante Diablicos', category_type: 'Comida típica', zone_slug: 'san-francisco', affiliation_status: 'activo', is_open: true, rating: 4.5, delivery_time: '25-35 min', opens_at: '08:00', closes_at: '21:00', description: 'Cocina casera.', icon: 'Soup' },
]
// r2 has phone and rating; r9 has neither (missing data must not be invented).
const couriers = [
  { code: 'r2', name: 'María Cedeño', phone: '6234-9876', zone_slug: 'san-francisco', rating: 4.8, is_available: true, affiliation_status: 'activo' },
  { code: 'r9', name: 'Pedro Sin Datos', phone: '', zone_slug: 'san-francisco', rating: null, is_available: true, affiliation_status: 'activo' },
]

function order(code: string, status: string, over: Record<string, unknown> = {}) {
  return {
    id: Number(code.slice(4)), code, merchant_code: 'c1', merchant_name: 'Restaurante Diablicos', customer_id: 1, customer_name: 'Carlos Andrade', customer_phone: '6000-0000',
    zone_slug: 'san-francisco', delivery_address: 'Calle 50, Piso 3', notes: '', payment_method: 'contr_entrega', status, courier_code: null, cancellation_reason: null,
    payment_status: null, subtotal: 14, delivery_fee: 2.5, total: 16.5, created_at: '2026-11-20T15:30:00Z',
    items: [{ id: 1, product_code: 'p1', name: 'Sancocho', unit_price: 7, quantity: 2, notes: 'sin cebolla' }], rating: null, ...over,
  }
}

const ALL = [
  order('PED-1001', 'en_camino', { courier_code: 'r2', payment_method: 'yappy', payment_status: 'pagado' }),
  order('PED-1002', 'en_camino', { courier_code: 'r9' }),
  order('PED-1003', 'pendiente'),
  order('PED-1004', 'confirmado', { payment_method: 'yappy', payment_status: 'pendiente' }),
  order('PED-1005', 'en_preparacion'),
  order('PED-1006', 'listo_para_recoger'),
  order('PED-1007', 'entregado'),
  order('PED-1008', 'entregado', { rating: { id: 1, merchant_stars: 4, courier_stars: 5, comment: '', created_at: '2026-11-20T16:00:00Z' } }),
  order('PED-1009', 'rechazado', { cancellation_reason: 'Sin stock del plato solicitado.' }),
  order('PED-1010', 'cancelado', { cancellation_reason: 'Cliente solicitó cancelación.', payment_method: 'yappy', payment_status: 'fallido' }),
]

async function mockApi(page: Page, orders: unknown[] = ALL) {
  const ratings: Array<Record<string, unknown>> = []
  const user = { id: 1, full_name: 'Carlos Andrade', email: 'carlos@ejemplo.pa', phone: '6000-0000', role: 'customer', address: 'Calle 50', lat: 8.98, lng: -79.52 }
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ contentType: 'image/png', body: TILE_PNG }))
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace('/api/v1', '')
    if (req.method() === 'POST' && path === '/auth/login') return route.fulfill({ json: { access_token: 'access-1', refresh_token: 'refresh-1', user } })
    if (req.method() === 'GET' && path === '/users/me') return req.headers().authorization === 'Bearer access-1' ? route.fulfill({ json: user }) : route.fulfill({ status: 401, json: { detail: 'No autenticado' } })
    if (path === '/users/me/consent') return route.fulfill({ json: { accepted: true, policy_version: 'ley81-v1', updated_at: '2026-11-20T00:00:00Z' } })
    if (path.startsWith('/zones')) return route.fulfill({ json: zones })
    if (path.startsWith('/merchants')) return route.fulfill({ json: merchants })
    if (path.startsWith('/delivery/couriers')) return route.fulfill({ json: couriers })
    if (req.method() === 'POST' && /^\/orders\/[^/]+\/rating$/.test(path)) {
      ratings.push({ path, ...(req.postDataJSON() as Record<string, unknown>) })
      return route.fulfill({ status: 200, json: order('PED-1007', 'entregado') })
    }
    if (req.method() === 'GET' && path === '/orders/') return route.fulfill({ json: orders })
    return route.fulfill({ json: [] })
  })
  return ratings
}

async function open(browser: Browser, viewport = DESKTOP, orders: unknown[] = ALL, options: Parameters<Browser['newContext']>[0] = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport, ...options })
  const page = await context.newPage()
  const ratings = await mockApi(page, orders)
  await page.goto('/login?redirect=/pedidos')
  await page.locator('input[type="email"]').fill('carlos@ejemplo.pa')
  await page.locator('input[type="password"]').fill('secret-pass-1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/pedidos')
  await expect(page.locator('h1')).toHaveText('Mis pedidos')
  return { context, page, ratings }
}

const card = (page: Page, code: string) => page.locator('[data-test="order-card"]', { hasText: code })
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const css = (page: Page, sel: string, prop: string) => page.locator(sel).first().evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop)

test.describe('orders: computed styles', () => {
  test('headings are Nunito in ink, not overridden by the global h1..h4 rule', async ({ browser }) => {
    const { context, page } = await open(browser)
    for (const sel of ['h1', 'h2', 'h3', 'h4']) {
      await expect(page.locator(`.cx ${sel}`).first()).toHaveCSS('font-family', /Nunito/)
      await expect(page.locator(`.cx ${sel}`).first()).toHaveCSS('color', INK)
      await expect(page.locator(`.cx ${sel}`).first()).toHaveCSS('letter-spacing', 'normal')
    }
    await expect(page.locator('h1')).toHaveCSS('font-weight', '800')
    await expect(page.locator('.cx h3').first()).toHaveCSS('font-weight', '700')
    await context.close()
  })

  test('tokens: the active tile is 24px on --bg, supporting tiles 16px on --surface, chips are pills with the tone of their state', async ({ browser }) => {
    const { context, page } = await open(browser)
    const active = page.locator('.cx-active')
    await expect(active).toHaveCSS('border-top-left-radius', '24px')
    await expect(active).toHaveCSS('background-color', BG)
    await expect(card(page, 'PED-1001').locator('[data-test="status-tile"]')).toHaveCSS('background-color', SURFACE)
    await expect(card(page, 'PED-1001').locator('[data-test="status-tile"]')).toHaveCSS('border-top-left-radius', '16px')
    const chip = (code: string) => card(page, code).locator('.cx-estado').first()
    await expect(chip('PED-1001')).toHaveCSS('background-color', PRIMARY_TINT)
    await expect(chip('PED-1001')).toHaveCSS('color', PRIMARY_TEXT)
    await expect(chip('PED-1001')).toHaveCSS('border-top-left-radius', '999px')
    await expect(chip('PED-1005')).toHaveCSS('background-color', 'rgb(253, 241, 214)') // preparing: warning tint
    await expect(chip('PED-1006')).toHaveCSS('background-color', 'rgb(228, 227, 246)') // courier assigned: secondary tint
    await expect(chip('PED-1007')).toHaveCSS('background-color', 'rgb(221, 243, 228)') // delivered: success tint
    await expect(chip('PED-1009')).toHaveCSS('background-color', 'rgb(251, 228, 228)') // rejected: danger tint
    await expect(chip('PED-1003')).toHaveCSS('background-color', 'rgb(227, 238, 238)') // received: surface-strong
    for (const code of ['PED-1001', 'PED-1003', 'PED-1005', 'PED-1006', 'PED-1007', 'PED-1009']) await expect(chip(code).locator('svg')).toHaveCount(1) // icon + text
    await context.close()
  })

  test('no blur, backdrop-filter or gradient anywhere on the page (map closed)', async ({ browser }) => {
    const { context, page } = await open(browser)
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('.cx, .cx *')].filter((el) => {
        const s = getComputedStyle(el)
        return (s.backdropFilter && s.backdropFilter !== 'none') || (s.filter && s.filter !== 'none') || s.backgroundImage.includes('gradient')
      }).length,
    )
    expect(bad).toBe(0)
    await context.close()
  })

  test('the active-order tile is the ONLY element with --shadow-active (and no other tile has a shadow)', async ({ browser }) => {
    const { context, page } = await open(browser)
    const shadows = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .map((el) => ({ cls: el.className?.toString?.() ?? '', s: getComputedStyle(el).boxShadow }))
        .filter((x) => x.s !== 'none' && x.s !== ''),
    )
    const active = shadows.filter((x) => x.s === SHADOW_ACTIVE)
    expect(active).toHaveLength(1)
    expect(active[0].cls).toContain('cx-active')
    // the rest are only the primary button lip (solid, no blur)
    for (const x of shadows.filter((y) => y.s !== SHADOW_ACTIVE)) expect(x.s, x.cls).toMatch(/^rgb\(0, 143, 125\) 0px [24]px 0px 0px$/)
    await context.close()
  })

  test('light only: a dark color scheme and html.dark do not recolor the page', async ({ browser }) => {
    const { context, page } = await open(browser, DESKTOP, ALL, { colorScheme: 'dark' })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await expect(page.locator('[data-test="orders-root"]')).toHaveCSS('background-color', BG)
    await expect(page.locator('[data-test="orders-root"]')).toHaveCSS('color', INK)
    await expect(page.locator('h1')).toHaveCSS('color', INK)
    await expect(page.locator('.cx-active')).toHaveCSS('background-color', BG)
    await context.close()
  })
})

test.describe('orders: layout', () => {
  for (const [name, vp] of [['mobile 360x800', MOBILE], ['desktop 1440x900', DESKTOP]] as const) {
    test(`${name}: no horizontal overflow, even with the map open and the details expanded`, async ({ browser }) => {
      const { context, page } = await open(browser, vp)
      expect(await overflow(page)).toBe(0)
      await card(page, 'PED-1001').locator('[data-test="map-toggle"]').click()
      await expect(card(page, 'PED-1001').locator('.cx-trackmap')).toBeVisible()
      for (const d of await page.locator('details').all()) await d.locator('summary').click()
      expect(await overflow(page)).toBe(0)
      await context.close()
    })
  }

  test('mobile: map, ETA | status side by side, courier, timeline in that order', async ({ browser }) => {
    const { context, page } = await open(browser, MOBILE)
    const c = card(page, 'PED-1001')
    const box = async (sel: string) => (await c.locator(sel).boundingBox())!
    const map = await box('[data-test="map-tile"]')
    const eta = await box('[data-test="eta-tile"]')
    const status = await box('[data-test="status-tile"]')
    const courier = await box('[data-test="courier-tile"]')
    const timeline = await box('.cx-track-timeline')
    expect(Math.abs(eta.y - status.y)).toBeLessThan(2)
    expect(eta.x).toBeLessThan(status.x)
    expect(map.y + map.height).toBeLessThanOrEqual(eta.y)
    expect(eta.y + eta.height).toBeLessThanOrEqual(courier.y)
    expect(courier.y + courier.height).toBeLessThanOrEqual(timeline.y)
    await context.close()
  })

  test('desktop: the map tile sits on the left and the ETA, status and timeline stack on the right', async ({ browser }) => {
    const { context, page } = await open(browser)
    const c = card(page, 'PED-1001')
    const map = (await c.locator('[data-test="map-tile"]').boundingBox())!
    const eta = (await c.locator('[data-test="eta-tile"]').boundingBox())!
    const status = (await c.locator('[data-test="status-tile"]').boundingBox())!
    expect(map.x).toBeLessThan(eta.x)
    expect(map.width).toBeGreaterThan(eta.width)
    expect(eta.y + eta.height).toBeLessThanOrEqual(status.y)
    await context.close()
  })

  test('every interactive target is at least 44px (courier call is 48)', async ({ browser }) => {
    for (const vp of [MOBILE, DESKTOP]) {
      const { context, page } = await open(browser, vp)
      await card(page, 'PED-1001').locator('[data-test="map-toggle"]').click()
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('main button, main a, main summary')]
          .filter((el) => !el.closest('.cx-trackmap') && el.offsetParent !== null) // CoverageMap's own controls are out of scope
          .map((el) => ({ t: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), h: el.getBoundingClientRect().height, w: el.getBoundingClientRect().width }))
          .filter((x) => x.h < 43.5 || x.w < 43.5),
      )
      expect(small, JSON.stringify(small)).toEqual([])
      const call = (await card(page, 'PED-1001').locator('[data-test="courier-call"]').boundingBox())!
      expect([call.width, call.height]).toEqual([48, 48])
      const avatar = (await card(page, 'PED-1001').locator('.cx-courier-avatar').boundingBox())!
      expect([avatar.width, avatar.height]).toEqual([48, 48])
      await context.close()
    }
  })
})

test.describe('orders: states', () => {
  test('timeline steps per order state, terminal orders show a banner with the reason and no steps', async ({ browser }) => {
    const { context, page } = await open(browser)
    const steps = (code: string) => card(page, code).locator('[data-test="timeline-step"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))
    expect(await steps('PED-1003')).toEqual(['current', 'pending', 'pending', 'pending', 'pending', 'pending'])
    expect(await steps('PED-1004')).toEqual(['done', 'current', 'pending', 'pending', 'pending', 'pending'])
    expect(await steps('PED-1005')).toEqual(['done', 'done', 'current', 'pending', 'pending', 'pending'])
    expect(await steps('PED-1006')).toEqual(['done', 'done', 'done', 'current', 'pending', 'pending'])
    expect(await steps('PED-1001')).toEqual(['done', 'done', 'done', 'done', 'current', 'pending'])
    expect(await steps('PED-1007')).toEqual(['done', 'done', 'done', 'done', 'done', 'current'])
    expect(await steps('PED-1009')).toEqual([])
    expect(await steps('PED-1010')).toEqual([])
    await expect(card(page, 'PED-1009').locator('[data-test="estado-terminal"]')).toHaveText('Rechazado: Sin stock del plato solicitado.')
    await expect(card(page, 'PED-1010').locator('[data-test="estado-terminal"]')).toHaveText('Cancelado: Cliente solicitó cancelación.')
    await expect(card(page, 'PED-1009').locator('[data-test="estado-terminal"]')).toHaveCSS('background-color', 'rgb(251, 228, 228)')
    await expect(card(page, 'PED-1009').locator('[data-test="estado-terminal"]')).toHaveCSS('border-top-left-radius', '16px')
    // timeline geometry: 24px circles, current one ringed with --primary-text
    const dot = card(page, 'PED-1005').locator('.cx-step[data-state="current"] .cx-step-dot')
    const b = (await dot.boundingBox())!
    expect([b.width, b.height]).toEqual([24, 24])
    await expect(dot).toHaveCSS('background-color', PRIMARY_TINT)
    await expect(dot).toHaveCSS('border-top-color', PRIMARY_TEXT)
    await expect(card(page, 'PED-1005').locator('.cx-step[data-state="done"] .cx-step-dot').first()).toHaveCSS('background-color', 'rgb(0, 177, 157)')
    await context.close()
  })

  test('progress bar: 8px pill with six dots, aria-valuenow and a polite live status', async ({ browser }) => {
    const { context, page } = await open(browser)
    const bar = card(page, 'PED-1005').locator('[data-test="timeline-progress"]')
    expect((await bar.boundingBox())!.height).toBe(8)
    await expect(bar).toHaveCSS('border-top-left-radius', '999px')
    await expect(bar).toHaveAttribute('aria-valuenow', '3')
    await expect(bar).toHaveAttribute('aria-valuetext', 'Paso 3 de 6: En preparación')
    await expect(card(page, 'PED-1005').locator('[data-test="progress-dot"]')).toHaveCount(6)
    await expect(card(page, 'PED-1005').locator('[data-test="status-tile"] [aria-live="polite"]')).toContainText('En preparación')
    await context.close()
  })

  test('ETA tile uses the merchant range in tabular Nunito; courier tile shows only what the data has', async ({ browser }) => {
    const { context, page } = await open(browser)
    const eta = card(page, 'PED-1001').locator('[data-test="eta-tile"]')
    await expect(eta.locator('.cx-eta')).toHaveText('25–35')
    await expect(eta.locator('.cx-eta')).toHaveCSS('font-family', /Nunito/)
    await expect(eta.locator('.cx-eta')).toHaveCSS('font-variant-numeric', 'tabular-nums')
    await expect(eta.locator('.cx-eta')).toHaveCSS('font-size', '40px')
    await expect(eta).toContainText('Tiempo estimado del comercio')
    // full data
    const full = card(page, 'PED-1001').locator('[data-test="courier-tile"]')
    await expect(full.locator('.cx-h3')).toHaveText('María Cedeño')
    await expect(full.locator('[data-test="courier-rating"]')).toHaveText('4.8')
    await expect(full.locator('[data-test="courier-call"]')).toHaveAttribute('href', 'tel:6234-9876')
    await expect(full.locator('[data-test="courier-call"]')).toHaveAttribute('aria-label', 'Llamar a María Cedeño')
    await expect(full.locator('[data-test="courier-call"]')).toHaveCSS('background-color', PRIMARY_TINT)
    // missing phone and rating
    const empty = card(page, 'PED-1002').locator('[data-test="courier-tile"]')
    await expect(empty.locator('.cx-h3')).toHaveText('Pedro Sin Datos')
    await expect(empty.locator('[data-test="courier-call"]')).toHaveCount(0)
    await expect(empty.locator('[data-test="courier-rating"]')).toHaveCount(0)
    await expect(empty).toContainText('Sin calificaciones')
    await context.close()
  })

  test('no invented values: no 4.9, no 12-18 min, no fallback phone, no chat', async ({ browser }) => {
    const { context, page } = await open(browser)
    const text = await page.locator('main').innerText()
    expect(text).not.toContain('4.9')
    expect(text).not.toMatch(/12\s*[-–]\s*18/)
    expect(text).not.toContain('6812-3344')
    expect(text).not.toMatch(/chat/i)
    expect(await page.locator('a[href^="tel:"]').evaluateAll((a) => a.map((x) => x.getAttribute('href')))).toEqual(['tel:6234-9876'])
    await context.close()
  })

  test('only the first order in progress is the hero tile, and it carries the one primary button', async ({ browser }) => {
    const { context, page } = await open(browser)
    await expect(page.locator('.cx-active')).toHaveCount(1)
    await expect(card(page, 'PED-1001')).toHaveClass(/cx-active/)
    const primaries = await page.locator('main .cx-btn:not(.cx-btn-secondary):not(.cx-btn-ghost)').evaluateAll((els) => els.map((e) => e.getAttribute('data-test')))
    expect(primaries).toEqual(['map-toggle'])
    await expect(card(page, 'PED-1001').locator('[data-test="map-toggle"]')).toHaveCSS('background-color', 'rgb(0, 177, 157)')
    await context.close()
  })

  test('the map tile hosts CoverageMap inside a 24px tile with a 16px clip and no legacy border or shadow', async ({ browser }) => {
    const { context, page } = await open(browser)
    const c = card(page, 'PED-1001')
    await c.locator('[data-test="map-toggle"]').click()
    await expect(c.locator('.leaflet-container')).toBeVisible()
    await expect(c.locator('[data-test="map-tile"]')).toHaveCSS('border-top-left-radius', '24px')
    await expect(c.locator('.cx-trackmap')).toHaveCSS('border-top-left-radius', '16px')
    await expect(c.locator('.cx-trackmap > div')).toHaveCSS('box-shadow', 'none')
    await expect(c.locator('[data-test="map-toggle"]')).toHaveAttribute('aria-expanded', 'true')
    await context.close()
  })

  test('history: delivered unrated has a tinted icon tile and Calificar; rated shows read-only stars with one decimal', async ({ browser }) => {
    const { context, page } = await open(browser)
    const un = card(page, 'PED-1007').locator('[data-test="delivered-tile"]')
    await expect(un.locator('.cx-delivered-icon')).toHaveCSS('background-color', 'rgb(221, 243, 228)')
    await expect(un.locator('.cx-delivered-icon')).toHaveCSS('border-top-left-radius', '999px')
    await expect(un.locator('.cx-h3')).toHaveText('Pedido entregado')
    await expect(un.locator('[data-test="rate-open"]')).toHaveText('Calificar')
    const rated = card(page, 'PED-1008').locator('[data-test="rating-readonly"]')
    await expect(rated).toContainText('4.0')
    await expect(rated).toContainText('5.0')
    await expect(card(page, 'PED-1008').locator('[data-test="rate-open"]')).toHaveCount(0)
    await context.close()
  })
})

test.describe('orders: rating dialog and keyboard', () => {
  test('keyboard only: open, arrows/Home/End on both radiogroups, type a comment, send; the POST carries the chosen values', async ({ browser }) => {
    const { context, page, ratings } = await open(browser)
    // Reach "Calificar" with Shift+Tab from the details summary that follows it, so the focus is keyboard-driven (:focus-visible).
    await card(page, 'PED-1007').locator('summary').focus()
    await page.keyboard.press('Shift+Tab')
    const opener = card(page, 'PED-1007').locator('[data-test="rate-open"]')
    await expect(opener).toBeFocused()
    await expect(opener).toHaveCSS('outline-style', 'solid')
    await expect(opener).toHaveCSS('outline-color', PRIMARY_TEXT)
    await expect(opener).toHaveCSS('outline-width', '2px')
    await expect(opener).toHaveCSS('outline-offset', '2px')
    await page.keyboard.press('Enter')
    const dialog = page.locator('[data-test="rate-dialog"]')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('role', 'dialog')
    await expect(dialog).toHaveAttribute('aria-modal', 'true')
    await expect(page.locator('#rate-title')).toBeFocused()
    await expect(page.locator('body')).toHaveClass(/cx-dialog-open/)
    await page.keyboard.press('Tab') // close
    await page.keyboard.press('Tab') // merchant group: the checked radio (5)
    const merchant = dialog.locator('[role="radiogroup"]').nth(0).locator('[role="radio"]')
    const courier = dialog.locator('[role="radiogroup"]').nth(1).locator('[role="radio"]')
    await expect(merchant.nth(4)).toBeFocused()
    await expect(merchant.nth(4)).toHaveCSS('outline-style', 'solid')
    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft') // 3
    await expect(merchant.nth(2)).toHaveAttribute('aria-checked', 'true')
    await expect(dialog.locator('[aria-live="polite"]').first()).toHaveText('Servicio del comercio: 3 de 5 estrellas')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Home') // 1
    await expect(courier.nth(0)).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('End') // 5
    await page.keyboard.press('ArrowLeft') // 4
    await expect(courier.nth(3)).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('Tab')
    await page.keyboard.type('Todo bien')
    for (const r of [...(await merchant.all()), ...(await courier.all())]) {
      const b = (await r.boundingBox())!
      expect(b.width).toBeGreaterThanOrEqual(44)
      expect(b.height).toBeGreaterThanOrEqual(44)
    }
    await page.keyboard.press('Tab') // Cancelar
    await page.keyboard.press('Tab') // Enviar
    await page.keyboard.press('Space')
    await expect(dialog).toBeHidden()
    expect(ratings).toEqual([{ path: '/orders/PED-1007/rating', merchant_stars: 3, courier_stars: 4, comment: 'Todo bien' }])
    await expect(page.locator('body')).not.toHaveClass(/cx-dialog-open/)
    await context.close()
  })

  test('Escape closes the dialog and gives focus back to Calificar', async ({ browser }) => {
    const { context, page } = await open(browser)
    const opener = card(page, 'PED-1007').locator('[data-test="rate-open"]')
    await opener.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-test="rate-dialog"]')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-test="rate-dialog"]')).toBeHidden()
    await expect(opener).toBeFocused()
    await context.close()
  })

  test('the dialog is a flat overlay: --bg panel with a 1px border, the overlay shadow and a flat scrim (no blur); a phone gets a bottom sheet', async ({ browser }) => {
    const { context, page } = await open(browser, MOBILE)
    await card(page, 'PED-1007').locator('[data-test="rate-open"]').click()
    const sheet = page.locator('[data-test="rate-dialog"]')
    await expect(sheet).toBeVisible()
    await expect(page.locator('.cx-sheet-enter-active, .cx-sheet-leave-active')).toHaveCount(0)
    await expect(page.locator('[data-test="rate-overlay"]')).toHaveCSS('background-color', 'rgba(11, 43, 51, 0.48)')
    expect(await css(page, '[data-test="rate-overlay"]', 'backdrop-filter')).toMatch(/^(none|)$/)
    await expect(sheet).toHaveCSS('border-top-left-radius', '32px')
    await expect(sheet).toHaveCSS('background-color', BG)
    const box = (await sheet.boundingBox())!
    expect(Math.round(box.y + box.height)).toBe(800)
    expect(await overflow(page)).toBe(0)
    await context.close()
  })
})

test.describe('orders: empty state', () => {
  for (const [name, vp] of [['mobile', MOBILE], ['desktop', DESKTOP]] as const) {
    test(`${name}: tinted circle, title, one line and one primary "Explorar comercios"`, async ({ browser }) => {
      const { context, page } = await open(browser, vp, [])
      const empty = page.locator('[data-test="orders-empty"]')
      await expect(empty.locator('.cx-empty-icon')).toHaveCSS('background-color', PRIMARY_TINT)
      await expect(empty.locator('.cx-h3')).toHaveText('Aún no tienes pedidos')
      await expect(empty.locator('p')).toHaveText('Cuando hagas tu primer pedido podrás seguirlo aquí.')
      const cta = empty.getByRole('link', { name: 'Explorar comercios' })
      await expect(cta).toHaveCount(1)
      await expect(cta).toHaveCSS('background-color', 'rgb(0, 177, 157)')
      await expect(cta).toHaveCSS('color', INK)
      expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(56)
      expect(await overflow(page)).toBe(0)
      await cta.click()
      await expect(page).toHaveURL('/tiendas')
      await context.close()
    })
  }
})
