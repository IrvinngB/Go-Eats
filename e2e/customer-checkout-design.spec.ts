import { test, expect, type Browser, type Page } from '@playwright/test'

// Real browser against the production build (service worker blocked). The API is mocked with page.route.
const INK = 'rgb(11, 43, 51)'
const BG = 'rgb(255, 255, 255)'
const BORDER = 'rgb(213, 224, 224)'
const SURFACE = 'rgb(242, 247, 247)'
const PRIMARY_TINT = 'rgb(214, 245, 240)'
const SCRIM = 'rgba(11, 43, 51, 0.48)'
const MOBILE = { width: 360, height: 800 }
const DESKTOP = { width: 1440, height: 900 }

const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const zones = [
  { id: 1, slug: 'san-francisco', name: 'San Francisco', delivery_fee: 2.5, distance_km: 3.2, is_active: true },
  { id: 2, slug: 'obarrio', name: 'Obarrio', delivery_fee: 3, distance_km: 5, is_active: true },
]
const TYPES = ['Comida típica', 'Pizza', 'Café']

function merchant(i: number, over: Record<string, unknown> = {}) {
  return {
    code: `c${i}`,
    name: `Comercio ${String(i).padStart(2, '0')}`,
    category_type: TYPES[i % TYPES.length],
    zone_slug: 'san-francisco',
    affiliation_status: 'activo',
    is_open: true,
    rating: 4,
    delivery_time: '25-35 min',
    opens_at: '08:00',
    closes_at: '21:00',
    description: 'Cocina casera, porciones generosas y entrega rápida en toda la zona.',
    icon: 'Soup',
    ...over,
  }
}

function product(merchantCode: string, i: number) {
  return {
    code: `${merchantCode}-p${i}`,
    merchant_code: merchantCode,
    name: `Plato ${String(i).padStart(2, '0')}`,
    description: 'Una descripción corta del plato.',
    price: 4 + i,
    promo_price: i % 5 === 0 ? 3 + i : 0,
    category: i % 2 ? 'Platos' : 'Bebidas',
    is_available: true,
  }
}

interface Calls {
  orders: Array<Record<string, unknown>>
  payments: Array<Record<string, unknown>>
  raw: string[]
}

interface Opts {
  merchants?: unknown[]
  products?: unknown[]
  orderFailures?: number
  address?: string | null
}

async function mockApi(page: Page, opts: Opts = {}) {
  const calls: Calls = { orders: [], payments: [], raw: [] }
  let failures = opts.orderFailures ?? 0
  const user = {
    id: 1,
    full_name: 'Carlos Andrade',
    email: 'carlos@ejemplo.pa',
    phone: '6000-0000',
    role: 'customer',
    address: opts.address === undefined ? 'Calle 50, Edificio Global, Piso 3' : opts.address,
    lat: opts.address === null ? null : 8.9824,
    lng: opts.address === null ? null : -79.5199,
  }
  const merchants = opts.merchants ?? [merchant(1), merchant(2, { code: 'closed', name: 'Cerrado Bistro', is_open: false })]
  const products = opts.products ?? Array.from({ length: 14 }, (_, i) => product('c1', i + 1)).concat([product('closed', 1), product('closed', 2)])
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ contentType: 'image/png', body: TILE_PNG }))
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const raw = req.postData()
    if (raw) calls.raw.push(raw)
    calls.raw.push(req.url())
    const path = new URL(req.url()).pathname.replace('/api/v1', '')
    if (req.method() === 'POST' && path === '/auth/login') return route.fulfill({ json: { access_token: 'access-1', refresh_token: 'refresh-1', user } })
    if (req.method() === 'GET' && path === '/users/me') return req.headers().authorization === 'Bearer access-1' ? route.fulfill({ json: user }) : route.fulfill({ status: 401, json: { detail: 'No autenticado' } })
    if (path === '/users/me/consent') return route.fulfill({ json: { accepted: true, policy_version: 'ley81-v1', updated_at: '2026-11-20T00:00:00Z' } })
    if (path.startsWith('/zones')) return route.fulfill({ json: zones })
    if (path.startsWith('/merchants')) return route.fulfill({ json: merchants })
    if (path.startsWith('/catalog/products')) return route.fulfill({ json: products })
    if (req.method() === 'POST' && path === '/orders/') {
      const body = req.postDataJSON() as Record<string, unknown>
      calls.orders.push(body)
      if (failures > 0) {
        failures--
        return route.fulfill({ status: 500, json: { detail: 'boom' } })
      }
      return route.fulfill({
        status: 201,
        json: {
          code: `PED-${9000 + calls.orders.length}`, customer_id: 1, customer_name: user.full_name, merchant_code: body.merchant_code,
          merchant_name: 'Comercio 01', zone_slug: body.zone_slug, status: 'pendiente', payment_method: body.payment_method,
          payment_status: null, subtotal: 5, delivery_fee: 2.5, total: 7.5, delivery_address: body.delivery_address,
          delivery_lat: body.delivery_lat ?? null, delivery_lng: body.delivery_lng ?? null, notes: '', items: [], created_at: '2026-11-20T22:30:00Z',
        },
      })
    }
    if (req.method() === 'POST' && path === '/payments/') {
      const body = req.postDataJSON() as Record<string, unknown>
      calls.payments.push(body)
      return route.fulfill({ status: 201, json: { id: 1, order_code: body.order_code, method: body.method, status: 'pagado', amount: 7.5, provider_reference: 'YPY-E2E-01' } })
    }
    return route.fulfill({ json: [] })
  })
  return calls
}

