import { test, expect } from '@playwright/test'

test('landing loads and has a title', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/.+/)
})
