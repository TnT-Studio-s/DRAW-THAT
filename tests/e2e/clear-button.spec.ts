import { expect, test } from '@playwright/test'

test('clear removes a preview drawing', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Game Screen', exact: true }).click()

  const canvas = page.getByTestId('draw-canvas')
  const clearButton = page.locator('.drawing-actions').getByRole('button', { name: 'Clear', exact: true })
  const box = await canvas.boundingBox()
  if (!box) throw new Error('drawing canvas was not measurable')

  const inkCount = () => page.evaluate(() => {
    const canvasElement = document.querySelector<HTMLCanvasElement>('[data-testid="draw-canvas"]')
    const context = canvasElement?.getContext('2d')
    if (!canvasElement || !context) return 0
    const pixels = context.getImageData(0, 0, canvasElement.width, canvasElement.height).data
    let count = 0
    for (let index = 0; index < pixels.length; index += 4) {
      if (pixels[index] !== 255 || pixels[index + 1] !== 255 || pixels[index + 2] !== 255 || pixels[index + 3] !== 255) count += 1
    }
    return count
  })

  await expect.poll(inkCount).toBe(0)
  await page.mouse.move(box.x + 30, box.y + 30)
  await page.mouse.down()
  await page.mouse.move(box.x + 140, box.y + 90)
  await page.mouse.up()
  await expect.poll(inkCount).toBeGreaterThan(0)

  await clearButton.click()
  const modal = page.getByRole('dialog', { name: 'Clear drawing' })
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('Clear the entire drawing?')
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(clearButton).toBeFocused()
  await expect.poll(inkCount).toBeGreaterThan(0)

  await clearButton.click()
  await expect(modal).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(modal).toBeHidden()
  await expect(clearButton).toBeFocused()
  await expect.poll(inkCount).toBeGreaterThan(0)

  await clearButton.click()
  await expect(modal).toBeVisible()
  await modal.getByRole('button', { name: 'Clear', exact: true }).click()
  await expect(clearButton).toBeFocused()
  await expect.poll(inkCount).toBe(0)
})

test('leaving a preview session uses the reusable modal', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Game Screen', exact: true }).click()
  await page.getByRole('button', { name: 'Game settings', exact: true }).click()

  for (const [action, title] of [
    ['Hide drawing and leave', 'Hide drawing and leave?'],
    ['Report and leave', 'Report partner and leave?'],
    ['Block and leave', 'Block partner and leave?'],
  ] as const) {
    const actionButton = page.getByRole('button', { name: action, exact: true })
    await actionButton.click()
    const actionModal = page.getByRole('dialog', { name: title })
    await expect(actionModal).toBeVisible()
    if (action === 'Report and leave') {
      const reason = actionModal.getByRole('combobox', { name: 'Reason', exact: true })
      await expect(reason).toHaveValue('other')
      await reason.selectOption('harassment')
      await expect(reason).toHaveValue('harassment')
    }
    await actionModal.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(actionModal).toBeHidden()
    await expect(actionButton).toBeFocused()
  }

  const leaveButton = page.getByRole('button', { name: 'Leave game', exact: true })
  await leaveButton.click()

  const modal = page.getByRole('dialog', { name: 'Leave game?' })
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('current session')
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(leaveButton).toBeFocused()

  await leaveButton.click()
  await modal.getByRole('button', { name: 'Leave game', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Preview Game Screen', exact: true })).toBeVisible()
  await expect(page.locator('.app')).toBeFocused()
})

test('unlocking a cosmetic uses the purchase modal', async ({ page }) => {
  let purchased = false
  const profile = {
    playerId: 'modal-test-player',
    displayName: 'Modal Tester',
    termsVersion: 'alpha-2026-09',
    wallet: 48,
    lifetimeCoins: 48,
    duoStreakCurrent: 0,
    duoStreakBest: 0,
    ownedCosmetics: ['color-red', 'color-green', 'color-blue', 'brush-medium', 'font-plain', 'border-plain'],
    equippedCosmetics: { draw_color: 'color-blue', name_color: 'color-blue', brush_size: 'brush-medium', name_font: 'font-plain', nameplate_border: 'border-plain' },
  }
  const item = { itemId: 'color-orange', type: 'draw_color', name: 'Juicy Orange', price: 12, value: '#f57c00', enabled: true }

  await page.route('**/api/account/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(purchased ? { ...profile, wallet: 36, ownedCosmetics: [...profile.ownedCosmetics, item.itemId] } : profile),
    })
  })
  await page.route('**/api/progression/catalog', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [item] }) })
  })
  await page.route('**/api/progression/purchase', async (route) => {
    purchased = true
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ itemId: item.itemId, owned: true, wallet: 36 }) })
  })

  await page.goto('/')
  await expect(page.getByText('Modal Tester')).toBeVisible()
  await page.getByRole('button', { name: 'Open reward store', exact: true }).click()

  const cosmetic = page.locator('.shop-item').filter({ hasText: item.name })
  const unlockButton = cosmetic.getByRole('button', { name: 'Unlock', exact: true })
  await unlockButton.click()

  const modal = page.getByRole('dialog', { name: 'Unlock Juicy Orange?' })
  await expect(modal).toBeVisible()
  await expect(modal).toContainText('12 coins')
  await expect(modal).toContainText('36 coins')
  await modal.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(unlockButton).toBeFocused()

  await unlockButton.click()
  await modal.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(modal).toBeHidden()
  await expect(cosmetic.getByRole('button', { name: 'Brush', exact: true })).toBeVisible()
  await expect(page.getByText('Your balance: 36 coins')).toBeVisible()
})

test('reporting leaves before a slow safety request resolves', async ({ page }) => {
  let releaseReport!: () => void
  let reportCategory = ''
  let requestSeen!: () => void
  const reportGate = new Promise<void>((resolve) => { releaseReport = resolve })
  const reportRequestSeen = new Promise<void>((resolve) => { requestSeen = resolve })

  await page.route('**/api/safety/report', async (route) => {
    reportCategory = (route.request().postDataJSON() as { category: string }).category
    requestSeen()
    await reportGate
    await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'delayed_test' }) })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Preview Game Screen', exact: true }).click()
  await page.getByRole('button', { name: 'Game settings', exact: true }).click()
  await page.getByRole('button', { name: 'Report and leave', exact: true }).click()

  const modal = page.getByRole('dialog', { name: 'Report partner and leave?' })
  await modal.getByRole('combobox', { name: 'Reason', exact: true }).selectOption('harassment')
  await modal.getByRole('button', { name: 'Report and leave', exact: true }).click()
  await requestSeen()
  await expect(page.getByRole('button', { name: 'Preview Game Screen', exact: true })).toBeVisible()
  expect(reportCategory).toBe('harassment')

  releaseReport()
  await expect(page.getByText('Report failed: delayed_test', { exact: true })).toBeVisible()
})
