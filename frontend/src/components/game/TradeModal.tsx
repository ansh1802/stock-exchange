import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR, COMPANY_TICKER } from '../../lib/constants'
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
  const isMobile = useIsMobile()
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)

  // RI smart-fill — must be before early returns (hook rules)
  // Returns the optimal qty to trade to best position for Rights Issue next turn.
  // Buy: max shares you can buy while still affording full RI afterwards.
  // Sell: min shares to sell so your cash covers full RI on remaining holdings.
  // Returns null when the button should be disabled.
  const riQty = useMemo(() => {
    if (!gameState || selectedCompany === null) return null
    const me = gameState.players.find((p) => p.is_you)
    if (!me) return null
    const company = gameState.companies[selectedCompany]
    if (!company || company.value <= 0) return null

    const h = me.stocks[company.name] ?? 0
    const p = company.value
    const riPrice = Math.max(5, Math.floor(p / 10) * 5)
    const c = me.cash
    const avail = gameState.available_shares[selectedCompany]
    const maxBuyLocal = Math.min(Math.floor(c / p), avail)

    if (mode === 'buy') {
      // Scan from maxBuy down: find largest q where cash after buying covers full RI
      for (let q = maxBuyLocal; q >= 1; q--) {
        if (c - q * p >= Math.floor((h + q) / 2) * riPrice) return q
      }
      return null
    } else {
      // Scan from 0 up: find minimum shares to sell so cash covers RI on remaining holdings
      for (let s = 0; s <= h; s++) {
        const eligible = Math.floor((h - s) / 2)
        if (eligible === 0) break // selling this much destroys all RI eligibility
        if (c + s * p >= eligible * riPrice) return s
      }
      return null
    }
  }, [gameState, selectedCompany, mode])

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

  // RI scenario after current quantity selection
  const riPreview = company && company.value > 0
    ? (() => {
        const h = myHolding
        const p = company.value
        const riPrice = Math.max(5, Math.floor(p / 10) * 5)
        const newHoldings = mode === 'buy' ? h + quantity : h - quantity
        const eligible = Math.floor(Math.max(0, newHoldings) / 2)
        const riCost = eligible * riPrice
        return { eligible, riPrice, riCost }
      })()
    : null

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

  const riButtonLabel = isBuy
    ? `RI buy ${riQty ?? '—'}`
    : riQty === 0
    ? 'RI: funded'
    : `RI sell ${riQty ?? '—'}`

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
        <div className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-3')}>
          {gameState.companies.map((co, i) => {
            const disabled = isBuy && (!co.is_open || co.value <= 0)
            const holdingQty = me.stocks[co.name] ?? 0
            const noShares = !isBuy && holdingQty === 0
            const label = isMobile ? (co.ticker || COMPANY_TICKER[co.name] || co.name) : co.name
            return (
              <button
                key={co.name}
                onClick={() => { setSelectedCompany(i); setQuantity(1) }}
                disabled={disabled || noShares}
                className={cn(
                  'rounded-lg text-xs font-medium transition-all border',
                  isMobile ? 'px-2 min-h-[44px]' : 'px-2 py-2',
                  selectedCompany === i
                    ? isBuy
                      ? 'border-emerald-500 bg-emerald-500/10 text-white ring-1 ring-emerald-500/30'
                      : 'border-red-500 bg-red-500/10 text-white ring-1 ring-red-500/30'
                    : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-500',
                  (disabled || noShares) && 'opacity-30 cursor-not-allowed',
                )}
              >
                <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', COMPANY_COLOR[co.name])} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Quantity + preview */}
        {company && (
          <div className="space-y-3">
            <div className={cn('flex items-center flex-wrap', isMobile ? 'gap-1.5' : 'gap-2')}>
              <label className="text-xs text-gray-400">Qty</label>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 5))}
                className={cn(
                  'bg-gray-800 rounded text-gray-300 hover:bg-gray-700 text-xs',
                  isMobile ? 'w-11 h-11' : 'w-7 h-7',
                )}
              >
                -5
              </button>
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className={cn(
                  'bg-gray-800 rounded text-gray-300 hover:bg-gray-700',
                  isMobile ? 'w-11 h-11' : 'w-7 h-7',
                )}
              >
                -
              </button>
              <span className="font-mono text-white w-10 text-center text-lg">{quantity}</span>
              <button
                onClick={() => setQuantity(Math.min(maxQty, quantity + 1))}
                className={cn(
                  'bg-gray-800 rounded text-gray-300 hover:bg-gray-700',
                  isMobile ? 'w-11 h-11' : 'w-7 h-7',
                )}
              >
                +
              </button>
              <button
                onClick={() => setQuantity(Math.min(maxQty, quantity + 5))}
                className={cn(
                  'bg-gray-800 rounded text-gray-300 hover:bg-gray-700 text-xs',
                  isMobile ? 'w-11 h-11' : 'w-7 h-7',
                )}
              >
                +5
              </button>
              {/* Max button */}
              <button
                onClick={() => setQuantity(maxQty)}
                disabled={maxQty === 0}
                className={cn(
                  'text-xs font-medium px-2 py-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed',
                  isBuy
                    ? 'border-emerald-600 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20'
                    : 'border-red-600 bg-red-600/10 text-red-400 hover:bg-red-600/20',
                )}
              >
                max {maxQty}
              </button>
              {/* RI smart-fill button */}
              <button
                onClick={() => riQty !== null && setQuantity(riQty)}
                disabled={riQty === null || riQty === 0}
                title={
                  isBuy
                    ? 'Buy this many to maximise shares while keeping cash for full Rights Issue'
                    : 'Sell minimum shares to fund a full Rights Issue on your current holdings'
                }
                className={cn(
                  'text-xs font-medium px-2 py-1 rounded border disabled:opacity-30 disabled:cursor-not-allowed',
                  'border-amber-600 bg-amber-600/10 text-amber-400 hover:bg-amber-600/20',
                )}
              >
                {riButtonLabel}
              </button>
            </div>

            <div className="text-sm font-mono bg-gray-800/50 px-3 py-2 rounded-lg space-y-1">
              <div className="text-gray-300">
                {quantity} × {company.name} @ ${company.value} = {formatCash(cost)}
              </div>
              <div className="text-gray-500 text-xs">
                Balance after: {formatCash(isBuy ? me.cash - cost : me.cash + cost)}
              </div>
              {riPreview && (
                <div className="text-amber-600/80 text-xs">
                  RI eligible after: {riPreview.eligible} × ${riPreview.riPrice} = {formatCash(riPreview.riCost)}
                </div>
              )}
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
