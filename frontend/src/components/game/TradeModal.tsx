import { useState, useMemo } from 'react'
import { useTutorial, tutorialAllows } from '../../tutorial/runtime/TutorialContext'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR, COMPANY_TICKER } from '../../lib/constants'
import { formatCash } from '../../lib/format'
import { X } from 'lucide-react'
import type { ClientMessage } from '../../types/messages'
import TurnTimerDisplay from './TurnTimerDisplay'

interface Props {
  mode: 'buy' | 'sell'
  send: (msg: ClientMessage) => void
  onClose: () => void
}

/** Trades are whole shares — the slider, ± buttons and ticks all snap to this. */
const QTY_STEP = 1

/** "Nice" tick intervals, ascending. */
const NICE_INTERVALS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]

/** A label only gets its own tick when it's at least this far (as a fraction
 *  of the track) from its neighbour, so labels never overlap on small maxes. */
const MIN_TICK_GAP = 0.12

/**
 * Reference tick values for a 0..max slider. Picks the smallest "nice"
 * interval that yields at most 4 segments, lists its multiples, and always
 * ends on `max` itself (dropping the last multiple if it would crowd it).
 *   max=100 → 0,25,50,75,100   max=137 → 0,50,100,137
 *   max=10  → 0,5,10           max=5   → 0,2,4,5
 */
function sliderTicks(max: number): number[] {
  if (max <= 0) return [0]
  const interval =
    NICE_INTERVALS.find((n) => max / n <= 4) ?? NICE_INTERVALS[NICE_INTERVALS.length - 1]
  const ticks: number[] = []
  for (let t = 0; t < max; t += interval) ticks.push(t)
  const last = ticks[ticks.length - 1]
  if (ticks.length > 1 && (max - last) / max < MIN_TICK_GAP) ticks.pop()
  ticks.push(max)
  return ticks
}