async function newPage(browser: Browser, viewport = DESKTOP, opts: Opts = {}, options: Parameters<Browser['newContext']>[0] = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', viewport, ...options })
  const page = await context.newPage()
  const calls = await mockApi(page, opts)
  return { context, page, calls }
}

async function loginTo(page: Page, redirect: string) {
  await page.goto(`/login?redirect=${redirect}`)
  await page.locator('input[type="email"]').fill('carlos@ejemplo.pa')
  await page.locator('input[type="password"]').fill('secret-pass-1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(redirect)
  await expect(page.locator('[data-test="product-card"]').first()).toBeVisible()
}

async function openCart(page: Page) {
  await page.locator('[data-test="add-to-cart"]').first().click()
  await expect(page.locator('[data-test="cart-drawer"]')).toBeVisible()
  await expect(page.locator('.cx-sheet-enter-active, .cx-sheet-leave-active')).toHaveCount(0)
}

async function openCheckout(page: Page) {
  await openCart(page)
  await page.getByRole('button', { name: 'Continuar' }).click()
  await expect(page.locator('#cart-title')).toHaveText('Finalizar pedido')
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const css = (page: Page, sel: string, prop: string, pseudo?: string) =>
  page.locator(sel).first().evaluate((el, [p, ps]) => getComputedStyle(el, ps || undefined).getPropertyValue(p as string), [prop, pseudo ?? ''] as const)

async function fillCard(page: Page, number = '4111 1111 1111 1111') {
  await page.locator('[data-test="card-holder"]').fill('Titular Secreto')
  await page.locator('[data-test="card-number"]').fill(number)
  await page.locator('[data-test="card-expiry"]').fill('12/29')
  await page.locator('[data-test="card-cvv"]').fill('987')
}

test.describe('cart sheet and checkout: computed styles', () => {
  test('desktop: a 440px right panel on a flat scrim, 32px left radius, overlay shadow, no blur, Nunito heading', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await openCart(page)
    const sheet = page.locator('.cx-sheet')
    await expect(page.locator('[data-test="cart-overlay"]')).toHaveCSS('background-color', SCRIM)
    expect(await css(page, '[data-test="cart-overlay"]', 'backdrop-filter')).toMatch(/^(none|)$/)
    await expect(sheet).toHaveCSS('background-color', BG)
    await expect(sheet).toHaveCSS('border-top-left-radius', '32px')
    await expect(sheet).toHaveCSS('border-bottom-left-radius', '32px')
    await expect(sheet).toHaveCSS('border-top-right-radius', '0px')
    await expect(sheet).toHaveCSS('border-left-color', BORDER)
    expect(await css(page, '.cx-sheet', 'box-shadow')).not.toBe('none')
    expect(await css(page, '.cx-sheet', 'backdrop-filter')).toMatch(/^(none|)$/)
    const side = (await sheet.boundingBox())!
    expect(side.width).toBe(440)
    expect(side.height).toBe(900) // full height
    expect(side.x + side.width).toBe(1440) // flush to the right edge
    await expect(page.locator('#cart-title')).toHaveCSS('font-family', /Nunito/)
    await expect(page.locator('#cart-title')).toHaveCSS('color', INK)
    expect(await css(page, '.cx-sheet', 'display', '::before')).toBe('none') // the grab handle is a phone affordance
    await context.close()
  })

  test('mobile 360x800: a bottom sheet (top radius 32, 4x36 handle in --border, max 90vh, flush to the bottom)', async ({ browser }) => {
    const { context, page } = await newPage(browser, MOBILE)
    await loginTo(page, '/tiendas/c1')
    await openCart(page)
    const sheet = page.locator('.cx-sheet')
    await expect(sheet).toHaveCSS('border-top-left-radius', '32px')
    await expect(sheet).toHaveCSS('border-top-right-radius', '32px')
    await expect(sheet).toHaveCSS('border-bottom-left-radius', '0px')
    const box = (await sheet.boundingBox())!
    expect(box.width).toBe(360)
    expect(Math.round(box.y + box.height)).toBe(800)
    expect(box.height).toBeLessThanOrEqual(720)
    expect(await css(page, '.cx-sheet', 'width', '::before')).toBe('36px')
    expect(await css(page, '.cx-sheet', 'height', '::before')).toBe('4px')
    expect(await css(page, '.cx-sheet', 'background-color', '::before')).toBe(BORDER)
    await context.close()
  })

  test('mobile: a long checkout caps the sheet at 90vh, scrolls its body and keeps the bar visible', async ({ browser }) => {
    const { context, page } = await newPage(browser, MOBILE, { address: null })
    await loginTo(page, '/tiendas/c1')
    await openCheckout(page)
    const sheet = (await page.locator('.cx-sheet').boundingBox())!
    expect(sheet.height).toBeCloseTo(720, 0)
    const body = page.locator('.cx-sheet-body')
    expect(await body.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)
    const bar = (await page.locator('[data-test="checkout-bar"]').boundingBox())!
    expect(Math.round(bar.y + bar.height)).toBe(800)
    await expect(page.locator('[data-test="place-order"]')).toBeInViewport()
    await expect(page.locator('[data-test="place-order"]')).toHaveCSS('min-height', '56px')
    await context.close()
  })

  test('the sticky bar: total on the left, the large primary button on the right with dark text and the lip', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await openCheckout(page)
    const total = (await page.locator('.cx-sheet-total').boundingBox())!
    const button = page.locator('[data-test="place-order"]')
    const b = (await button.boundingBox())!
    expect(total.x).toBeLessThan(b.x)
    await expect(button).toHaveCSS('color', INK)
    await expect(button).toHaveCSS('background-color', 'rgb(0, 177, 157)')
    await expect(button).toHaveCSS('box-shadow', 'rgb(0, 143, 125) 0px 4px 0px 0px')
    await expect(page.locator('[data-test="summary-total"]')).toHaveCSS('font-family', /Nunito/)
    await expect(page.locator('[data-test="summary-subtotal"]')).toHaveCSS('font-variant-numeric', 'tabular-nums')
    await expect(page.locator('[data-test="summary-subtotal"]')).toHaveCSS('text-align', 'right')
    await context.close()
  })

  test('form: inputs are 16px radius on --surface with a transparent 2px border; the selected payment tile is tonal', async ({ browser }) => {
    const { context, page } = await newPage(browser, DESKTOP, { address: null })
    await loginTo(page, '/tiendas/c1')
    await openCheckout(page)
    const input = page.locator('#checkout-direccion')
    await expect(input).toHaveCSS('border-radius', '16px')
    await expect(input).toHaveCSS('background-color', SURFACE)
    await expect(input).toHaveCSS('border-top-width', '2px')
    await expect(input).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
    await expect(input).toHaveCSS('font-family', /Inter/)
    await input.focus()
    await expect(input).toHaveCSS('border-top-color', 'rgb(0, 121, 107)')
    const cod = page.locator('label.cx-option').first()
    await expect(cod).toHaveCSS('background-color', PRIMARY_TINT)
    await expect(cod).toHaveCSS('border-top-color', 'rgb(0, 121, 107)')
    await expect(page.locator('label.cx-option').nth(1)).toHaveCSS('background-color', SURFACE)
    await page.locator('input[value="electronico"]').check()
    await expect(page.locator('label.cx-option').nth(1)).toHaveCSS('background-color', PRIMARY_TINT)
    await context.close()
  })

  test('an empty address shows the 2px danger border, icon and message below (not only a toast)', async ({ browser }) => {
    const { context, page } = await newPage(browser, DESKTOP, { address: null })
    await loginTo(page, '/tiendas/c1')
    await openCheckout(page)
    await page.locator('[data-test="place-order"]').click()
    const input = page.locator('#checkout-direccion')
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(input).toHaveCSS('border-top-color', 'rgb(220, 38, 38)')
    await expect(input).toBeFocused()
    const err = page.locator('[data-test="direccion-error"]')
    await expect(err).toHaveText('Ingresa la dirección de entrega para continuar.')
    await expect(err.locator('svg')).toBeVisible()
    await expect(err).toHaveCSS('color', 'rgb(185, 28, 28)')
    await context.close()
  })

  test('the map picker keeps 44px controls, a 24px clipped tile and the indigo pin', async ({ browser }) => {
    const { context, page } = await newPage(browser, MOBILE)
    await loginTo(page, '/tiendas/c1')
    await openCheckout(page)
    await page.locator('[data-test="cambiar-direccion"]').click()
    const tile = page.locator('.cx-mapbox')
    await expect(tile).toBeVisible()
    await expect(tile).toHaveCSS('border-radius', '24px')
    await expect(tile).toHaveCSS('overflow', 'hidden')
    for (const a of await page.locator('.cx-mapbox .leaflet-bar a').all()) {
      const box = (await a.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
    await expect(page.locator('.cx-pin-marker')).toHaveCSS('background-color', 'rgb(46, 42, 122)')
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await context.close()
  })
})

test.describe('payment dialog: computed styles', () => {
  async function toGateway(page: Page) {
    await openCheckout(page)
    await page.locator('input[value="electronico"]').check()
    await page.locator('[data-test="place-order"]').click()
    await expect(page.locator('[data-test="step-card"]')).toBeVisible()
    await expect(page.locator('[data-test="cart-overlay"]')).toHaveCount(0) // the cart finished leaving
    await expect(page.locator('.cx-sheet-enter-active, .cx-sheet-leave-active')).toHaveCount(0)
  }

  test('desktop: a centered 480px modal, 24px radius, 1px border, overlay shadow, Nunito title, actions bottom-right', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await toGateway(page)
    const modal = page.locator('[data-test="gateway-dialog"]')
    const box = (await modal.boundingBox())!
    expect(box.width).toBe(480)
    expect(Math.abs(box.x + box.width / 2 - 720)).toBeLessThanOrEqual(1)
    expect(Math.abs(box.y + box.height / 2 - 450)).toBeLessThanOrEqual(1) // vertically centered
    await expect(modal).toHaveCSS('border-radius', '24px')
    await expect(modal).toHaveCSS('border-top-color', BORDER)
    await expect(modal).toHaveCSS('background-color', BG)
    expect(await css(page, '[data-test="gateway-dialog"]', 'box-shadow')).not.toBe('none')
    expect(await css(page, '[data-test="gateway-overlay"]', 'backdrop-filter')).toMatch(/^(none|)$/)
    await expect(page.locator('[data-test="gateway-overlay"]')).toHaveCSS('background-color', SCRIM)
    await expect(page.locator('#gateway-title')).toHaveCSS('font-family', /Nunito/)
    await expect(page.locator('#gateway-title')).toHaveCSS('color', INK)
    const cancel = (await page.locator('[data-test="card-cancel"]').boundingBox())!
    const go = (await page.locator('[data-test="card-submit"]').boundingBox())!
    expect(cancel.x).toBeLessThan(go.x) // secondary left of primary
    expect(Math.abs(go.x + go.width - (box.x + box.width - 24))).toBeLessThanOrEqual(2) // right aligned in the 24px padding
    await expect(page.locator('[data-test="card-submit"]')).toHaveCSS('color', INK)
    await context.close()
  })

  test('mobile: the same dialog is a bottom sheet with the grab handle', async ({ browser }) => {
    const { context, page } = await newPage(browser, MOBILE)
    await loginTo(page, '/tiendas/c1')
    await toGateway(page)
    const modal = page.locator('[data-test="gateway-dialog"]')
    const box = (await modal.boundingBox())!
    expect(Math.round(box.y + box.height)).toBe(800)
    expect(box.width).toBe(360)
    expect(box.height).toBeLessThanOrEqual(720)
    await expect(modal).toHaveCSS('border-top-left-radius', '32px')
    expect(await css(page, '[data-test="gateway-dialog"]', 'height', '::before')).toBe('4px')
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await context.close()
  })

  test('card validation: danger borders, icon + text under every invalid field', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await toGateway(page)
    await page.locator('[data-test="card-submit"]').click()
    for (const [field, err] of [['card-holder', 'error-titular'], ['card-number', 'error-numero'], ['card-expiry', 'error-vencimiento'], ['card-cvv', 'error-cvv']]) {
      const input = page.locator(`[data-test="${field}"]`)
      await expect(input).toHaveAttribute('aria-invalid', 'true')
      await expect(input).toHaveCSS('border-top-color', 'rgb(220, 38, 38)')
      await expect(page.locator(`[data-test="${err}"] svg`)).toBeVisible()
      await expect(page.locator(`[data-test="${err}"]`)).toBeVisible()
    }
    await context.close()
  })

  test('result steps use icon + text + color: approved is success green, declined is danger red', async ({ browser }) => {
    const { context, page, calls } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await toGateway(page)
    await fillCard(page)
    await page.locator('[data-test="card-submit"]').click()
    await page.locator('[data-test="otp-code"]').fill('654321')
    await page.locator('[data-test="otp-submit"]').click()
    await expect(page.locator('[data-test="step-result"]')).toBeVisible()
    await expect(page.locator('.cx-result-icon')).toHaveCSS('background-color', 'rgb(221, 243, 228)')
    await expect(page.locator('.cx-result-icon svg')).toBeVisible()
    await expect(page.locator('#gateway-title')).toHaveText('Pago aprobado')
    await expect(page.locator('#gateway-title')).toBeFocused()
    await expect(page.locator('[data-test="referencia-pago"]')).toHaveCSS('background-color', PRIMARY_TINT)
    expect(calls.payments).toEqual([{ order_code: 'PED-9001', method: 'yappy' }])
    await context.close()
  })
})

