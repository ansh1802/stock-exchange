import { test, expect } from '@playwright/test'
import { ORDERED } from '../src/tutorial/chapters/ordered'

const taught = ORDERED.filter((c) => c.id !== 'recap')

test('recap lists every chapter with its chips', async ({ page }) => {
  await page.goto('/tutorial/play/recap')
  await expect(page.getByTestId('recap')).toBeVisible()
  expect(taught.length).toBeGreaterThan(0)
  for (const c of taught) {
    const group = page.getByTestId(`recap-chapter-${c.id}`)
    await expect(group).toContainText(c.title)
    expect(c.chips.length).toBeGreaterThan(0)
    for (const chip of c.chips) await expect(group).toContainText(chip)
  }
  await expect(page.getByTestId('recap-chapter-_smoke')).toHaveCount(0)
})

test('Play your first game vs bots goes to a fresh room with autostart', async ({ page }) => {
  await page.goto('/tutorial/play/recap')
  await page.evaluate(() => localStorage.setItem('stock-exchange-last-name', 'Ann'))
  await page.reload()
  // Stub the socket: navigation is all this test checks.
  await page.routeWebSocket(/\/ws\//, () => {})
  await page.getByTestId('recap-play-bots').click()
  await expect(page).toHaveURL(/\/game\/[A-Z0-9]{4}\?autostart=bots3$/)
  const s = await page.evaluate(() =>
    (window as unknown as { __store: { getState(): { playerName: string; roomCode: string } } }).__store.getState())
  expect(s.playerName).toBe('Ann')
  expect(page.url()).toContain(`/game/${s.roomCode}?`)
})

test('Play vs bots asks for a name inline when none is saved', async ({ page }) => {
  await page.goto('/tutorial/play/recap')
  await page.evaluate(() => localStorage.removeItem('stock-exchange-last-name'))
  await page.reload()
  await page.routeWebSocket(/\/ws\//, () => {})
  await page.getByTestId('recap-play-bots').click()
  await expect(page).toHaveURL(/\/tutorial\/play\/recap$/)
  await page.getByTestId('recap-name').fill('Bea')
  await page.getByTestId('recap-play-bots').click()
  await expect(page).toHaveURL(/\/game\/[A-Z0-9]{4}\?autostart=bots3$/)
  expect(await page.evaluate(() => localStorage.getItem('stock-exchange-last-name'))).toBe('Bea')
})

test('recap buttons: replay a chapter and read the rulebook', async ({ page }) => {
  await page.goto('/tutorial/play/recap')
  await page.getByTestId('recap-replay').click()
  await expect(page).toHaveURL(/\/tutorial$/)
  await page.goto('/tutorial/play/recap')
  await page.getByTestId('recap-rulebook').click()
  await expect(page).toHaveURL(/\/rulebook/)
})
