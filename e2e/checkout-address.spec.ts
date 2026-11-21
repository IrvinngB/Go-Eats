import { test, expect, type Page } from '@playwright/test'

const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

const SAVED_ADDRESS = {
  address: 'Calle 50, Edificio Global, Piso 3',
  lat: 8.9824,
  lng: -79.5199,
}

interface CapturedCalls {
  orders: Array<Record<string, unknown>>
  profileUpdates: Array<Record<string, unknown>>
}

async function setupCheckoutMock(page: Page): Promise<CapturedCalls> {
  const captured: CapturedCalls = { orders: [], profileUpdates: [] }
  let currentUser = {
    id: 1,
    full_name: 'Carlos Andrade',
    email: 'carlos@ejemplo.pa',
    phone: '6000-0000',
    role: 'customer',
    ...SAVED_ADDRESS,
  }

  await page.route(/tile\.openstreetmap\.org/, (route) =>
    route.fulfill({ contentType: 'image/png', body: TILE_PNG }),
  )

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname.replace('/api/v1', '')

    if (req.method() === 'POST' && path === '/auth/login') {
      return route.fulfill({
        json: { access_token: 'access-1', refresh_token: 'refresh-1', user: currentUser },
      })
    }
    if (req.method() === 'GET' && path === '/users/me') {
      return req.headers().authorization === 'Bearer access-1'
        ? route.fulfill({ json: currentUser })
        : route.fulfill({ status: 401, json: { detail: 'No autenticado' } })
    }
    if (req.method() === 'PUT' && path === '/users/me') {
      const body = req.postDataJSON() as Record<string, unknown>
      captured.profileUpdates.push(body)
      currentUser = { ...currentUser, ...body }
      return route.fulfill({ json: currentUser })
    }
    if (req.method() === 'GET' && path === '/users/me/consent') {
      return route.fulfill({ json: { accepted: true, policy_version: 'ley81-v1', updated_at: '2026-11-20T00:00:00Z' } })
    }
    if (req.method() === 'POST' && path === '/orders/') {
      const body = req.postDataJSON() as Record<string, unknown>
      captured.orders.push(body)
      return route.fulfill({
        status: 201,
        json: {
          code: `PED-${9000 + captured.orders.length}`,
          customer_id: 1,
          customer_name: currentUser.full_name,
          merchant_code: body.merchant_code,
          merchant_name: 'Fonda La Istmeña',
          zone_slug: body.zone_slug,
          status: 'pendiente',
          payment_method: body.payment_method,
          payment_status: 'pendiente',
          subtotal: 8.5,
          delivery_fee: 1.75,
          total: 10.25,
          delivery_address: body.delivery_address,
          delivery_lat: body.delivery_lat ?? null,
          delivery_lng: body.delivery_lng ?? null,
          notes: body.notes ?? '',
          items: [],
          created_at: '2026-11-20T22:30:00Z',
        },
      })
    }
    return route.fulfill({ json: [] })
  })

  return captured
}

async function loginAndOpenStore(page: Page) {
  await page.goto('/login?redirect=/tiendas/c1')
  await page.locator('input[type="email"]').fill('carlos@ejemplo.pa')
  await page.locator('input[type="password"]').fill('secret-pass-1')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL('/tiendas/c1')
}

async function addFirstProductAndOpenCheckout(page: Page) {
  await expect(page.getByRole('heading', { name: 'Menú' })).toBeVisible()
  await page.locator('h2:has-text("Menú") + div button.btn-primary').first().click()
  await page.getByRole('button', { name: 'Continuar' }).click()
}

test.describe('checkout delivery address (real browser)', () => {
  test('prefills saved profile address and sends its coords without updating profile', async ({ page }) => {
    const captured = await setupCheckoutMock(page)
    await loginAndOpenStore(page)
    await addFirstProductAndOpenCheckout(page)

    const savedBox = page.locator('[data-test="direccion-guardada"]')
    await expect(savedBox).toBeVisible()
    await expect(savedBox).toContainText(SAVED_ADDRESS.address)

    await page.getByRole('button', { name: 'Realizar pedido' }).click()
    await expect.poll(() => captured.orders.length).toBe(1)

    expect(captured.orders[0]).toMatchObject({
      delivery_address: SAVED_ADDRESS.address,
      delivery_lat: SAVED_ADDRESS.lat,
      delivery_lng: SAVED_ADDRESS.lng,
    })
    expect(captured.profileUpdates).toHaveLength(0)
  })

  test('changing address for this order sends override coords, warns outside coverage, and leaves profile untouched', async ({ page }) => {
    const captured = await setupCheckoutMock(page)
    await loginAndOpenStore(page)
    await addFirstProductAndOpenCheckout(page)

    await page.locator('[data-test="cambiar-direccion"]').click()
    await page.locator('#checkout-direccion').fill('Vía Tocumen, Casa 14')
    await page.getByLabel('Latitud').fill('9.3547')
    await page.getByLabel('Longitud').fill('-79.9000')

    await expect(page.locator('[data-test="coverage-hint"]')).toBeVisible()
    await expect(page.locator('[data-test="guardar-default"]')).not.toBeChecked()

    await page.getByRole('button', { name: 'Realizar pedido' }).click()
    await expect.poll(() => captured.orders.length).toBe(1)

    expect(captured.orders[0]).toMatchObject({
      delivery_address: 'Vía Tocumen, Casa 14',
      delivery_lat: 9.3547,
      delivery_lng: -79.9,
    })
    expect(captured.profileUpdates).toHaveLength(0)
  })

  test('ticking "Guardar como mi dirección" persists the new address to PUT /users/me after order', async ({ page }) => {
    const captured = await setupCheckoutMock(page)
    await loginAndOpenStore(page)
    await addFirstProductAndOpenCheckout(page)

    await page.locator('[data-test="cambiar-direccion"]').click()
    await page.locator('#checkout-direccion').fill('Costa del Este, PH Mirador 8B')
    await page.getByLabel('Latitud').fill('9.0150')
    await page.getByLabel('Longitud').fill('-79.4670')
    await page.locator('[data-test="guardar-default"]').check()

    await page.getByRole('button', { name: 'Realizar pedido' }).click()
    await expect.poll(() => captured.orders.length).toBe(1)
    await expect.poll(() => captured.profileUpdates.length).toBe(1)

    expect(captured.orders[0]).toMatchObject({
      delivery_address: 'Costa del Este, PH Mirador 8B',
      delivery_lat: 9.015,
      delivery_lng: -79.467,
    })
    expect(captured.profileUpdates[0]).toMatchObject({
      address: 'Costa del Este, PH Mirador 8B',
      lat: 9.015,
      lng: -79.467,
    })
  })
})
