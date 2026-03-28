import { useGameStore } from '../../store/useGameStore'
import { COMPANY_COLOR } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function StockTicker() {
  const gameState = useGameStore((s) => s.gameState)
  if (!gameState) return null

  return (
    <div className="flex gap-1 px-2 py-2 bg-gray-900 border-b border-gray-800 overflow-x-auto">
      {gameState.companies.map((co, i) => {
        const diff = co.value - co.prev_value
        const isUp = diff > 0

        return (
          <div
            key={co.name}
            className={cn(
              'flex-1 min-w-[130px] px-3 py-2 rounded-lg border transition-colors',
              co.is_open
                ? 'bg-gray-800/50 border-gray-700'
                : 'bg-gray-800/20 border-gray-800 opacity-50',
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full', COMPANY_COLOR[co.name])} />
              <span className="text-xs text-gray-400 truncate">{co.name}</span>
              {!co.is_open && <span className="text-[10px] text-red-400 ml-auto">CLOSED</span>}
            </div>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-lg font-mono font-bold text-white">{co.value}</span>
              {diff !== 0 && (
                <span
                  className={cn(
                    'flex items-center gap-0.5 text-xs font-mono',
                    isUp ? 'text-emerald-400' : 'text-red-400',
                  )}
                >
                  {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {isUp ? '+' : ''}{diff}
                </span>
              )}
              {diff === 0 && (
                <span className="flex items-center text-xs text-gray-500">
                  <Minus size={12} />
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-500 font-mono mt-0.5">
              {gameState.available_shares[i]} avail
            </div>
          </div>
        )
      })}
    </div>
  )
}