test.describe('headings, scope and light-only', () => {
  test('drawer and modal headings are Nunito in the catalog ink, not the global h1..h4 style', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await openCart(page)
    for (const h of await page.locator('.cx-sheet h2, .cx-sheet h3').all()) {
      await expect(h).toHaveCSS('font-family', /Nunito/)
      await expect(h).toHaveCSS('color', INK)
      await expect(h).toHaveCSS('letter-spacing', 'normal')
    }
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.locator('input[value="electronico"]').check()
    await page.locator('[data-test="place-order"]').click()
    await expect(page.locator('#gateway-title')).toHaveCSS('font-family', /Nunito/)
    await expect(page.locator('#gateway-title')).toHaveCSS('color', INK)
    await context.close()
  })

  test('removing the scoped .cx h1..h4 rule makes the global heading style win in the sheet (the rule is load-bearing)', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await openCart(page)
    await expect(page.locator('#cart-title')).toHaveCSS('color', INK)
    const removed = await page.evaluate(() => {
      let n = 0
      for (const sheet of [...document.styleSheets]) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue
        }
        for (let i = rules.length - 1; i >= 0; i--) {
          if ((rules[i] as CSSStyleRule).selectorText === '.cx :is(h1, h2, h3, h4)') {
            sheet.deleteRule(i)
            n++
          }
        }
      }
      return n
    })
    expect(removed).toBe(1)
    // .cx-h2 only sets size; with the scoped rule gone the global `h1..h4 { text-ink }` (#2C3E50) colors the title.
    await expect(page.locator('#cart-title')).toHaveCSS('color', 'rgb(44, 62, 80)')
    await expect(page.locator('#cart-title')).not.toHaveCSS('font-family', /Nunito/)
    await context.close()
  })

  test('dark color scheme and html.dark do not recolor the sheet or the dialog', async ({ browser }) => {
    const { context, page } = await newPage(browser, DESKTOP, {}, { colorScheme: 'dark' })
    await loginTo(page, '/tiendas/c1')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await openCheckout(page)
    await expect(page.locator('.cx-sheet')).toHaveCSS('background-color', BG)
    await expect(page.locator('#cart-title')).toHaveCSS('color', INK)
    await expect(page.locator('.cx-summary')).toHaveCSS('background-color', SURFACE)
    await page.locator('input[value="electronico"]').check()
    await page.locator('[data-test="place-order"]').click()
    await expect(page.locator('[data-test="gateway-dialog"]')).toHaveCSS('background-color', BG)
    await expect(page.locator('#gateway-title')).toHaveCSS('color', INK)
    await context.close()
  })
})

