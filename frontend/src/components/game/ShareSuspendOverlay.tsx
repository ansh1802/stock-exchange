import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR, COMPANY_TEXT_COLOR } from '../../lib/constants'
import type { ClientMessage } from '../../types/messages'
import { useTutorial, tutorialAllows } from '../../tutorial/runtime/TutorialContext'
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

function WaitingDots({ className }: { className?: string }) {
  return (
    <motion.span
      className={cn('inline-flex items-center gap-1', className)}
      animate={{ opacity: [0.3, 1, 0.3] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1 h-1 rounded-full bg-current"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
        />
      ))}
    </motion.span>
  )
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

  // ── Networth standings graph ──
  // Every game_state broadcast replaces gameState.players with a new array, so
  // memoise on the *content* the graph cares about (ids/names/left) rather than
  // the array identity. Keeps the players prop referentially stable across the
  // many broadcasts that land while this overlay is open.
  const playersKey = (gameState?.players ?? [])
    .map((p) => `${p.id}:${p.name}:${p.left ? 1 : 0}:${p.is_you ? 1 : 0}`)
    .join('|')
  const graphPlayers = useMemo(() => {
    if (!gameState) return []
    return gameState.players
      .filter((p) => !p.left)
      .map((p) => ({ id: p.id, name: p.name, isYou: p.is_you }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playersKey])

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

  // Stringified last entry. Trigger A first writes it; Trigger B rewrites it in
  // place when a suspend swap fires. Used to detect "SS APPLIED".
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
  // The graph travel starts when the finalized snapshot lands (same moment) —
  // delay by GRAPH_TRAVEL_MS so the countdown only appears once the line finishes.
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
  const tutorial = useTutorial()
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

  const myDecision = hasQueue && isMyTurn
  const selected = selectedCompany !== null ? gameState.companies[selectedCompany - 1] : null
  const status = hasQueue
    ? myDecision
      ? 'Halting a company undoes today’s move on it.'
      : 'Someone is deciding whether to halt a company.'
    : everHadQueue
      ? 'Share suspend complete.'
      : 'No share suspend cards this round.'

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex flex-col"
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

      {/* HALTED banner — transient, floats over the chart */}
      <AnimatePresence>
        {activeAnim && (
          <motion.div
            key={`halt-${activeAnim.name}-${activeAnim.newValue}`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-28 md:top-36 left-0 right-0 z-20 flex justify-center pointer-events-none"
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

      {/* Page: header + body, everything in flow and bounded by the viewport. */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="relative flex-1 min-h-0 w-full max-w-6xl mx-auto flex flex-col gap-3 md:gap-4 px-4 md:px-8 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {/* Header — title left, clock right */}
        <div className="flex items-end justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <p className="text-gray-500 text-[10px] md:text-xs tracking-[0.3em] uppercase font-mono">
              End of Day {graphCurrentDay}
            </p>
            <h1
              className="text-xl md:text-2xl text-amber-400 leading-tight tracking-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Share Suspend
            </h1>
            <p className="text-[11px] md:text-xs text-gray-500 font-mono truncate">{status}</p>
          </div>
          <div className="text-right shrink-0">
            {!backendReady && !hasQueue ? (
              <div className="text-[10px] text-gray-500 uppercase tracking-widest leading-tight">
                <p>Waiting for</p>
                <p>players to finish</p>
                <WaitingDots className="mt-1 text-gray-500" />
              </div>
            ) : countdown !== null ? (
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">Next phase in</p>
                <span className={cn(
                  'font-mono text-2xl md:text-3xl font-bold tabular-nums leading-none',
                  countdown <= 2 ? 'text-red-400' : 'text-amber-400',
                )}>
                  {countdown}s
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Body — chart fills, ticket is fixed-size. Column on phones, two
            columns on desktop so the whole decision fits beside the chart. */}
        <div className="flex-1 min-h-0 flex flex-col gap-3 md:grid md:grid-cols-[minmax(0,1fr)_21rem] md:gap-5">
          <div className="flex-1 min-h-0">
            {gameState.networth_history && gameState.networth_history.length > 0 && (
              <NetworthGraph
                history={gameState.networth_history}
                currentDay={graphCurrentDay}
                players={graphPlayers}
                activePlayerId={graphActivePlayerId}
                viewport={isMobile ? 'mobile' : 'desktop'}
                title={`Standings · Day ${graphCurrentDay}`}
                pillText={`DAY ${graphCurrentDay} / 10`}
                ssApplied={ssApplied}
                fill
              />
            )}
          </div>

          {/* Ticket — one company list that is selectable on your turn and
              read-only otherwise, so nothing is shown twice. */}
          <div className="shrink-0 md:min-h-0 flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-2 px-0.5">
              <p
                className={cn(
                  'text-sm md:text-base leading-tight',
                  myDecision ? 'text-amber-300' : 'text-gray-300',
                )}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {myDecision
                  ? 'Halt a company?'
                  : hasQueue
                    ? `Waiting for ${gameState.current_player_name}`
                    : 'Today’s moves'}
              </p>
              {hasQueue && !isMyTurn ? (
                <WaitingDots className="text-amber-500" />
              ) : (
                <span className="text-[10px] font-mono text-gray-600 whitespace-nowrap">before → after</span>
              )}
            </div>

            <div
              className={cn(
                'grid gap-1.5 grid-cols-2 md:grid-cols-1',
                myDecision ? '' : 'opacity-80',
              )}
              role={myDecision ? 'radiogroup' : undefined}
              aria-label={myDecision ? 'Company to halt' : 'Prices after today’s cards'}
            >
              {gameState.companies.map((co, i) => {
                const diff = co.value - co.pre_fluct_value
                const tone = diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-gray-300'
                const isSelected = selectedCompany === i + 1
                const inner = (
                  <>
                    <span className="flex items-center gap-2 min-w-0">
                      {myDecision && (
                        <span
                          className={cn(
                            'hidden md:flex w-3.5 h-3.5 rounded-full border-2 items-center justify-center shrink-0',
                            isSelected ? 'border-amber-400' : 'border-gray-600',
                          )}
                        >
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                        </span>
                      )}
                      <span className={cn('w-2 h-2 rounded-full shrink-0', COMPANY_COLOR[co.name])} />
                      <span className={cn('text-xs md:text-sm font-medium truncate', COMPANY_TEXT_COLOR[co.name])}>
                        {co.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 md:gap-1.5 font-mono text-xs md:text-sm shrink-0 tabular-nums">
                      <span className="text-gray-500">${co.pre_fluct_value}</span>
                      <span className="text-gray-700">&rarr;</span>
                      <span className={cn('font-bold', tone)}>${co.value}</span>
                    </span>
                  </>
                )
                if (!myDecision) {
                  return (
                    <div
                      key={co.name}
                      className="flex items-center justify-between gap-2 px-2.5 md:px-3 min-h-[40px] md:min-h-[42px] rounded-lg border border-dashed border-gray-800"
                    >
                      {inner}
                    </div>
                  )
                }
                return (
                  <button
                    key={co.name}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelectedCompany(isSelected ? null : i + 1)}
                    className={cn(
                      'flex items-center justify-between gap-2 px-2.5 md:px-3 min-h-[44px] md:min-h-[42px] rounded-lg border-2 transition-colors text-left',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70',
                      isSelected
                        ? 'border-amber-400 bg-amber-500/15'
                        : 'border-gray-700 bg-gray-900 hover:border-gray-500',
                    )}
                  >
                    {inner}
                  </button>
                )
              })}
            </div>

            {/* Decision footer — in flow, directly under the list */}
            {myDecision && (
              <div className="flex gap-2 pt-1 md:mt-auto">
                <motion.button
                  onClick={handleHalt}
                  disabled={selectedCompany === null || !tutorialAllows(tutorial, { type: 'share_suspend', company_num: selectedCompany })}
                  whileTap={selectedCompany !== null ? { scale: 0.98 } : {}}
                  className="flex-1 min-h-[48px] px-3 rounded-xl font-bold transition-colors bg-amber-500 text-gray-950 hover:bg-amber-400 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                  {selected ? (
                    <span className="flex flex-col leading-tight">
                      <span>Halt {selected.name}</span>
                      <span className="text-[11px] font-mono font-medium opacity-80">
                        back to ${selected.pre_fluct_value}
                      </span>
                    </span>
                  ) : (
                    'Select a company'
                  )}
                </motion.button>
                <motion.button
                  onClick={handlePass}
                  disabled={!tutorialAllows(tutorial, { type: 'share_suspend', company_num: 0 })}
                  whileTap={{ scale: 0.98 }}
                  className="px-6 min-h-[48px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium border border-gray-700 transition-colors"
                >
                  Pass
                </motion.button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
