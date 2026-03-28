import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/useGameStore'
import { formatCash } from '../../lib/format'
import { COMPANY_COLOR } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { Trophy } from 'lucide-react'
import type { Ranking } from '../../types/game'

interface Props {
  rankings: Ranking[]
}

export default function GameOverScreen({ rankings }: Props) {
  const navigate = useNavigate()
  const reset = useGameStore((s) => s.reset)

  const handleBack = () => {
    reset()
    navigate('/')
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <Trophy className="mx-auto text-amber-400 mb-2" size={48} />
          <h1 className="text-3xl font-bold text-white">Game Over</h1>
        </div>

        <div className="space-y-2">
          {rankings.map((r, i) => (
            <div
              key={r.player_id}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl border',
                i === 0
                  ? 'bg-amber-900/20 border-amber-700/50'
                  : 'bg-gray-900 border-gray-800',
              )}
            >
              <span
                className={cn(
                  'text-2xl font-bold w-8 text-center',
                  i === 0 ? 'text-amber-400' : 'text-gray-500',
                )}
              >
                #{i + 1}
              </span>
              <div className="flex-1">
                <div className="text-white font-medium">{r.name}</div>
                <div className="flex gap-3 mt-1 text-xs text-gray-400 font-mono">
                  <span>Cash: {formatCash(r.cash)}</span>
                  <span className="text-gray-600">|</span>
                  <span>
                    Stocks:{' '}
                    {Object.entries(r.stocks)
                      .filter(([, v]) => v > 0)
                      .map(([name, count]) => (
                        <span key={name} className="inline-flex items-center gap-0.5 mr-2">
                          <span className={cn('w-1 h-1 rounded-full', COMPANY_COLOR[name])} />
                          {count}
                        </span>
                      ))}
                  </span>
                </div>
              </div>
              <span className={cn(
                'text-lg font-mono font-bold',
                i === 0 ? 'text-amber-400' : 'text-white',
              )}>
                {formatCash(r.net_worth)}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={handleBack}
          className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  )
}
