import { useEffect, useState } from 'react'
import { tutorialStorage } from '../lib/tutorialStorage'

/**
 * Fire a tooltip the first time a UI concept appears in real gameplay.
 * - Persists "seen" state in localStorage so it never repeats across games.
 * - Bails entirely if the user has disabled tips from the tutorial hub.
 * - Returned `dismiss()` should be called by the consumer's <Coachmark/>
 *   onDismiss handler. Subsequent renders return `show: false`.
 *
 * The hook itself is render-only: the consumer owns the Coachmark JSX so
 * the consumer can choose anchor refs, layout, and copy.
 */
export function useFirstEncounterTip(id: string, active: boolean) {
  const [show, setShow] = useState(() => {
    if (!active) return false
    if (tutorialStorage.areTipsDisabled()) return false
    return !tutorialStorage.hasSeenTooltip(id)
  })

  useEffect(() => {
    if (!active) return
    if (tutorialStorage.areTipsDisabled()) return
    if (tutorialStorage.hasSeenTooltip(id)) return
    setShow(true)
  }, [id, active])

  const dismiss = () => {
    tutorialStorage.markTooltipSeen(id)
    setShow(false)
  }

  return { show, dismiss }
}
