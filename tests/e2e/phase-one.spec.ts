import { expect, test } from '@playwright/test'

test('two browser clients complete all eight alternating turns and reach results', async ({ browser }) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  try {
    await pageA.goto('/')
    await pageA.getByTestId('create-private').click()
    await expect(pageA.locator('strong').first()).toHaveText(/[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}/)
    const roomCode = (await pageA.locator('strong').first().textContent())?.trim()
    if (!roomCode) throw new Error('private room code was not rendered')

    await pageB.goto('/')
    await pageB.getByPlaceholder('Enter 6-char code').fill(roomCode)
    await pageB.getByTestId('join-private').click()
    await expect(pageA.getByText(/Players:\s*2/)).toBeVisible()
    await expect(pageB.getByText(/Players:\s*2/)).toBeVisible()

    await pageA.getByRole('button', { name: 'Ready', exact: true }).click()
    await pageB.getByRole('button', { name: 'Ready', exact: true }).click()

    for (let turn = 0; turn < 8; turn += 1) {
      const choiceA = pageA.getByTestId('choice-1')
      const choiceB = pageB.getByTestId('choice-1')
      await expect.poll(async () => {
        if (await choiceA.isVisible()) return 'A'
        if (await choiceB.isVisible()) return 'B'
        return ''
      }).not.toBe('')

      const drawer = await choiceA.isVisible() ? pageA : pageB
      const guesser = drawer === pageA ? pageB : pageA
      await drawer.getByTestId('choice-1').click()
      await expect(drawer.getByText(/^Draw: /)).toBeVisible()
      if (turn === 0) {
        await expect(drawer.getByTestId('draw-canvas')).toBeVisible()
        const canvas = await drawer.getByTestId('draw-canvas').boundingBox()
        if (!canvas) throw new Error('drawing canvas was not measurable')
        await drawer.mouse.move(canvas.x + 30, canvas.y + 30)
        await drawer.mouse.down()
        await drawer.mouse.move(canvas.x + 140, canvas.y + 90)
        await drawer.mouse.up()
      }
      const pass = guesser.getByRole('button', { name: 'Pass', exact: true })
      await expect(pass).toBeEnabled()
      await pass.click()
    }

    await expect(pageA.getByText('Session complete.')).toBeVisible({ timeout: 15_000 })
    await expect(pageB.getByText('Session complete.')).toBeVisible({ timeout: 15_000 })
    await pageA.getByRole('button', { name: 'Rematch', exact: true }).click()
    await pageB.getByRole('button', { name: 'Rematch', exact: true }).click()
    await expect.poll(async () => {
      if (await pageA.getByTestId('choice-1').isVisible()) return 'A'
      if (await pageB.getByTestId('choice-1').isVisible()) return 'B'
      return ''
    }).not.toBe('')
  } finally {
    await contextA.close()
    await contextB.close()
  }
})
