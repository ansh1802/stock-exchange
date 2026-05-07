import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/useGameStore'
import { formatCash } from '../../lib/format'
import { COMPANY_COLOR } from '../../lib/constants'
import { cn } from '../../lib/cn'
import { Trophy, Crown } from 'lucide-react'
import { useTheme } from '../../hooks/useTheme'
import type { Ranking } from '../../types/game'

interface Props {
  rankings: Ranking[]
}

export default function GameOverScreen({ rankings }: Props) {
  const navigate = useNavigate()
  const reset = useGameStore((s) => s.reset)
  const theme = useTheme()

  const handleBack = () => {
    reset()
    navigate('/')
  }

  if (theme === 'v2') {
    const winner = rankings[0]
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen p-4"
        style={{ background: 'var(--color-felt)' }}
      >
        <div className="w-full max-w-2xl">
          {/* Eyebrow */}
          <div
            className="text-center font-mono uppercase mb-4"
            style={{ fontSize: 11, letterSpacing: '0.3em', color: 'var(--color-gold-deep)' }}
          >
            · The Bell Has Rung ·
          </div>

          {/* Winner card */}
          <div
            className="p-8 mb-6 text-center"
            style={{
              background: 'var(--color-paper)',
              color: 'var(--color-ink)',
              borderRadius: 4,
              boxShadow: '0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px var(--color-gold)',
              position: 'relative',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: 12,
                left: 12,
                right: 12,
                bottom: 12,
                border: '1px solid var(--color-gold-deep)',
                pointerEvents: 'none',
                opacity: 0.5,
              }}
            />
            <div
              className="font-mono uppercase mb-2"
              style={{ fontSize: 10, letterSpacing: '0.3em', color: 'var(--color-gold-deep)' }}
            >
              First Position
            </div>
            <Crown size={36} style={{ margin: '0 auto', color: 'var(--color-gold)' }} />
            <div
              style={{
                fontFamily: 'DM Serif Display, serif',
                fontStyle: 'italic',
                fontSize: 56,
                lineHeight: 1,
                color: 'var(--color-ink)',
                marginTop: 8,
              }}
            >
              {winner.name}
            </div>
            <div
              style={{
                marginTop: 12,
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 22,
                color: 'var(--color-gold-deep)',
                letterSpacing: '0.05em',
              }}
            >
              {formatCash(winner.net_worth)}
            </div>
            <div
              style={{
                marginTop: 16,
                height: 1,
                background:
                  'linear-gradient(to right, transparent, var(--color-gold) 25%, var(--color-gold) 75%, transparent)',
              }}
            />
          </div>

          {/* Ranked list */}
          <div
            className="overflow-hidden"
            style={{
              background: 'var(--color-paper)',
              borderRadius: 4,
              border: '1px solid var(--color-paper-line)',
            }}
          >
            {rankings.map((r, i) => (
              <div
                key={r.player_id}
                className="flex items-center gap-4 px-5 py-4"
                style={{
                  borderBottom:
                    i < rankings.length - 1 ? '1px solid var(--color-paper-line)' : 'none',
                  background: i === 0 ? 'rgba(201,161,74,0.12)' : 'transparent',
                  color: 'var(--color-ink)',
                }}
              >
                <span
                  style={{
                    fontFamily: 'DM Serif Display, serif',
                    fontSize: 28,
                    width: 36,
                    textAlign: 'center',
                    color: i === 0 ? 'var(--color-gold-deep)' : 'var(--color-ink-muted)',
                  }}
                >
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div
                    style={{
                      fontFamily: 'DM Serif Display, serif',
                      fontSize: 20,
                      lineHeight: 1.1,
                      color: 'var(--color-ink)',
                    }}
                  >
                    {r.name}
                  </div>
                  <div
                    className="flex gap-3 mt-0.5 font-mono"
                    style={{ fontSize: 11, color: 'var(--color-ink-muted)' }}
                  >
                    <span>cash · {formatCash(r.cash)}</span>
                    <span style={{ color: 'var(--color-paper-line)' }}>·</span>
                    <span>
                      {Object.entries(r.stocks)
                        .filter(([, v]) => v > 0)
                        .map(([name, count]) => (
                          <span key={name} className="inline-flex items-center gap-0.5 mr-2">
                            <span
                              className={cn('w-1.5 h-1.5 rounded-full', COMPANY_COLOR[name])}
                            />
                            {count}
                          </span>
                        ))}
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 16,
                    fontWeight: 700,
                    color: i === 0 ? 'var(--color-gold-deep)' : 'var(--color-ink)',
                  }}
                >
                  {formatCash(r.net_worth)}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleBack}
            className="mt-6 w-full py-3 transition-all"
            style={{
              background: 'var(--color-ink)',
              color: 'var(--color-gold-soft)',
              border: '1px solid var(--color-gold)',
              borderRadius: 3,
              fontFamily: 'DM Serif Display, serif',
              fontSize: 18,
            }}
          >
            Return to the Floor
          </button>
        </div>
      </div>
    )
  }

  // v1 — unchanged
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <Trophy className="mx-auto text-amber-400 mb-2" size={48} />
          <h1 className="text-3xl font-bold text-white">Game Over</h1>
        </div>

        <div className="space-y-2">
          {rankings.map((r, i) => (
            <div
              key={r.player_id}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl border',
                i === 0
                  ? 'bg-amber-900/20 border-amber-700/50'
                  : 'bg-gray-900 border-gray-800',
              )}
            >
              <span
                className={cn(
                  'text-2xl font-bold w-8 text-center',
                  i === 0 ? 'text-amber-400' : 'text-gray-500',
                )}
              >
                #{i + 1}
              </span>
              <div className="flex-1">
                <div className="text-white font-medium">{r.name}</div>
                <div className="flex gap-3 mt-1 text-xs text-gray-400 font-mono">
                  <span>Cash: {formatCash(r.cash)}</span>
                  <span className="text-gray-600">|</span>
                  <span>
                    Stocks:{' '}
                    {Object.entries(r.stocks)
                      .filter(([, v]) => v > 0)
                      .map(([name, count]) => (
                        <span key={name} className="inline-flex items-center gap-0.5 mr-2">
                          <span className={cn('w-1 h-1 rounded-full', COMPANY_COLOR[name])} />
                          {count}
                        </span>
                      ))}
                  </span>
                </div>
              </div>
              <span className={cn(
                'text-lg font-mono font-bold',
                i === 0 ? 'text-amber-400' : 'text-white',
              )}>
                {formatCash(r.net_worth)}
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={handleBack}
          className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-medium transition-colors"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  )
}