export default function TradeModal({ mode, send, onClose }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const isMobile = useIsMobile()
  const tutorial = useTutorial()
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const [rawQuantity, setRawQuantity] = useState(1)

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

  const maxBuy = company
    ? Math.min(
        company.value > 0 ? Math.floor(me.cash / company.value) : 0,
        gameState.available_shares[selectedCompany!],
      )
    : 0
  const myHolding = company ? (me.stocks[company.name] ?? 0) : 0
  const maxSell = myHolding
  const maxQty = mode === 'buy' ? maxBuy : maxSell

  // Single source of truth for the quantity: every control (slider, ±, Max,
  // RI, tick labels) writes through `setQuantity`, and the rendered/sent value
  // is clamped to the *current* max so a stale selection can never exceed it
  // when max shrinks (company switch, state refresh).
  const clampQty = (n: number) =>
    Math.min(maxQty, Math.max(0, Math.round(n / QTY_STEP) * QTY_STEP))
  const quantity = clampQty(rawQuantity)
  const setQuantity = (n: number) => setRawQuantity(clampQty(n))
  const ticks = sliderTicks(maxQty)
  const fillPct = maxQty > 0 ? (quantity / maxQty) * 100 : 0
  const cost = company ? company.value * quantity : 0

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

  const tutorialBlocked = !tutorialAllows(
    tutorial,
    selectedCompany === null ? null : { type: mode, company_num: selectedCompany + 1, quantity } as ClientMessage,
  )
  const confirmDisabled = !canExecute || tutorialBlocked

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
          <h3 data-tutorial="trade-mode" className={cn(
            'text-lg font-bold',
            isBuy ? 'text-emerald-400' : 'text-red-400',
          )}>
            {isBuy ? 'Buy Shares' : 'Sell Shares'}
          </h3>
          <div className="flex items-center gap-3">
            <TurnTimerDisplay />
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Company selector */}
        <div data-tutorial="trade-company" className={cn('grid gap-2', isMobile ? 'grid-cols-2' : 'grid-cols-3')}>
          {gameState.companies.map((co, i) => {
            const disabled = isBuy && (!co.is_open || co.value <= 0)
            const holdingQty = me.stocks[co.name] ?? 0
            const noShares = !isBuy && holdingQty === 0
            const label = isMobile ? (co.ticker || COMPANY_TICKER[co.name] || co.name) : co.name
            return (
              <button
                key={co.name}
                onClick={() => { setSelectedCompany(i); setRawQuantity(1) }}
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
                onClick={() => setQuantity(quantity - 5)}
                className={cn(
                  'bg-gray-800 rounded text-gray-300 hover:bg-gray-700 text-xs',
                  isMobile ? 'w-11 h-11' : 'w-7 h-7',
                )}
              >
                -5
              </button>
              <button
                onClick={() => setQuantity(quantity - 1)}
                className={cn(
                  'bg-gray-800 rounded text-gray-300 hover:bg-gray-700',
                  isMobile ? 'w-11 h-11' : 'w-7 h-7',
                )}
              >
                -
              </button>
              <span className="font-mono text-white w-10 text-center text-lg">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className={cn(
                  'bg-gray-800 rounded text-gray-300 hover:bg-gray-700',
                  isMobile ? 'w-11 h-11' : 'w-7 h-7',
                )}
              >
                +
              </button>
              <button
                onClick={() => setQuantity(quantity + 5)}
                className={cn(
                  'bg-gray-800 rounded text-gray-300 hover:bg-gray-700 text-xs',
                  isMobile ? 'w-11 h-11' : 'w-7 h-7',
                )}
              >
                +5
              </button>
            </div>

            {/* Quantity slider — always spans 0..current max, rescales as max changes */}
            <div data-tutorial="trade-slider" className="px-1">
              {/* 44px-tall hit area; the visual track is a thin bar centred inside it */}
              <div className="relative h-11">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-700 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', isBuy ? 'bg-emerald-500' : 'bg-red-500')}
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
                <input
                  type="range"
                  aria-label="Quantity"
                  min={0}
                  max={maxQty}
                  step={QTY_STEP}
                  value={quantity}
                  disabled={maxQty === 0}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className={cn(
                    // `bg-transparent!` — the v2 theme's `html[data-theme] input` rule
                    // out-specifies a plain utility and would paint the hit area grey.
                    'absolute inset-0 w-full h-full m-0 p-0 border-0 appearance-none bg-transparent! cursor-pointer touch-pan-y',
                    'focus:outline-none disabled:cursor-not-allowed',
                    // Track pseudo-elements are invisible — the bar above is the visual track
                    '[&::-webkit-slider-runnable-track]:bg-transparent [&::-webkit-slider-runnable-track]:h-full',
                    '[&::-moz-range-track]:bg-transparent [&::-moz-range-track]:h-full',
                    // Thumb: 22px circle, colour-coded to buy/sell, white ring.
                    // WebKit pins a custom thumb to the top of the track, so mt = (44 - 22) / 2 centres it.
                    '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[22px] [&::-webkit-slider-thumb]:h-[22px] [&::-webkit-slider-thumb]:mt-[11px]',
                    '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white',
                    '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:shadow-black/50',
                    '[&::-moz-range-thumb]:w-[22px] [&::-moz-range-thumb]:h-[22px] [&::-moz-range-thumb]:rounded-full',
                    '[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md',
                    isBuy
                      ? '[&::-webkit-slider-thumb]:bg-emerald-500 [&::-moz-range-thumb]:bg-emerald-500 focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-emerald-400/60'
                      : '[&::-webkit-slider-thumb]:bg-red-500 [&::-moz-range-thumb]:bg-red-500 focus-visible:[&::-webkit-slider-thumb]:ring-2 focus-visible:[&::-webkit-slider-thumb]:ring-red-400/60',
                    'disabled:[&::-webkit-slider-thumb]:bg-gray-600 disabled:[&::-moz-range-thumb]:bg-gray-600',
                  )}
                />
              </div>
              {/* Reference ticks — tappable, positioned at value/max along the track.
                  mx-[11px] matches half the thumb width so labels line up with thumb centres. */}
              <div className="relative h-5 mx-[11px]">
                {ticks.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setQuantity(t)}
                    className={cn(
                      'absolute top-0 -translate-x-1/2 flex flex-col items-center',
                      'font-mono text-[10px] leading-none tabular-nums transition-colors',
                      t === quantity ? 'text-white' : 'text-gray-500 hover:text-gray-300',
                    )}
                    style={{ left: maxQty > 0 ? `${(t / maxQty) * 100}%` : '0%' }}
                  >
                    <span className="block w-px h-1.5 bg-gray-600 mb-1" />
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Smart-fill row — Max + RI, equal width, full touch size */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setQuantity(maxQty)}
                data-tutorial="trade-max"
                disabled={maxQty === 0}
                className={cn(
                  'text-sm font-medium rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed',
                  isMobile ? 'min-h-[44px]' : 'py-2',
                  isBuy
                    ? 'border-emerald-600 bg-emerald-600/10 text-emerald-400 hover:bg-emerald-600/20'
                    : 'border-red-600 bg-red-600/10 text-red-400 hover:bg-red-600/20',
                )}
              >
                Max {maxQty}
              </button>
              <button
                onClick={() => riQty !== null && setQuantity(riQty)}
                data-tutorial="trade-ri"
                disabled={riQty === null || riQty === 0}
                title={
                  isBuy
                    ? 'Buy this many to maximise shares while keeping cash for full Rights Issue'
                    : 'Sell minimum shares to fund a full Rights Issue on your current holdings'
                }
                className={cn(
                  'text-sm font-medium rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed',
                  isMobile ? 'min-h-[44px]' : 'py-2',
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
          data-tutorial="trade-confirm"
          disabled={confirmDisabled}
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
