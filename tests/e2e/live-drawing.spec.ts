import { expect, test } from '@playwright/test'

test('a completed stroke is rendered on the remote guesser canvas', async ({ browser }) => {
  const drawerContext = await browser.newContext()
  const guesserContext = await browser.newContext()
  const drawerPage = await drawerContext.newPage()
  const guesserPage = await guesserContext.newPage()

  try {
    await drawerPage.goto('/')
    await drawerPage.getByTestId('create-private').click()
    await expect(drawerPage.locator('strong').first()).toHaveText(/[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}/)
    const roomCode = (await drawerPage.locator('strong').first().textContent())?.trim()
    if (!roomCode) throw new Error('private room code was not rendered')

    await guesserPage.goto('/')
    await guesserPage.getByPlaceholder('Enter 6-char code').fill(roomCode)
    await guesserPage.getByTestId('join-private').click()
    await expect(drawerPage.getByText(/Players:\s*2/)).toBeVisible()
    await expect(guesserPage.getByText(/Players:\s*2/)).toBeVisible()
    await drawerPage.getByRole('button', { name: 'Ready', exact: true }).click()
    await guesserPage.getByRole('button', { name: 'Ready', exact: true }).click()

    const firstChoice = drawerPage.getByTestId('choice-1')
    const secondChoice = guesserPage.getByTestId('choice-1')
    await expect.poll(async () => {
      if (await firstChoice.isVisible()) return 'first'
      if (await secondChoice.isVisible()) return 'second'
      return ''
    }).not.toBe('')
    const activeDrawer = await firstChoice.isVisible() ? drawerPage : guesserPage
    const remoteGuesser = activeDrawer === drawerPage ? guesserPage : drawerPage
    await activeDrawer.getByTestId('choice-1').click()
    await expect(activeDrawer.getByText(/^Draw: /)).toBeVisible()

    const drawerCanvas = activeDrawer.getByTestId('draw-canvas')
    const canvasBounds = await drawerCanvas.boundingBox()
    if (!canvasBounds) throw new Error('drawing canvas was not measurable')

    await activeDrawer.mouse.move(canvasBounds.x + 30, canvasBounds.y + 30)
    await activeDrawer.mouse.down()
    await activeDrawer.mouse.move(canvasBounds.x + 140, canvasBounds.y + 90)
    await activeDrawer.mouse.up()

    await expect.poll(() => remoteGuesser.getByTestId('draw-canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')
      if (!context) return false
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245)) {
          return true
        }
      }
      return false
    })).toBe(true)

    await activeDrawer.locator('.drawing-actions').getByRole('button', { name: 'Clear', exact: true }).click()
    const clearDialog = activeDrawer.getByRole('dialog', { name: 'Clear drawing' })
    await expect(clearDialog).toBeVisible()
    await clearDialog.getByRole('button', { name: 'Clear', exact: true }).click()
    await expect.poll(() => remoteGuesser.getByTestId('draw-canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')
      if (!context) return false
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245)) {
          return true
        }
      }
      return false
    })).toBe(false)

    await activeDrawer.mouse.move(canvasBounds.x + 60, canvasBounds.y + 150)
    await activeDrawer.mouse.down()
    await activeDrawer.mouse.move(canvasBounds.x + 180, canvasBounds.y + 80)
    await activeDrawer.mouse.up()
    await expect.poll(() => remoteGuesser.getByTestId('draw-canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')
      if (!context) return false
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245)) {
          return true
        }
      }
      return false
    })).toBe(true)

    await remoteGuesser.getByRole('button', { name: 'Pass', exact: true }).click()
    await expect(remoteGuesser.getByTestId('choice-1')).toBeVisible()
    await remoteGuesser.getByTestId('choice-1').click()
    await expect(remoteGuesser.getByText(/^Draw: /)).toBeVisible()

    const reverseCanvasBounds = await remoteGuesser.getByTestId('draw-canvas').boundingBox()
    if (!reverseCanvasBounds) throw new Error('reverse drawing canvas was not measurable')
    await remoteGuesser.mouse.move(reverseCanvasBounds.x + 40, reverseCanvasBounds.y + 120)
    await remoteGuesser.mouse.down()
    await remoteGuesser.mouse.move(reverseCanvasBounds.x + 160, reverseCanvasBounds.y + 50)
    await remoteGuesser.mouse.up()

    await expect.poll(() => activeDrawer.getByTestId('draw-canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')
      if (!context) return false
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3] > 0 && (pixels[index] < 245 || pixels[index + 1] < 245 || pixels[index + 2] < 245)) {
          return true
        }
      }
      return false
    })).toBe(true)
  } finally {
    await drawerContext.close()
    await guesserContext.close()
  }
})
