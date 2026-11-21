import { test, expect, type Page } from '@playwright/test'

const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const ZONE_NAMES = [
  'San Francisco', 'Bella Vista', 'Obarrio', 'Condado del Rey', 'Costa del Este',
  'El Cangrejo', 'Marbella', 'Punta Pacífica', 'Albrook', 'Clayton',
]
const zones = ZONE_NAMES.map((name, i) => ({
  id: i + 1,
  slug: name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ /g, '-'),
  name,
  delivery_fee: 2.5 + i * 0.25,
  distance_km: 3 + i,
  is_active: true,
}))
const LAST_ZONE = zones[zones.length - 1]

function makeMerchants(zoneSlug: string, count: number) {
  const list = Array.from({ length: count }, (_, i) => ({
    code: `M-${zoneSlug}-${i + 1}`,
    name: `Comercio ${i + 1}`,
    category_type: 'Comida típica',
    zone_slug: zoneSlug,
    affiliation_status: 'activo',
    is_open: true,
    rating: 4.5,
    delivery_time: '25-35 min',
    opens_at: '08:00',
    closes_at: '21:00',
    description: 'Cocina casera, porciones generosas y entrega rápida en toda la zona.',
    icon: 'Soup',
  }))
  return list
}

async function mockApi(page: Page, merchants: unknown[], products: unknown[] = []) {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ contentType: 'image/png', body: TILE_PNG }))
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
    if (path.startsWith('/zones')) return route.fulfill({ json: zones })
    if (path.startsWith('/merchants')) return route.fulfill({ json: merchants })
    if (path.startsWith('/catalog/products')) return route.fulfill({ json: products })
    return route.fulfill({ status: 401, json: { detail: 'No autenticado' } })
  })
}

/** Group boxes into visual rows (same top within 2px) and report each row's width coverage. */
async function measureGrid(page: Page, containerSel: string, tileSel: string) {
  return page.evaluate(
    ([cSel, tSel]) => {
      const container = document.querySelector(cSel)!.getBoundingClientRect()
      const tiles = [...document.querySelectorAll(`${cSel} > ${tSel}`)].map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.left, y: r.top, w: r.width, h: r.height }
      })
      const rows: { top: number; tiles: typeof tiles }[] = []
      for (const t of tiles) {
        const row = rows.find((r) => Math.abs(r.top - t.y) <= 2)
        if (row) row.tiles.push(t)
        else rows.push({ top: t.y, tiles: [t] })
      }
      return {
        container: { x: container.left, w: container.width, gap: parseFloat(getComputedStyle(document.querySelector(cSel)!).columnGap) || 0 },
        rows: rows.map((r) => ({
          top: r.top,
          n: r.tiles.length,
          sumW: r.tiles.reduce((s, t) => s + t.w, 0),
          left: Math.min(...r.tiles.map((t) => t.x)),
          right: Math.max(...r.tiles.map((t) => t.x + t.w)),
          widths: r.tiles.map((t) => Math.round(t.w)),
        })),
      }
    },
    [containerSel, tileSel] as const,
  )
}

const GRID = '[data-test="merchant-grid"]'
const CELL = '*'

async function expectFullRows(page: Page, gridSel: string, cellSel: string, label: string, mobile = false) {
  const m = await measureGrid(page, gridSel, cellSel)
  const gap = m.container.gap
  for (const row of m.rows) {
    // sum of tile widths + gaps between tiles in the row must equal the container width
    const total = row.sumW + gap * (row.n - 1)
    const hole = Math.round(m.container.w - total)
    expect(Math.abs(hole), `${label}: row@${Math.round(row.top)} widths ${JSON.stringify(row.widths)} expected full row ${Math.round(m.container.w)}px, got hole of ${hole}px`).toBeLessThanOrEqual(1)
    expect(Math.abs(row.left - m.container.x), `${label}: row left edge`).toBeLessThanOrEqual(1)
    expect(Math.abs(row.right - (m.container.x + m.container.w)), `${label}: last tile right edge reaches container, hole ${Math.round(m.container.x + m.container.w - row.right)}px`).toBeLessThanOrEqual(1)
    if (mobile) expect(row.n, `${label}: mobile is one column`).toBe(1)
  }
  return m
}

const noHorizontalOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)

test.describe('catalog grid: no holes, count aware', () => {
  for (const count of [1, 2, 3, 4, 5, 6]) {
    test(`desktop 1440x900: ${count} merchant(s) fill every row`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await mockApi(page, makeMerchants('san-francisco', count))
      await page.goto('/tiendas')
      await expect(page.locator('[data-test="merchant-card"]')).toHaveCount(count)
      const m = await expectFullRows(page, GRID, CELL, `${count} merchants @1440`)
      const expectedRows = { 1: [1], 2: [2], 3: [3], 4: [2, 2], 5: [3, 2], 6: [3, 3] }[count]!
      expect(m.rows.map((r) => r.n), `${count} merchants row layout`).toEqual(expectedRows)
      expect(await noHorizontalOverflow(page)).toBe(true)
    })

    test(`mobile 360x800: ${count} merchant(s) in one column, no overflow`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 })
      await mockApi(page, makeMerchants('san-francisco', count))
      await page.goto('/tiendas')
      await expect(page.locator('[data-test="merchant-card"]')).toHaveCount(count)
      await expectFullRows(page, GRID, CELL, `${count} merchants @360`, true)
      expect(await noHorizontalOverflow(page)).toBe(true)
    })
  }

  for (const count of [1, 3]) {
    test(`tablet 800x900: ${count} merchant(s) fill every row`, async ({ page }) => {
      await page.setViewportSize({ width: 800, height: 900 })
      await mockApi(page, makeMerchants('san-francisco', count))
      await page.goto('/tiendas')
      await expect(page.locator('[data-test="merchant-card"]')).toHaveCount(count)
      await expectFullRows(page, GRID, CELL, `${count} merchants @800`)
    })
  }

  test('a single merchant is a wide horizontal hero tile (cover left, info right)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockApi(page, makeMerchants('san-francisco', 1))
    await page.goto('/tiendas')
    const card = page.locator('[data-test="merchant-card"]')
    const cover = await card.locator('.cx-cover').boundingBox()
    const body = await card.locator('.cx-merchant-body').boundingBox()
    expect(body!.x, 'info is right of the cover').toBeGreaterThanOrEqual(cover!.x + cover!.width - 1)
  })
})

