import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR, COMPANY_TEXT_COLOR } from '../../lib/constants'
import { formatCash } from '../../lib/format'
import { Crown, Target, PiggyBank } from 'lucide-react'

export default function PlayerBoard() {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)

  // Track which player just used LoanStock (show piggy bank briefly)
  const [loanStockPlayerId, setLoanStockPlayerId] = useState<number | null>(null)
  const prevLogLen = useRef(0)

  useEffect(() => {
    if (!gameState) return
    const log = gameState.game_log
    if (log.length > prevLogLen.current) {
      const latest = log[log.length - 1]
      if (latest.includes('Loan Stock used')) {
        // Find the player who used it from the log entry format: "PlayerName: Loan Stock used..."
        const actorName = latest.split(':')[0].trim()
        const player = gameState.players.find((p) => p.name === actorName)
        if (player) {
          setLoanStockPlayerId(player.id)
          setTimeout(() => setLoanStockPlayerId(null), 3000)
        }
      }
    }
    prevLogLen.current = log.length
  }, [gameState?.game_log, gameState?.players])

  if (!gameState) return null

  const { players, companies, chairman, directors, current_player_name } = gameState

  // Compute portfolio value for a player
  const portfolioValue = (player: typeof players[0]) => {
    let total = player.cash
    for (const co of companies) {
      const held = player.stocks[co.name] ?? 0
      if (held > 0 && co.is_open) {
        total += held * co.value
      }
    }
    return total
  }

  // Get position for a player+company
  const getPosition = (playerId: number, companyName: string) => {
    if (chairman[companyName] === playerId) return 'chairman'
    if (directors[companyName]?.includes(playerId)) {
      const p = gameState.players.find((p) => p.id === playerId)
      if (p && (p.stocks[companyName] ?? 0) >= 100) return 'double_director'
      return 'director'
    }
    return null
  }

  // Fixed 6-slot grid (2 rows x 3 cols), empty slots for < 6 players
  const slots = Array.from({ length: 6 }, (_, i) => players[i] ?? null)

  return (
    <div className="grid grid-cols-3 grid-rows-2 gap-3 h-full">
      {slots.map((player, slotIdx) => {
        if (!player) {
          return (
            <div
              key={`empty-${slotIdx}`}
              className="rounded-xl border border-gray-800/40 bg-gray-900/20"
            />
          )
        }

        const isCurrent = player.name === current_player_name
        const isYou = player.name === playerName
        const holdings = Object.entries(player.stocks).filter(([, qty]) => qty > 0)
        const netWorth = portfolioValue(player)

        return (
          <div
            key={player.id}
            className={cn(
              'rounded-xl border p-4 flex flex-col gap-2.5 transition-all duration-300',
              isCurrent && 'ring-2 ring-emerald-500/70 border-emerald-800/50',
              isYou && !isCurrent && 'bg-emerald-950/10 border-gray-700',
              !isYou && !isCurrent && 'bg-gray-900/50 border-gray-800',
              isCurrent && isYou && 'bg-emerald-950/20 border-emerald-800/50',
            )}
          >
            {/* Name + Net Worth row */}
            <div className="flex items-center gap-2">
              {isCurrent && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
              <span className={cn(
                'text-base font-bold truncate',
                isCurrent ? 'text-emerald-300' : isYou ? 'text-white' : 'text-gray-300',
              )}>
                {player.name}
                {isYou && <span className="text-gray-500 font-normal text-sm ml-1">(you)</span>}
              </span>
              <span className="text-amber-300 font-mono text-sm font-semibold ml-auto">
                {formatCash(netWorth)}
              </span>
            </div>

            {/* Cash + Portfolio */}
            <div className="flex gap-4 text-sm font-mono">
              <div>
                <span className="text-gray-500">Cash </span>
                <span className="text-gray-200">{formatCash(player.cash)}</span>
              </div>
              <div>
                <span className="text-gray-500">Stocks </span>
                <span className="text-gray-200">{formatCash(netWorth - player.cash)}</span>
              </div>
            </div>

            {/* Holdings */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
              {holdings.length === 0 && (
                <p className="text-xs text-gray-600 italic">No holdings</p>
              )}
              {holdings.map(([company, qty]) => {
                const position = getPosition(player.id, company)
                return (
                  <div key={company} className="flex items-center gap-2 text-sm">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', COMPANY_COLOR[company])} />
                    <span className={cn('truncate', COMPANY_TEXT_COLOR[company])}>{company}</span>
                    <span className="text-gray-400 font-mono ml-auto">{qty}</span>
                    {position === 'chairman' && (
                      <Crown size={14} className="text-amber-400 flex-shrink-0" />
                    )}
                    {position === 'director' && (
                      <Target size={14} className="text-sky-400 flex-shrink-0" />
                    )}
                    {position === 'double_director' && (
                      <span className="flex flex-shrink-0">
                        <Target size={14} className="text-sky-400" />
                        <Target size={14} className="text-sky-400 -ml-1" />
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Loan Stock piggy bank indicator */}
            <AnimatePresence>
              {loanStockPlayerId === player.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="flex items-center gap-1.5 text-sm text-pink-400"
                >
                  <PiggyBank size={18} className="text-pink-400" />
                  <span className="font-mono">Loan Stock</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
