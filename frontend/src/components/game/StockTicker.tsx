import { useGameStore } from '../../store/useGameStore'
import { COMPANY_COLOR, COMPANY_TICKER } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { useIsMobile } from '../../hooks/useIsMobile'
import { useTheme } from '../../hooks/useTheme'

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
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
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

const V2_COMPANY_HEX: Record<string, string> = {
  Vodafone: '#c44a3f',
  YesBank: '#2c5d8a',
  Cred: '#6b3d8e',
  TCS: '#1f6d7a',
  Reliance: '#c66a2f',
  Infosys: '#3d7a4a',
}

export default function StockTicker() {
  const gameState = useGameStore((s) => s.gameState)
  const isMobile = useIsMobile()
  const theme = useTheme()
  if (!gameState) return null

  const { price_history } = gameState

  if (theme === 'v2') {
    if (isMobile) {
      return (
        <div
          className="grid grid-cols-3 gap-px px-1 py-1.5"
          style={{
            background: 'var(--color-paper-line)',
            borderBottom: '1px solid var(--color-ink)',
          }}
        >
          {gameState.companies.map((co) => {
            const ticker = co.ticker || COMPANY_TICKER[co.name] || co.name.toUpperCase()
            const hex = V2_COMPANY_HEX[co.name] ?? '#7a6f5b'
            return (
              <div
                key={co.name}
                className={cn('relative px-2 py-1.5', !co.is_open && 'opacity-50')}
                style={{ background: 'var(--color-paper)' }}
              >
                <span
                  aria-hidden
                  className="absolute left-0 top-1 bottom-1 w-[3px]"
                  style={{ background: hex }}
                />
                <div className="flex items-center justify-between pl-1.5">
                  <span
                    className="font-mono font-semibold tracking-[0.1em]"
                    style={{ fontSize: 10, color: 'var(--color-ink-2)' }}
                  >
                    {ticker}
                  </span>
                  {!co.is_open && (
                    <span
                      className="font-mono font-bold"
                      style={{ fontSize: 8, color: 'var(--color-sell)' }}
                    >
                      ✕
                    </span>
                  )}
                </div>
                <div className="flex items-baseline pl-1.5 mt-0.5">
                  <span
                    className="font-serif leading-none"
                    style={{ fontSize: 18, color: 'var(--color-ink)' }}
                  >
                    {co.value}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    return (
      <div
        className="flex gap-0 px-2 py-2 overflow-x-auto"
        style={{
          background: 'var(--color-paper)',
          borderBottom: '1px solid var(--color-ink)',
        }}
      >
        {gameState.companies.map((co, i) => {
          const hex = V2_COMPANY_HEX[co.name] ?? '#7a6f5b'

          const historyForCompany = price_history.map((day) => day[i])
          const sparkData = [...historyForCompany.slice(-5), co.value]

          return (
            <div
              key={co.name}
              className={cn(
                'relative flex-1 min-w-[150px] px-3 py-2 transition-opacity',
                i > 0 && 'border-l',
                !co.is_open && 'opacity-50',
              )}
              style={{
                borderColor: 'var(--color-paper-line)',
              }}
            >
              <span
                aria-hidden
                className="absolute left-0 top-1.5 bottom-1.5 w-[3px]"
                style={{ background: hex }}
              />
              <div className="flex items-center gap-2 pl-2">
                <span
                  className="font-mono font-semibold tracking-[0.15em] truncate"
                  style={{ fontSize: 10, color: 'var(--color-ink-2)' }}
                >
                  {(co.ticker || co.name).toUpperCase()}
                </span>
                {!co.is_open && (
                  <span
                    className="font-mono ml-auto"
                    style={{ fontSize: 9, color: 'var(--color-sell)', letterSpacing: '0.15em' }}
                  >
                    SUSPENDED
                  </span>
                )}
              </div>
              <div className="flex items-end gap-2 mt-0.5 pl-2">
                <span
                  className="font-serif leading-none"
                  style={{ fontSize: 26, color: 'var(--color-ink)' }}
                >
                  {co.value}
                </span>
                {sparkData.length >= 2 && (
                  <div className="ml-auto">
                    <Sparkline values={sparkData} color="var(--color-gold-deep)" />
                  </div>
                )}
              </div>
              <div
                className="font-mono mt-0.5 pl-2"
                style={{ fontSize: 9, color: 'var(--color-ink-muted)', letterSpacing: '0.1em' }}
              >
                {gameState.available_shares[i]} avail
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // v1 — unchanged
  if (isMobile) {
    return (
      <div className="grid grid-cols-3 gap-1.5 px-3 py-1.5 bg-gray-900 border-b border-gray-800">
        {gameState.companies.map((co) => {
          const ticker = co.ticker || COMPANY_TICKER[co.name] || co.name.toUpperCase()
          return (
            <div
              key={co.name}
              className={cn(
                'px-2 py-1 rounded-md border',
                co.is_open
                  ? 'bg-gray-800/60 border-gray-700'
                  : 'bg-gray-800/20 border-gray-800 opacity-50',
              )}
            >
              <div className="flex items-center gap-1">
                <span className={cn('w-1.5 h-1.5 rounded-full', COMPANY_COLOR[co.name])} />
                <span className="text-[10px] font-mono font-semibold text-gray-300 tracking-wider">
                  {ticker}
                </span>
                {!co.is_open && (
                  <span className="text-[8px] text-red-400 ml-auto font-semibold">X</span>
                )}
              </div>
              <div className="flex items-baseline mt-0.5">
                <span className="text-sm font-mono font-bold leading-tight text-white">
                  {co.value}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex gap-1 px-2 py-2 bg-gray-900 border-b border-gray-800 overflow-x-auto">
      {gameState.companies.map((co, i) => {
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
              <span className="text-xs font-mono font-semibold tracking-wider text-gray-300 truncate">
                {co.name.toUpperCase()}
              </span>
              {!co.is_open && <span className="text-[10px] text-red-400 ml-auto">CLOSED</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-lg font-mono font-bold text-white">{co.value}</span>
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
