import { cn } from '../../lib/cn'
import { COMPANY_COLOR, COMPANY_TICKER } from '../../lib/constants'
import type { Card } from '../../types/game'

interface Props {
  card: Card
  onClick?: () => void
  selected?: boolean
  compact?: boolean
}

export default function CardComponent({ card, onClick, selected, compact }: Props) {
  const isPower = card.is_power
  const ticker = COMPANY_TICKER[card.company] ?? card.company.toUpperCase()

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border-2 transition-all',
        compact
          ? 'px-1.5 py-1 gap-0.5 min-w-[44px] h-[52px]'
          : 'px-3 py-2 min-w-[80px] hover:scale-105 hover:-translate-y-1',
        'cursor-pointer',
        selected && (compact ? 'ring-2 ring-emerald-400 -translate-y-0.5' : 'ring-2 ring-emerald-400 -translate-y-2'),
        isPower
          ? 'bg-amber-900/30 border-amber-600/50 hover:border-amber-400'
          : 'bg-gray-800 border-gray-600 hover:border-gray-400',
        isPower && compact && 'min-w-[52px]',
      )}
    >
      {isPower ? (
        <span
          className={cn(
            'font-bold text-amber-400 uppercase tracking-wider text-center leading-tight',
            compact ? 'text-[8px]' : 'text-[10px]',
          )}
        >
          {card.company.replace(' ', '')}
        </span>
      ) : (
        <>
          <div className={cn('flex items-center', compact ? 'gap-1' : 'gap-1')}>
            <span className={cn(compact ? 'w-1 h-1' : 'w-1.5 h-1.5', 'rounded-full', COMPANY_COLOR[card.company] || 'bg-gray-500')} />
            <span
              className={cn(
                'font-mono font-semibold text-gray-300 tracking-wider',
                compact ? 'text-[8px]' : 'text-[10px]',
              )}
            >
              {ticker}
            </span>
          </div>
          <span
            className={cn(
              'font-mono font-bold',
              compact ? 'text-sm' : 'text-lg',
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
