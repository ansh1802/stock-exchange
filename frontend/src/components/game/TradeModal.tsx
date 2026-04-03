import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR } from '../../lib/constants'
import { formatCash } from '../../lib/format'
import { X } from 'lucide-react'
import type { ClientMessage } from '../../types/messages'

interface Props {
  mode: 'buy' | 'sell'
  send: (msg: ClientMessage) => void
  onClose: () => void
}

export default function TradeModal({ mode, send, onClose }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)

  if (!gameState) return null

  const me = gameState.players.find((p) => p.is_you)
  if (!me) return null

  const company = selectedCompany !== null ? gameState.companies[selectedCompany] : null
  const cost = company ? company.value * quantity : 0

  const maxBuy = company
    ? Math.min(
        company.value > 0 ? Math.floor(me.cash / company.value) : 0,
        gameState.available_shares[selectedCompany!],
      )
    : 0
  const myHolding = company ? (me.stocks[company.name] ?? 0) : 0
  const maxSell = myHolding
  const maxQty = mode === 'buy' ? maxBuy : maxSell

  const canExecute = company && quantity > 0 && quantity <= maxQty &&
    (mode === 'buy' ? company.is_open && company.value > 0 : true)

  const handleExecute = () => {
    if (!canExecute || selectedCompany === null) return
    const companyNum = selectedCompany + 1
    if (mode === 'buy') {
      send({ type: 'buy', company_num: companyNum, quantity })
    } else {
      send({ type: 'sell', company_num: companyNum, quantity })
    }
    onClose()
  }

  const isBuy = mode === 'buy'

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm mx-4 bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className={cn(
            'text-lg font-bold',
            isBuy ? 'text-emerald-400' : 'text-red-400',
          )}>
            {isBuy ? 'Buy Shares' : 'Sell Shares'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Company selector */}
        <div className="grid grid-cols-3 gap-2">
          {gameState.companies.map((co, i) => {
            const disabled = isBuy && (!co.is_open || co.value <= 0)
            const holdingQty = me.stocks[co.name] ?? 0
            const noShares = !isBuy && holdingQty === 0
            return (
              <button
                key={co.name}
                onClick={() => { setSelectedCompany(i); setQuantity(1) }}
                disabled={disabled || noShares}
                className={cn(
                  'px-2 py-2 rounded-lg text-xs font-medium transition-all border',
                  selectedCompany === i
                    ? isBuy
                      ? 'border-emerald-500 bg-emerald-500/10 text-white ring-1 ring-emerald-500/30'
                      : 'border-red-500 bg-red-500/10 text-white ring-1 ring-red-500/30'
                    : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500',
                  (disabled || noShares) && 'opacity-30 cursor-not-allowed',
                )}
              >
                <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', COMPANY_COLOR[co.name])} />
                {co.name}
              </button>
            )
          })}
        </div>

        {/* Quantity + preview */}
        {company && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400">Qty</label>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 5))}
                className="w-7 h-7 bg-gray-800 rounded text-gray-300 hover:bg-gray-700 text-xs"
              >
                -5
              </button>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-7 h-7 bg-gray-800 rounded text-gray-300 hover:bg-gray-700"
              >
                -
              </button>
              <span className="font-mono text-white w-10 text-center text-lg">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                className="w-7 h-7 bg-gray-800 rounded text-gray-300 hover:bg-gray-700"
              >
                +
              </button>
              <button
                onClick={() => setQuantity(Math.min(maxQty, quantity + 5))}
                className="w-7 h-7 bg-gray-800 rounded text-gray-300 hover:bg-gray-700 text-xs"
              >
                +5
              </button>
              <span className="text-[10px] text-gray-500 ml-auto">
                max {maxQty}
              </span>
            </div>

            <div className="text-sm font-mono bg-gray-800/50 px-3 py-2 rounded-lg space-y-1">
              <div className="text-gray-300">
                {quantity} x {company.name} @ ${company.value} = {formatCash(cost)}
              </div>
              <div className="text-gray-500 text-xs">
                Balance after: {formatCash(isBuy ? me.cash - cost : me.cash + cost)}
              </div>
            </div>
          </div>
        )}

        {/* Confirm */}
        <motion.button
          onClick={handleExecute}
          disabled={!canExecute}
          whileHover={canExecute ? { scale: 1.02 } : {}}
          whileTap={canExecute ? { scale: 0.98 } : {}}
          className={cn(
            'w-full py-3 rounded-xl font-medium transition-colors',
            canExecute
              ? isBuy
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-gray-800 text-gray-600 cursor-not-allowed',
          )}
        >
          {isBuy ? 'Confirm Buy' : 'Confirm Sell'}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
