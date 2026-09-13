import { expect, test } from '@playwright/test'

test('a room creator can cancel a waiting invite and return to the lobby', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('create-private').click()
  await expect(page.getByText('Invite your partner')).toBeVisible()
  await page.getByTestId('cancel-invite').click()
  await expect(page.getByText('Status: Invite canceled')).toBeVisible()
  await expect(page.getByTestId('create-private')).toBeEnabled()
})
