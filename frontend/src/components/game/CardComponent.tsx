import { cn } from '../../lib/cn'
import { COMPANY_COLOR } from '../../lib/constants'
import type { Card } from '../../types/game'

interface Props {
  card: Card
  onClick?: () => void
  selected?: boolean
}

export default function CardComponent({ card, onClick, selected }: Props) {
  const isPower = card.is_power

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center px-3 py-2 rounded-lg border-2 transition-all min-w-[80px]',
        'hover:scale-105 hover:-translate-y-1 cursor-pointer',
        selected && 'ring-2 ring-emerald-400 -translate-y-2',
        isPower
          ? 'bg-amber-900/30 border-amber-600/50 hover:border-amber-400'
          : 'bg-gray-800 border-gray-600 hover:border-gray-400',
      )}
    >
      {/* Company dot / power label */}
      {isPower ? (
        <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">
          {card.company.replace(' ', '')}
        </span>
      ) : (
        <>
          <div className="flex items-center gap-1">
            <span className={cn('w-1.5 h-1.5 rounded-full', COMPANY_COLOR[card.company] || 'bg-gray-500')} />
            <span className="text-[10px] text-gray-400 truncate max-w-[60px]">{card.company}</span>
          </div>
          <span
            className={cn(
              'text-lg font-mono font-bold',
              card.positive ? 'text-emerald-400' : 'text-red-400',
            )}
          >
            {card.positive ? '+' : '-'}{card.value}
          </span>
        </>
      )}
    </button>
  )
}
