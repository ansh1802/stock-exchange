import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR, COMPANY_TEXT_COLOR } from '../../lib/constants'
import type { ClientMessage } from '../../types/messages'
import NetworthGraph, { TRAVEL_MS as GRAPH_TRAVEL_MS } from './NetworthGraph'

interface Props {
  send: (msg: ClientMessage) => void
  onComplete: () => void
}

interface SuspendAnim {
  name: string
  oldValue: number
  newValue: number
}

export default function ShareSuspendOverlay({ send, onComplete }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)
  const isMobile = useIsMobile()

  // Whether any suspend cards existed this round
  const [everHadQueue, setEverHadQueue] = useState(false)

  // Suspend animation state
  const [animQueue, setAnimQueue] = useState<SuspendAnim[]>([])
  const [activeAnim, setActiveAnim] = useState<SuspendAnim | null>(null)
  const prevValues = useRef<Record<string, number>>({})

  // Timer state
  const [countdown, setCountdown] = useState<number | null>(null)
  // True once the backend has finalized card reveal (all players sent reveal_complete).
  // Only after this point is the day's networth snapshot written and it's safe to advance.
  const [backendReady, setBackendReady] = useState(false)

  // Derived
  const hasQueue = (gameState?.suspend_queue.length ?? 0) > 0
  const isMyTurn = gameState?.current_player_name === playerName
  const animBusy = activeAnim !== null || animQueue.length > 0

  // ── Networth standings graph (Trigger A on mount, Trigger B per swap) ──
  const graphPlayers = useMemo(() => {
    if (!gameState) return []
    return gameState.players.map((p) => ({ id: p.id, name: p.name, isYou: p.is_you }))
  }, [gameState?.players])

  // Highlight the player currently choosing whether to suspend (front of queue),
  // falling back to the local player so the line never goes un-haloed.
  const graphActivePlayerId = useMemo(() => {
    if (!gameState) return null
    const front = gameState.suspend_queue?.[0]
    if (front != null) return front
    const you = gameState.players.find((p) => p.is_you)
    return you?.id ?? null
  }, [gameState?.suspend_queue, gameState?.players])

  // Use the last populated index in networth_history as the display day.
  // gameState.day advances to N+1 right after finalization (before this overlay
  // even receives the snapshot), so history[gameState.day] is always null here.
  // history.length - 1 is the last day actually written by _snapshot_networth.
  const graphCurrentDay = useMemo(() => {
    const hist = gameState?.networth_history
    if (!hist || hist.length === 0) return 0
    return hist.length - 1
  }, [gameState?.networth_history])

  // Snapshot bump: stringified last entry. Trigger A first writes it (graphCurrentDay
  // increments when history gains a new entry); Trigger B rewrites it in place when
  // a suspend swap fires. Either change re-runs the anim.
  const currentDaySnapKey = useMemo(() => {
    const hist = gameState?.networth_history
    if (!hist || hist.length === 0) return ''
    return JSON.stringify(hist[hist.length - 1] ?? null)
  }, [gameState?.networth_history])

  // Detect whether a Trigger B has fired since the overlay opened (i.e. a real
  // share suspend swap, not just the initial mount snapshot). Drives the gold
  // "SS APPLIED" pill on the graph header.
  const initialSnapKey = useRef<string | null>(null)
  useEffect(() => {
    if (initialSnapKey.current === null && currentDaySnapKey) {
      initialSnapKey.current = currentDaySnapKey
    }
  }, [currentDaySnapKey])
  const ssApplied =
    initialSnapKey.current !== null &&
    currentDaySnapKey !== '' &&
    currentDaySnapKey !== initialSnapKey.current

  // Track if suspend cards ever existed
  useEffect(() => {
    if (hasQueue) setEverHadQueue(true)
  }, [hasQueue])

  // Wait for backend to reach share_suspend phase before tracking value changes.
  // The overlay mounts when the frontend animation finishes, but the backend may
  // still be in card_reveal (waiting for other players' reveal_complete). Values
  // change when the backend finalizes — we must ignore that transition.
  const initialized = useRef(false)
  useEffect(() => {
    if (!gameState || initialized.current) return
    // Only snapshot once backend has finalized card reveal (all players done).
    // dealing/player_turn are also valid — auto_advance can race past share_suspend.
    const phase = gameState.phase
    if (
      phase !== 'share_suspend' &&
      phase !== 'day_end' &&
      phase !== 'dealing' &&
      phase !== 'player_turn' &&
      phase !== 'game_over'
    ) return
    const curr: Record<string, number> = {}
    for (const co of gameState.companies) curr[co.name] = co.value
    prevValues.current = curr
    initialized.current = true
    setBackendReady(true)
  }, [gameState])

  // Detect company value changes → queue animation (only after backend is ready)
  useEffect(() => {
    if (!gameState || !initialized.current) return
    const curr: Record<string, number> = {}
    for (const co of gameState.companies) curr[co.name] = co.value

    const prev = prevValues.current
    for (const co of gameState.companies) {
      if (prev[co.name] !== undefined && prev[co.name] !== co.value) {
        setAnimQueue((q) => [...q, { name: co.name, oldValue: prev[co.name], newValue: co.value }])
      }
    }
    prevValues.current = curr
  }, [gameState?.companies])

  // Dequeue next animation
  useEffect(() => {
    if (activeAnim || animQueue.length === 0) return
    setActiveAnim(animQueue[0])
    setAnimQueue((q) => q.slice(1))
  }, [animQueue, activeAnim])

  // Clear active animation after 2.5s
  useEffect(() => {
    if (!activeAnim) return
    const t = setTimeout(() => setActiveAnim(null), 2500)
    return () => clearTimeout(t)
  }, [activeAnim])

  // Start 5s countdown after the graph travel animation finishes.
  // backendReady fires at the same moment for all players (backend broadcasts
  // the finalized state simultaneously), so everyone's countdown is in sync.
  // The graph animation starts when backendReady flips the replayKey — we delay
  // by GRAPH_TRAVEL_MS so the countdown only appears once the line finishes traveling.
  const graphAnimTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    if (!backendReady || hasQueue || animBusy || countdown !== null) return
    clearTimeout(graphAnimTimerRef.current)
    graphAnimTimerRef.current = setTimeout(() => setCountdown(5), GRAPH_TRAVEL_MS + 200)
    return () => clearTimeout(graphAnimTimerRef.current)
  }, [backendReady, hasQueue, animBusy, countdown])

  // Tick countdown
  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // Countdown done → advance
  useEffect(() => {
    if (countdown === 0) onComplete()
  }, [countdown, onComplete])

  // Two-step halt: tapping a row only selects it; the footer Halt button
  // commits. Stops scroll/drag gestures on mobile from firing a suspend.
  const [selectedCompany, setSelectedCompany] = useState<number | null>(null)
  const queueHeadKey = `${gameState?.suspend_queue.length ?? 0}:${gameState?.suspend_queue[0] ?? ''}`
  useEffect(() => {
    setSelectedCompany(null)
  }, [queueHeadKey])

  const handleHalt = useCallback(() => {
    if (selectedCompany === null) return
    send({ type: 'share_suspend', company_num: selectedCompany })
    setSelectedCompany(null)
  }, [send, selectedCompany])

  const handlePass = useCallback(() => {
    send({ type: 'share_suspend', company_num: 0 })
    setSelectedCompany(null)
  }, [send])

  if (!gameState) return null

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-gray-950/95" />

      {/* Warning stripes background */}
      <div className="absolute inset-0 overflow-hidden opacity-[0.04]">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-1 bg-amber-500"
            style={{ top: `${i * 5 + 2}%`, left: '-100%', right: '-100%' }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 3, delay: i * 0.1, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </div>

      {/* Top-right: waiting indicator or synchronized countdown */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="absolute top-6 right-8 z-10"
      >
        {!backendReady && !hasQueue ? (
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Waiting for</p>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">players to finish</p>
            <motion.div
              className="flex justify-center gap-1 mt-2"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 h-1 rounded-full bg-gray-500"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                />
              ))}
            </motion.div>
          </div>
        ) : countdown !== null ? (
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">Next phase in</p>
            <span className={cn(
              'font-mono text-3xl font-bold',
              countdown <= 2 ? 'text-red-400' : 'text-amber-400',
            )}>
              {countdown}s
            </span>
          </div>
        ) : null}
      </motion.div>

      {/* HALTED animation banner (top area) */}
      <AnimatePresence>
        {activeAnim && (
          <motion.div
            key={`halt-${activeAnim.name}-${activeAnim.newValue}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-0 right-0 z-20 flex justify-center"
          >
            <div className="bg-gray-900/90 border border-amber-500/30 rounded-xl px-8 py-5 text-center space-y-3">
              <div className="flex items-center justify-center gap-3">
                <span className={cn('w-3 h-3 rounded-full', COMPANY_COLOR[activeAnim.name])} />
                <span
                  className={cn('text-2xl font-bold', COMPANY_TEXT_COLOR[activeAnim.name])}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {activeAnim.name}
                </span>
              </div>
              <div className="flex items-center justify-center gap-4 font-mono">
                <motion.span
                  initial={{ x: 0 }}
                  animate={{ x: -10, opacity: 0.4 }}
                  className="text-xl text-red-400 line-through"
                >
                  ${activeAnim.oldValue}
                </motion.span>
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1, rotate: [0, -10, 10, 0] }}
                  transition={{ delay: 0.2 }}
                  className="text-amber-400 text-base font-bold"
                >
                  HALTED
                </motion.span>
                <motion.span
                  initial={{ x: 0, opacity: 0 }}
                  animate={{ x: 10, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl text-emerald-400 font-bold"
                >
                  ${activeAnim.newValue}
                </motion.span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="relative w-full max-w-3xl mx-4 max-h-[92vh] flex flex-col"
      >
        <div className="flex-1 min-h-0 overflow-y-auto space-y-5 py-4">
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
            {hasQueue
              ? 'Swap a company\'s value with its pre-fluctuation price'
              : everHadQueue
                ? 'Share suspend complete'
                : 'No share suspend cards this round'}
          </p>
        </div>

        {/* Standings graph — animates Trigger A on mount, Trigger B per swap */}
        {gameState.networth_history && gameState.networth_history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <NetworthGraph
              history={gameState.networth_history}
              currentDay={graphCurrentDay}
              players={graphPlayers}
              activePlayerId={graphActivePlayerId}
              viewport={isMobile ? 'mobile' : 'desktop'}
              replayKey={currentDaySnapKey}
              title={`Standings · Day ${graphCurrentDay}`}
              pillText={`DAY ${graphCurrentDay} / 10`}
              ssApplied={ssApplied}
            />
          </motion.div>
        )}

        {/* Action area — only when queue is active */}
        {hasQueue && isMyTurn ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-2 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] p-3"
          >
            <p className="text-center text-xs text-amber-400 uppercase tracking-widest font-mono pb-1">
              Pick a company to halt
            </p>
            {gameState.companies.map((co, i) => {
              const diff = co.value - co.pre_fluct_value
              const selected = selectedCompany === i + 1
              return (
                <motion.button
                  key={co.name}
                  onClick={() => setSelectedCompany(selected ? null : i + 1)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.06 }}
                  aria-pressed={selected}
                  className={cn(
                    'w-full flex items-center justify-between px-4 min-h-[48px] rounded-xl border-2 transition-colors',
                    selected
                      ? 'border-amber-400 bg-amber-500/15'
                      : 'border-gray-700 bg-gray-900 hover:border-gray-500',
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                        selected ? 'border-amber-400' : 'border-gray-600',
                      )}
                    >
                      {selected && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                    </span>
                    <span className={cn('w-2.5 h-2.5 rounded-full', COMPANY_COLOR[co.name])} />
                    <span className={cn('text-sm font-medium', COMPANY_TEXT_COLOR[co.name])}>{co.name}</span>
                  </span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span className={cn(
                      'font-bold',
                      diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-gray-400',
                    )}>
                      ${co.value}
                    </span>
                    <span className="text-gray-600">&rarr;</span>
                    <span className="text-amber-300">${co.pre_fluct_value}</span>
                  </span>
                </motion.button>
              )
            })}
            <p className="text-center text-[11px] text-gray-500 font-mono pt-1">
              Halting reverts today&apos;s move: current &rarr; pre-fluctuation price
            </p>
          </motion.div>
        ) : hasQueue ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-4">
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
        ) : null}

        {/* Prices table — always visible, read-only (visually secondary) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 opacity-80 pointer-events-none select-none"
        >
          <p className="text-center text-xs text-gray-500 uppercase tracking-widest font-mono">
            Prices After Fluctuation
          </p>
          <div className="grid grid-cols-2 gap-2">
            {gameState.companies.map((co) => {
              const diff = co.value - co.pre_fluct_value
              const tone =
                diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-gray-300'
              return (
                <div
                  key={co.name}
                  className="flex items-center justify-between px-3 py-2 rounded-lg border border-dashed border-gray-800"
                >
                  <span className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', COMPANY_COLOR[co.name])} />
                    <span className={cn('text-sm font-medium', COMPANY_TEXT_COLOR[co.name])}>{co.name}</span>
                  </span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span className="text-gray-500">${co.pre_fluct_value}</span>
                    <span className="text-gray-700">&rarr;</span>
                    <span className={cn('font-bold', tone)}>${co.value}</span>
                  </span>
                </div>
              )
            })}
          </div>
        </motion.div>
        </div>

        {/* Sticky decision footer — outside the scroll area so it's always reachable */}
        {hasQueue && isMyTurn && (
          <div className="flex gap-2 pt-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] border-t border-gray-800 bg-gray-950">
            <motion.button
              onClick={handleHalt}
              disabled={selectedCompany === null}
              whileTap={selectedCompany !== null ? { scale: 0.98 } : {}}
              className="flex-1 min-h-[48px] rounded-xl font-bold transition-colors bg-amber-500 text-gray-950 hover:bg-amber-400 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              {selectedCompany !== null
                ? `Halt ${gameState.companies[selectedCompany - 1]?.name ?? ''}`
                : 'Select a company'}
            </motion.button>
            <motion.button
              onClick={handlePass}
              whileTap={{ scale: 0.98 }}
              className="px-6 min-h-[48px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium border border-gray-700 transition-colors"
            >
              Pass
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
