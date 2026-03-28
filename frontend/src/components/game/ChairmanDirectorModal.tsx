import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR } from '../../lib/constants'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
  inline?: boolean // When true, renders without the fixed overlay wrapper
}

export default function ChairmanDirectorModal({ send, inline }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)

  const [selectedOwn, setSelectedOwn] = useState<number[]>([])
  const [selectedTargetPlayer, setSelectedTargetPlayer] = useState<number | null>(null)
  const [selectedTargetCard, setSelectedTargetCard] = useState<number | null>(null)

  if (!gameState || !gameState.chairman_director_queue.length) return null

  const [activePlayerId, companyName, role] = gameState.chairman_director_queue[0]
  const isMyTurn = gameState.current_player_name === playerName

  const isChairman = role === 'chairman'
  const isDouble = role === 'double_director'
  const requiredOwn = isDouble ? 2 : 1

  // Find own cards of this company in hand
  const ownCards = gameState.your_hand
    .map((c, i) => ({ ...c, handIdx: i }))
    .filter((c) => c.company === companyName && !c.is_power)

  // For chairman: find other players who hold cards of this company
  // During card_reveal, all_hands is available
  const otherPlayersWithCards = isChairman && isMyTurn
    ? gameState.players
        .filter((p) => !p.is_you)
        .map((p) => {
          const hand = gameState.all_hands?.[p.id] ?? []
          const companyCards = hand.filter((c) => c.company === companyName && !c.is_power)
          return { ...p, companyCards }
        })
        .filter((p) => p.companyCards.length > 0)
    : []

  const toggleOwn = (idx: number) => {
    setSelectedOwn((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx)
      if (prev.length >= requiredOwn) return [...prev.slice(1), idx]
      return [...prev, idx]
    })
  }

  const canSubmit = () => {
    if (selectedOwn.length !== requiredOwn) return false
    if (isChairman && (selectedTargetPlayer === null || selectedTargetCard === null)) return false
    return true
  }

  const handleSubmit = () => {
    if (!canSubmit()) return

    if (isChairman) {
      send({
        type: 'chairman_director',
        discard_own_idx: selectedOwn[0],
        discard_other_player_id: selectedTargetPlayer!,
        discard_other_idx: selectedTargetCard!,
      })
    } else if (isDouble) {
      send({
        type: 'chairman_director',
        discard_own_idx: selectedOwn,
      })
    } else {
      send({
        type: 'chairman_director',
        discard_own_idx: selectedOwn[0],
      })
    }

    setSelectedOwn([])
    setSelectedTargetPlayer(null)
    setSelectedTargetCard(null)
  }

  const roleLabel = isChairman ? 'Chairman' : isDouble ? 'Double Director' : 'Director'
  const roleColor = isChairman ? 'text-amber-400' : 'text-sky-400'
  const roleBg = isChairman ? 'bg-amber-900/20 border-amber-800/30' : 'bg-sky-900/20 border-sky-800/30'

  const content = (
    <div className={cn('rounded-xl p-5 space-y-4 border', roleBg)}>
      <div className="flex items-center gap-2">
        <span className={cn('w-2.5 h-2.5 rounded-full', COMPANY_COLOR[companyName])} />
        <h3 className={cn('text-base font-bold', roleColor)}>{roleLabel} Power</h3>
        <span className="text-gray-500 text-xs ml-auto font-mono">{companyName}</span>
      </div>

      {isMyTurn ? (
        <>
          {/* Own cards to discard */}
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Discard {requiredOwn} of your {companyName} card{requiredOwn > 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              {ownCards.map((card, i) => (
                <motion.button
                  key={i}
                  onClick={() => toggleOwn(i)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'px-4 py-2 rounded-lg border font-mono text-sm transition-colors',
                    selectedOwn.includes(i)
                      ? 'bg-red-900/40 border-red-600 text-red-300 ring-1 ring-red-500/50'
                      : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500',
                  )}
                >
                  {card.positive ? '+' : '-'}{card.value}
                </motion.button>
              ))}
              {ownCards.length === 0 && (
                <p className="text-xs text-gray-600">No cards to discard</p>
              )}
            </div>
          </div>

          {/* Chairman: pick target player + card */}
          {isChairman && (
            <div>
              <p className="text-xs text-gray-500 mb-2">
                Remove a card from another player
              </p>
              <div className="space-y-2">
                {otherPlayersWithCards.map((p) => (
                  <div key={p.id} className="space-y-1">
                    <button
                      onClick={() => {
                        setSelectedTargetPlayer(p.id)
                        setSelectedTargetCard(null)
                      }}
                      className={cn(
                        'text-xs font-medium px-2 py-1 rounded transition-colors',
                        selectedTargetPlayer === p.id
                          ? 'text-amber-400 bg-amber-900/30'
                          : 'text-gray-400 hover:text-white',
                      )}
                    >
                      {p.name}
                    </button>
                    {selectedTargetPlayer === p.id && (
                      <div className="flex flex-wrap gap-2 ml-2">
                        {p.companyCards.map((card, ci) => (
                          <motion.button
                            key={ci}
                            onClick={() => setSelectedTargetCard(ci)}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className={cn(
                              'px-3 py-1.5 rounded-lg border font-mono text-xs transition-colors',
                              selectedTargetCard === ci
                                ? 'bg-amber-900/40 border-amber-600 text-amber-300 ring-1 ring-amber-500/50'
                                : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500',
                            )}
                          >
                            {card.positive ? '+' : '-'}{card.value}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {otherPlayersWithCards.length === 0 && (
                  <p className="text-xs text-gray-600">No other players hold {companyName} cards</p>
                )}
              </div>
            </div>
          )}

          <motion.button
            onClick={handleSubmit}
            disabled={!canSubmit()}
            whileHover={canSubmit() ? { scale: 1.02 } : {}}
            whileTap={canSubmit() ? { scale: 0.98 } : {}}
            className={cn(
              'w-full py-2.5 rounded-lg font-medium text-sm transition-colors',
              canSubmit()
                ? isChairman ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'
                : 'bg-gray-800 text-gray-600 cursor-not-allowed',
            )}
          >
            Confirm Discard
          </motion.button>
        </>
      ) : (
        <p className="text-gray-500 text-center py-3 text-sm">
          Waiting for <span className="text-white">{gameState.current_player_name}</span>
          <span className={cn('ml-1', roleColor)}>({roleLabel})</span>
        </p>
      )}
    </div>
  )

  if (inline) return content

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md mx-4"
      >
        {content}
      </motion.div>
    </div>
  )
}
