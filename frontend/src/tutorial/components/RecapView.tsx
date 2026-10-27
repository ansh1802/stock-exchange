import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LAST_NAME_KEY, generateRoomCode } from '../../lib/room'
import { tutorialStorage } from '../../lib/tutorialStorage'
import { useGameStore } from '../../store/useGameStore'
import { ORDERED } from '../chapters/ordered'
import { RECAP_COPY, RECAP_ID } from '../chapters/recap'

const TAUGHT = ORDERED.filter((c) => c.id !== RECAP_ID)

function readLastName(): string {
  try { return localStorage.getItem(LAST_NAME_KEY) ?? '' } catch { return '' }
}

const btn = {
  fontSize: 11,
  letterSpacing: '0.15em',
  cursor: 'pointer',
  borderRadius: 3,
  minHeight: 44,
} as const

/**
 * Ch 11: every chapter's chips grouped by chapter, then "Play your first game
 * vs bots" (fresh room, `?autostart=bots3`), replay and rulebook. No fixture,
 * no store swap — it runs against the live store, like the lobby.
 */
export default function RecapView() {
  const navigate = useNavigate()
  const [name, setName] = useState(readLastName)
  const [askName, setAskName] = useState(false)

  // Reaching the recap finishes the tutorial.
  useEffect(() => { tutorialStorage.markChapterDone(RECAP_ID) }, [])

  const play = () => {
    const trimmed = name.trim()
    if (!trimmed) { setAskName(true); return }
    try { localStorage.setItem(LAST_NAME_KEY, trimmed) } catch { /* ignore */ }
    const code = generateRoomCode()
    const store = useGameStore.getState()
    store.reset() // a brand-new room: drop any previous room's lobby/game state
    store.setConnection(code, trimmed)
    navigate(`/game/${code}?autostart=bots3`)
  }

  return (
    <div
      data-testid="recap"
      className="min-h-screen flex justify-center"
      style={{ background: 'var(--color-felt)', padding: '24px 16px' }}
    >
      <div className="w-full max-w-xl">
        <div
          className="px-6 py-7"
          style={{ background: 'var(--color-paper)', color: 'var(--color-ink)', borderRadius: 4, boxShadow: '0 12px 32px rgba(0,0,0,0.5)' }}
        >
          <div className="font-mono uppercase text-center" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-gold-deep)' }}>
            {RECAP_COPY.eyebrow}
          </div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 36, lineHeight: 1.05, textAlign: 'center', margin: '6px 0' }}>
            {RECAP_COPY.heading}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-ink-muted)', textAlign: 'center', marginBottom: 20 }}>
            {RECAP_COPY.intro}
          </p>

          <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
            {TAUGHT.map((c, i) => (
              <li key={c.id} data-testid={`recap-chapter-${c.id}`} style={{ marginBottom: 14 }}>
                <div className="flex items-baseline gap-2" style={{ marginBottom: 6 }}>
                  <span className="font-mono" style={{ fontSize: 11, color: 'var(--color-gold-deep)' }}>{i + 1}</span>
                  <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 18 }}>{c.title}</span>
                </div>
                <ul className="space-y-1">
                  {c.chips.map((chip) => (
                    <li
                      key={chip}
                      className="px-3 py-2"
                      style={{ background: 'var(--color-paper-2)', border: '1px solid var(--color-gold)', borderRadius: 3, fontSize: 13 }}
                    >
                      ✦ {chip}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-2">
            {askName && (
              <label className="flex flex-col gap-1" style={{ fontSize: 12, color: 'var(--color-ink-muted)' }}>
                {RECAP_COPY.namePrompt}
                <input
                  data-testid="recap-name"
                  autoFocus
                  value={name}
                  maxLength={20}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') play() }}
                  className="px-3"
                  style={{ minHeight: 44, fontSize: 16, color: 'var(--color-ink)', background: 'var(--color-paper-2)', border: '1px solid var(--color-gold)', borderRadius: 3 }}
                />
              </label>
            )}
            <button
              data-testid="recap-play-bots"
              onClick={play}
              className="font-mono uppercase"
              style={{ ...btn, background: 'var(--color-ink)', color: 'var(--color-gold-soft)', border: '1px solid var(--color-gold)' }}
            >
              {RECAP_COPY.play}
            </button>
            <p style={{ fontSize: 11, color: 'var(--color-ink-muted)', textAlign: 'center', marginBottom: 6 }}>
              {RECAP_COPY.playHint}
            </p>
            <button
              data-testid="recap-replay"
              onClick={() => navigate('/tutorial')}
              className="font-mono uppercase"
              style={{ ...btn, background: 'transparent', color: 'var(--color-ink)', border: '1px solid var(--color-paper-line)' }}
            >
              {RECAP_COPY.replay}
            </button>
            <button
              data-testid="recap-rulebook"
              onClick={() => navigate('/rulebook')}
              className="font-mono uppercase"
              style={{ ...btn, background: 'transparent', color: 'var(--color-ink)', border: '1px solid var(--color-paper-line)' }}
            >
              {RECAP_COPY.rulebook}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
