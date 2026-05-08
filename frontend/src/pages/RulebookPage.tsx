import { useParams, Link } from 'react-router-dom'
import { CHAPTERS } from '../tutorial/chapters'

const orn = '✦' // tiny chapter ornament

export default function RulebookPage() {
  const { chapterId } = useParams()

  // Chapter view
  if (chapterId) {
    const idx = CHAPTERS.findIndex((c) => c.id === chapterId)
    if (idx === -1) {
      return <NotFound />
    }
    const chapter = CHAPTERS[idx]
    const prev = CHAPTERS[idx - 1] ?? null
    const next = CHAPTERS[idx + 1] ?? null
    return (
      <div
        className="min-h-screen flex flex-col items-center"
        style={{ background: 'var(--color-felt)', padding: '24px 16px 48px' }}
      >
        <div
          className="w-full max-w-2xl px-6 py-8"
          style={{
            background: 'var(--color-paper)',
            color: 'var(--color-ink)',
            borderRadius: 4,
            boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <Link
              to="/rulebook"
              className="font-mono"
              style={{
                fontSize: 10,
                letterSpacing: '0.2em',
                color: 'var(--color-gold-deep)',
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              ← Rulebook
            </Link>
            <span
              className="font-mono"
              style={{ fontSize: 10, color: 'var(--color-ink-muted)', letterSpacing: '0.15em' }}
            >
              CH {String(idx + 1).padStart(2, '0')} OF {CHAPTERS.length}
            </span>
          </div>

          <div style={{ textAlign: 'center', margin: '12px 0 4px', color: 'var(--color-gold-deep)', fontSize: 18 }}>
            {orn}
          </div>
          <h1 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 36, lineHeight: 1.05, margin: 0 }}>
            {chapter.title}
          </h1>
          <p
            style={{
              fontSize: 14,
              color: 'var(--color-ink-muted)',
              marginTop: 4,
              marginBottom: 18,
            }}
          >
            {chapter.subtitle}
          </p>

          <div style={{ fontSize: 14, lineHeight: 1.6 }}>{chapter.body}</div>

          <div
            className="flex items-center justify-between"
            style={{
              marginTop: 24,
              paddingTop: 16,
              borderTop: '1px solid var(--color-paper-line)',
            }}
          >
            {prev ? (
              <Link
                to={`/rulebook/${prev.id}`}
                className="font-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--color-gold-deep)',
                  textDecoration: 'none',
                  letterSpacing: '0.1em',
                }}
              >
                ← {prev.title}
              </Link>
            ) : <span />}
            {next ? (
              <Link
                to={`/rulebook/${next.id}`}
                className="font-mono"
                style={{
                  fontSize: 11,
                  color: 'var(--color-gold-deep)',
                  textDecoration: 'none',
                  letterSpacing: '0.1em',
                }}
              >
                {next.title} →
              </Link>
            ) : <span />}
          </div>
        </div>
      </div>
    )
  }

  // Index view
  return (
    <div
      className="min-h-screen flex flex-col items-center"
      style={{ background: 'var(--color-felt)', padding: '24px 16px 48px' }}
    >
      <div className="w-full max-w-2xl">
        <div className="flex items-center justify-between mb-3">
          <Link
            to="/"
            className="font-mono"
            style={{
              fontSize: 10,
              letterSpacing: '0.2em',
              color: 'var(--color-gold-soft)',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            ← Lobby
          </Link>
          <span
            className="font-mono"
            style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-gold-deep)' }}
          >
            REFERENCE
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
          <div style={{ textAlign: 'center', color: 'var(--color-gold-deep)', fontSize: 18 }}>{orn}</div>
          <h1
            style={{
              fontFamily: 'DM Serif Display, serif',
              fontSize: 40,
              textAlign: 'center',
              lineHeight: 1.05,
              margin: '4px 0',
            }}
          >
            Rulebook
          </h1>
          <p
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: 'var(--color-ink-muted)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginTop: 0,
              marginBottom: 24,
            }}
          >
            Ten chapters · {CHAPTERS.reduce((s, c) => s + c.seconds, 0)}s read
          </p>

          <div style={{ display: 'grid', gap: 8 }}>
            {CHAPTERS.map((c, i) => (
              <Link
                key={c.id}
                to={`/rulebook/${c.id}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  background: 'var(--color-paper-2)',
                  border: '1px solid var(--color-paper-line)',
                  borderRadius: 3,
                  color: 'var(--color-ink)',
                  textDecoration: 'none',
                }}
              >
                <div>
                  <div
                    className="font-mono"
                    style={{ fontSize: 9, letterSpacing: '0.18em', color: 'var(--color-gold-deep)' }}
                  >
                    CH {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 18, lineHeight: 1.1 }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-ink-muted)', marginTop: 2 }}>
                    {c.subtitle}
                  </div>
                </div>
                <span
                  className="font-mono"
                  style={{ fontSize: 10, color: 'var(--color-ink-muted)' }}
                >
                  {c.seconds}s
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--color-felt)', color: 'var(--color-paper)' }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 32 }}>Chapter not found</div>
        <Link
          to="/rulebook"
          style={{
            display: 'inline-block',
            marginTop: 16,
            padding: '8px 16px',
            background: 'var(--color-ink)',
            color: 'var(--color-gold-soft)',
            border: '1px solid var(--color-gold)',
            borderRadius: 3,
            textDecoration: 'none',
          }}
        >
          Back to index
        </Link>
      </div>
    </div>
  )
}
