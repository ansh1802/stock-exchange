import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR } from '../../lib/constants'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
  inline?: boolean
}

interface OtherCard {
  playerId: number
  cardIdx: number // index within that player's company cards
  positive: boolean
  value: number
}

export default function ChairmanDirectorModal({ send, inline }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)

  const [selectedOwn, setSelectedOwn] = useState<number[]>([])
  const [selectedOther, setSelectedOther] = useState<OtherCard | null>(null)

  if (!gameState || !gameState.chairman_director_queue.length) return null

  const [, companyName, role] = gameState.chairman_director_queue[0]
  const isMyTurn = gameState.current_player_name === playerName

  const isChairman = role === 'chairman'
  const isDouble = role === 'double_director'
  const requiredOwn = isDouble ? 2 : 1

  // Own cards of this company
  const ownCards = gameState.your_hand
    .map((c, i) => ({ ...c, handIdx: i }))
    .filter((c) => c.company === companyName && !c.is_power)

  // Chairman: aggregate all other players' cards into a flat list
  const otherCards = useMemo((): OtherCard[] => {
    if (!isChairman || !isMyTurn) return []
    const cards: OtherCard[] = []
    for (const p of gameState.players) {
      if (p.is_you) continue
      const hand = gameState.all_hands?.[p.id] ?? []
      hand.forEach((c, ci) => {
        if (c.company === companyName && !c.is_power) {
          cards.push({ playerId: p.id, cardIdx: ci, positive: c.positive, value: c.value })
        }
      })
    }
    return cards
  }, [isChairman, isMyTurn, gameState.players, gameState.all_hands, companyName])

  const toggleOwn = (idx: number) => {
    setSelectedOwn((prev) => {
      if (prev.includes(idx)) return prev.filter((i) => i !== idx)
      if (prev.length >= requiredOwn) return [...prev.slice(1), idx]
      return [...prev, idx]
    })
  }

  const selectOther = (card: OtherCard) => {
    setSelectedOther((prev) =>
      prev && prev.playerId === card.playerId && prev.cardIdx === card.cardIdx ? null : card,
    )
  }

  // Chairman can partially exercise: own only, other only, both, or pass
  // Director/Double director: must select required own cards or pass
  const canSubmit = () => {
    if (isChairman) {
      return selectedOwn.length > 0 || selectedOther !== null
    }
    return selectedOwn.length === requiredOwn
  }

  const handlePass = () => {
    send({ type: 'chairman_director', discard_own_idx: -1 })
    resetSelection()
  }

  const resetSelection = () => {
    setSelectedOwn([])
    setSelectedOther(null)
  }

  const handleSubmit = () => {
    if (!canSubmit()) return

    if (isChairman) {
      send({
        type: 'chairman_director',
        discard_own_idx: selectedOwn.length > 0 ? selectedOwn[0] : -1,
        discard_other_player_id: selectedOther?.playerId ?? null,
        discard_other_idx: selectedOther?.cardIdx ?? null,
      })
    } else if (isDouble) {
      send({ type: 'chairman_director', discard_own_idx: selectedOwn })
    } else {
      send({ type: 'chairman_director', discard_own_idx: selectedOwn[0] })
    }

    resetSelection()
  }

  const roleLabel = isChairman ? 'Chairman' : isDouble ? 'Double Director' : 'Director'
  const roleColor = isChairman ? 'text-amber-400' : 'text-sky-400'
  const roleBg = isChairman ? 'bg-amber-900/20 border-amber-800/30' : 'bg-sky-900/20 border-sky-800/30'

  const content = (
    <div className={cn('rounded-xl p-4 space-y-3 border', roleBg)}>
      <div className="flex items-center gap-2">
        <span className={cn('w-2.5 h-2.5 rounded-full', COMPANY_COLOR[companyName])} />
        <h3 className={cn('text-sm font-bold', roleColor)}>{roleLabel} Power</h3>
        <span className="text-gray-500 text-xs ml-auto font-mono">{companyName}</span>
      </div>

      {isMyTurn ? (
        <>
          {/* Own cards */}
          <div>
            <p className="text-xs text-gray-500 mb-1.5">
              {isChairman ? 'Your' : `Discard ${requiredOwn} of your`} {companyName} card{requiredOwn > 1 ? 's' : ''}
              {isChairman && <span className="text-gray-600 ml-1">(optional)</span>}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ownCards.map((card, i) => (
                <motion.button
                  key={i}
                  onClick={() => toggleOwn(i)}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'px-3 py-1.5 rounded-lg border font-mono text-sm transition-colors',
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

          {/* Chairman: other players' cards (flat list) */}
          {isChairman && (
            <div>
              <p className="text-xs text-gray-500 mb-1.5">
                Remove from another player <span className="text-gray-600">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {otherCards.map((card, i) => (
                  <motion.button
                    key={i}
                    onClick={() => selectOther(card)}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border font-mono text-sm transition-colors',
                      selectedOther?.playerId === card.playerId && selectedOther?.cardIdx === card.cardIdx
                        ? 'bg-amber-900/40 border-amber-600 text-amber-300 ring-1 ring-amber-500/50'
                        : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:border-gray-500',
                    )}
                  >
                    {card.positive ? '+' : '-'}{card.value}
                  </motion.button>
                ))}
                {otherCards.length === 0 && (
                  <p className="text-xs text-gray-600">No other players hold {companyName} cards</p>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <motion.button
              onClick={handleSubmit}
              disabled={!canSubmit()}
              whileHover={canSubmit() ? { scale: 1.02 } : {}}
              whileTap={canSubmit() ? { scale: 0.98 } : {}}
              className={cn(
                'flex-1 py-2 rounded-lg font-medium text-sm transition-colors',
                canSubmit()
                  ? isChairman ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-sky-600 hover:bg-sky-500 text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed',
              )}
            >
              Confirm Discard
            </motion.button>
            <motion.button
              onClick={handlePass}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-300 bg-gray-800/30 hover:bg-gray-700/30 border border-gray-800 transition-colors"
            >
              Pass
            </motion.button>
          </div>
        </>
      ) : (
        <p className="text-gray-500 text-center py-2 text-sm">
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
