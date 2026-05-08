import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  /** Where to anchor the callout. If absent, callout renders top-centered. */
  anchorRef?: React.RefObject<HTMLElement | null>
  /** Title (DM Serif). */
  title: ReactNode
  /** Body. */
  children: ReactNode
  /** Primary CTA label. Defaults to "Got it". */
  primaryLabel?: string
  /** Optional secondary action — e.g. "Read more" deep-links into rulebook. */
  secondary?: { label: string; onClick: () => void }
  /** Called when primary CTA is clicked OR backdrop dismissed. */
  onDismiss: () => void
  /** Pause the page underneath while open. Default false (game keeps moving). */
  modal?: boolean
}

/**
 * Gold-stripe callout. Floats above the page; positioned beneath the anchor
 * when given, else top-centered. Backdrop is transparent unless `modal`,
 * because the plan calls out: tooltips do not pause the game and auto-dismiss
 * on action — so by default the page stays interactive behind the coachmark.
 */
export default function Coachmark({
  anchorRef,
  title,
  children,
  primaryLabel = 'Got it',
  secondary,
  onDismiss,
  modal = false,
}: Props) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  // Position once we know the anchor + our own measured size
  useLayoutEffect(() => {
    if (!anchorRef?.current || !cardRef.current) return
    const compute = () => {
      const a = anchorRef.current?.getBoundingClientRect()
      const c = cardRef.current?.getBoundingClientRect()
      if (!a || !c) return
      // Prefer below the anchor, fall back to above if no room
      const margin = 8
      const wantTop = a.bottom + margin
      const fitsBelow = wantTop + c.height < window.innerHeight - 16
      const top = fitsBelow ? wantTop : Math.max(16, a.top - c.height - margin)
      // Center horizontally on the anchor, clamp to viewport
      const rawLeft = a.left + a.width / 2 - c.width / 2
      const left = Math.max(12, Math.min(window.innerWidth - c.width - 12, rawLeft))
      setPos({ top, left })
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
    }
  }, [anchorRef])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  const cardStyle: React.CSSProperties = anchorRef
    ? {
        position: 'fixed',
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        opacity: pos ? 1 : 0,
        zIndex: 80,
      }
    : {
        position: 'fixed',
        top: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 80,
      }

  return createPortal(
    <>
      {modal && (
        <div
          onClick={onDismiss}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(14,26,20,0.5)',
            backdropFilter: 'blur(2px)',
            zIndex: 75,
          }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        style={{
          ...cardStyle,
          width: 'min(360px, calc(100vw - 24px))',
          background: 'var(--color-paper)',
          color: 'var(--color-ink)',
          borderLeft: '3px solid var(--color-gold)',
          borderRadius: 3,
          padding: '12px 14px',
          boxShadow: '0 14px 36px rgba(0,0,0,0.45), 0 0 0 1px rgba(201,161,74,0.25)',
        }}
      >
        <div
          style={{
            fontFamily: 'DM Serif Display, serif',
            fontSize: 18,
            lineHeight: 1.15,
            marginBottom: 4,
            color: 'var(--color-ink)',
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-ink-2)' }}>
          {children}
        </div>
        <div
          className="flex gap-2"
          style={{ marginTop: 10, alignItems: 'center', justifyContent: 'flex-end' }}
        >
          {secondary && (
            <button
              onClick={secondary.onClick}
              className="font-mono"
              style={{
                background: 'transparent',
                border: '1px solid var(--color-paper-line)',
                color: 'var(--color-ink-2)',
                padding: '5px 10px',
                fontSize: 10,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              {secondary.label}
            </button>
          )}
          <button
            onClick={onDismiss}
            className="font-mono"
            style={{
              background: 'var(--color-ink)',
              color: 'var(--color-gold-soft)',
              border: '1px solid var(--color-gold)',
              padding: '5px 12px',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
