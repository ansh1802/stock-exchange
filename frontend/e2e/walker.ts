import { expect, type Locator, type Page } from '@playwright/test'
import type { Chapter, Step } from '../src/tutorial/runtime/types'

const STEP_TIMEOUT = 30_000

/** Same 768px fork as useIsMobile(). */
export function isMobileViewport(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 768
}

function effectiveTarget(step: Step, mobile: boolean) {
  return mobile && step.targetMobile !== undefined ? step.targetMobile : step.target
}

/** The visible element the tutorial spotlights for this step (keyed when `targetKey`). */
export function targetLocator(page: Page, step: Step): Locator {
  const target = effectiveTarget(step, isMobileViewport(page))
  if (!target) throw new Error(`step ${step.id}: ${step.advance.kind} step has no target on this viewport`)
  const base = page.locator(`[data-tutorial="${target}"]:visible`).first()
  return step.targetKey ? base.locator(`[data-tutorial-key="${step.targetKey}"]:visible`).first() : base
}

const player = (page: Page) => page.getByTestId('tutorial-player')

/** Wait until the page is on `stepId` (or the chapter is done when null). */
async function waitForStep(page: Page, stepId: string | null) {
  if (stepId === null) {
    await expect(page.getByTestId('tutorial-chapter-done')).toBeVisible({ timeout: STEP_TIMEOUT })
  } else {
    await expect(player(page)).toHaveAttribute('data-step', stepId, { timeout: STEP_TIMEOUT })
  }
}

async function performStep(page: Page, step: Step) {
  const a = step.advance
  switch (a.kind) {
    case 'next':
      await page.getByTestId('tutorial-next').click()
      return
    case 'click':
    case 'action': // target = the commit control
      await targetLocator(page, step).click()
      return
    case 'value': {
      const t = targetLocator(page, step)
      await t.evaluate((el, v) => {
        const input = (el.matches('input[type=range]') ? el : el.querySelector('input[type=range]')) as HTMLInputElement
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        setter.call(input, String(v))
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }, a.equals)
      return
    }
    case 'predict':
      await page.getByTestId('tutorial-predict-0').click()
      await page.getByTestId('tutorial-next').click()
      return
    case 'auto':
    case 'reveal_wait':
    case 'reveal_end':
    case 'suspend_end':
      return // the page advances on its own
  }
}

/** Drive a chapter on its player route, step by step, to the done card. */
export async function walkChapter(page: Page, chapter: Chapter, { navigate = true } = {}) {
  if (navigate) await page.goto(`/tutorial/play/${chapter.id}`)
  for (let i = 0; i < chapter.steps.length; i++) {
    const step = chapter.steps[i]
    await waitForStep(page, step.id)
    await performStep(page, step)
    await waitForStep(page, chapter.steps[i + 1]?.id ?? null)
  }
}