test.describe('zone chip row', () => {
  test('the selected zone chip is fully visible inside the scroller after load and after selection', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await mockApi(page, makeMerchants(LAST_ZONE.slug, 3))
    await page.goto('/tiendas')
    // the mock leaves 'san-francisco' selected by default; pick the last zone through the UI
    const scroller = page.locator('[data-test="zone-scroller"]')
    const last = scroller.getByRole('button', { name: new RegExp(LAST_ZONE.name) })
    await last.scrollIntoViewIfNeeded()
    await last.click()
    await expect(page.locator('h1')).toHaveText(LAST_ZONE.name)
    await expect.poll(async () => {
      const s = await scroller.boundingBox()
      const c = await scroller.locator('.cx-chip-selected').boundingBox()
      return c!.x >= s!.x - 0.5 && c!.x + c!.width <= s!.x + s!.width + 0.5
    }).toBe(true)
  })

  test('the selected chip is inside the scroller on a narrow screen with a selected last zone on load', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await mockApi(page, makeMerchants('san-francisco', 3))
    await page.goto('/tiendas')
    const scroller = page.locator('[data-test="zone-scroller"]')
    await scroller.getByRole('button', { name: new RegExp(LAST_ZONE.name) }).click()
    await expect.poll(async () => {
      const s = await scroller.boundingBox()
      const c = await scroller.locator('.cx-chip-selected').boundingBox()
      return c!.x >= s!.x - 0.5 && c!.x + c!.width <= s!.x + s!.width + 0.5
    }).toBe(true)
  })

  test('scroll chevrons are >= 44px, labelled, keyboard operable and scroll the row', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await mockApi(page, makeMerchants('san-francisco', 3))
    await page.goto('/tiendas')
    const next = page.getByRole('button', { name: 'Ver más zonas' })
    await expect(next).toBeVisible()
    const box = await next.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(44)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    const scroller = page.locator('[data-test="zone-scroller"]')
    const before = await scroller.evaluate((el) => el.scrollLeft)
    await next.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before + 40)
    await expect(page.getByRole('button', { name: 'Ver zonas anteriores' })).toBeVisible()
  })

  test('chevrons are hidden when every zone fits', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ contentType: 'image/png', body: TILE_PNG }))
    await page.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
      if (path.startsWith('/zones')) return route.fulfill({ json: zones.slice(0, 2) })
      if (path.startsWith('/merchants')) return route.fulfill({ json: makeMerchants('san-francisco', 3) })
      if (path.startsWith('/catalog/products')) return route.fulfill({ json: [] })
      return route.fulfill({ status: 401, json: { detail: 'No autenticado' } })
    })
    await page.goto('/tiendas')
    await expect(page.locator('[data-test="merchant-card"]')).toHaveCount(3)
    await expect(page.getByRole('button', { name: 'Ver más zonas' })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Ver zonas anteriores' })).toBeHidden()
  })
})

const mkProducts = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    code: `P-${i + 1}`,
    merchant_code: 'M-1',
    name: `Producto ${i + 1}`,
    category: 'Platos',
    price: 5 + i,
    promo_price: 0,
    is_available: true,
    description: 'Preparado al momento con ingredientes frescos del día.',
  }))

test.describe('store detail product grid', () => {
  for (const count of [1, 2, 3, 4, 5]) {
    test(`desktop 1440x900: ${count} product(s) fill every row`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await mockApi(page, makeMerchants('san-francisco', 1).map((m) => ({ ...m, code: 'M-1' })), mkProducts(count))
      await page.goto('/tiendas/M-1')
      await expect(page.locator('[data-test="product-card"]')).toHaveCount(count)
      await expectFullRows(page, '[data-test="product-grid"]', '[data-test="product-card"]', `${count} products @1440`)
      expect(await noHorizontalOverflow(page)).toBe(true)
    })
  }

  for (const count of [1, 3]) {
    test(`mobile 360x800: ${count} product(s) in one column`, async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 })
      await mockApi(page, makeMerchants('san-francisco', 1).map((m) => ({ ...m, code: 'M-1' })), mkProducts(count))
      await page.goto('/tiendas/M-1')
      await expect(page.locator('[data-test="product-card"]')).toHaveCount(count)
      await expectFullRows(page, '[data-test="product-grid"]', '[data-test="product-card"]', `${count} products @360`, true)
      expect(await noHorizontalOverflow(page)).toBe(true)
    })
  }
})
