import { useMemo } from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { Card } from '../../types/game'
import CardComponent from './CardComponent'

interface Props {
  hand: Card[]
  selectedIdx: number | null
  isMyTurn: boolean
  onSelect: (index: number) => void
  onOpenDrawer: () => void
}

export default function MobileCardStrip({
  hand,
  selectedIdx,
  isMyTurn,
  onSelect,
  onOpenDrawer,
}: Props) {
  // Derive cards directly from props — no accumulated local state (Phase 2 rule).
  const cards = useMemo(() => hand, [hand])

  return (
    <div className="relative border-t border-gray-800 bg-gray-900">
      {/* Protruding chevron tab — centred, bumps above the strip */}
      <button
        onClick={onOpenDrawer}
        aria-label="View all cards"
        className="absolute left-1/2 -translate-x-1/2 -top-4 flex items-center justify-center w-12 h-5 rounded-t-xl bg-gray-900 border border-gray-700 border-b-0 text-emerald-400 hover:text-emerald-300 shadow-[0_-2px_6px_rgba(0,0,0,0.4)]"
      >
        <ChevronUp size={16} />
      </button>
      <div className="flex gap-1.5 px-2 py-2 overflow-x-auto mobile-scroll items-stretch">
        {cards.map((card, i) => (
          <CardComponent
            key={i}
            card={card}
            compact
            selected={selectedIdx === i}
            onClick={() => isMyTurn && onSelect(i)}
          />
        ))}
        {cards.length === 0 && (
          <span className="text-gray-500 text-xs py-2 px-2">No cards in hand</span>
        )}
      </div>
    </div>
  )
}
