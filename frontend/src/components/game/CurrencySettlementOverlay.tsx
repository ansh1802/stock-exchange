import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { formatCash } from '../../lib/format'
import type { ClientMessage } from '../../types/messages'

interface Props {
  onComplete: () => void
  send: (msg: ClientMessage) => void
}

interface CurrencyEffect {
  playerName: string
  before: number
  after: number
  type: '+' | '-'
}

export default function CurrencySettlementOverlay({ onComplete, send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const [visibleIdx, setVisibleIdx] = useState(-1)
  const [effects, setEffects] = useState<CurrencyEffect[]>([])
  const sentRef = useRef(false)

  // On mount, tell backend to process currency settlement — it will apply effects
  // and broadcast updated state with game_log entries we can parse
  useEffect(() => {
    if (!sentRef.current) {
      sentRef.current = true
      send({ type: 'complete_currency_settlement' })
    }
  }, [send])

  // Parse currency effects from the game log (populated after backend processes our signal)
  useEffect(() => {
    if (!gameState) return

    const log = gameState.game_log
    const parsed: CurrencyEffect[] = []

    for (const entry of log) {
      // Match pattern: "Player X: 600 -> 660" from currency_settlement
      const match = entry.match(/Player (\d+): ([\d.]+) -> ([\d.]+)/)
      if (match) {
        const pid = parseInt(match[1])
        const before = parseFloat(match[2])
        const after = parseFloat(match[3])
        const player = gameState.players.find((p) => p.id === pid)
        if (player) {
          parsed.push({
            playerName: player.name,
            before,
            after,
            type: after > before ? '+' : '-',
          })
        }
      }
    }

    setEffects(parsed)

    if (parsed.length === 0) {
      // No currency effects (yet or at all) — auto-complete quickly
      const t = setTimeout(onComplete, 1200)
      return () => clearTimeout(t)
    }
  }, [gameState, onComplete])

  // Stagger reveal effects
  useEffect(() => {
    if (effects.length === 0) return

    const timers: ReturnType<typeof setTimeout>[] = []

    effects.forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleIdx(i), 800 + i * 600))
    })

    // Auto-complete after all shown
    timers.push(setTimeout(onComplete, 800 + effects.length * 600 + 1500))

    return () => timers.forEach(clearTimeout)
  }, [effects, onComplete])

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4 } }}
    >
      <div className="absolute inset-0 bg-gray-950/95" />

      {/* Subtle radial gradient */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: effects.length > 0
            ? 'radial-gradient(ellipse at center, rgba(34,197,94,0.1) 0%, transparent 60%)'
            : 'none',
        }}
      />

      <div className="relative w-full max-w-md mx-auto px-8 space-y-8">
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-1"
        >
          <p className="text-gray-600 text-xs tracking-[0.3em] uppercase font-mono">Phase</p>
          <h2
            className="text-2xl text-gray-300 tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Currency Settlement
          </h2>
        </motion.div>

        {effects.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-gray-600 font-mono text-sm"
          >
            No currency cards in play
          </motion.p>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {effects.map((effect, i) => (
                i <= visibleIdx && (
                  <motion.div
                    key={effect.playerName}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    className="flex items-center justify-between px-4 py-3 rounded-xl border bg-gray-900/60 border-gray-800"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        effect.type === '+' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
                      }`}>
                        {effect.type === '+' ? 'Currency +' : 'Currency -'}
                      </span>
                      <span className="text-sm text-gray-300">{effect.playerName}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-sm">
                      <span className="text-gray-500">{formatCash(effect.before)}</span>
                      <span className="text-gray-700">&rarr;</span>
                      <motion.span
                        initial={{ scale: 1.3 }}
                        animate={{ scale: 1 }}
                        className={effect.type === '+' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}
                      >
                        {formatCash(effect.after)}
                      </motion.span>
                    </div>
                  </motion.div>
                )
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  )
}
