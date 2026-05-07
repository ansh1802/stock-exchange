import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useTurnUrgency, type Urgency } from '../../hooks/useTurnUrgency'
import { useGameStore } from '../../store/useGameStore'

const COLOR_CLASSES: Record<Urgency, string> = {
  calm: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
  none: 'text-gray-400',
}

const PULSE_CLASSES: Record<Urgency, string> = {
  calm: '',
  warning: 'animate-pulse',
  critical: 'animate-[pulse_0.6s_ease-in-out_infinite]',
  none: '',
}

interface Props {
  /**
   * When true, renders even when there is no active turn timer — shows
   * a neutral gray countdown so the active player's remaining time stays
   * visible to everyone on mobile. Drives from `turn_timer_deadline`.
   */
  alwaysShow?: boolean
}

export default function TurnTimerDisplay({ alwaysShow = false }: Props) {
  const turnUrgency = useTurnUrgency()
  const deadline = useGameStore((s) => s.gameState?.turn_timer_deadline ?? null)

  // When `alwaysShow` is true but the turn isn't "active" (e.g. another
  // player is in player_turn and we're watching), derive a neutral countdown
  // directly from the deadline broadcast — same deadline-driven rule, no
  // local state beyond the tick.
  const [neutralRemaining, setNeutralRemaining] = useState(() =>
    deadline !== null ? Math.max(0, Math.ceil(deadline - Date.now() / 1000)) : 0,
  )

  useEffect(() => {
    if (!alwaysShow || turnUrgency.active || deadline === null) return
    const tick = () => setNeutralRemaining(Math.max(0, Math.ceil(deadline - Date.now() / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [alwaysShow, deadline, turnUrgency.active])

  if (!turnUrgency.active && !alwaysShow) return null
  if (!turnUrgency.active && deadline === null) return null

  const remaining = turnUrgency.active ? turnUrgency.remaining : neutralRemaining
  const urgency: Urgency = turnUrgency.active ? turnUrgency.urgency : 'none'

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 font-mono text-xs tabular-nums tracking-[0.05em]',
        COLOR_CLASSES[urgency],
        PULSE_CLASSES[urgency],
      )}
    >
      <Clock size={14} />
      <span>{remaining}s</span>
    </div>
  )
}