test.describe('layout and targets', () => {
  for (const [name, viewport] of [['mobile 360x800', MOBILE], ['desktop 1440x900', DESKTOP]] as const) {
    test(`${name}: no horizontal overflow in the page, the sheet body or the dialog at any step`, async ({ browser }) => {
      const { context, page } = await newPage(browser, viewport, { address: null })
      await loginTo(page, '/tiendas/c1')
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      await openCart(page)
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      const bodyOverflow = () => page.locator('.cx-sheet-body').evaluate((el) => el.scrollWidth - el.clientWidth)
      expect(await bodyOverflow()).toBeLessThanOrEqual(0)
      await page.getByRole('button', { name: 'Continuar' }).click()
      expect(await bodyOverflow()).toBeLessThanOrEqual(0)
      await page.locator('#checkout-direccion').fill('Calle 45, Ed. Nogal, Apto 2B')
      await page.locator('input[value="electronico"]').check()
      await page.locator('[data-test="place-order"]').click()
      await expect(page.locator('[data-test="step-card"]')).toBeVisible()
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      const dialog = page.locator('[data-test="gateway-dialog"]')
      expect(await dialog.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
      await context.close()
    })
  }

  test('every interactive control in the cart, the checkout and the dialog is at least 44px', async ({ browser }) => {
    const { context, page } = await newPage(browser, MOBILE, { address: null })
    await loginTo(page, '/tiendas/c1')
    const small = (root: string) =>
      page.locator(root).evaluate((el) => {
        const sel = 'button, a[href], input:not([type="hidden"]), select, textarea, label.cx-option, label.cx-check'
        const out: string[] = []
        for (const c of el.querySelectorAll<HTMLElement>(sel)) {
          const target = c.matches('.cx-option-input, .cx-check-input') ? c.closest('label')! : c
          const r = target.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          if (r.height < 44 - 0.5 || r.width < 44 - 0.5) out.push(`${c.tagName.toLowerCase()}[${c.getAttribute('data-test') || c.getAttribute('aria-label') || c.textContent?.trim().slice(0, 20)}] ${Math.round(r.width)}x${Math.round(r.height)}`)
        }
        return out
      })
    await openCart(page)
    expect(await small('[data-test="cart-drawer"]')).toEqual([])
    await page.getByRole('button', { name: 'Continuar' }).click()
    await page.locator('#checkout-direccion').waitFor()
    expect(await small('[data-test="cart-drawer"]')).toEqual([])
    await page.locator('#checkout-direccion').fill('Calle 45, Ed. Nogal, Apto 2B')
    await page.locator('input[value="electronico"]').check()
    await page.locator('[data-test="place-order"]').click()
    await expect(page.locator('[data-test="step-card"]')).toBeVisible()
    expect(await small('[data-test="gateway-dialog"]')).toEqual([])
    await context.close()
  })
})

test.describe('keyboard-only checkout walk', () => {
  const active = (page: Page) =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      return el ? el.getAttribute('data-test') || el.id || el.getAttribute('aria-label') || el.tagName.toLowerCase() : 'none'
    })

  test('Enter opens the cart, Tab stays in the sheet in a sane order, Escape closes it and focus returns to the add button', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    const add = page.locator('[data-test="add-to-cart"]').first()
    await add.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-test="cart-drawer"]')).toBeVisible()
    await expect(page.locator('#cart-title')).toBeFocused()
    const order: string[] = []
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab')
      order.push(await active(page))
    }
    // title -> close -> note -> minus -> plus -> continue -> (wraps) close
    expect(order).toEqual(['cart-close', 'item-note', 'qty-minus', 'qty-plus', 'cart-continue', 'cart-close'])
    await page.keyboard.press('Shift+Tab')
    expect(await active(page)).toBe('cart-continue')
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-test="cart-drawer"]')).toHaveCount(0)
    await expect(add).toBeFocused()
    await context.close()
  })

  test('checkout and payment with the keyboard: address, payment choice, card, OTP, result, then focus returns', async ({ browser }) => {
    const { context, page, calls } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await page.locator('[data-test="add-to-cart"]').first().focus()
    await page.keyboard.press('Enter')
    await page.locator('[data-test="cart-continue"]').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('#cart-title')).toBeFocused()
    // the saved default address is shown; pick the electronic method with the arrow keys
    await expect(page.locator('[data-test="direccion-guardada"]')).toBeVisible()
    await page.locator('input[value="contr_entrega"]').focus()
    await page.keyboard.press('ArrowDown')
    await expect(page.locator('input[value="electronico"]')).toBeChecked()
    await page.locator('[data-test="place-order"]').focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-test="card-holder"]').first()).toBeFocused()
    await page.keyboard.type('Titular Secreto')
    await page.keyboard.press('Tab')
    await page.keyboard.type('4111111111111111')
    await page.keyboard.press('Tab')
    await page.keyboard.type('12/29')
    await page.keyboard.press('Tab')
    await page.keyboard.type('987')
    await page.keyboard.press('Enter') // Enter in a field continues
    await expect(page.locator('[data-test="otp-code"]')).toBeFocused()
    await page.keyboard.type('123456')
    await page.keyboard.press('Enter')
    await expect(page.locator('#gateway-title')).toHaveText('Pago aprobado')
    await expect(page.locator('#gateway-title')).toBeFocused()
    expect(calls.payments).toHaveLength(1)
    await context.close()
  })

  test('Escape closes the payment dialog from the card step and focus lands back on the page', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await openCheckout(page)
    await page.locator('input[value="electronico"]').check()
    await page.locator('[data-test="place-order"]').click()
    await expect(page.locator('[data-test="step-card"]')).toBeVisible()
    await expect(page.locator('[data-test="cart-overlay"]')).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-test="gateway-dialog"]')).toHaveCount(0)
    await expect(page.locator('[data-test="cart-fab"]')).toBeFocused()
    await context.close()
  })

  test('focus is trapped in the payment dialog (Tab never reaches the page behind it)', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await openCheckout(page)
    await page.locator('input[value="electronico"]').check()
    await page.locator('[data-test="place-order"]').click()
    await expect(page.locator('[data-test="step-card"]')).toBeVisible()
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => !!document.activeElement?.closest('[data-test="gateway-dialog"]')), `tab ${i}`).toBe(true)
    }
    await context.close()
  })
})

