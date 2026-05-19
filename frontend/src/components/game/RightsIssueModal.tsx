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
  const isMyTurn = gameState.current_player_name === playerName

  const myPlayer = gameState.players.find((p) => p.name === playerName)
  const holdings = myPlayer?.stocks[company.name] ?? 0
  const eligible = Math.floor(holdings / 2)
  const cash = myPlayer?.cash ?? 0
  const available = gameState.available_shares[companyIdx]
  const price = company.value

  const maxByCash = price > 0 ? Math.floor(cash / price) : 0
  const maxQty = Math.min(eligible, maxByCash, available)

  const limitLabel =
    maxQty <= 0
      ? null
      : maxQty === available && available <= eligible && available <= maxByCash
      ? 'limited by availability'
      : maxQty === eligible && eligible <= maxByCash
      ? 'limited by eligibility'
      : 'limited by cash'

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
          <span className="text-emerald-400 font-mono">${price}</span>{' '}
          <span className="text-gray-500 text-xs">(50% of market price)</span>
        </p>

        {/* Info grid — always visible to all players */}
        <div className="bg-gray-800 rounded-lg p-3 grid grid-cols-2 gap-y-2 text-sm">
          <span className="text-gray-400">Your holdings</span>
          <span className="text-white font-mono text-right">{holdings}</span>

          <span className="text-gray-400">Eligible qty</span>
          <span className="text-white font-mono text-right">{eligible}</span>

          <span className="text-gray-400">Cash in hand</span>
          <span className="text-white font-mono text-right">${cash}</span>

          <span className="text-gray-400">Co. availability</span>
          <span className="text-white font-mono text-right">{available}</span>

          <span className="text-gray-400">Max purchase</span>
          <span className="text-right">
            <span className="text-emerald-400 font-mono font-bold">{maxQty}</span>
            {limitLabel && (
              <span className="text-gray-500 text-xs ml-1">({limitLabel})</span>
            )}
          </span>
        </div>

        {isMyTurn ? (
          <>
            {/* Stepper — fixed layout, no conditional children to avoid button shift */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400 flex-1">Quantity</span>
              <button
                onClick={() => setQuantity(Math.max(0, quantity - 1))}
                className="w-8 h-8 bg-gray-800 rounded text-gray-300 hover:bg-gray-700 flex items-center justify-center flex-shrink-0"
              >
                −
              </button>
              <span className="font-mono text-white w-8 text-center flex-shrink-0">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                className="w-8 h-8 bg-gray-800 rounded text-gray-300 hover:bg-gray-700 flex items-center justify-center flex-shrink-0"
              >
                +
              </button>
              <button
                onClick={() => setQuantity(maxQty)}
                disabled={maxQty === 0}
                className="ml-1 px-3 h-8 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-gray-300 rounded text-xs font-medium flex-shrink-0"
              >
                Max
              </button>
            </div>

            {/* Always-rendered cost line — no conditional to prevent layout shift */}
            <p className="text-sm font-mono text-gray-400">
              Cost:{' '}
              <span className="text-white">${quantity * price}</span>
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleBuy}
                disabled={quantity === 0}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium"
              >
                {quantity > 0 ? `Buy ${quantity}` : 'Buy'}
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
            Waiting for{' '}
            <span className="text-white">{gameState.current_player_name}</span>...
          </p>
        )}
      </div>
    </div>
  )
}
