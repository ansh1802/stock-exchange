import { test, expect } from '@playwright/test'
import { ORDERED } from '../src/tutorial/chapters/ordered'
import smoke from '../src/tutorial/chapters/_smoke'
import { walkChapter } from './walker'

// One test per chapter, titled by id: `npx playwright test -g <id>`.
for (const chapter of [...ORDERED, smoke]) {
  test(`chapter ${chapter.id} completes`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
    await walkChapter(page, chapter)
    await expect(page.getByTestId('tutorial-chapter-done')).toContainText(chapter.chips[0])
    expect(errors).toEqual([])
  })
}

test('exit restores the live store', async ({ page }) => {
  await page.goto('/tutorial')
  await page.evaluate(() => {
    (window as unknown as { __store: { getState(): { setConnection(c: string, n: string): void } } })
      .__store.getState().setConnection('ABCD', 'Ann')
  })
  await page.getByTestId('tutorial-chapter-_smoke').click()
  await expect(page.getByTestId('tutorial-player')).toHaveAttribute('data-step', 'intro')
  await page.getByTestId('tutorial-next').click()
  await expect(page.getByTestId('tutorial-player')).toHaveAttribute('data-step', 'open-buy')
  await page.getByTestId('tutorial-exit').click()
  await expect(page).toHaveURL(/\/tutorial$/)
  // The URL flips before React commits the unmount; wait for the hub itself.
  await expect(page.getByTestId('tutorial-chapter-_smoke')).toBeVisible()
  await expect(page.getByTestId('tutorial-player')).toHaveCount(0)
  const s = await page.evaluate(() => {
    const st = (window as unknown as { __store: { getState(): Record<string, unknown> } }).__store.getState()
    return { gameState: st.gameState, roomCode: st.roomCode, playerName: st.playerName }
  })
  expect(s).toEqual({ gameState: null, roomCode: 'ABCD', playerName: 'Ann' })
  const persisted = await page.evaluate(() => sessionStorage.getItem('stock-exchange-session'))
  expect(persisted).toContain('"playerName":"Ann"')
})

test('restart after crossing 768px mid-step rewinds and still completes', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'starts wide, then narrows')
  await page.goto('/tutorial/play/_smoke')
  const playerEl = page.getByTestId('tutorial-player')
  await page.getByTestId('tutorial-next').click()
  await page.locator('[data-tutorial="buy-button"]:visible').first().click()
  await expect(playerEl).toHaveAttribute('data-step', 'pick-tcs')
  await page.setViewportSize({ width: 390, height: 844 }) // trees swap; the open popup is gone
  await page.getByTestId('tutorial-restart').click()
  await expect(playerEl).toHaveAttribute('data-step', 'intro') // _smoke has no checkpoint
  await walkChapter(page, smoke, { navigate: false })
})
