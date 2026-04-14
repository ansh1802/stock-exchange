import { useState, useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'

export type Urgency = 'calm' | 'warning' | 'critical' | 'none'

export interface TurnUrgency {
  active: boolean
  remaining: number
  urgency: Urgency
  fraction: number
  duration: number
}

export function useTurnUrgency(): TurnUrgency {
  const gameState = useGameStore((s) => s.gameState)
  const deadline = gameState?.turn_timer_deadline ?? null
  const duration = gameState?.turn_timer_duration ?? 90
  const active = gameState?.phase === 'player_turn' && deadline !== null

  const [remaining, setRemaining] = useState(() =>
    active && deadline !== null
      ? Math.max(0, Math.ceil(deadline - Date.now() / 1000))
      : 0,
  )

  useEffect(() => {
    if (!active || deadline === null) {
      setRemaining(0)
      return
    }
    const tick = () => setRemaining(Math.max(0, Math.ceil(deadline - Date.now() / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline, active])

  if (!active) {
    return { active: false, remaining: 0, urgency: 'none', fraction: 1, duration }
  }

  const fraction = duration > 0 ? remaining / duration : 0
  const urgency: Urgency =
    fraction > 0.5 ? 'calm' : fraction > 0.25 ? 'warning' : 'critical'

  return { active: true, remaining, urgency, fraction, duration }
}
