import { test, expect, type Browser, type Page } from '@playwright/test'

// Real browser against the production build (service worker blocked). The API is mocked with page.route.
const INK = 'rgb(11, 43, 51)'
const BG = 'rgb(255, 255, 255)'
const SURFACE = 'rgb(242, 247, 247)'
const SURFACE_STRONG = 'rgb(227, 238, 238)'
const BORDER = 'rgb(213, 224, 224)'
const PRIMARY = 'rgb(0, 177, 157)'
const PRIMARY_LIP = 'rgb(0, 143, 125)'
const PRIMARY_TEXT = 'rgb(0, 121, 107)'
const PRIMARY_TINT = 'rgb(214, 245, 240)'
const INDIGO = 'rgb(46, 42, 122)'
const DANGER = 'rgb(220, 38, 38)'
const WHITE = 'rgb(255, 255, 255)'

type Role = 'customer' | 'merchant'
const NAMES: Record<Role, string> = { customer: 'Carlos Andrade', merchant: 'Hector Endara' }
const user = (role: Role) => ({ id: 1, full_name: NAMES[role], email: `${role}@ejemplo.pa`, phone: '6000-0000', role })

interface Mock {
  role: Role
  loginFails: boolean
  putStatus: number
}

async function mockApi(page: Page, state: Mock = { role: 'customer', loginFails: false, putStatus: 200 }) {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 204 }))
  await page.route('**/api/v1/**', (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace('/api/v1', '')
    if (req.method() === 'POST' && path === '/auth/login') {
      return state.loginFails
        ? route.fulfill({ status: 401, json: { detail: 'Credenciales inválidas.' } })
        : route.fulfill({ json: { access_token: 'access-1', refresh_token: 'refresh-1', user: user(state.role) } })
    }
    if (path === '/users/me') {
      if (req.method() === 'PUT') {
        return state.putStatus === 200
          ? route.fulfill({ json: user(state.role) })
          : route.fulfill({ status: state.putStatus, json: { detail: 'Dato inválido.' } })
      }
      return req.headers().authorization === 'Bearer access-1'
        ? route.fulfill({ json: user(state.role) })
        : route.fulfill({ status: 401, json: { detail: 'No autenticado' } })
    }
    if (path.startsWith('/zones')) return route.fulfill({ json: [{ id: 1, slug: 'san-francisco', name: 'San Francisco', delivery_fee: 2.5, distance_km: 3.2, is_active: true }] })
    return route.fulfill({ json: [] })
  })
  return state
}

async function newPage(browser: Browser, options: Parameters<Browser['newContext']>[0] = {}, state?: Mock) {
  const context = await browser.newContext({ serviceWorkers: 'block', ...options })
  const page = await context.newPage()
  const mock = await mockApi(page, state)
  return { context, page, mock }
}

