import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import type { ClientMessage } from '../../types/messages'
import type { RevealCompanyData } from '../../types/game'
import StockTicker from './StockTicker'
import DayRoundIndicator from './DayRoundIndicator'
import PlayerBoard from './PlayerBoard'
import PlayerHand from './PlayerHand'
import ActionBar from './ActionBar'
import GameLog from './GameLog'
import RightsIssueModal from './RightsIssueModal'
import CardRevealOverlay from './CardRevealOverlay'
import ShareSuspendOverlay from './ShareSuspendOverlay'
import CurrencySettlementOverlay from './CurrencySettlementOverlay'
import ChairmanDirectorModal from './ChairmanDirectorModal'
import RightsIssueOverlay from './RightsIssueOverlay'
import DebentureOverlay from './DebentureOverlay'

interface Props {
  send: (msg: ClientMessage) => void
}

type AnimationPhase = 'none' | 'card_reveal' | 'share_suspend' | 'currency_settlement'

export default function GameBoard({ send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const isConnected = useGameStore((s) => s.isConnected)

  // Animation state — decoupled from backend phase
  const [animPhase, setAnimPhase] = useState<AnimationPhase>('none')
  const [cachedRevealData, setCachedRevealData] = useState<RevealCompanyData[] | null>(null)
  const lastRevealDay = useRef<number>(0)

  // Power card overlay state
  const [showRightsIssueOverlay, setShowRightsIssueOverlay] = useState(false)
  const [rightsIssueCompanyName, setRightsIssueCompanyName] = useState('')
  const [showDebentureOverlay, setShowDebentureOverlay] = useState(false)
  const [debentureCompanyName, setDebentureCompanyName] = useState('')
  const prevPhaseRef = useRef<string>('')
  const prevLogLen = useRef<number>(0)

  // Detect when card_reveal phase starts and cache the reveal data
  useEffect(() => {
    if (!gameState) return

    if (
      gameState.reveal_data &&
      gameState.reveal_data.length > 0
    ) {
      if (gameState.day !== lastRevealDay.current) {
        lastRevealDay.current = gameState.day
        setAnimPhase('card_reveal')
      }
      // Always update cached data so CD discards refresh delta/new_value
      setCachedRevealData(gameState.reveal_data)
    }
  }, [gameState?.reveal_data, gameState?.day, gameState])

  // Detect rights_issue phase entry → show overlay
  useEffect(() => {
    if (!gameState) return
    if (gameState.phase === 'rights_issue' && prevPhaseRef.current !== 'rights_issue') {
      const companyIdx = gameState.rights_issue_company
      if (companyIdx !== null) {
        setRightsIssueCompanyName(gameState.companies[companyIdx - 1]?.name ?? '')
        setShowRightsIssueOverlay(true)
      }
    }
    prevPhaseRef.current = gameState.phase
  }, [gameState?.phase, gameState?.rights_issue_company, gameState])

  // Detect debenture action via game log
  useEffect(() => {
    if (!gameState) return
    const log = gameState.game_log
    if (log.length > prevLogLen.current) {
      const latest = log[log.length - 1]
      if (latest.includes('reopened at')) {
        const match = latest.match(/(\w+) reopened/)
        if (match) {
          setDebentureCompanyName(match[1])
          setShowDebentureOverlay(true)
        }
      }
    }
    prevLogLen.current = log.length
  }, [gameState?.game_log])

  // When card_reveal animation completes
  const handleRevealComplete = useCallback(() => {
    setAnimPhase('none')
    setCachedRevealData(null)

    // Always show share_suspend overlay after card reveal.
    // The overlay handles both cases: active suspend queue (player picks) and
    // empty queue (shows timer then transitions to currency settlement).
    // Backend may already be in share_suspend or currency_settlement by now.
    setAnimPhase('share_suspend')
  }, [])

  // Watch for phase transitions — only for cases where card_reveal animation
  // was skipped (e.g., reconnect). Don't auto-set share_suspend here since
  // handleRevealComplete handles the normal flow.
  useEffect(() => {
    if (animPhase !== 'none') return
    if (!gameState) return

    if (gameState.phase === 'share_suspend' && gameState.suspend_queue.length > 0) {
      setAnimPhase('share_suspend')
    }
    // Don't auto-set currency_settlement here — it's reached via handleSuspendComplete
  }, [gameState?.phase, gameState?.suspend_queue, animPhase])

  // When share_suspend overlay completes (timer expired), transition to currency
  const handleSuspendComplete = useCallback(() => {
    // Backend is likely already in currency_settlement (auto-advanced when suspend queue emptied).
    // Always show the currency settlement overlay — it will send the completion message.
    setAnimPhase('currency_settlement')
  }, [])

  const handleCurrencyComplete = useCallback(() => {
    setAnimPhase('none')
  }, [])

  if (!gameState) return null

  const { phase } = gameState

  // During card_reveal with CD queue but NO reveal animation (e.g., reconnect),
  // show the CD modal directly
  const showStandaloneCdModal =
    phase === 'card_reveal' &&
    gameState.chairman_director_queue.length > 0 &&
    animPhase !== 'card_reveal'

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <DayRoundIndicator isConnected={isConnected} />

      {/* Stock ticker */}
      <StockTicker />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center: Player Board */}
        <div className="flex-1 p-4 overflow-y-auto">
          <PlayerBoard />
        </div>

        {/* Right: Game Log */}
        <div className="w-72 border-l border-gray-800 flex flex-col">
          <GameLog />
        </div>
      </div>

      {/* Action bar (Buy/Sell/Pass) */}
      <ActionBar send={send} />

      {/* Bottom: Player hand */}
      <PlayerHand send={send} />

      {/* Modals for sub-phases */}
      {phase === 'rights_issue' && !showRightsIssueOverlay && <RightsIssueModal send={send} />}

      {/* Standalone CD modal (fallback when no reveal animation) */}
      {showStandaloneCdModal && <ChairmanDirectorModal send={send} />}

      {/* Power card overlays */}
      <AnimatePresence>
        {showRightsIssueOverlay && (
          <RightsIssueOverlay
            key="rights-issue-overlay"
            companyName={rightsIssueCompanyName}
            onComplete={() => setShowRightsIssueOverlay(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDebentureOverlay && (
          <DebentureOverlay
            key="debenture-overlay"
            companyName={debentureCompanyName}
            onComplete={() => setShowDebentureOverlay(false)}
          />
        )}
      </AnimatePresence>

      {/* Animated overlays */}
      <AnimatePresence>
        {animPhase === 'card_reveal' && cachedRevealData && (
          <CardRevealOverlay
            key="card-reveal"
            revealData={cachedRevealData}
            onComplete={handleRevealComplete}
            send={send}
          />
        )}

        {animPhase === 'share_suspend' && (
          <ShareSuspendOverlay key="share-suspend" send={send} onComplete={handleSuspendComplete} />
        )}

        {animPhase === 'currency_settlement' && (
          <CurrencySettlementOverlay key="currency-settlement" onComplete={handleCurrencyComplete} send={send} />
        )}
      </AnimatePresence>
    </div>
  )
}
