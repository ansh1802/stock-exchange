import { cn } from '../../lib/cn'
import { COMPANY_COLOR, COMPANY_TICKER } from '../../lib/constants'
import { useTheme } from '../../hooks/useTheme'
import type { Card } from '../../types/game'

interface Props {
  card: Card
  onClick?: () => void
  selected?: boolean
  compact?: boolean
}

// v2 company color CSS values (paired with --color-co-* tokens)
const V2_COMPANY_HEX: Record<string, string> = {
  Vodafone: '#c44a3f',
  YesBank: '#2c5d8a',
  Cred: '#6b3d8e',
  TCS: '#1f6d7a',
  Reliance: '#c66a2f',
  Infosys: '#3d7a4a',
}

export default function CardComponent({ card, onClick, selected, compact }: Props) {
  const isPower = card.is_power
  const ticker = COMPANY_TICKER[card.company] ?? card.company.toUpperCase()
  const theme = useTheme()

  if (theme === 'v2') {
    const companyHex = V2_COMPANY_HEX[card.company] ?? '#7a6f5b'
    const sizeClasses = compact
      ? 'w-[52px] h-[68px]'   // mobile compact
      : 'w-24 h-[134px]'      // 96 × 134

    if (isPower) {
      // Short, compact-safe abbreviations for the 6 power cards (≤4 chars)
      const POWER_ABBREV: Record<string, string> = {
        RightsIssue: 'RGHT',
        ShareSuspend: 'SUSP',
        LoanStock: 'LOAN',
        Debenture: 'DEBT',
        'Currency + ': 'FX+',
        'Currency - ': 'FX−',
      }
      const abbrev = POWER_ABBREV[card.company] ?? card.company.slice(0, 4).toUpperCase()
      return (
        <button
          onClick={onClick}
          className={cn(
            'relative flex flex-col items-center justify-center cursor-pointer transition-all',
            'bg-[var(--color-ink)] text-[var(--color-paper)]',
            'border border-[var(--color-gold-deep)]',
            'rounded-[3px] overflow-hidden',
            'shadow-[inset_0_0_0_1px_rgba(201,161,74,0.35)]',
            sizeClasses,
            selected && (compact
              ? '-translate-y-1 ring-2 ring-[var(--color-gold)]'
              : '-translate-y-2 ring-2 ring-[var(--color-gold)] shadow-[0_8px_24px_rgba(0,0,0,0.55)]'),
            !selected && !compact && 'hover:-translate-y-1 hover:shadow-[0_6px_16px_rgba(0,0,0,0.45)]',
          )}
        >
          {/* plum stripe — left */}
          <span
            aria-hidden
            className="absolute left-0 top-0 bottom-0 w-1"
            style={{ background: 'var(--color-power)' }}
          />
          {compact ? (
            // Wrap in inner box with paddingLeft to clear the absolute plum stripe
            <div
              className="flex flex-col items-center justify-center w-full h-full"
              style={{ paddingLeft: 4 }}
            >
              <span
                aria-hidden
                className="font-serif italic text-[var(--color-gold)] leading-none"
                style={{ fontSize: 20 }}
              >
                ✦
              </span>
              <span
                className="font-mono font-bold text-[var(--color-gold-soft)] tracking-[0.04em] mt-1 text-center"
                style={{ fontSize: 9, lineHeight: 1 }}
              >
                {abbrev}
              </span>
            </div>
          ) : (
            <>
              <span
                aria-hidden
                className="absolute top-1 right-1.5 font-mono text-[var(--color-gold)]"
                style={{ fontSize: 9, letterSpacing: '0.1em' }}
              >
                ◆
              </span>
              <span
                className="font-serif italic text-[var(--color-gold-soft)] text-center px-1 leading-tight text-[13px]"
                style={{ whiteSpace: 'pre-line' }}
              >
                {card.company.replace(' ', '\n')}
              </span>
            </>
          )}
        </button>
      )
    }

    return (
      <button
        onClick={onClick}
        className={cn(
          'relative flex flex-col items-stretch cursor-pointer transition-all',
          'bg-[var(--color-paper)] text-[var(--color-ink)]',
          'border border-[var(--color-paper-line)]',
          'rounded-[3px] overflow-hidden',
          'shadow-[0_1px_2px_rgba(26,22,17,0.2)]',
          sizeClasses,
          selected && (compact
            ? '-translate-y-1 ring-2 ring-[var(--color-gold)]'
            : '-translate-y-2 ring-2 ring-[var(--color-gold)] shadow-[0_10px_28px_rgba(26,22,17,0.55)]'),
          !selected && !compact && 'hover:-translate-y-1 hover:shadow-[0_6px_18px_rgba(26,22,17,0.4)]',
        )}
      >
        {/* ink stripe — top */}
        <span aria-hidden className="absolute left-0 right-0 top-0 h-px bg-[var(--color-ink)]" />
        {/* company color stripe — left, 4px */}
        <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: companyHex }} />
        {/* gold corner mark — desktop only (overlaps ticker on compact) */}
        {!compact && (
          <span
            aria-hidden
            className="absolute top-1 right-1.5 font-mono text-[var(--color-gold-deep)]"
            style={{ fontSize: 9, letterSpacing: '0.1em' }}
          >
            ◆
          </span>
        )}

        {/* ticker */}
        {compact ? (
          <span
            className="font-mono font-semibold text-[var(--color-ink-muted)] mt-1 text-center w-full"
            style={{ fontSize: 8, letterSpacing: '0.04em', paddingLeft: 4 }}
          >
            {ticker}
          </span>
        ) : (
          <span className="font-mono font-semibold text-[var(--color-ink-muted)] tracking-[0.12em] mt-1 text-[10px] pl-3">
            {ticker}
          </span>
        )}

        {/* value (DM Serif) */}
        <span
          className={cn(
            'flex-1 flex items-center justify-center font-serif',
            compact ? 'text-[20px] leading-none' : 'text-[34px] leading-none',
          )}
          style={{
            color: card.positive ? 'var(--color-buy)' : 'var(--color-sell)',
            paddingLeft: compact ? 2 : 4,
          }}
        >
          {card.positive ? '+' : '−'}{card.value}
        </span>

        {/* mini bottom row */}
        {!compact && (
          <span className="font-mono text-[9px] tracking-[0.15em] text-[var(--color-ink-muted)] uppercase pb-1.5 pl-3">
            {card.positive ? 'gain' : 'drop'}
          </span>
        )}
      </button>
    )
  }

  // v1 — unchanged
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
        isPower && compact && 'min-w-[56px] px-0.5',
      )}
    >
      {isPower ? (
        <span
          className={cn(
            'font-bold text-amber-400 uppercase text-center whitespace-pre-line break-words',
            compact ? 'text-[8px] leading-[1.1] tracking-normal' : 'text-[10px] tracking-wider leading-tight',
          )}
        >
          {card.company.replace(' ', '\n')}
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
