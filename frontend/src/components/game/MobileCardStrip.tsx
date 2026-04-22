import { useMemo } from 'react'
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
    <div className="border-t border-gray-800 bg-gray-900">
      <div className="flex gap-1.5 px-2 py-2 overflow-x-auto mobile-scroll items-stretch">
        {/* Header slot: label + View All button, inlined as the first slot */}
        <button
          onClick={onOpenDrawer}
          className={cn(
            'flex-shrink-0 flex flex-col items-center justify-center gap-0.5',
            'min-w-[56px] h-[52px] px-1.5 rounded-md',
            'bg-gray-800/50 border border-gray-700 hover:bg-gray-800',
            'text-[9px] font-mono text-gray-400',
          )}
          aria-label="View all cards"
        >
          <span className="tracking-wider">CARDS ({cards.length})</span>
          <span className="text-emerald-400 text-[10px] font-semibold">View All ↑</span>
        </button>

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
