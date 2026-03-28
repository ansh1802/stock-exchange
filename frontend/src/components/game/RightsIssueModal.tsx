import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function RightsIssueModal({ send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)
  const [quantity, setQuantity] = useState(0)

  if (!gameState || gameState.rights_issue_company === null) return null

  const companyIdx = gameState.rights_issue_company - 1
  const company = gameState.companies[companyIdx]

  // Check if it's our turn in the queue (by matching current_player_name)
  const isMyTurn = gameState.current_player_name === playerName

  const handleBuy = () => {
    send({ type: 'rights_issue_buy', quantity })
    setQuantity(0)
  }

  const handlePass = () => {
    send({ type: 'rights_issue_buy', quantity: 0 })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-lg font-bold text-white">Rights Issue</h3>
        <p className="text-sm text-gray-400">
          <span className="text-white font-medium">{company?.name}</span> shares available at{' '}
          <span className="text-emerald-400 font-mono">$10</span> each
        </p>

        {isMyTurn ? (
          <>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-400">Quantity</label>
              <button
                onClick={() => setQuantity(Math.max(0, quantity - 1))}
                className="w-7 h-7 bg-gray-800 rounded text-gray-300 hover:bg-gray-700"
              >
                -
              </button>
              <span className="font-mono text-white w-8 text-center">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-7 h-7 bg-gray-800 rounded text-gray-300 hover:bg-gray-700"
              >
                +
              </button>
            </div>
            {quantity > 0 && (
              <p className="text-sm font-mono text-gray-400">
                Cost: ${quantity * 10}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleBuy}
                disabled={quantity === 0}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium"
              >
                Buy {quantity}
              </button>
              <button
                onClick={handlePass}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium"
              >
                Pass
              </button>
            </div>
          </>
        ) : (
          <p className="text-gray-400 text-center py-4">
            Waiting for <span className="text-white">{gameState.current_player_name}</span>...
          </p>
        )}
      </div>
    </div>
  )
}
