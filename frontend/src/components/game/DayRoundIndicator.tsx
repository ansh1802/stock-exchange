import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { useTurnUrgency } from '../../hooks/useTurnUrgency'
import { useIsMobile } from '../../hooks/useIsMobile'
import TurnTimerDisplay from './TurnTimerDisplay'

interface Props {
  isConnected: boolean
}

export default function DayRoundIndicator({ isConnected }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)
  const turnUrgency = useTurnUrgency()
  const isMobile = useIsMobile()
  if (!gameState) return null

  const isMyTurn = gameState.phase === 'player_turn' && gameState.current_player_name === playerName

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
            Round <span className="text-white font-bold">{gameState.round + 1}</span>
            <span className="text-gray-500">/3</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TurnTimerDisplay alwaysShow />
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
          Round <span className="text-white font-bold">{gameState.round + 1}</span>/3
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
        {turnUrgency.active ? (
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
