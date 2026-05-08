import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { tutorialStorage } from '../lib/tutorialStorage'

/**
 * Tutorial hub. The plan defines a Surface A "scripted bot walkthrough" that
 * is a multi-week build (state machine, three bot personas, scripted decks).
 * That's stubbed here — the route exists, the entry surfaces are wired, but
 * the orchestrator is a "coming soon" panel. Surface B (Rulebook) ships fully
 * (see /rulebook). Surface C (first-encounter tooltips) ships via
 * useFirstEncounterTip.
 */
export default function TutorialPage() {
  const navigate = useNavigate()
  const [tipsDisabled, setTipsDisabled] = useState(() => tutorialStorage.areTipsDisabled())
  const [completed, setCompleted] = useState(() => tutorialStorage.isCompleted())

  useEffect(() => {
    tutorialStorage.setTipsDisabled(tipsDisabled)
  }, [tipsDisabled])

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-felt)', padding: '24px 16px' }}
    >
      <div className="w-full max-w-xl">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => navigate('/')}
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.2em',
              color: 'var(--color-gold-soft)',
              textTransform: 'uppercase',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            ← Lobby
          </button>
          <span
            className="font-mono"
            style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-gold-deep)' }}
          >
            LEARN TO PLAY
          </span>
        </div>

        <div
          className="px-6 py-7"
          style={{
            background: 'var(--color-paper)',
            color: 'var(--color-ink)',
            borderRadius: 4,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ textAlign: 'center', color: 'var(--color-gold-deep)', fontSize: 18 }}>✦</div>
          <h1
            style={{
              fontFamily: 'DM Serif Display, serif',
              fontSize: 40,
              lineHeight: 1.05,
              textAlign: 'center',
              margin: '4px 0 6px',
            }}
          >
            Three ways<br />to learn
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--color-ink-muted)',
              textAlign: 'center',
              marginBottom: 22,
            }}
          >
            Pick what fits your time.
          </p>

          {/* Walkthrough — stubbed */}
          <div
            className="px-4 py-4"
            style={{
              background: 'var(--color-paper-2)',
              border: '1px solid var(--color-paper-line)',
              borderRadius: 3,
              opacity: 0.6,
              marginBottom: 10,
            }}
          >
            <div className="flex items-baseline justify-between">
              <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 20 }}>Walkthrough</div>
              <span
                className="font-mono"
                style={{ fontSize: 10, color: 'var(--color-ink-muted)', letterSpacing: '0.15em' }}
              >
                COMING SOON
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', marginTop: 4 }}>
              5-minute guided sandbox with scripted opponents. Read the
              rulebook in the meantime.
            </div>
          </div>

          {/* Rulebook — primary */}
          <Link
            to="/rulebook"
            className="block px-4 py-4"
            style={{
              background: 'var(--color-paper-2)',
              border: '1px solid var(--color-gold)',
              boxShadow: '0 0 0 1px rgba(201,161,74,0.18)',
              borderRadius: 3,
              color: 'var(--color-ink)',
              textDecoration: 'none',
              marginBottom: 10,
            }}
          >
            <div className="flex items-baseline justify-between">
              <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 20 }}>Rulebook</div>
              <span
                className="font-mono"
                style={{ fontSize: 10, color: 'var(--color-gold-deep)', letterSpacing: '0.15em' }}
              >
                READ →
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', marginTop: 4 }}>
              Ten short chapters. Browsable any time. ~6 minutes total.
            </div>
          </Link>

          {/* Live tips toggle */}
          <div
            className="px-4 py-4"
            style={{
              background: 'var(--color-paper-2)',
              border: '1px solid var(--color-paper-line)',
              borderRadius: 3,
              marginBottom: 16,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 18 }}>
                  Live tooltips
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>
                  First-time spotlights for the Chairman badge, power cards
                  and edge cases. Off for power users.
                </div>
              </div>
              <button
                onClick={() => setTipsDisabled((v) => !v)}
                style={{
                  background: tipsDisabled ? 'var(--color-paper-2)' : 'var(--color-ink)',
                  color: tipsDisabled ? 'var(--color-ink-muted)' : 'var(--color-gold-soft)',
                  border: `1px solid ${tipsDisabled ? 'var(--color-paper-line)' : 'var(--color-gold)'}`,
                  padding: '6px 12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  borderRadius: 3,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {tipsDisabled ? 'Off' : 'On'}
              </button>
            </div>
          </div>

          {/* Completed toggle */}
          <div className="flex items-center justify-between" style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>
            <span>
              Status:{' '}
              <strong style={{ color: 'var(--color-ink)' }}>
                {completed ? 'tutorial completed' : 'not yet completed'}
              </strong>
            </span>
            <button
              onClick={() => {
                if (completed) {
                  tutorialStorage.resetCompleted()
                  setCompleted(false)
                } else {
                  tutorialStorage.markCompleted()
                  setCompleted(true)
                }
              }}
              className="font-mono"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-gold-deep)',
                cursor: 'pointer',
                fontSize: 10,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              {completed ? 'Reset' : 'Mark done'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
