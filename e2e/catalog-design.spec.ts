import { test, expect, type Browser, type Page } from '@playwright/test'

const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const INK = 'rgb(11, 43, 51)'
const BG = 'rgb(255, 255, 255)'
const PRIMARY = 'rgb(0, 177, 157)'
const PRIMARY_LIP = 'rgb(0, 143, 125)'
const PRIMARY_TEXT = 'rgb(0, 121, 107)'

const zones = [
  { id: 1, slug: 'san-francisco', name: 'San Francisco', delivery_fee: 2.5, distance_km: 3.2, is_active: true },
  { id: 2, slug: 'bella-vista', name: 'Bella Vista', delivery_fee: 3, distance_km: 4.8, is_active: true },
  { id: 3, slug: 'obarrio', name: 'Obarrio', delivery_fee: 3.5, distance_km: 5.5, is_active: true },
]

const merchant = (code: string, name: string, type: string, extra: Record<string, unknown> = {}) => ({
  code,
  name,
  category_type: type,
  zone_slug: 'san-francisco',
  affiliation_status: 'activo',
  is_open: true,
  rating: 4.6,
  delivery_time: '25-35 min',
  opens_at: '08:00',
  closes_at: '21:00',
  description: 'Cocina casera, porciones generosas y entrega rápida en toda la zona.',
  icon: 'Soup',
  ...extra,
})

const merchants = [
  merchant('M-1', 'Fonda La Istmeña', 'Comida típica', { rating: 4.8 }),
  merchant('M-2', 'Verde Bistro', 'Saludable', { is_open: false, icon: 'Salad', rating: 4.9 }),
  merchant('M-3', 'Asados El Istmo', 'Comida típica', { icon: 'Drumstick', rating: 4.5, delivery_time: '30-40 min' }),
  merchant('M-4', 'Café Panamá', 'Cafetería', { icon: 'Coffee', rating: 4.7, delivery_time: '15-25 min' }),
  merchant('M-5', 'Pizzería Don Luigi', 'Pizzería', { icon: 'Pizza', rating: 4.4 }),
  merchant('M-6', 'Mariscos del Pacífico', 'Mariscos', { is_open: false, affiliation_status: 'en_revision', icon: 'Fish' }),
]

const product = (code: string, merchantCode: string, name: string, category: string, price: number, extra: Record<string, unknown> = {}) => ({
  code,
  merchant_code: merchantCode,
  name,
  category,
  price,
  promo_price: 0,
  is_available: true,
  description: 'Preparado al momento con ingredientes frescos del día.',
  ...extra,
})

const products = [
  product('P-1', 'M-1', 'Sancocho de gallina', 'Sopas', 6.5, { promo_price: 5.2 }),
  product('P-2', 'M-1', 'Ropa vieja con arroz', 'Platos fuertes', 8.75),
  product('P-3', 'M-1', 'Chicha de limón', 'Bebidas', 2),
  product('P-4', 'M-1', 'Tamal de olla', 'Platos fuertes', 4.25, { is_available: false }),
  product('P-5', 'M-2', 'Bowl de quinoa', 'Bowls', 7.9),
  product('P-6', 'M-2', 'Ensalada César', 'Ensaladas', 6.5, { promo_price: 5.5 }),
]

async function mockApi(page: Page) {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ contentType: 'image/png', body: TILE_PNG }))
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    if (path.startsWith('/zones')) return route.fulfill({ json: zones })
    if (path.startsWith('/merchants')) return route.fulfill({ json: merchants })
    if (path.startsWith('/catalog/products')) return route.fulfill({ json: products })
    return route.fulfill({ status: 401, json: { detail: 'No autenticado' } })
  })
}

async function open(page: Page, path: string, ready: string) {
  await mockApi(page)
  await page.goto(path)
  await expect(page.locator(ready).first()).toBeVisible()
  await expect(page.locator('[data-test="catalog-root"]')).toBeVisible()
}

