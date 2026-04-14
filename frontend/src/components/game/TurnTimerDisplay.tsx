import { Clock } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useTurnUrgency, type Urgency } from '../../hooks/useTurnUrgency'

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

export default function TurnTimerDisplay() {
  const { remaining, urgency } = useTurnUrgency()

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 font-mono text-xs tabular-nums',
        COLOR_CLASSES[urgency],
        PULSE_CLASSES[urgency],
      )}
    >
      <Clock size={14} />
      <span>{remaining}s</span>
    </div>
  )
}
