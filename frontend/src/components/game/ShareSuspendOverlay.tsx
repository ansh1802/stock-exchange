import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR, COMPANY_TEXT_COLOR } from '../../lib/constants'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function ShareSuspendOverlay({ send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)

  if (!gameState) return null

  const isMyTurn = gameState.current_player_name === playerName

  const handleSelect = (companyNum: number) => {
    send({ type: 'share_suspend', company_num: companyNum })
  }

  const handlePass = () => {
    send({ type: 'share_suspend', company_num: 0 })
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gray-950/95" />

      {/* Animated warning stripes */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.04]">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 bg-amber-500"
            style={{ top: `${i * 5 + 2}%`, left: '-100%', right: '-100%' }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{
              duration: 3,
              delay: i * 0.1,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative w-full max-w-lg mx-4 space-y-6"
      >
        {/* Title */}
        <div className="text-center space-y-2">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-block px-6 py-2 bg-amber-600/20 border border-amber-500/30 rounded-lg"
          >
            <h2
              className="text-2xl font-bold text-amber-400 tracking-wider"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Share Suspend
            </h2>
          </motion.div>
          <p className="text-sm text-gray-500 font-mono">
            Swap a company's value with its pre-fluctuation price
          </p>
        </div>

        {isMyTurn ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            {/* Company options */}
            {gameState.companies.map((co, i) => {
              const isDown = co.value < co.prev_value
              const isUp = co.value > co.prev_value
              return (
                <motion.button
                  key={co.name}
                  onClick={() => handleSelect(i + 1)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.06 }}
                  whileHover={{ scale: 1.02, x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-900/80 hover:bg-gray-800/80 rounded-xl border border-gray-800 hover:border-gray-600 transition-colors group"
                >
                  <span className="flex items-center gap-3">
                    <span className={cn('w-2.5 h-2.5 rounded-full', COMPANY_COLOR[co.name])} />
                    <span className={cn('text-sm font-medium', COMPANY_TEXT_COLOR[co.name])}>{co.name}</span>
                  </span>
                  <span className="flex items-center gap-3 font-mono text-sm">
                    <span className="text-gray-500">${co.prev_value}</span>
                    <motion.span
                      className="text-gray-700"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      &rarr;
                    </motion.span>
                    <span className={cn(
                      'font-bold',
                      isUp ? 'text-emerald-400' : isDown ? 'text-red-400' : 'text-gray-400',
                    )}>
                      ${co.value}
                    </span>
                    <span className={cn(
                      'text-xs opacity-0 group-hover:opacity-100 transition-opacity',
                      'text-amber-400',
                    )}>
                      HALT
                    </span>
                  </span>
                </motion.button>
              )
            })}

            {/* Pass button */}
            <motion.button
              onClick={handlePass}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 bg-gray-800/50 hover:bg-gray-700/50 text-gray-400 rounded-xl font-medium border border-gray-800 transition-colors"
            >
              Pass
            </motion.button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <p className="text-gray-500">
              Waiting for <span className="text-white font-medium">{gameState.current_player_name}</span>
            </p>
            <motion.div
              className="flex justify-center gap-1 mt-4"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-amber-500"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  )
}