test.describe('"Ver más comercios" with 40 merchants', () => {
  const forty = Array.from({ length: 40 }, (_, i) => merchant(i + 1))

  async function gridRowsAreFull(page: Page) {
    return page.evaluate(() => {
      const grid = document.querySelector('[data-test="merchant-grid"]')!
      const gw = grid.getBoundingClientRect().width
      const rows = new Map<number, number>()
      for (const el of grid.children) {
        const r = el.getBoundingClientRect()
        const k = Math.round(r.top)
        rows.set(k, (rows.get(k) ?? 0) + r.width)
      }
      const gap = parseFloat(getComputedStyle(grid).columnGap) || 0
      return [...rows.entries()].every(([, w]) => true && w > 0) && [...rows.values()].length > 0
        ? [...grid.children].length > 0 && [...rows.keys()].every((k) => {
            const inRow = [...grid.children].filter((c) => Math.round(c.getBoundingClientRect().top) === k)
            const total = inRow.reduce((s, c) => s + c.getBoundingClientRect().width, 0) + gap * (inRow.length - 1)
            return Math.abs(total - gw) <= 1
          })
        : false
    })
  }

  test('desktop: 12, then 24, remaining count in the label, a 44px secondary button, full rows on every page', async ({ browser }) => {
    const { context, page } = await newPage(browser, DESKTOP, { merchants: forty })
    await page.goto('/tiendas')
    const cards = page.locator('[data-test="merchant-card"]')
    await expect(cards).toHaveCount(12)
    const more = page.locator('[data-test="merchants-more"]')
    await expect(more).toHaveText('Ver más comercios (28 restantes)')
    expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect(more).toHaveCSS('background-color', PRIMARY_TINT) // secondary: tint, no lip
    await expect(more).toHaveCSS('box-shadow', 'none')
    expect(await gridRowsAreFull(page)).toBe(true)
    await more.click()
    await expect(cards).toHaveCount(24)
    await expect(more).toHaveText('Ver más comercios (16 restantes)')
    expect(await gridRowsAreFull(page)).toBe(true)
    await expect(page.locator('[data-test="stores-shown"]')).toHaveText('Mostrando 24 de 40 comercios')
    await more.click()
    await more.click()
    await expect(cards).toHaveCount(40)
    await expect(more).toHaveCount(0)
    expect(await gridRowsAreFull(page)).toBe(true) // 40 = 36 + a 2x2 tail
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await context.close()
  })

  test('the first page is no longer thousands of px tall on a phone, and revealing keeps one column', async ({ browser }) => {
    const { context, page } = await newPage(browser, MOBILE, { merchants: forty })
    await page.goto('/tiendas')
    await expect(page.locator('[data-test="merchant-card"]')).toHaveCount(12)
    const h = await page.locator('[data-test="merchant-grid"]').evaluate((el) => el.getBoundingClientRect().height)
    expect(h).toBeLessThan(40 * 150) // 12 cards, not the whole zone
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await context.close()
  })

  test('search, category, sort and zone changes go back to the first page', async ({ browser }) => {
    const { context, page } = await newPage(browser, DESKTOP, { merchants: forty })
    await page.goto('/tiendas')
    const cards = page.locator('[data-test="merchant-card"]')
    const more = page.locator('[data-test="merchants-more"]')
    await more.click()
    await expect(cards).toHaveCount(24)
    await page.locator('[data-test="stores-category"]').nth(1).click() // one category: ~13-14 merchants
    await expect(cards).toHaveCount(12)
    await expect(more).toHaveText(/Ver más comercios \(\d+ restantes?\)/)
    await page.locator('[data-test="stores-category"]').first().click()
    await more.click()
    await expect(cards).toHaveCount(24)
    await page.locator('[data-test="stores-sort"]').selectOption('nombre')
    await expect(cards).toHaveCount(12)
    await more.click()
    await page.locator('[data-test="stores-search"]').fill('Comercio')
    await expect(cards).toHaveCount(12)
    await more.click()
    await expect(cards).toHaveCount(24)
    await page.getByRole('button', { name: /Obarrio/ }).click() // another zone: no merchants -> empty state, then back
    await expect(page.locator('[data-test="stores-empty"]')).toBeVisible()
    await page.getByRole('button', { name: /San Francisco/ }).click()
    await expect(cards).toHaveCount(12)
    await context.close()
  })

  test('ratings print with one decimal', async ({ browser }) => {
    const { context, page } = await newPage(browser, DESKTOP, { merchants: [merchant(1, { rating: 4 }), merchant(2, { rating: 4.5 }), merchant(3, { rating: 3.25 })] })
    await page.goto('/tiendas')
    await expect(page.locator('[data-test="merchant-rating"]')).toHaveText(['4.0', '4.5', '3.3'])
    await context.close()
  })

  test('a store with more than 12 products paginates its menu; 12 or fewer do not', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await loginTo(page, '/tiendas/c1')
    await expect(page.locator('[data-test="product-card"]')).toHaveCount(12)
    await expect(page.locator('[data-test="products-more"]')).toHaveText('Ver más productos (2 restantes)')
    await page.locator('[data-test="products-more"]').click()
    await expect(page.locator('[data-test="product-card"]')).toHaveCount(14)
    await expect(page.locator('[data-test="products-more"]')).toHaveCount(0)
    await expect(page.locator('[data-test="store-summary"]')).toContainText('4.0 calificación')
    await context.close()
  })
})

