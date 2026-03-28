import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR } from '../../lib/constants'
import { formatCash } from '../../lib/format'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function TradePanel({ send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')

  if (!gameState) return null

  const isMyTurn = gameState.phase === 'player_turn' && gameState.current_player_name === playerName
  const me = gameState.players.find((p) => p.is_you)
  if (!me) return null

  const company = selectedCompany !== null ? gameState.companies[selectedCompany] : null
  const cost = company ? company.value * quantity : 0

  // Validation
  const maxBuy = company
    ? Math.min(
        company.value > 0 ? Math.floor(me.cash / company.value) : 0,
        gameState.available_shares[selectedCompany!],
      )
    : 0
  const myHolding = company ? (me.stocks[company.name] ?? 0) : 0
  const maxSell = myHolding

  const canBuy = company && company.is_open && company.value > 0 && quantity > 0 && quantity <= maxBuy
  const canSell = company && quantity > 0 && quantity <= maxSell

  const executeTrade = () => {
    if (!company || selectedCompany === null) return
    const companyNum = selectedCompany + 1
    if (mode === 'buy' && canBuy) {
      send({ type: 'buy', company_num: companyNum, quantity })
    } else if (mode === 'sell' && canSell) {
      send({ type: 'sell', company_num: companyNum, quantity })
    }
    setSelectedCompany(null)
    setQuantity(1)
  }

  const passTurn = () => {
    send({ type: 'pass' })
  }

  if (!isMyTurn) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <p className="text-gray-400 text-center">
          Waiting for <span className="text-white font-medium">{gameState.current_player_name}</span>...
        </p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-4 space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setMode('buy'); setQuantity(1) }}
          className={cn(
            'flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors',
            mode === 'buy' ? 'bg-emerald-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white',
          )}
        >
          Buy
        </button>
        <button
          onClick={() => { setMode('sell'); setQuantity(1) }}
          className={cn(
            'flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors',
            mode === 'sell' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white',
          )}
        >
          Sell
        </button>
      </div>

      {/* Company selector */}
      <div className="grid grid-cols-3 gap-1.5">
        {gameState.companies.map((co, i) => (
          <button
            key={co.name}
            onClick={() => { setSelectedCompany(i); setQuantity(1) }}
            disabled={!co.is_open && mode === 'buy'}
            className={cn(
              'px-2 py-1.5 rounded text-xs font-medium transition-colors border',
              selectedCompany === i
                ? 'border-emerald-500 bg-emerald-500/10 text-white'
                : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500',
              !co.is_open && mode === 'buy' && 'opacity-30 cursor-not-allowed',
            )}
          >
            <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', COMPANY_COLOR[co.name])} />
            {co.name}
          </button>
        ))}
      </div>

      {/* Quantity + preview */}
      {company && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400">Qty</label>
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
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
            <span className="text-xs text-gray-500 ml-auto">
              max: {mode === 'buy' ? maxBuy : maxSell}
            </span>
          </div>

          <div className="text-sm font-mono text-gray-300 bg-gray-800 px-3 py-1.5 rounded">
            {quantity} x {company.name} @ {company.value} = {formatCash(cost)}
            {mode === 'buy' && (
              <span className="text-gray-500 ml-2">
                Balance after: {formatCash(me.cash - cost)}
              </span>
            )}
            {mode === 'sell' && (
              <span className="text-gray-500 ml-2">
                Balance after: {formatCash(me.cash + cost)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={executeTrade}
          disabled={mode === 'buy' ? !canBuy : !canSell}
          className={cn(
            'flex-1 py-2 rounded-lg font-medium transition-colors',
            mode === 'buy'
              ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white'
              : 'bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white',
          )}
        >
          {mode === 'buy' ? 'Buy' : 'Sell'}
        </button>
        <button
          onClick={passTurn}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition-colors"
        >
          Pass
        </button>
      </div>
    </div>
  )
}
