import { describe, it, expect } from 'vitest'
import { tutorialAllows, type TutorialApi } from './TutorialContext'
import type { ClientMessage } from '../../types/messages'

const buy = { type: 'buy', company_num: 4, quantity: 5 } as ClientMessage
const api = (allow: boolean): TutorialApi => ({
  allows: () => allow, frozenTimerSecs: 60, heldRevealStage: null, holdSuspendClose: false,
  reportRevealStage: () => {}, forcedMobileTab: null,
})

describe('tutorialAllows', () => {
  it('no provider allows everything', () => expect(tutorialAllows(null, buy)).toBe(true))
  it('delegates to api.allows', () => {
    expect(tutorialAllows(api(false), buy)).toBe(false)
    expect(tutorialAllows(api(true), buy)).toBe(true)
  })
  it('null message is never allowed', () => {
    expect(tutorialAllows(api(true), null)).toBe(false)
    expect(tutorialAllows(null, null)).toBe(false)
  })
})
