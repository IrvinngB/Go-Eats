import { test, expect, type Page } from '@playwright/test'

// Real browser against the production build (service worker blocked in playwright.config.ts).
// The API is mocked: the server decides the role from the account that logs in.
const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

type Role = 'customer' | 'merchant' | 'courier' | 'accountant' | 'admin'

const NAMES: Record<Role, string> = {
  customer: 'Carlos Andrade',
  merchant: 'Hector Endara',
  courier: 'Maria Cedeno',
  accountant: 'Marta Pinzon',
  admin: 'Administrador General',
}

function user(role: Role) {
  return { id: 1, full_name: NAMES[role], email: `${role}@ejemplo.pa`, phone: '6000-0000', role }
}

/** `account` is the role the mocked server answers for the next login and for GET /users/me. */
async function mockApi(page: Page, account: { role: Role }) {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ contentType: 'image/png', body: TILE_PNG }))
  await page.route('**/api/v1/**', (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace('/api/v1', '')
    if (req.method() === 'POST' && path === '/auth/login') {
      return route.fulfill({ json: { access_token: 'access-1', refresh_token: 'refresh-1', user: user(account.role) } })
    }
    if (path === '/users/me') {
      return req.headers().authorization === 'Bearer access-1'
        ? route.fulfill({ json: user(account.role) })
        : route.fulfill({ status: 401, json: { detail: 'No autenticado' } })
    }
    return route.fulfill({ json: [] })
  })
}

/** vue-router writes the redirect value as `/login?redirect=/pedidos` (a slash is legal in a query); a literal `%2F` would be equivalent. */
const loginWithRedirect = (path: string) => new RegExp(`/login\\?redirect=(%2F|/)${path.replace('/', '')}$`)

async function login(page: Page) {
  // The form is empty unless the demo flag is on at build time: type the credentials explicitly.
  await page.locator('input[type="email"]').fill('user@example.com')
  await page.locator('input[type="password"]').fill('secret-pass-1')
  await page.getByRole('button', { name: 'Entrar' }).click()
}

test.describe('route guards (real browser)', () => {
  test('anonymous /panel-admin goes to /login with the redirect', async ({ page }) => {
    await mockApi(page, { role: 'admin' })
    await page.goto('/panel-admin')
    await expect(page).toHaveURL(loginWithRedirect('/panel-admin'))
    await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible()
  })

  test('mocked login as that role returns to the target', async ({ page }) => {
    await mockApi(page, { role: 'admin' })
    await page.goto('/panel-admin')
    await login(page)
    await expect(page).toHaveURL('/panel-admin')
    await expect(page.getByText(NAMES.admin).first()).toBeVisible()
  })

  test('a customer who opens /panel-admin lands on /tiendas (also after a full reload)', async ({ page }) => {
    await mockApi(page, { role: 'customer' })
    await page.goto('/login')
    await login(page)
    await expect(page).toHaveURL('/tiendas')
    await page.goto('/panel-admin') // full reload: the guard waits for the session restore (GET /users/me)
    await expect(page).toHaveURL('/tiendas')
    await expect(page.getByText(NAMES.customer).first()).toBeVisible()
  })

  test('a customer route redirect from the login is honored after login', async ({ page }) => {
    await mockApi(page, { role: 'customer' })
    await page.goto('/pedidos')
    await expect(page).toHaveURL(loginWithRedirect('/pedidos'))
    await login(page)
    await expect(page).toHaveURL('/pedidos')
  })

  test('/tiendas, /tiendas/:id and / stay public for anonymous visitors', async ({ page }) => {
    await mockApi(page, { role: 'customer' })
    await page.goto('/tiendas')
    await expect(page).toHaveURL('/tiendas')
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
    await expect(page.getByText('Carlos Andrade')).toHaveCount(0)
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await page.goto('/no-existe')
    await expect(page).toHaveURL('/tiendas')
  })

  test('a malicious ?redirect goes to the role home, not off-site', async ({ page }) => {
    await mockApi(page, { role: 'merchant' })
    await page.goto('/login?redirect=//evil.com')
    await login(page)
    await expect(page).toHaveURL('/panel-comercio')
    expect(new URL(page.url()).hostname).toBe('localhost')
  })

  test('an authenticated user opening /login goes to the role home', async ({ page }) => {
    await mockApi(page, { role: 'courier' })
    await page.goto('/login')
    await login(page)
    await expect(page).toHaveURL('/panel-repartidor')
    await page.goto('/login')
    await expect(page).toHaveURL('/panel-repartidor')
  })

  test('the demo switcher is ABSENT in the default build (flag off)', async ({ page }) => {
    await mockApi(page, { role: 'customer' })
    await page.goto('/login')
    await login(page)
    await expect(page).toHaveURL('/tiendas')
    await page.locator('[data-test="account-trigger"]').click()
    await expect(page.getByText('Cerrar sesión')).toBeVisible()
    await expect(page.getByText('Cambiar de Cuenta')).toHaveCount(0)
    await expect(page.getByText('admin@goeats.pa')).toHaveCount(0)
  })

  test('a rejected refresh mid-session logs out and returns to /login with the page they were on', async ({ page }) => {
    await mockApi(page, { role: 'customer' })
    await page.goto('/login')
    await login(page)
    await expect(page).toHaveURL('/tiendas')
    // From now on the session is dead: authenticated calls 401 and the refresh is refused.
    await page.unroute('**/api/v1/**')
    await page.route('**/api/v1/**', (route) => {
      const path = new URL(route.request().url()).pathname.replace('/api/v1', '')
      if (path === '/auth/refresh' || path.startsWith('/users/me')) {
        return route.fulfill({ status: 401, json: { detail: 'Sesión inválida' } })
      }
      return route.fulfill({ json: [] })
    })
    // Client-side navigation (no reload): the profile page loads its consent through the axios interceptor.
    await page.getByRole('button', { name: 'Perfil' }).click()
    await expect(page).toHaveURL(loginWithRedirect('/perfil'))
    expect(await page.evaluate(() => localStorage.getItem('goeats_access_token'))).toBeNull()
    expect(await page.evaluate(() => localStorage.getItem('goeats_refresh_token'))).toBeNull()
    await expect(page.getByText('Tu sesión expiró. Inicia sesión de nuevo.')).toBeVisible()
  })

  test('anonymous public sync failing with 401 causes no redirect and no notice', async ({ page }) => {
    await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ contentType: 'image/png', body: TILE_PNG }))
    await page.route('**/api/v1/**', (route) => route.fulfill({ status: 401, json: { detail: 'No autenticado' } }))
    await page.goto('/tiendas')
    await page.waitForTimeout(500)
    await expect(page).toHaveURL('/tiendas')
    await expect(page.getByText('sesión expiró')).toHaveCount(0)
  })
})
