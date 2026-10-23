import { createContext, useContext } from 'react'
import type { ClientMessage } from '../../types/messages'
import type { MobileTab } from '../../components/game/MobileTabBar'

/**
 * Present only inside the guided tutorial. Live games render without a
 * provider, so `useTutorial()` is null and every guard below is a no-op.
 */
export interface TutorialApi {
  allows(msg: ClientMessage): boolean
  frozenTimerSecs: number // shown remaining seconds, never ticks
  heldRevealStage: string | null
  reportRevealStage(key: string): void
  forcedMobileTab: MobileTab | null
}

export const TutorialContext = createContext<TutorialApi | null>(null)

export function useTutorial(): TutorialApi | null {
  return useContext(TutorialContext)
}

/** null api -> true (live game); null msg -> false (nothing to send). */
export function tutorialAllows(api: TutorialApi | null, msg: ClientMessage | null): boolean {
  if (msg === null) return false
  if (api === null) return true
  return api.allows(msg)
}

export function useTutorialAllows(msg: ClientMessage | null): boolean {
  return tutorialAllows(useTutorial(), msg)
}
