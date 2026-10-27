import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useReducer, useState } from 'react'
import { tutorialStorage } from '../lib/tutorialStorage'
import { CHAPTERS } from '../tutorial/chapters/index'

/**
 * Tutorial hub: the guided-tutorial chapter list (with per-chapter progress),
 * the rulebook link and the first-encounter tips toggle.
 */
export default function TutorialPage() {
  const navigate = useNavigate()
  const [tipsDisabled, setTipsDisabled] = useState(() => tutorialStorage.areTipsDisabled())
  const [, rerender] = useReducer((n: number) => n + 1, 0) // re-read storage after a reset
  const ids = CHAPTERS.map((c) => c.id)
  const doneIds = new Set(ids.filter((id) => tutorialStorage.isChapterDone(id)))
  const startId = ids.length > 0 ? tutorialStorage.firstIncompleteChapter(ids) : null
  const startChapter = CHAPTERS.find((c) => c.id === startId)

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
            Learn to play
          </h1>
          <p
            style={{
              fontSize: 13,
              color: 'var(--color-ink-muted)',
              textAlign: 'center',
              marginBottom: 22,
            }}
          >
            A guided walkthrough on the real board. Every chapter stands alone.
          </p>

          {startChapter && (
            <button
              data-testid="tutorial-start"
              onClick={() => navigate(`/tutorial/play/${startChapter.id}`)}
              className="w-full px-4 py-4 text-left"
              style={{
                background: 'var(--color-ink)',
                color: 'var(--color-gold-soft)',
                border: '1px solid var(--color-gold)',
                borderRadius: 3,
                cursor: 'pointer',
                marginBottom: 10,
              }}
            >
              <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 20 }}>
                {doneIds.size === 0 ? 'Start from the beginning' : `Continue: ${startChapter.title}`}
              </div>
              <div className="font-mono" style={{ fontSize: 10, letterSpacing: '0.15em', opacity: 0.75, marginTop: 4 }}>
                {doneIds.size} / {CHAPTERS.length} CHAPTERS DONE
              </div>
            </button>
          )}

          {/* Chapter list */}
          <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 10px' }}>
            {CHAPTERS.map((c, i) => {
              const done = doneIds.has(c.id)
              return (
                <li key={c.id} style={{ marginBottom: 6 }}>
                  <Link
                    to={`/tutorial/play/${c.id}`}
                    data-testid={`tutorial-chapter-${c.id}`}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      background: 'var(--color-paper-2)',
                      border: '1px solid var(--color-paper-line)',
                      borderRadius: 3,
                      color: 'var(--color-ink)',
                      textDecoration: 'none',
                      minHeight: 44,
                    }}
                  >
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-gold-deep)', width: 18 }}>
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span style={{ display: 'block', fontFamily: 'DM Serif Display, serif', fontSize: 17 }}>{c.title}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--color-ink-muted)' }}>{c.subtitle}</span>
                    </span>
                    <span className="font-mono" style={{ fontSize: 10, color: 'var(--color-ink-muted)', whiteSpace: 'nowrap' }}>
                      {c.minutes} MIN
                    </span>
                    <span
                      aria-label={done ? 'completed' : 'not completed'}
                      style={{ width: 16, textAlign: 'center', color: 'var(--color-gold-deep)', fontSize: 14 }}
                    >
                      {done ? '✓' : ''}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>

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

          {/* Progress reset */}
          <div className="flex items-center justify-between" style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}>
            <span>
              Progress:{' '}
              <strong style={{ color: 'var(--color-ink)' }}>
                {doneIds.size} of {CHAPTERS.length} chapters
              </strong>
            </span>
            <button
              onClick={() => {
                tutorialStorage.resetChapters()
                tutorialStorage.resetCompleted()
                rerender()
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
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
