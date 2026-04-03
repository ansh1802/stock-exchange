import { useGameStore } from '../../store/useGameStore'
import { COMPANY_COLOR } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

// Inline SVG sparkline from price history
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null

  const w = 60
  const h = 20
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - ((v - min) / range) * (h - 2) - 1
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={w} height={h} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  )
}

// Map company bg color classes to stroke hex colors for SVG
const SPARK_COLORS: Record<string, string> = {
  Vodafone: '#f87171',
  YesBank: '#60a5fa',
  Cred: '#c084fc',
  TCS: '#22d3ee',
  Reliance: '#fb923c',
  Infosys: '#4ade80',
}

export default function StockTicker() {
  const gameState = useGameStore((s) => s.gameState)
  if (!gameState) return null

  const { price_history } = gameState

  return (
    <div className="flex gap-1 px-2 py-2 bg-gray-900 border-b border-gray-800 overflow-x-auto">
      {gameState.companies.map((co, i) => {
        const diff = co.value - co.prev_value
        const isUp = diff > 0

        // Build sparkline data: last 5 days from history + current value
        const historyForCompany = price_history.map((day) => day[i])
        const sparkData = [...historyForCompany.slice(-5), co.value]

        return (
          <div
            key={co.name}
            className={cn(
              'flex-1 min-w-[140px] px-3 py-2 rounded-lg border transition-colors',
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
            <div className="flex items-center gap-2 mt-1">
              <div className="flex items-baseline gap-1">
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
              {sparkData.length >= 2 && (
                <Sparkline values={sparkData} color={SPARK_COLORS[co.name] ?? '#9ca3af'} />
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
