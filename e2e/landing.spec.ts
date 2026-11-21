import { test, expect, type Page } from '@playwright/test'

const INK = 'rgb(11, 43, 51)'
const WHITE = 'rgb(255, 255, 255)'
const SURFACE = 'rgb(242, 247, 247)'

// 1x1 transparent PNG: keeps map tiles offline-safe.
const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

interface MerchantMock {
  id: number
  name: string
  category_type: string
  zone_slug: string
  affiliation_status: string
}

const merchants: MerchantMock[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: i + 1,
    name: `Comercio Activo ${i + 1}`,
    category_type: 'Restaurante',
    zone_slug: 'zona-uno',
    affiliation_status: 'activo',
  })),
  { id: 100, name: 'Comercio Inactivo', category_type: 'Farmacia', zone_slug: 'zona-uno', affiliation_status: 'suspendido' },
]

const zones = [
  { id: 1, slug: 'zona-uno', name: 'Zona Uno', is_active: true },
  { id: 2, slug: 'zona-dos', name: 'Zona Dos', is_active: true },
  { id: 3, slug: 'zona-vieja', name: 'Zona Inactiva', is_active: false },
]

async function mockApi(page: Page) {
  await page.route('**/api/v1/merchants/**', (route) => route.fulfill({ json: merchants }))
  await page.route('**/api/v1/zones/**', (route) => route.fulfill({ json: zones }))
}

async function mockTiles(page: Page) {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ contentType: 'image/png', body: TILE_PNG }))
}

async function openLanding(page: Page) {
  await mockApi(page)
  await mockTiles(page)
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
}

test.describe('cascade: nothing global recolors the landing', () => {
  async function expectLightLanding(page: Page) {
    await expect(page.locator('.landing h1')).toHaveCSS('color', INK)
    const h2s = page.locator('.landing h2:not(.lp-band-indigo h2)')
    const count = await h2s.count()
    expect(count).toBeGreaterThan(3)
    for (let i = 0; i < count; i++) {
      await expect(h2s.nth(i)).toHaveCSS('color', INK)
    }
    await expect(page.locator('.landing')).toHaveCSS('background-color', WHITE)
    await expect(page.locator('#cobertura')).toHaveCSS('background-color', SURFACE)
  }

  test('prefers-color-scheme: dark', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark', serviceWorkers: 'block' })
    const page = await context.newPage()
    await openLanding(page)
    await expectLightLanding(page)
    await context.close()
  })

  test('html.dark class', async ({ page }) => {
    await openLanding(page)
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expectLightLanding(page)
  })
})

test.describe('no horizontal overflow', () => {
  for (const size of [
    { width: 360, height: 800 },
    { width: 1440, height: 900 },
  ]) {
    test(`${size.width}x${size.height}`, async ({ page }) => {
      await page.setViewportSize(size)
      await openLanding(page)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})

test('landmarks', async ({ page }) => {
  await openLanding(page)
  await expect(page.locator('header')).toHaveCount(1)
  await expect(page.locator('main')).toHaveCount(1)
  await expect(page.locator('footer')).toHaveCount(1)
  await expect(page.locator('nav')).toHaveCount(1)
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(1)
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('footer nav')).toHaveCount(0)
})

test('skip link: Tab focuses it, Enter moves focus to main', async ({ page }) => {
  await openLanding(page)
  await page.keyboard.press('Tab')
  const skip = page.getByRole('link', { name: 'Saltar al contenido' })
  await expect(skip).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main#contenido')).toBeFocused()
})

test.describe('sticky navigation', () => {
  test('header stays at the top after scrolling', async ({ page }) => {
    await openLanding(page)
    await page.locator('#preguntas').scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2))
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(500)
    await expect.poll(async () => (await page.locator('header').boundingBox())?.y).toBe(0)
  })

  for (const id of ['como-funciona', 'cobertura', 'preguntas']) {
    test(`anchor #${id} lands below the header`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      await openLanding(page)
      await page.locator(`.landing nav a[href="#${id}"]`).click()
      const heading = page.locator(`#${id} h2`).first()
      await expect(heading).toBeInViewport()
      await expect
        .poll(async () => {
          const [h, header] = await Promise.all([heading.boundingBox(), page.locator('header').boundingBox()])
          return h && header ? h.y >= header.y + header.height : false
        })
        .toBe(true)
    })
  }
})
