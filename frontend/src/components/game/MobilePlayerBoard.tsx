import { useEffect, useRef } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR, COMPANY_TICKER } from '../../lib/constants'
import { formatCash } from '../../lib/format'
import { Crown, Target, WifiOff } from 'lucide-react'
import { useTurnUrgency, type Urgency } from '../../hooks/useTurnUrgency'
import { portfolioValue, getPosition, type Position } from '../../lib/playerHelpers'

const URGENCY_DOT: Record<Urgency, string> = {
  calm: 'bg-emerald-400',
  warning: 'bg-amber-400',
  critical: 'bg-red-500',
  none: 'bg-emerald-400',
}

const URGENCY_RING: Record<Urgency, string> = {
  calm: 'ring-emerald-500/70',
  warning: 'ring-amber-500/70',
  critical: 'ring-red-500/80',
  none: 'ring-emerald-500/70',
}

const URGENCY_PULSE: Record<Urgency, string> = {
  calm: 'animate-pulse',
  warning: 'animate-pulse',
  critical: 'animate-[pulse_0.6s_ease-in-out_infinite]',
  none: 'animate-pulse',
}

function HoldingPill({
  company,
  qty,
  position,
}: {
  company: string
  qty: number
  position: Position
}) {
  const ticker = COMPANY_TICKER[company] ?? company.toUpperCase()
  return (
    <span className="inline-flex w-fit justify-self-start items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-800/60 border border-gray-700/50 text-[10px] font-mono whitespace-nowrap">
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', COMPANY_COLOR[company])} />
      <span className="text-gray-300 w-[30px]">{ticker}</span>
      <span className="text-white font-semibold ml-1 tabular-nums">{qty}</span>
      {position === 'chairman' && <Crown size={10} className="text-amber-400 flex-shrink-0" />}
      {position === 'director' && <Target size={10} className="text-sky-400 flex-shrink-0" />}
      {position === 'double_director' && (
        <span className="flex flex-shrink-0">
          <Target size={10} className="text-sky-400" />
          <Target size={10} className="text-sky-400 -ml-1" />
        </span>
      )}
    </span>
  )
}

export default function MobilePlayerBoard() {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)
  const { urgency } = useTurnUrgency()

  // Auto-scroll target tracking — split across two effects so the timeout
  // cleanup-bug pattern from Phase 3 can't reappear.
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())
  const scrollTargetRef = useRef<number | null>(null)
  const prevActivePlayerIdRef = useRef<number | null>(null)

  const activePlayerId = (() => {
    if (!gameState) return null
    const p = gameState.players.find((pl) => pl.name === gameState.current_player_name)
    return p?.id ?? null
  })()

  // Effect 1: detect a change in the active player id, but only when we're
  // actually in player_turn — never scroll during reveal / suspend / etc.
  useEffect(() => {
    if (!gameState) return
    if (gameState.phase !== 'player_turn') return
    if (activePlayerId === null) return
    if (activePlayerId === prevActivePlayerIdRef.current) return
    prevActivePlayerIdRef.current = activePlayerId
    scrollTargetRef.current = activePlayerId
  }, [activePlayerId, gameState?.phase])

  // Effect 2: when scroll target changes, call scrollIntoView on that row.
  useEffect(() => {
    if (scrollTargetRef.current === null) return
    const row = rowRefs.current.get(scrollTargetRef.current)
    if (!row) return
    row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activePlayerId, gameState?.phase])

  if (!gameState) return null

  const { players, companies, current_player_name } = gameState

  // Order strictly by turn sequence — server rotates `players` so players[0]
  // is the day's first to act. Showing them in this order (rather than
  // YOU-first) makes turn order legible at a glance, which matters for
  // buy/sell strategy.
  const ordered = players

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 overflow-y-auto mobile-scroll px-2 py-1.5 space-y-1.5 bg-gray-950"
    >
      {ordered.map((player) => {
        const isYou = player.name === playerName
        const isCurrent = player.name === current_player_name
        const isDisconnected = player.connected === false && !isYou
        const netWorth = portfolioValue(player, companies)
        const stockValue = netWorth - player.cash
        const holdings = Object.entries(player.stocks).filter(([, q]) => q > 0)

        return (
          <div
            key={player.id}
            ref={(el) => {
              if (el) rowRefs.current.set(player.id, el)
              else rowRefs.current.delete(player.id)
            }}
            className={cn(
              'rounded-lg border px-2.5 py-1.5 transition-colors',
              isCurrent && !isDisconnected && cn('ring-2', URGENCY_RING[urgency]),
              isYou && 'bg-emerald-950/20 border-emerald-800/40',
              !isYou && isCurrent && !isDisconnected && 'bg-gray-900 border-emerald-800/40',
              !isYou && !isCurrent && !isDisconnected && 'bg-gray-900/60 border-gray-800',
              isDisconnected && 'opacity-50 bg-gray-900/30 border-gray-800/50',
            )}
          >
            {/* Header row: dot · name · holdings pills · net worth */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {isCurrent && !isDisconnected ? (
                <span
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    URGENCY_DOT[urgency],
                    URGENCY_PULSE[urgency],
                  )}
                />
              ) : (
                <span className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
              )}
              {isDisconnected && <WifiOff size={11} className="text-red-400 flex-shrink-0" />}
              <span
                className={cn(
                  'font-semibold text-sm truncate max-w-[110px]',
                  isDisconnected ? 'text-gray-500' : isYou ? 'text-emerald-300' : 'text-white',
                )}
              >
                {player.name}
              </span>
              {isYou && <span className="text-[10px] text-gray-500">(you)</span>}
              <span className="ml-auto font-mono text-amber-300 font-bold text-sm">
                {formatCash(netWorth)}
              </span>
            </div>

            {/* Sub-row: Cash / Stocks */}
            <div className="flex gap-3 mt-0.5 text-[10px] font-mono text-gray-500">
              <span>
                Cash <span className="text-gray-200">{formatCash(player.cash)}</span>
              </span>
              <span>
                Stocks <span className="text-gray-200">{formatCash(stockValue)}</span>
              </span>
            </div>

            {/* Holdings pills — fixed 3-column grid (up to 6 companies = 2 rows) */}
            {holdings.length === 0 ? (
              <div className="mt-1 text-[10px] text-gray-600 italic">No holdings</div>
            ) : (
              <div className="mt-1 grid grid-cols-3 gap-1">
                {holdings.map(([company, qty]) => (
                  <HoldingPill
                    key={company}
                    company={company}
                    qty={qty}
                    position={getPosition(gameState, player.id, company)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
