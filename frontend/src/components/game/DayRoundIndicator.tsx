import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'

interface Props {
  isConnected: boolean
}

export default function DayRoundIndicator({ isConnected }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)
  if (!gameState) return null

  const isMyTurn = gameState.phase === 'player_turn' && gameState.current_player_name === playerName

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 text-sm">
      <div className="flex items-center gap-4">
        <span className="font-mono text-gray-300">
          Day <span className="text-white font-bold">{gameState.day}</span>/10
        </span>
        <span className="font-mono text-gray-300">
          Round <span className="text-white font-bold">{gameState.round + 1}</span>/3
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
        <span className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-emerald-400' : 'bg-red-400')} />
        <span className="text-gray-500 text-xs">{gameState.room_code}</span>
      </div>
    </div>
  )
}
