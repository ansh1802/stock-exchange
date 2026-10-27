import type { CSSProperties, Ref } from 'react'
import type { Step } from '../runtime/types'
import { renderBold } from './richText'

export type CoachmarkVariant = 'card' | 'chip' | 'missing'

interface Props {
  variant: CoachmarkVariant
  step: Step
  picked: number | null
  isMobile: boolean
  style: CSSProperties
  cardRef?: Ref<HTMLDivElement>
  onNext(): void
  onPredict(i: number): void
  onRestartStep(): void
  onExit(): void
}

const ACTION_KINDS = new Set(['click', 'value', 'action'])

/**
 * The tutorial's single callout. Editorial paper card (v2 tokens, which are
 * defined globally, so it reads the same on the v1 dark board): mono eyebrow,
 * sans body with `**bold**`, quiet Exit on the left, one primary on the right.
 * Positioning is the layer's job — this only renders content into `style`.
 */
export default function TutorialCoachmark({
  variant, step, picked, isMobile, style, cardRef, onNext, onPredict, onRestartStep, onExit,
}: Props) {
  const text = (isMobile ? step.textMobile ?? step.text : step.text) ?? ''
  const a = step.advance
  const touch = isMobile ? 44 : 34

  const primaryBtn: CSSProperties = {
    minHeight: touch,
    padding: '0 16px',
    background: 'var(--color-ink)',
    color: 'var(--color-gold-soft)',
    border: '1px solid var(--color-gold)',
    borderRadius: 3,
    fontSize: 11,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  }
  const exitBtn: CSSProperties = {
    minHeight: touch,
    padding: '0 2px',
    background: 'transparent',
    border: 0,
    color: 'var(--color-ink-muted)',
    fontSize: 10,
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    textDecoration: 'underline',
    textDecorationColor: 'var(--color-paper-line)',
    textUnderlineOffset: 3,
  }
  const exit = (
    <button type="button" data-testid="tutorial-exit" className="font-mono" style={exitBtn} onClick={onExit}>
      Exit tutorial
    </button>
  )

  if (variant === 'chip') {
    return (
      <div
        ref={cardRef}
        role="status"
        aria-live="polite"
        className="tut-enter"
        style={{
          ...style,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '4px 6px 4px 14px',
          background: 'var(--color-paper)',
          color: 'var(--color-ink-2)',
          borderLeft: '3px solid var(--color-gold)',
          borderRadius: 3,
          boxShadow: '0 10px 28px rgba(0,0,0,0.4), 0 0 0 1px rgba(201,161,74,0.25)',
          fontSize: 13,
          lineHeight: 1.45,
        }}
      >
        <span aria-hidden className="tut-dots" style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
          <i /><i /><i />
        </span>
        {text && <span style={{ flex: 1, minWidth: 0, padding: '6px 0' }}>{renderBold(text)}</span>}
        {exit}
      </div>
    )
  }

  const isPredict = a.kind === 'predict'
  const eyebrow = variant === 'missing' ? null : isPredict ? 'Predict' : ACTION_KINDS.has(a.kind) ? 'Your move' : null
  const showNext = a.kind === 'next' || (isPredict && picked !== null)

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-live="polite"
      aria-label="Tutorial"
      className="tut-enter"
      style={{
        ...style,
        maxHeight: 'calc(100svh - 32px)',
        overflowY: 'auto',
        background: 'var(--color-paper)',
        color: 'var(--color-ink-2)',
        borderLeft: '3px solid var(--color-gold)',
        borderRadius: 3,
        padding: isMobile ? '12px 14px 8px' : '14px 16px 10px',
        boxShadow: '0 18px 44px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,161,74,0.28)',
      }}
    >
      {eyebrow && (
        <div
          className="font-mono"
          style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--color-gold-deep)', marginBottom: 6 }}
        >
          {eyebrow}
        </div>
      )}
      {text && (
        <p className="font-sans" style={{ margin: 0, fontSize: isMobile ? 15 : 14.5, lineHeight: 1.5 }}>
          {renderBold(text)}
        </p>
      )}

      {isPredict && (
        <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
          {a.options.map((o, i) => {
            const chosen = picked === i
            const revealCorrect = picked !== null && o.correct
            const tone = chosen ? (o.correct ? 'var(--color-buy)' : 'var(--color-sell)') : revealCorrect ? 'var(--color-buy)' : null
            return (
              <button
                key={i}
                type="button"
                data-testid={`tutorial-predict-${i}`}
                disabled={picked !== null}
                aria-pressed={chosen}
                onClick={() => onPredict(i)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: isMobile ? 44 : 38,
                  padding: '6px 12px',
                  textAlign: 'left',
                  background: chosen ? 'var(--color-paper-2)' : 'transparent',
                  border: `1px solid ${tone ?? 'var(--color-paper-line)'}`,
                  borderRadius: 3,
                  color: 'var(--color-ink)',
                  fontSize: 14,
                  cursor: picked === null ? 'pointer' : 'default',
                  opacity: picked !== null && !chosen && !revealCorrect ? 0.55 : 1,
                }}
              >
                <span className="font-mono" style={{ fontSize: 10, color: tone ?? 'var(--color-ink-muted)', width: 12 }}>
                  {picked !== null && (chosen || revealCorrect) ? (o.correct ? '✓' : '✕') : String.fromCharCode(65 + i)}
                </span>
                <span>{renderBold(o.label)}</span>
              </button>
            )
          })}
          {picked !== null && (
            <p
              className="font-serif"
              style={{ margin: '4px 0 0', fontSize: 17, lineHeight: 1.3, color: 'var(--color-ink)', fontStyle: 'italic' }}
            >
              {renderBold(a.options[picked]?.correct ? a.right : a.wrong)}
            </p>
          )}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
        {exit}
        <div style={{ display: 'flex', gap: 8 }}>
          {variant === 'missing' && (
            <button type="button" data-testid="tutorial-restart" className="font-mono" style={primaryBtn} onClick={onRestartStep}>
              Restart this step
            </button>
          )}
          {showNext && (
            <button type="button" data-testid="tutorial-next" className="font-mono" style={primaryBtn} onClick={onNext}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