async function loginAs(page: Page, mock: Mock, role: Role) {
  mock.role = role
  await page.goto('/login')
  await page.locator('input[type="email"]').fill(`${role}@ejemplo.pa`)
  await page.locator('input[type="password"]').fill('secret-pass-1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(role === 'customer' ? /\/tiendas$/ : /\/panel-comercio$/)
  await expect(page.locator('[data-test="account-trigger"]')).toBeVisible()
  // The page transition keeps the leaving login view in the DOM for a moment.
  await expect(page.locator('.cx-login')).toHaveCount(0)
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const MOBILE = { width: 360, height: 800 }
const DESKTOP = { width: 1440, height: 900 }

test.describe('login: scope, cascade and styles', () => {
  test('page, hero and form tiles use the catalog tokens', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: DESKTOP })
    await page.goto('/login')
    await expect(page.locator('.cx-login')).toHaveCSS('background-color', SURFACE)
    await expect(page.locator('.cx-login-hero')).toHaveCSS('background-color', INDIGO)
    await expect(page.locator('.cx-login-hero')).toHaveCSS('border-radius', '32px')
    await expect(page.locator('.cx-login-form')).toHaveCSS('background-color', BG)
    await expect(page.locator('.cx-login-form')).toHaveCSS('border-radius', '32px')
    // Hero heading keeps white on indigo; form heading is Nunito in the catalog ink (not the global rule).
    await expect(page.locator('h1')).toHaveCSS('color', WHITE)
    await expect(page.locator('h1')).toHaveCSS('font-family', /Nunito/)
    await expect(page.locator('h2')).toHaveCSS('color', INK)
    await expect(page.locator('h2')).toHaveCSS('font-family', /Nunito/)
    await expect(page.locator('input[type="email"]')).toHaveCSS('font-family', /Inter/)
    await context.close()
  })

  test('removing the scoped h1..h4 rule makes the global heading style win (proves the rule is load-bearing)', async ({ browser }) => {
    const { context, page } = await newPage(browser)
    await page.goto('/login')
    const h2 = page.locator('h2')
    await expect(h2).toHaveCSS('color', INK)
    await expect(h2).toHaveCSS('font-family', /Nunito/)
    const removed = await page.evaluate(() => {
      let n = 0
      for (const sheet of [...document.styleSheets]) {
        let rules: CSSRuleList
        try {
          rules = sheet.cssRules
        } catch {
          continue // cross-origin stylesheet (Google Fonts)
        }
        for (let i = rules.length - 1; i >= 0; i--) {
          const r = rules[i] as CSSStyleRule
          if (r.selectorText === '.cx :is(h1, h2, h3, h4)') {
            sheet.deleteRule(i)
            n++
          }
        }
      }
      return n
    })
    expect(removed).toBe(1)
    // Global `h1..h4 { text-ink }` (#2C3E50) now colors the heading and the Nunito family is gone.
    await expect(h2).toHaveCSS('color', 'rgb(44, 62, 80)')
    await expect(h2).not.toHaveCSS('font-family', /Nunito/)
    await context.close()
  })

  test('inputs: 52px, 16px radius, surface fill, 2px transparent border; focus swaps to a 2px primary-text border on --bg', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: MOBILE })
    await page.goto('/login')
    const email = page.locator('input[type="email"]')
    const box = await email.boundingBox()
    expect(box!.height).toBe(52)
    await expect(email).toHaveCSS('background-color', SURFACE)
    await expect(email).toHaveCSS('border-top-width', '2px')
    await expect(email).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)')
    await expect(email).toHaveCSS('border-top-left-radius', '16px')
    await email.focus()
    await expect(email).toHaveCSS('border-top-color', PRIMARY_TEXT)
    await expect(email).toHaveCSS('background-color', BG)
    // Visible labels sit above the fields.
    const label = page.locator('label[for="login-email"]')
    await expect(label).toBeVisible()
    const l = await label.boundingBox()
    expect(l!.y + l!.height).toBeLessThanOrEqual(box!.y)
    await context.close()
  })

  test('the primary submit is dark on turquoise with the 4px lip, 56px tall; the only solid primary button; no white on primary anywhere', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: MOBILE })
    await page.goto('/login')
    const submit = page.locator('[data-test="login-submit"]')
    await expect(submit).toHaveCSS('background-color', PRIMARY)
    await expect(submit).toHaveCSS('color', INK)
    const shadow = await submit.evaluate((el) => getComputedStyle(el).boxShadow)
    expect(shadow).toContain(PRIMARY_LIP)
    expect(shadow).toMatch(/0px 4px 0px 0px/)
    const box = await submit.boundingBox()
    expect(box!.height).toBe(56)
    const offenders = await page.evaluate(
      ({ primary }) =>
        [...document.querySelectorAll('*')]
          .filter((el) => getComputedStyle(el).backgroundColor === primary && getComputedStyle(el).color === 'rgb(255, 255, 255)')
          .map((el) => el.className),
      { primary: PRIMARY },
    )
    expect(offenders).toEqual([])
    await context.close()
  })

  test('login/register chips: selected = primary fill + dark text + check; 44px targets', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: MOBILE })
    await page.goto('/login')
    const tabs = page.locator('[data-test="login-tabs"] button')
    await expect(tabs.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await expect(tabs.nth(0)).toHaveCSS('background-color', PRIMARY)
    await expect(tabs.nth(0)).toHaveCSS('color', INK)
    await expect(tabs.nth(0).locator('svg')).toHaveCount(1)
    await expect(tabs.nth(1)).toHaveCSS('background-color', SURFACE_STRONG)
    // offsetHeight ignores the 220ms selected-chip pop (scale 0.94) that boundingBox would include.
    for (let i = 0; i < 2; i++) expect(await tabs.nth(i).evaluate((el) => (el as HTMLElement).offsetHeight)).toBeGreaterThanOrEqual(44)
    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('h2')).toHaveText('Crea tu cuenta')
    await context.close()
  })

  test('error state: 2px danger border + alert with icon and message; typing clears the flag', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: MOBILE })
    await page.goto('/login')
    await page.locator('[data-test="login-submit"]').click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Ingresa tu correo y contraseña')
    await expect(alert.locator('svg')).toHaveCount(1)
    await expect(alert).toHaveCSS('background-color', 'rgb(251, 228, 228)')
    await expect(alert).toHaveCSS('color', 'rgb(185, 28, 28)')
    const email = page.locator('input[type="email"]')
    await expect(email).toHaveCSS('border-top-color', DANGER)
    await expect(email).toHaveCSS('border-top-width', '2px')
    await email.fill('a@b.pa')
    await expect(email).not.toHaveAttribute('aria-invalid', 'true')
    await context.close()
  })

  test('a rejected login shows the server message with the icon', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: MOBILE }, { role: 'customer', loginFails: true, putStatus: 200 })
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('a@b.pa')
    await page.locator('input[type="password"]').fill('nope-nope')
    await page.locator('[data-test="login-submit"]').click()
    await expect(page.getByRole('alert')).toContainText('Credenciales inválidas.')
    await expect(page.getByRole('alert').locator('svg')).toHaveCount(1)
    await expect(page).toHaveURL(/\/login$/)
    await context.close()
  })
})

