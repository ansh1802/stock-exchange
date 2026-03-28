import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR, COMPANY_TEXT_COLOR } from '../../lib/constants'
import type { RevealCompanyData, RevealCard } from '../../types/game'
import type { ClientMessage } from '../../types/messages'
import ChairmanDirectorModal from './ChairmanDirectorModal'

interface Props {
  revealData: RevealCompanyData[]
  onComplete: () => void
  send: (msg: ClientMessage) => void
}

const CARD_DELAY = 400     // ms between each card reveal
const COMPANY_PAUSE = 1800 // ms pause after each company before next

type Stage =
  | { type: 'company_intro'; companyIdx: number }
  | { type: 'revealing_cards'; companyIdx: number; cardIdx: number }
  | { type: 'final_value'; companyIdx: number }
  | { type: 'chairman_director'; companyIdx: number }
  | { type: 'complete' }

export default function CardRevealOverlay({ revealData, onComplete, send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const [stage, setStage] = useState<Stage>({ type: 'company_intro', companyIdx: 0 })
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const sentRevealComplete = useRef(false)

  const currentCompany = stage.type !== 'complete' ? revealData[stage.companyIdx] : null
  const cdQueue = gameState?.chairman_director_queue ?? []

  // Check if current company needs chairman/director action
  const companyNeedsCd = useCallback((companyIdx: number) => {
    const companyName = revealData[companyIdx]?.company_name
    return cdQueue.some(([, cn]) => cn === companyName)
  }, [cdQueue, revealData])

  // Advance to next stage (pure — no side effects)
  const advance = useCallback(() => {
    setStage((prev) => {
      if (prev.type === 'complete') return prev

      const company = revealData[prev.companyIdx]
      if (!company) return { type: 'complete' }

      if (prev.type === 'company_intro') {
        if (company.cards.length === 0) {
          return { type: 'final_value', companyIdx: prev.companyIdx }
        }
        return { type: 'revealing_cards', companyIdx: prev.companyIdx, cardIdx: 0 }
      }

      if (prev.type === 'revealing_cards') {
        if (prev.cardIdx + 1 < company.cards.length) {
          return { type: 'revealing_cards', companyIdx: prev.companyIdx, cardIdx: prev.cardIdx + 1 }
        }
        return { type: 'final_value', companyIdx: prev.companyIdx }
      }

      if (prev.type === 'final_value') {
        if (companyNeedsCd(prev.companyIdx)) {
          return { type: 'chairman_director', companyIdx: prev.companyIdx }
        }
        if (prev.companyIdx + 1 < revealData.length) {
          return { type: 'company_intro', companyIdx: prev.companyIdx + 1 }
        }
        return { type: 'complete' }
      }

      if (prev.type === 'chairman_director') {
        if (companyNeedsCd(prev.companyIdx)) {
          return prev
        }
        if (prev.companyIdx + 1 < revealData.length) {
          return { type: 'company_intro', companyIdx: prev.companyIdx + 1 }
        }
        return { type: 'complete' }
      }

      return { type: 'complete' }
    })
  }, [revealData, companyNeedsCd])

  // Auto-advance through timed stages
  useEffect(() => {
    if (stage.type === 'complete') {
      if (!sentRevealComplete.current) {
        sentRevealComplete.current = true
        send({ type: 'reveal_complete' })
      }
      timerRef.current = setTimeout(onComplete, 800)
      return () => clearTimeout(timerRef.current)
    }
    if (stage.type === 'chairman_director') return

    const delays: Record<string, number> = {
      company_intro: 1000,
      revealing_cards: CARD_DELAY,
      final_value: COMPANY_PAUSE,
    }

    timerRef.current = setTimeout(advance, delays[stage.type] ?? 1000)
    return () => clearTimeout(timerRef.current)
  }, [stage, advance, onComplete])

  // When CD queue changes (action was taken), try to advance past chairman_director stage
  const prevQueueLen = useRef(cdQueue.length)
  useEffect(() => {
    if (stage.type === 'chairman_director' && cdQueue.length < prevQueueLen.current) {
      setTimeout(advance, 600)
    }
    prevQueueLen.current = cdQueue.length
  }, [cdQueue.length, stage.type, advance])

  // Derive revealed cards from stage — no separate state needed.
  // At revealing_cards cardIdx N: cards 0..N are visible (current card just appeared).
  // At final_value / chairman_director: all cards visible.
  // At company_intro: no cards visible.
  const revealedForCompany = useMemo((): RevealCard[] => {
    if (!currentCompany) return []
    if (stage.type === 'company_intro') return []
    if (stage.type === 'revealing_cards') {
      return currentCompany.cards.slice(0, stage.cardIdx + 1)
    }
    // final_value, chairman_director — all cards
    return currentCompany.cards
  }, [stage, currentCompany])

  const runningDelta = revealedForCompany.reduce(
    (sum, c) => sum + (c.positive ? c.value : -c.value), 0,
  )

  const companyIdx = stage.type !== 'complete' ? stage.companyIdx : revealData.length - 1
  const progressPct = ((companyIdx + 1) / revealData.length) * 100

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      {/* Layered background */}
      <div className="absolute inset-0 bg-gray-950/95" />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.05) 40px, rgba(255,255,255,0.05) 41px),
                           repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.05) 40px, rgba(255,255,255,0.05) 41px)`,
        }}
      />

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gray-800">
        <motion.div
          className="h-full bg-amber-500"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 text-center">
        <motion.p
          className="text-gray-500 text-xs tracking-[0.3em] uppercase font-mono"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          End of Day {gameState?.day}
        </motion.p>
        <motion.h1
          className="text-2xl mt-1 tracking-tight text-gray-300"
          style={{ fontFamily: 'var(--font-display)' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Closing Bell
        </motion.h1>
      </div>

      {/* Main content */}
      <div className="relative w-full max-w-2xl mx-auto px-8">
        <AnimatePresence mode="wait">
          {currentCompany && stage.type !== 'complete' && (
            <motion.div
              key={`company-${currentCompany.company_name}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
              className="space-y-6"
            >
              {/* Company name + value */}
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-3">
                  <span className={cn('w-3 h-3 rounded-full', COMPANY_COLOR[currentCompany.company_name])} />
                  <h2
                    className={cn('text-4xl font-bold tracking-tight', COMPANY_TEXT_COLOR[currentCompany.company_name])}
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {currentCompany.company_name}
                  </h2>
                </div>
                <p className="text-gray-500 font-mono text-sm">
                  Current Value: <span className="text-gray-300">${currentCompany.old_value}</span>
                </p>
              </div>

              {/* Revealed cards */}
              <div className="max-h-[40vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
                <div className="grid gap-2">
                  <AnimatePresence>
                    {revealedForCompany.map((card, i) => (
                      <motion.div
                        key={`card-${currentCompany.company_name}-${i}`}
                        initial={{ opacity: 0, x: -40, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{ duration: 0.3, ease: 'backOut' }}
                        className={cn(
                          'flex items-center justify-between px-4 py-2.5 rounded-lg border backdrop-blur-sm',
                          card.positive
                            ? 'bg-emerald-950/30 border-emerald-800/40'
                            : 'bg-red-950/30 border-red-800/40',
                        )}
                      >
                        <span className="text-sm text-gray-400">{card.player_name}</span>
                        <span className={cn(
                          'font-mono text-lg font-bold',
                          card.positive ? 'text-emerald-400' : 'text-red-400',
                        )}>
                          {card.positive ? '+' : '-'}{card.value}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {revealedForCompany.length === 0 && stage.type === 'final_value' && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center text-gray-600 py-8 font-mono text-sm"
                    >
                      No cards played
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Delta + New Value */}
              {(stage.type === 'revealing_cards' || stage.type === 'final_value' || stage.type === 'chairman_director') && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-8"
                >
                  {/* Running delta */}
                  <div className="text-center">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Delta</p>
                    <motion.p
                      key={`delta-${revealedForCompany.length}-${runningDelta}`}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={cn(
                        'font-mono text-2xl font-bold',
                        runningDelta > 0 ? 'text-emerald-400' : runningDelta < 0 ? 'text-red-400' : 'text-gray-500',
                      )}
                    >
                      {runningDelta > 0 ? '+' : ''}{runningDelta}
                    </motion.p>
                  </div>

                  {/* Arrow */}
                  {stage.type === 'final_value' || stage.type === 'chairman_director' ? (
                    <motion.span
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-gray-600 text-2xl"
                    >
                      &rarr;
                    </motion.span>
                  ) : null}

                  {/* New value */}
                  {(stage.type === 'final_value' || stage.type === 'chairman_director') && (
                    <div className="text-center">
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">New Value</p>
                      <motion.p
                        initial={{ scale: 1.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        className={cn(
                          'font-mono text-3xl font-bold',
                          currentCompany.new_value > currentCompany.old_value ? 'text-emerald-300' :
                          currentCompany.new_value < currentCompany.old_value ? 'text-red-300' : 'text-gray-300',
                        )}
                      >
                        ${currentCompany.new_value}
                      </motion.p>
                      {currentCompany.new_value <= 0 && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-red-500 text-xs font-bold tracking-widest uppercase mt-1 block"
                        >
                          Bankrupt
                        </motion.span>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              {/* Chairman/Director modal inline */}
              {stage.type === 'chairman_director' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <ChairmanDirectorModal send={send} inline />
                </motion.div>
              )}
            </motion.div>
          )}

          {stage.type === 'complete' && (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <p className="text-gray-400 font-mono text-sm">Values applied</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Company dots at bottom */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-2">
        {revealData.map((rd, i) => (
          <div
            key={rd.company_name}
            className={cn(
              'w-2 h-2 rounded-full transition-all duration-300',
              COMPANY_COLOR[rd.company_name],
              i <= companyIdx ? 'opacity-100 scale-100' : 'opacity-20 scale-75',
            )}
          />
        ))}
      </div>
    </motion.div>
  )
}
