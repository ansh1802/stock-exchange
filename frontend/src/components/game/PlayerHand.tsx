import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import type { ClientMessage } from '../../types/messages'
import type { Card } from '../../types/game'
import CardComponent from './CardComponent'
import PowerCardPanel from './PowerCardPanel'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function PlayerHand({ send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)
  const [selectedCard, setSelectedCard] = useState<number | null>(null)

  if (!gameState) return null

  const isMyTurn = gameState.phase === 'player_turn' && gameState.current_player_name === playerName
  const hand = gameState.your_hand

  const handleCardClick = (index: number) => {
    if (!isMyTurn) return
    setSelectedCard(selectedCard === index ? null : index)
  }

  const selectedCardData = selectedCard !== null ? hand[selectedCard] : null

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

  return (
    <div className="border-t border-gray-800 bg-gray-900">
      {/* Power card action panel */}
      {selectedCardData?.is_power && isMyTurn && (
        <PowerCardPanel
          card={selectedCardData}
          companies={gameState.companies}
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
    </div>
  )
}
