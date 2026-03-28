import { useState, useEffect, useRef, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import type { ClientMessage } from '../../types/messages'
import type { RevealCompanyData } from '../../types/game'
import StockTicker from './StockTicker'
import DayRoundIndicator from './DayRoundIndicator'
import PlayerHand from './PlayerHand'
import TradePanel from './TradePanel'
import Portfolio from './Portfolio'
import GameLog from './GameLog'
import RightsIssueModal from './RightsIssueModal'
import CardRevealOverlay from './CardRevealOverlay'
import ShareSuspendOverlay from './ShareSuspendOverlay'
import CurrencySettlementOverlay from './CurrencySettlementOverlay'
import ChairmanDirectorModal from './ChairmanDirectorModal'

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

  // Detect when card_reveal phase starts and cache the reveal data
  useEffect(() => {
    if (!gameState) return

    // When we receive reveal_data for a new day, start the reveal animation
    if (
      gameState.reveal_data &&
      gameState.reveal_data.length > 0 &&
      gameState.day !== lastRevealDay.current
    ) {
      lastRevealDay.current = gameState.day
      setCachedRevealData(gameState.reveal_data)
      setAnimPhase('card_reveal')
    }
  }, [gameState?.reveal_data, gameState?.day, gameState])

  // When card_reveal animation completes
  const handleRevealComplete = useCallback(() => {
    setAnimPhase('none')
    setCachedRevealData(null)

    // Check if we should transition to share_suspend or currency_settlement
    if (gameState?.phase === 'share_suspend' && gameState.suspend_queue.length > 0) {
      setAnimPhase('share_suspend')
    } else if (gameState?.phase === 'currency_settlement') {
      setAnimPhase('currency_settlement')
    }
  }, [gameState?.phase, gameState?.suspend_queue])

  // Watch for phase transitions to show share_suspend / currency_settlement overlays
  // after card_reveal finishes (or directly if no reveal was needed)
  useEffect(() => {
    if (animPhase !== 'none') return // Don't interrupt running animations
    if (!gameState) return

    if (gameState.phase === 'share_suspend' && gameState.suspend_queue.length > 0) {
      setAnimPhase('share_suspend')
    } else if (gameState.phase === 'currency_settlement') {
      setAnimPhase('currency_settlement')
    }
  }, [gameState?.phase, gameState?.suspend_queue, animPhase])

  // When share_suspend completes (queue drains), check for currency_settlement
  useEffect(() => {
    if (animPhase !== 'share_suspend') return
    if (!gameState) return

    if (gameState.phase !== 'share_suspend') {
      // Phase moved on — dismiss the overlay
      // Brief delay to show the result
      const t = setTimeout(() => {
        if (gameState.phase === 'currency_settlement') {
          setAnimPhase('currency_settlement')
        } else {
          setAnimPhase('none')
        }
      }, 800)
      return () => clearTimeout(t)
    }
  }, [gameState?.phase, animPhase])

  const handleCurrencyComplete = useCallback(() => {
    setAnimPhase('none')
  }, [])

  if (!gameState) return null

  const { phase } = gameState
  const showingOverlay = animPhase !== 'none'

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
        {/* Left: Trade panel + Game log */}
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          <TradePanel send={send} />
          <GameLog />
        </div>

        {/* Right: Portfolio sidebar */}
        <div className="w-64 border-l border-gray-800 overflow-y-auto">
          <Portfolio />
        </div>
      </div>

      {/* Bottom: Player hand */}
      <PlayerHand send={send} />

      {/* Modals for sub-phases */}
      {phase === 'rights_issue' && <RightsIssueModal send={send} />}

      {/* Standalone CD modal (fallback when no reveal animation) */}
      {showStandaloneCdModal && <ChairmanDirectorModal send={send} />}

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
          <ShareSuspendOverlay key="share-suspend" send={send} />
        )}

        {animPhase === 'currency_settlement' && (
          <CurrencySettlementOverlay key="currency-settlement" onComplete={handleCurrencyComplete} send={send} />
        )}
      </AnimatePresence>
    </div>
  )
}