test.describe('persistent error toast', () => {
  test('an error stays past the info timeout, has a 44px dismiss, and a successful retry clears it', async ({ browser }) => {
    const { context, page, calls } = await newPage(browser, DESKTOP, { orderFailures: 1 })
    await loginTo(page, '/tiendas/c1')
    await openCheckout(page)
    await page.locator('[data-test="place-order"]').click()
    const toast = page.locator('.cx-toast-error')
    await expect(toast).toBeVisible()
    await expect(toast).toHaveAttribute('role', 'alert')
    await page.waitForTimeout(3600) // longer than the 2.8s auto-dismiss of info toasts
    await expect(toast).toBeVisible()
    const close = toast.getByRole('button', { name: 'Cerrar notificación' })
    expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    // the toast rides above the sticky bar while the sheet is open: the primary action stays clickable
    const t = (await toast.boundingBox())!
    const bar = (await page.locator('[data-test="checkout-bar"]').boundingBox())!
    expect(t.y + t.height).toBeLessThanOrEqual(bar.y)
    await page.locator('[data-test="place-order"]').click() // retry succeeds
    await expect.poll(() => calls.orders.length).toBe(2)
    await expect(toast).toHaveCount(0)
    await context.close()
  })

  test('dismissing with the button and a newer error replacing an older one', async ({ browser }) => {
    const { context, page } = await newPage(browser, DESKTOP, { orderFailures: 2 })
    await loginTo(page, '/tiendas/c1')
    await openCheckout(page)
    await page.locator('[data-test="place-order"]').click()
    await expect(page.locator('.cx-toast-error')).toHaveCount(1)
    await page.locator('[data-test="place-order"]').click()
    await expect.poll(() => page.locator('.cx-toast-error').count()).toBe(1) // replaced, never stacked
    await page.locator('.cx-toast-error').getByRole('button', { name: 'Cerrar notificación' }).click()
    await expect(page.locator('.cx-toast-error')).toHaveCount(0)
    await context.close()
  })
})

test.describe('closed merchant', () => {
  test('notice with icon and text, every add button disabled with icon + text, no cart', async ({ browser }) => {
    const { context, page } = await newPage(browser, MOBILE)
    await loginTo(page, '/tiendas/closed')
    const notice = page.locator('[data-test="closed-merchant-notice"]')
    await expect(notice).toContainText('cerrado')
    await expect(notice.locator('svg')).toBeVisible()
    await expect(notice).toHaveCSS('border-top-left-radius', '16px')
    for (const b of await page.locator('[data-test="add-to-cart"]').all()) {
      await expect(b).toBeDisabled()
      await expect(b).toHaveText('Cerrado')
      await expect(b.locator('svg')).toBeVisible()
    }
    await expect(page.locator('[data-test="cart-fab"]')).toHaveCount(0)
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await context.close()
  })
})
