import { test, expect, type Page } from '@playwright/test'

const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const merchants = [
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

async function mockTiles(page: Page) {
  await page.route(/basemaps\.cartocdn\.com/, (route) => route.fulfill({ contentType: 'image/png', body: TILE_PNG }))
}

async function mockApi(page: Page) {
  await page.route('**/api/v1/merchants/**', (route) => route.fulfill({ json: merchants }))
  await page.route('**/api/v1/zones/**', (route) => route.fulfill({ json: zones }))
}

test('reduced motion: auto scroll behavior and nothing animating', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' })
  const page = await context.newPage()
  await mockApi(page)
  await page.goto('/')
  await expect(page.locator('h1')).toBeVisible()
  await expect(page.locator('html')).toHaveCSS('scroll-behavior', 'auto')
  await expect
    .poll(() =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((a) => a.playState === 'running')
          .filter((a) => {
            const target = (a.effect as KeyframeEffect | null)?.target
            return target instanceof Element && target.closest('.landing') !== null
          })
          .map((a) => a.id || a.constructor.name),
      ),
    )
    .toEqual([])
  await context.close()
})

test.describe('API states', () => {
  test('fulfilled: active stores capped at 6 and active zone chips only', async ({ page }) => {
    await mockApi(page)
    await mockTiles(page)
    await page.goto('/')
    const tiles = page.locator('[data-test="store-tile"]')
    await expect(tiles).toHaveCount(6)
    await expect(page.getByText('Comercio Inactivo')).toHaveCount(0)
    await expect(tiles.first()).toContainText('Comercio Activo 1')
    await expect(tiles.last()).toContainText('Comercio Activo 6')
    await expect(page.locator('[data-test="zone-chip"]')).toHaveText(['Zona Uno', 'Zona Dos'])
  })

  test('aborted: static fallback, no crash, no toast or alert', async ({ page }) => {
    const pageErrors: Error[] = []
    page.on('pageerror', (e) => pageErrors.push(e))
    await page.route('**/api/v1/merchants/**', (route) => route.abort())
    await page.route('**/api/v1/zones/**', (route) => route.abort())
    await page.goto('/')
    await expect(page.locator('[data-test="stores-fallback"]')).toBeVisible()
    await expect(page.locator('[data-test="coverage-fallback"]')).toBeVisible()
    await expect(page.locator('[data-test="store-tile"]')).toHaveCount(0)
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: /\S/ })).toHaveCount(0)
    expect(pageErrors).toEqual([])
  })

  test('delayed response: loading skeleton with aria-busy', async ({ page }) => {
    await page.route('**/api/v1/merchants/**', async (route) => {
      await new Promise((r) => setTimeout(r, 6000))
      await route.fulfill({ json: merchants }).catch(() => {})
    })
    await page.route('**/api/v1/zones/**', async (route) => {
      await new Promise((r) => setTimeout(r, 6000))
      await route.fulfill({ json: zones }).catch(() => {})
    })
    await page.goto('/')
    await expect(page.locator('#tiendas [aria-busy="true"]')).toBeVisible()
    await expect(page.locator('[data-test="store-skeleton"]')).toHaveCount(3)
    await expect(page.locator('[data-test="store-tile"]')).toHaveCount(0)
  })
})

test.describe('coverage map', () => {
  test('lazy: nothing before #cobertura, loads after, caption visible, no dialog', async ({ page }) => {
    const requests: string[] = []
    const dialogs: string[] = []
    page.on('request', (r) => requests.push(r.url()))
    page.on('dialog', (d) => {
      dialogs.push(d.message())
      void d.dismiss()
    })
    await mockApi(page)
    await mockTiles(page)
    await page.goto('/')
    await expect(page.locator('[data-test="store-tile"]')).toHaveCount(6)

    expect(requests.filter((u) => /CoverageMap/.test(u))).toEqual([])
    expect(requests.filter((u) => /cartocdn\.com/.test(u))).toEqual([])

    await page.locator('#cobertura').scrollIntoViewIfNeeded()
    await expect.poll(() => requests.some((u) => /CoverageMap/.test(u))).toBe(true)
    await expect.poll(() => requests.some((u) => /cartocdn\.com/.test(u))).toBe(true)
    await expect(page.locator('[data-test="map-attribution"]')).toContainText('OpenStreetMap')
    await expect(page.locator('[data-test="map-attribution"]')).toContainText('CARTO')
    await expect(page.locator('[data-test="map-attribution"]')).toBeVisible()
    expect(dialogs).toEqual([])
  })

  test('no geolocation prompt: permission is never requested', async ({ browser }) => {
    // Denied permission would surface as a call to getCurrentPosition; spy on it instead.
    const context = await browser.newContext({ serviceWorkers: 'block' })
    await context.addInitScript(() => {
      const w = window as unknown as { __geo: number }
      w.__geo = 0
      const geo = navigator.geolocation
      for (const m of ['getCurrentPosition', 'watchPosition'] as const) {
        const original = geo[m].bind(geo)
        ;(geo as unknown as Record<string, unknown>)[m] = (...args: unknown[]) => {
          w.__geo++
          return (original as (...a: unknown[]) => unknown)(...args)
        }
      }
    })
    const page = await context.newPage()
    await mockApi(page)
    await mockTiles(page)
    await page.goto('/')
    await page.locator('#cobertura').scrollIntoViewIfNeeded()
    await expect(page.locator('[data-test="map-attribution"]')).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __geo: number }).__geo)).toBe(0)
    await context.close()
  })
})

test('FAQ: one open at a time, aria-expanded follows, keyboard works', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  const triggers = page.locator('#preguntas button[aria-expanded]')
  await expect(triggers.first()).toBeVisible()
  expect(await triggers.count()).toBeGreaterThan(2)
  await expect(page.locator('#preguntas button[aria-expanded="true"]')).toHaveCount(0)

  await triggers.first().focus()
  await page.keyboard.press('Enter')
  await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'true')

  await page.keyboard.press('Tab')
  await expect(triggers.nth(1)).toBeFocused()
  await page.keyboard.press('Space')
  await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true')
  await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'false')
  await expect(page.locator('#preguntas button[aria-expanded="true"]')).toHaveCount(1)

  await page.keyboard.press('Space')
  await expect(page.locator('#preguntas button[aria-expanded="true"]')).toHaveCount(0)
})

test('install: beforeinstallprompt shows the section button and no floating banner', async ({ page }) => {
  await mockApi(page)
  await page.addInitScript(() => {
    window.addEventListener('DOMContentLoaded', () => {
      const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> }
      e.prompt = () => Promise.resolve()
      e.userChoice = Promise.resolve({ outcome: 'dismissed' })
      window.dispatchEvent(e)
    })
  })
  await page.goto('/')
  await expect(page.locator('#instalar button')).toBeVisible()
  await expect(page.locator('#instalar button')).toHaveText(/\S/)
  // The floating banner has its own "Instalar" button; exactly one install button on the page means it is hidden.
  await expect(page.getByRole('button', { name: /^Instalar/ })).toHaveCount(1)
  await expect(page.getByText('Instalar Go Eats', { exact: true })).toHaveCount(1)
})