test.describe('login: keyboard and consent', () => {
  test('Tab walks chips, fields and submit in order; each stop shows the 2px primary-text ring', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: DESKTOP })
    await page.goto('/login')
    const order = ['Iniciar sesión', 'Regístrate', 'login-email', 'login-password', 'login-submit']
    const idOf = (el: Element | null) => (el as HTMLElement | null)?.id || (el as HTMLElement | null)?.getAttribute('data-test') || (el as HTMLElement | null)?.textContent?.trim() || ''
    await page.locator('body').click({ position: { x: 1, y: 1 } })
    for (const expected of order) {
      await page.keyboard.press('Tab')
      expect(await page.evaluate(idOf, await page.evaluateHandle(() => document.activeElement))).toBe(expected)
      const ring = await page.evaluate(() => {
        const cs = getComputedStyle(document.activeElement as Element)
        return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor, offset: cs.outlineOffset }
      })
      expect(ring).toEqual({ style: 'solid', width: '2px', color: PRIMARY_TEXT, offset: '2px' })
    }
    await context.close()
  })

  test('Enter in the password field submits the form (empty email -> alert)', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: DESKTOP })
    await page.goto('/login')
    await page.locator('input[type="password"]').fill('abc12345')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alert')).toContainText('Ingresa tu correo')
    await context.close()
  })

  test('Enter logs a customer in and lands on the store list', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: DESKTOP })
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('customer@ejemplo.pa')
    await page.locator('input[type="password"]').fill('secret-pass-1')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/tiendas$/)
    await context.close()
  })

  test('consent: keyboard Space ticks it, shows the dark tick on primary, a 44px target and a focus ring on the box', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: MOBILE })
    await page.goto('/login')
    await page.getByRole('button', { name: 'Regístrate' }).click()
    const check = page.getByRole('checkbox', { name: /Ley 81 de 2019/ })
    await expect(check).not.toBeChecked()
    const label = page.locator('label.cx-check')
    expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.locator('input[type="password"]').focus()
    await page.keyboard.press('Tab')
    await expect(check).toBeFocused()
    const ring = await page.locator('.cx-check-box').evaluate((el) => {
      const cs = getComputedStyle(el)
      return `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`
    })
    expect(ring).toBe(`solid 2px ${PRIMARY_TEXT}`)
    await page.keyboard.press('Space')
    await expect(check).toBeChecked()
    const box = page.locator('.cx-check-box')
    await expect(box).toHaveCSS('background-color', PRIMARY)
    await expect(box).toHaveCSS('color', INK)
    await expect(box.locator('svg')).toHaveCount(1)
    await context.close()
  })

  test('register without consent flags the checkbox in danger red', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: MOBILE })
    await page.goto('/login')
    await page.getByRole('button', { name: 'Regístrate' }).click()
    await page.locator('input[type="email"]').fill('nuevo@ejemplo.pa')
    await page.locator('input[type="password"]').fill('secret-pass-1')
    await page.locator('[data-test="login-submit"]').click()
    await expect(page.getByRole('alert')).toContainText('Ley 81')
    await expect(page.locator('.cx-check-box')).toHaveCSS('border-top-color', DANGER)
    await context.close()
  })
})

