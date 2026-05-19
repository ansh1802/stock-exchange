import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/useGameStore'
import type { ClientMessage } from '../../types/messages'
import type { Card } from '../../types/game'
import CardComponent from './CardComponent'
import PowerCardPanel from './PowerCardPanel'
import MobileCardStrip from './MobileCardStrip'
import ViewAllDrawer from './ViewAllDrawer'
import { useIsMobile } from '../../hooks/useIsMobile'
import { sortHand } from '../../lib/sortHand'
import { useFirstEncounterTip } from '../../hooks/useFirstEncounterTip'
import Coachmark from '../tutorial/Coachmark'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function PlayerHand({ send }: Props) {
  // All hooks above every conditional return — Phase-4 rule.
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [selectedCard, setSelectedCard] = useState<number | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Sorted display of the hand. selectedCard indexes into this sorted view.
  const hand = useMemo(
    () => sortHand(gameState?.your_hand ?? []),
    [gameState?.your_hand],
  )
  const hasPower = useMemo(() => hand.some((c) => c.is_power), [hand])
  const powerTip = useFirstEncounterTip('power_card_first', hasPower)

  if (!gameState) return null

  const isMyTurn = gameState.phase === 'player_turn' && gameState.current_player_name === playerName

  const handleCardClick = (index: number) => {
    if (!isMyTurn) return
    setSelectedCard((prev) => (prev === index ? null : index))
  }

  const handleSelectFromDrawer = (index: number) => {
    if (!isMyTurn) return
    setSelectedCard((prev) => (prev === index ? null : index))
    setDrawerOpen(false)
  }

  const selectedCardData = selectedCard !== null ? hand[selectedCard] : null

  const me = gameState.players.find((p) => p.is_you)
  const loanAmount = useMemo(() => {
    if (!me) return 0
    const netWorth = me.cash + gameState.companies.reduce((sum, c) => {
      const held = me.stocks[c.name] ?? 0
      return sum + (c.is_open && held > 0 ? held * c.value : 0)
    }, 0)
    return Math.max(5, Math.floor(netWorth * 0.1 / 5) * 5)
  }, [me, gameState.companies])

  const usePowerCard = (card: Card, companyNum?: number) => {
    if (card.company === 'LoanStock') {
      send({ type: 'loan_stock' })
    } else if (card.company === 'Debenture' && companyNum) {
      send({ type: 'debenture', company_num: companyNum })
    } else if (card.company === 'RightsIssue' && companyNum) {
      send({ type: 'rights_issue', company_num: companyNum })
    }
    setSelectedCard(null)
  }

  // First-encounter tooltip rendered for both mobile + desktop branches
  const powerTipNode = powerTip.show ? (
    <Coachmark
      title="That's a power card."
      onDismiss={powerTip.dismiss}
      secondary={{
        label: 'Read more',
        onClick: () => { powerTip.dismiss(); navigate('/rulebook/power-cards') },
      }}
    >
      Six of these exist (Rights Issue, Share Suspend, Loan Stock, Debenture,
      Currency +/−). Tap one on your turn to play it for an immediate
      effect — no buy/sell that turn.
    </Coachmark>
  ) : null

  if (isMobile) {
    return (
      <>
        {selectedCardData?.is_power && isMyTurn && (
          <PowerCardPanel
            card={selectedCardData}
            companies={gameState.companies}
            loanAmount={loanAmount}
            onUse={usePowerCard}
            onCancel={() => setSelectedCard(null)}
          />
        )}
        <MobileCardStrip
          hand={hand}
          selectedIdx={selectedCard}
          isMyTurn={isMyTurn}
          onSelect={handleCardClick}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
        <ViewAllDrawer
          open={drawerOpen}
          hand={hand}
          selectedIdx={selectedCard}
          isMyTurn={isMyTurn}
          onSelect={handleSelectFromDrawer}
          onClose={() => setDrawerOpen(false)}
        />
        {powerTipNode}
      </>
    )
  }

  return (
    <div className="border-t border-gray-800 bg-gray-900">
      {/* Power card action panel */}
      {selectedCardData?.is_power && isMyTurn && (
        <PowerCardPanel
          card={selectedCardData}
          companies={gameState.companies}
          loanAmount={loanAmount}
          onUse={usePowerCard}
          onCancel={() => setSelectedCard(null)}
        />
      )}

      {/* Cards */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto">
        {hand.map((card, i) => (
          <CardComponent
            key={i}
            card={card}
            selected={selectedCard === i}
            onClick={() => handleCardClick(i)}
          />
        ))}
        {hand.length === 0 && (
          <p className="text-gray-500 text-sm py-2">No cards in hand</p>
        )}
      </div>
      {powerTipNode}
    </div>
  )
}
