import { useEffect, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { useTurnUrgency } from '../../hooks/useTurnUrgency'
import { useIsMobile } from '../../hooks/useIsMobile'
import TurnTimerDisplay from './TurnTimerDisplay'

interface Props {
  isConnected: boolean
}

// Tracks the absolute `day_end_countdown_deadline` and emits a 3..2..1
// integer suitable for "Ending day in Ns" display.
function useDayEndCountdown(deadline: number | null): number | null {
  const [remaining, setRemaining] = useState<number | null>(() =>
    deadline === null ? null : Math.max(0, Math.ceil(deadline - Date.now() / 1000)),
  )
  useEffect(() => {
    if (deadline === null) {
      setRemaining(null)
      return
    }
    const tick = () => setRemaining(Math.max(0, Math.ceil(deadline - Date.now() / 1000)))
    tick()
    const id = setInterval(tick, 200)
    return () => clearInterval(id)
  }, [deadline])
  return remaining
}

function DayEndingPill({ remaining }: { remaining: number }) {
  const critical = remaining <= 1
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 font-mono text-xs tabular-nums tracking-[0.05em] animate-[pulse_0.5s_ease-in-out_infinite]',
        critical ? 'text-red-400' : 'text-amber-400',
      )}
    >
      <span className="uppercase tracking-[0.15em] text-[10px]">Ending day in</span>
      <span className="font-bold">{remaining}s</span>
    </div>
  )
}

export default function DayRoundIndicator({ isConnected }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)
  const turnUrgency = useTurnUrgency()
  const isMobile = useIsMobile()
  const dayEndRemaining = useDayEndCountdown(gameState?.day_end_countdown_deadline ?? null)
  if (!gameState) return null

  const isMyTurn = gameState.phase === 'player_turn' && gameState.current_player_name === playerName
  const showDayEnd = dayEndRemaining !== null && dayEndRemaining > 0
  // During the pause `current_round` has incremented past `rounds_per_day` (-> "4/3").
  // Cap the displayed round so it doesn't briefly flash an out-of-range value.
  const displayRound = Math.min(gameState.round + 1, 3)

  if (isMobile) {
    return (
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-gray-300">
            Day <span className="text-white font-bold">{gameState.day}</span>
            <span className="text-gray-500">/10</span>
          </span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-300">
            Round <span className="text-white font-bold">{displayRound}</span>
            <span className="text-gray-500">/3</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showDayEnd ? <DayEndingPill remaining={dayEndRemaining} /> : <TurnTimerDisplay alwaysShow />}
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-emerald-400' : 'bg-red-400',
            )}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-sm">
      <div className="flex items-center gap-4">
        <span className="font-mono text-gray-300">
          Day <span className="text-white font-bold">{gameState.day}</span>/10
        </span>
        <span className="font-mono text-gray-300">
          Round <span className="text-white font-bold">{displayRound}</span>/3
        </span>
        <span className="font-mono text-gray-300">
          Turn <span className="text-white font-bold">{gameState.current_turn + 1}</span>/{gameState.num_players}
        </span>
      </div>

      <div className={cn(
        'px-3 py-1 rounded-full text-sm font-medium',
        isMyTurn
          ? 'bg-emerald-500/20 text-emerald-400 animate-pulse'
          : 'bg-gray-800 text-gray-400',
      )}>
        {isMyTurn ? 'Your turn!' : `${gameState.current_player_name}'s turn`}
      </div>

      <div className="flex items-center gap-2">
        {showDayEnd ? (
          <DayEndingPill remaining={dayEndRemaining} />
        ) : turnUrgency.active ? (
          <TurnTimerDisplay />
        ) : (
          <>
            <span className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-emerald-400' : 'bg-red-400')} />
            <span className="text-gray-500 text-xs">{gameState.room_code}</span>
          </>
        )}
      </div>
    </div>
  )
}