const LIST_READY = '[data-test="merchant-card"]'
const DETAIL_READY = '[data-test="product-card"]'

async function newPage(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', ...options })
  return { context, page: await context.newPage() }
}

test.describe('catalog scope and cascade', () => {
  test('stores list: root background, Nunito headings and catalog ink (not the global h1 rule)', async ({ page }) => {
    await open(page, '/tiendas', LIST_READY)
    const root = page.locator('[data-test="catalog-root"]')
    await expect(root).toHaveCSS('background-color', BG)
    await expect(root).toHaveCSS('color', INK)
    for (const sel of ['h1', 'h2', '[data-test="merchant-card"] h3']) {
      const h = page.locator(sel).first()
      await expect(h, `${sel} color`).toHaveCSS('color', INK)
      await expect(h, `${sel} font`).toHaveCSS('font-family', /Nunito/)
    }
    await expect(page.locator('[data-test="stores-search"]')).toHaveCSS('font-family', /Inter/)
  })

  test('store detail: headings keep the catalog ink and Nunito', async ({ page }) => {
    await open(page, '/tiendas/M-1', DETAIL_READY)
    for (const sel of ['h1', 'h2', '[data-test="product-card"] h3']) {
      const h = page.locator(sel).first()
      await expect(h, `${sel} color`).toHaveCSS('color', INK)
      await expect(h, `${sel} font`).toHaveCSS('font-family', /Nunito/)
    }
  })

  for (const [name, opts] of [
    ['prefers-color-scheme: dark', { colorScheme: 'dark' as const }],
    ['light with html.dark', { colorScheme: 'light' as const }],
    ['dark scheme with html.dark', { colorScheme: 'dark' as const }],
  ] as const) {
    test(`${name} does not recolor the catalog`, async ({ browser }) => {
      const { context, page } = await newPage(browser, opts)
      await mockApi(page)
      if (name.includes('html.dark')) await page.addInitScript(() => document.documentElement.classList.add('dark'))
      await page.goto('/tiendas')
      await expect(page.locator(LIST_READY).first()).toBeVisible()
      const root = page.locator('[data-test="catalog-root"]')
      await expect(root).toHaveCSS('background-color', BG)
      await expect(page.locator('h1')).toHaveCSS('color', INK)
      await expect(page.locator('[data-test="stores-category"]').first()).toHaveCSS('background-color', PRIMARY)
      await page.goto('/tiendas/M-1')
      await expect(page.locator(DETAIL_READY).first()).toBeVisible()
      await expect(page.locator('[data-test="catalog-root"]')).toHaveCSS('background-color', BG)
      await expect(page.locator('h1')).toHaveCSS('color', INK)
      await context.close()
    })
  }
})

