import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import type { ClientMessage } from '../../types/messages'
import TradeModal from './TradeModal'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function ActionBar({ send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)
  const [tradeMode, setTradeMode] = useState<'buy' | 'sell' | null>(null)

  if (!gameState) return null

  const isMyTurn = gameState.phase === 'player_turn' && gameState.current_player_name === playerName

  const handlePass = () => {
    send({ type: 'pass' })
  }

  return (
    <>
      <div className="px-4 py-2 bg-gray-900 border-t border-gray-800">
        {isMyTurn ? (
          <div className="flex gap-2 max-w-lg mx-auto">
            <motion.button
              onClick={() => setTradeMode('buy')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Buy
            </motion.button>
            <motion.button
              onClick={() => setTradeMode('sell')}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Sell
            </motion.button>
            <motion.button
              onClick={handlePass}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex-1 py-2.5 rounded-lg font-medium text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
            >
              Pass
            </motion.button>
          </div>
        ) : (
          <p className="text-center text-sm text-gray-500">
            Waiting for <span className="text-gray-300 font-medium">{gameState.current_player_name}</span>...
          </p>
        )}
      </div>

      {tradeMode && (
        <TradeModal
          mode={tradeMode}
          send={send}
          onClose={() => setTradeMode(null)}
        />
      )}
    </>
  )
}