test.describe('top bar', () => {
  test('anonymous: flat 64px bar, bottom border, no blur, a secondary "Iniciar sesión" and no account menu', async ({ browser }) => {
    const { context, page } = await newPage(browser, { viewport: DESKTOP })
    await page.goto('/tiendas')
    const bar = page.locator('header.cx-topbar')
    await expect(bar).toBeVisible()
    expect((await bar.boundingBox())!.height).toBe(64)
    await expect(bar).toHaveCSS('background-color', BG)
    await expect(bar).toHaveCSS('border-bottom-width', '1px')
    await expect(bar).toHaveCSS('border-bottom-color', BORDER)
    await expect(bar).toHaveCSS('position', 'sticky')
    const effects = await bar.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { backdrop: cs.backdropFilter, shadow: cs.boxShadow }
    })
    expect(effects.backdrop === 'none' || effects.backdrop === '').toBe(true)
    expect(effects.shadow).toBe('none')
    const signIn = bar.getByRole('button', { name: 'Iniciar sesión' })
    await expect(signIn).toHaveCSS('background-color', PRIMARY_TINT)
    await expect(signIn).toHaveCSS('color', PRIMARY_TEXT)
    expect((await signIn.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await expect(page.locator('[data-test="account-trigger"]')).toHaveCount(0)
    await expect(bar.getByRole('button', { name: 'Explorar' })).toHaveAttribute('aria-current', 'page')
    await context.close()
  })

  test('customer on desktop: nav items hover/active states, targets >= 44px, menu overlay, Escape returns focus', async ({ browser }) => {
    const { context, page, mock } = await newPage(browser, { viewport: DESKTOP })
    await loginAs(page, mock, 'customer')
    const nav = page.locator('header nav')
    const items = nav.getByRole('button')
    await expect(items).toHaveCount(3)
    const active = nav.getByRole('button', { name: 'Explorar' })
    await expect(active).toHaveCSS('background-color', PRIMARY_TINT)
    await expect(active).toHaveCSS('color', PRIMARY_TEXT)
    const idle = nav.getByRole('button', { name: 'Mis pedidos' })
    await expect(idle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    await idle.hover()
    await expect(idle).toHaveCSS('background-color', SURFACE)
    for (let i = 0; i < 3; i++) {
      const b = (await items.nth(i).boundingBox())!
      expect(b.height).toBeGreaterThanOrEqual(44)
    }
    const trigger = page.locator('[data-test="account-trigger"]')
    await expect(trigger).toHaveAttribute('aria-label', 'Cuenta de Carlos Andrade')
    await trigger.click()
    const menu = page.locator('[data-test="account-menu"]')
    await expect(menu).toBeVisible()
    await expect(menu).toHaveCSS('background-color', BG)
    await expect(menu).toHaveCSS('border-top-color', BORDER)
    await expect(menu).toHaveCSS('border-top-left-radius', '24px')
    expect(await menu.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none')
    // The customer destinations are NOT duplicated in the menu on desktop.
    await expect(page.locator('[data-test="menu-nav"]')).toBeHidden()
    const rows = menu.locator('.cx-menu-item')
    for (let i = 0; i < (await rows.count()); i++) {
      const r = rows.nth(i)
      if (await r.isVisible()) expect((await r.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    }
    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(trigger).toBeFocused()
    await context.close()
  })

  test('keyboard: Tab reaches brand, nav items and the account trigger, all with the focus ring', async ({ browser }) => {
    const { context, page, mock } = await newPage(browser, { viewport: DESKTOP })
    await loginAs(page, mock, 'customer')
    // Switch to keyboard modality, then start the walk at the first control of the bar.
    await page.keyboard.press('Tab')
    await page.locator('.cx-brand').focus()
    const seen: string[] = []
    for (let i = 0; i < 5; i++) {
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        const cs = getComputedStyle(el)
        return { name: el.getAttribute('aria-label') || el.textContent?.trim() || '', ring: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} ${cs.outlineOffset}` }
      })
      seen.push(info.name)
      expect(info.ring, info.name).toBe(`solid 2px ${PRIMARY_TEXT} 2px`)
      await page.keyboard.press('Tab')
    }
    expect(seen.slice(0, 5)).toEqual(['Go Eats, ir al inicio', 'Explorar', 'Mis pedidos', 'Perfil', 'Cuenta de Carlos Andrade'])
    await context.close()
  })

  test('customer on a phone (360px): no nav, targets >= 44px, no overlap, destinations inside the account menu', async ({ browser }) => {
    const { context, page, mock } = await newPage(browser, { viewport: MOBILE })
    await loginAs(page, mock, 'customer')
    await expect(page.locator('header nav')).toBeHidden()
    const brand = (await page.locator('.cx-brand').boundingBox())!
    const trigger = page.locator('[data-test="account-trigger"]')
    const t = (await trigger.boundingBox())!
    expect(brand.height).toBeGreaterThanOrEqual(44)
    expect(brand.width).toBeGreaterThanOrEqual(44)
    expect(t.height).toBeGreaterThanOrEqual(44)
    expect(t.width).toBeGreaterThanOrEqual(44)
    expect(brand.x + brand.width + 8).toBeLessThanOrEqual(t.x)
    expect(t.x + t.width).toBeLessThanOrEqual(360)
    expect(await overflow(page)).toBeLessThanOrEqual(0)
    await trigger.click()
    const menu = page.locator('[data-test="account-menu"]')
    const m = (await menu.boundingBox())!
    expect(m.x).toBeGreaterThanOrEqual(0)
    expect(m.x + m.width).toBeLessThanOrEqual(360)
    const links = page.locator('[data-test="menu-nav"] button')
    await expect(links).toHaveCount(3)
    for (let i = 0; i < 3; i++) expect((await links.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await links.nth(1).click()
    await expect(page).toHaveURL(/\/pedidos$/)
    await expect(menu).toHaveCount(0)
    await context.close()
  })

  test('the same bar serves another role: merchant sees its name and role, no customer nav, and can log out', async ({ browser }) => {
    const { context, page, mock } = await newPage(browser, { viewport: DESKTOP })
    await loginAs(page, mock, 'merchant')
    const bar = page.locator('header.cx-topbar')
    expect((await bar.boundingBox())!.height).toBe(64)
    await expect(bar.locator('nav')).toHaveCount(0)
    await expect(bar).toContainText('Hector Endara')
    await expect(bar).toContainText('Comercio')
    await page.locator('[data-test="account-trigger"]').click()
    await expect(page.locator('[data-test="menu-nav"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page).toHaveURL(/\/login$/)
    await context.close()
  })
})

test.describe('toast', () => {
  test('info toast (logout): ink tile, bg text, 16px radius, icon + text, polite status, bottom-center', async ({ browser }) => {
    const { context, page, mock } = await newPage(browser, { viewport: DESKTOP })
    await loginAs(page, mock, 'customer')
    await page.locator('[data-test="account-trigger"]').click()
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    const toast = page.locator('.cx-toast')
    await expect(toast).toHaveText('Has cerrado sesión.')
    await expect(toast).toHaveAttribute('role', 'status')
    await expect(toast).toHaveCSS('background-color', INK)
    await expect(toast).toHaveCSS('color', BG)
    await expect(toast).toHaveCSS('border-top-left-radius', '16px')
    await expect(toast.locator('svg')).toHaveCount(1)
    await expect(page.locator('.cx-toast-region')).toHaveAttribute('aria-live', 'polite')
    const b = (await toast.boundingBox())!
    expect(Math.abs(b.x + b.width / 2 - 720)).toBeLessThanOrEqual(1)
    expect(b.y + b.height).toBeLessThanOrEqual(900 - 24)
    await expect(toast.locator('.cx-toast-icon')).toHaveCSS('background-color', PRIMARY_TINT)
    await context.close()
  })

  test('error toast: alert role, danger icon + text, dismiss button >= 44px that closes it; readable on a panel too', async ({ browser }) => {
    const state: Mock = { role: 'customer', loginFails: false, putStatus: 422 }
    const { context, page, mock } = await newPage(browser, { viewport: MOBILE }, state)
    await loginAs(page, mock, 'customer')
    await page.goto('/perfil')
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    const toast = page.locator('.cx-toast-error')
    await expect(toast).toBeVisible()
    await expect(toast).toHaveAttribute('role', 'alert')
    await expect(toast).toHaveCSS('background-color', INK)
    await expect(toast.locator('.cx-toast-icon')).toHaveCSS('background-color', 'rgb(251, 228, 228)')
    await expect(toast.locator('.cx-toast-icon')).toHaveCSS('color', 'rgb(185, 28, 28)')
    await expect(toast.locator('svg')).toHaveCount(2)
    const close = toast.getByRole('button', { name: 'Cerrar notificación' })
    const c = (await close.boundingBox())!
    expect(c.width).toBeGreaterThanOrEqual(44)
    expect(c.height).toBeGreaterThanOrEqual(44)
    const tb = (await toast.boundingBox())!
    expect(tb.x).toBeGreaterThanOrEqual(0)
    expect(tb.x + tb.width).toBeLessThanOrEqual(360)
    await close.click()
    await expect(toast).toHaveCount(0)
    await context.close()
  })

  test('toast over a merchant panel keeps the same ink tile (shared by every role)', async ({ browser }) => {
    const { context, page, mock } = await newPage(browser, { viewport: DESKTOP })
    await loginAs(page, mock, 'merchant')
    await page.locator('[data-test="account-trigger"]').click()
    await page.getByRole('button', { name: 'Cerrar sesión' }).click()
    await expect(page.locator('.cx-toast')).toHaveCSS('background-color', INK)
    await context.close()
  })
})

test.describe('layout and scheme', () => {
  for (const vp of [MOBILE, DESKTOP]) {
    test(`no horizontal overflow at ${vp.width}x${vp.height} (login, register, error, bar anonymous and logged in)`, async ({ browser }) => {
      const { context, page, mock } = await newPage(browser, { viewport: vp })
      await page.goto('/login')
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      await page.getByRole('button', { name: 'Regístrate' }).click()
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      await page.locator('[data-test="login-submit"]').click()
      await expect(page.getByRole('alert')).toBeVisible()
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      await page.goto('/tiendas')
      await expect(page.locator('header.cx-topbar')).toBeVisible()
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      await loginAs(page, mock, 'customer')
      await page.locator('[data-test="account-trigger"]').click()
      expect(await overflow(page)).toBeLessThanOrEqual(0)
      await context.close()
    })
  }

  for (const [name, opts] of [
    ['prefers-color-scheme: dark', { colorScheme: 'dark' as const }],
    ['light with html.dark', { colorScheme: 'light' as const }],
    ['dark scheme with html.dark', { colorScheme: 'dark' as const }],
  ] as const) {
    test(`${name} does not recolor the login, the bar or the toast`, async ({ browser }) => {
      const { context, page, mock } = await newPage(browser, opts)
      if (name.includes('html.dark')) await page.addInitScript(() => document.documentElement.classList.add('dark'))
      await page.goto('/login')
      await expect(page.locator('.cx-login')).toHaveCSS('background-color', SURFACE)
      await expect(page.locator('.cx-login-form')).toHaveCSS('background-color', BG)
      await expect(page.locator('h2')).toHaveCSS('color', INK)
      await expect(page.locator('[data-test="login-submit"]')).toHaveCSS('background-color', PRIMARY)
      await expect(page.locator('input[type="email"]')).toHaveCSS('background-color', SURFACE)
      await loginAs(page, mock, 'customer')
      await expect(page.locator('header.cx-topbar')).toHaveCSS('background-color', BG)
      await expect(page.locator('.cx-account')).toHaveCSS('background-color', SURFACE)
      await page.locator('[data-test="account-trigger"]').click()
      await expect(page.locator('[data-test="account-menu"]')).toHaveCSS('background-color', BG)
      await page.getByRole('button', { name: 'Cerrar sesión' }).click()
      await expect(page.locator('.cx-toast')).toHaveCSS('background-color', INK)
      await context.close()
    })
  }

  test('prefers-reduced-motion: the shell does not animate', async ({ browser }) => {
    const { context, page } = await newPage(browser, { reducedMotion: 'reduce' })
    await page.goto('/login')
    const chip = page.locator('[data-test="login-tabs"] button').first()
    await expect(chip).toHaveCSS('animation-name', 'none')
    await expect(page.locator('[data-test="login-submit"]')).toHaveCSS('transition-duration', '0s')
    await context.close()
  })
})