test.describe('layout', () => {
  for (const vp of [
    { width: 360, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    test(`no horizontal overflow at ${vp.width}x${vp.height} (list, detail, empty)`, async ({ browser }) => {
      const { context, page } = await newPage(browser, { viewport: vp })
      await mockApi(page)
      const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      await page.goto('/tiendas')
      await expect(page.locator(LIST_READY).first()).toBeVisible()
      expect(await overflow()).toBeLessThanOrEqual(0)
      await page.locator('[data-test="stores-search"]').fill('zzz')
      await expect(page.locator('[data-test="stores-empty"]')).toBeVisible()
      expect(await overflow()).toBeLessThanOrEqual(0)
      await page.goto('/tiendas/M-1')
      await expect(page.locator(DETAIL_READY).first()).toBeVisible()
      expect(await overflow()).toBeLessThanOrEqual(0)
      await page.goto('/tiendas/M-2')
      await expect(page.locator('[data-test="closed-merchant-notice"]')).toBeVisible()
      expect(await overflow()).toBeLessThanOrEqual(0)
      await context.close()
    })
  }
})

test.describe('targets, focus and primary button', () => {
  test('interactive controls on the list are at least 44px tall', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: { width: 360, height: 800 } })
    await open(page, '/tiendas', LIST_READY)
    const targets = page.locator('.cx-chip, .cx-segment button, .cx-input')
    const count = await targets.count()
    expect(count).toBeGreaterThan(6)
    for (let i = 0; i < count; i++) {
      // offsetHeight ignores the 220ms selected-chip pop (scale 0.94) that boundingBox would measure mid-animation.
      const height = await targets.nth(i).evaluate((el) => (el as HTMLElement).offsetHeight)
      expect(height, `target #${i}`).toBeGreaterThanOrEqual(44)
    }
    await context.close()
  })

  test('detail: chips, search, back and add buttons are at least 44px', async ({ page }) => {
    await open(page, '/tiendas/M-1', DETAIL_READY)
    const targets = page.locator('.cx-chip, .cx-input, .cx-btn')
    const count = await targets.count()
    expect(count).toBeGreaterThan(8)
    for (let i = 0; i < count; i++) {
      const size = await targets.nth(i).evaluate((el) => ({ h: (el as HTMLElement).offsetHeight, w: (el as HTMLElement).offsetWidth }))
      expect(size.h, `target #${i}`).toBeGreaterThanOrEqual(44)
      expect(size.w, `target #${i}`).toBeGreaterThanOrEqual(44)
    }
  })

  test('keyboard focus shows the 2px primary-text ring with 2px offset', async ({ page }) => {
    await open(page, '/tiendas', LIST_READY)
    await page.locator('[data-test="stores-category"]').nth(1).focus()
    await page.keyboard.press('Shift+Tab')
    await page.keyboard.press('Tab')
    const chip = page.locator('[data-test="stores-category"]').nth(1)
    await expect(chip).toBeFocused()
    await expect(chip).toHaveCSS('outline-style', 'solid')
    await expect(chip).toHaveCSS('outline-width', '2px')
    await expect(chip).toHaveCSS('outline-color', PRIMARY_TEXT)
    await expect(chip).toHaveCSS('outline-offset', '2px')
  })

  test('the primary button is dark on turquoise with the solid 4px lip; no white text on the primary fill anywhere', async ({ page }) => {
    await open(page, '/tiendas/M-1', DETAIL_READY)
    await page.locator('[data-test="add-to-cart"]').first().click()
    // Close the drawer by clicking the scrim so the floating primary button is visible.
    await page.mouse.click(10, 400)
    const fab = page.locator('.cx-fab')
    await expect(fab).toBeVisible()
    await expect(fab).toHaveCSS('background-color', PRIMARY)
    await expect(fab).toHaveCSS('color', INK)
    const shadow = await fab.evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).toContain(PRIMARY_LIP)
    expect(shadow).toMatch(/0px 4px 0px 0px/)
    const offenders = await page.evaluate(
      ({ primary }) =>
        [...document.querySelectorAll('.cx *')]
          .filter((el) => getComputedStyle(el).backgroundColor === primary && getComputedStyle(el).color === 'rgb(255, 255, 255)')
          .map((el) => el.className),
      { primary: PRIMARY },
    )
    expect(offenders).toEqual([])
  })

  test('selected chips are dark on the primary fill and carry a check icon', async ({ page }) => {
    await open(page, '/tiendas', LIST_READY)
    const selected = page.locator('.cx-chip-selected').first()
    await expect(selected).toHaveCSS('background-color', PRIMARY)
    await expect(selected).toHaveCSS('color', INK)
    await expect(selected.locator('svg')).toHaveCount(1)
  })
})

