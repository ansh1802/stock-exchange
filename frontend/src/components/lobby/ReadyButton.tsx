import { useState, useEffect } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function ReadyButton({ send }: Props) {
  const players = useGameStore((s) => s.lobbyPlayers)
  const autoready = useGameStore((s) => s.autoready)
  const me = players.find((p) => p.is_you)
  const ready = me?.ready ?? false

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    if (!autoready?.active || autoready.deadline == null) {
      setSecondsLeft(null)
      return
    }
    const deadline = autoready.deadline
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil(deadline - Date.now() / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [autoready?.active, autoready?.deadline])

  if (!me) return null

  const waitingOnMe = !!autoready?.active && autoready.waiting_on.includes(me.id)

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => send({ type: 'ready', ready: !ready })}
        className={cn(
          'w-full py-2.5 font-medium rounded-2xl transition-colors',
          ready
            ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white',
        )}
      >
        {ready ? 'Not ready' : "I'm ready"}
      </button>
      {autoready?.active && secondsLeft !== null && (
        <p className={cn('text-center text-xs', waitingOnMe ? 'text-amber-400' : 'text-gray-500')}>
          {waitingOnMe
            ? `Auto-ready in ${secondsLeft}s if you don't respond`
            : `Waiting on a straggler — auto-ready in ${secondsLeft}s`}
        </p>
      )}
    </div>
  )
}