test.describe('closed merchant and promo', () => {
  test('a closed merchant card is disabled, aria-disabled, labelled with icon + text, and keyboard cannot open it', async ({ page }) => {
    await open(page, '/tiendas', LIST_READY)
    const closed = page.locator('[data-test="merchant-card"]', { hasText: 'Verde Bistro' })
    await expect(closed).toBeDisabled()
    await expect(closed).toHaveAttribute('aria-disabled', 'true')
    await expect(closed.locator('[data-test="merchant-status"]')).toHaveText('Cerrado')
    await expect(closed.locator('[data-test="merchant-status"] svg')).toHaveCount(1)
    await expect(closed).toHaveCSS('cursor', 'not-allowed')

    // Walk the whole tab order: the closed card is never a stop.
    const stops: string[] = []
    await page.locator('body').click({ position: { x: 1, y: 1 } })
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab')
      stops.push(await page.evaluate(() => (document.activeElement as HTMLElement)?.textContent?.trim().slice(0, 40) ?? ''))
    }
    expect(stops.some((s) => s.includes('Fonda La Istmeña'))).toBe(true)
    expect(stops.some((s) => s.includes('Verde Bistro'))).toBe(false)

    // Forcing focus and pressing Enter / Space does nothing.
    await closed.evaluate((el) => (el as HTMLElement).focus())
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(/\/tiendas$/)
  })

  test('an open merchant opens from the keyboard', async ({ page }) => {
    await open(page, '/tiendas', LIST_READY)
    await page.locator('[data-test="merchant-card"]', { hasText: 'Fonda La Istmeña' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/tiendas\/M-1$/)
  })

  test('closed store detail: notice, Cerrado badge and add buttons are disabled with icon + text', async ({ page }) => {
    await open(page, '/tiendas/M-2', DETAIL_READY)
    await expect(page.locator('[data-test="closed-merchant-notice"]')).toBeVisible()
    await expect(page.locator('[data-test="store-status"]')).toHaveText('Cerrado')
    const buttons = page.locator('[data-test="add-to-cart"]')
    const n = await buttons.count()
    expect(n).toBe(2)
    for (let i = 0; i < n; i++) {
      await expect(buttons.nth(i)).toBeDisabled()
      await expect(buttons.nth(i)).toHaveAttribute('aria-disabled', 'true')
      await expect(buttons.nth(i)).toHaveText('Cerrado')
      await expect(buttons.nth(i).locator('svg')).toHaveCount(1)
    }
  })

  test('promo product: struck-through list price, effective price and promo badge', async ({ page }) => {
    await open(page, '/tiendas/M-1', DETAIL_READY)
    const tile = page.locator('[data-test="product-card"]', { hasText: 'Sancocho de gallina' })
    await expect(tile.locator('[data-test="promo-badge"]')).toHaveText('Promo')
    await expect(tile.locator('[data-test="precio-efectivo"]')).toHaveText('B/ 5.20')
    await expect(tile.locator('[data-test="precio-regular"]')).toHaveText('B/ 6.50')
    await expect(tile.locator('[data-test="precio-regular"]')).toHaveCSS('text-decoration-line', 'line-through')
    await expect(tile.locator('[data-test="precio-efectivo"]')).toHaveCSS('font-variant-numeric', 'tabular-nums')
    await expect(tile.locator('[data-test="descuento"]')).toHaveText('-20%')
  })
})

test.describe('flat tiles', () => {
  test('tiles and chips have no shadow or border; radii come from the scale', async ({ page }) => {
    await open(page, '/tiendas', LIST_READY)
    const bad = await page.evaluate(() => {
      const allowed = new Set(['0px', '8px', '12px', '16px', '24px', '32px'])
      const out: string[] = []
      for (const el of document.querySelectorAll('.cx-tile, .cx-chip, .cx-badge, .cx-input')) {
        const cs = getComputedStyle(el)
        if (cs.boxShadow !== 'none') out.push(`${el.className} shadow ${cs.boxShadow}`)
        if (!el.classList.contains('cx-input') && parseFloat(cs.borderTopWidth) > 0) out.push(`${el.className} border`)
        const r = cs.borderTopLeftRadius
        if (!allowed.has(r) && parseFloat(r) < 999) out.push(`${el.className} radius ${r}`)
        if (cs.backdropFilter !== 'none' && cs.backdropFilter !== '') out.push(`${el.className} backdrop`)
      }
      return out
    })
    expect(bad).toEqual([])
  })
})
