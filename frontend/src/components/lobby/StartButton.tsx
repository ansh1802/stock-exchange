import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import type { ClientMessage } from '../../types/messages'

const DEBUG_PRESETS: Record<string, string> = {
  chairman: 'P1 chairman (100 shares Reliance), P2 director (75). Both have cards. Last round.',
  chairman_no_own_cards: 'P1 chairman with NO own cards. P2 director has cards. Tests partial exercise.',
  double_director: 'P1 chairman + P2 double director (both 100 shares Cred).',
  share_suspend: 'Both players hold ShareSuspend power cards.',
  currency: 'P1 has Currency+, P2 has Currency-.',
  all_powers: 'Chairman + ShareSuspend + Currency cards. Full end-of-day test.',
}

const TIMER_OPTIONS = [15, 30, 45, 60, 75, 90] as const

interface Props {
  send: (msg: ClientMessage) => void
}

export default function StartButton({ send }: Props) {
  const isHost = useGameStore((s) => s.isHost)
  const players = useGameStore((s) => s.lobbyPlayers)
  const details = useGameStore((s) => s.lobbyDetails)
  const playerName = useGameStore((s) => s.playerName)
  const isPublic = useGameStore((s) => s.isPublic)
  const [showPresets, setShowPresets] = useState(false)
  const [turnTimer, setTurnTimer] = useState<number>(90)

  const notReady = details.filter((p) => !p.is_host && !p.ready).map((p) => p.name)
  const canStart = players.length >= 2 && notReady.length === 0

  if (!isHost) {
    const me = details.find((p) => p.name === playerName)
    const ready = me?.ready ?? false
    return (
      <div className="mt-4 space-y-2">
        <button
          onClick={() => send({ type: 'set_ready', ready: !ready })}
          className={cn(
            'w-full min-h-[44px] font-medium rounded-2xl border transition-colors',
            ready
              ? 'bg-emerald-600/15 border-emerald-500/60 text-emerald-300 hover:bg-emerald-600/25'
              : 'bg-emerald-600 border-emerald-500 text-white hover:bg-emerald-500',
          )}
        >
          {ready ? 'Ready ✓ (tap to undo)' : "I'm ready"}
        </button>
        <p className="text-sm text-gray-500 text-center">
          {ready ? 'Waiting for host to start...' : 'Press ready when you are set'}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      <label className="flex items-center justify-between gap-3 cursor-pointer select-none">
        <span>
          <span className="block text-sm text-gray-300">Public room</span>
          <span className="block text-[11px] text-gray-500">Show on the landing page so anyone can join</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isPublic}
          onClick={() => send({ type: 'set_public', is_public: !isPublic })}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors flex-shrink-0',
            isPublic ? 'bg-emerald-600' : 'bg-gray-700',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform',
              isPublic && 'translate-x-5',
            )}
          />
        </button>
      </label>

      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1.5">Turn timer</p>
        <div className="grid grid-cols-6 gap-1.5">
          {TIMER_OPTIONS.map((secs) => (
            <button
              key={secs}
              onClick={() => setTurnTimer(secs)}
              className={cn(
                'py-1.5 text-xs font-mono rounded-md border transition-colors',
                turnTimer === secs
                  ? 'bg-emerald-600/20 border-emerald-500/60 text-emerald-300'
                  : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300',
              )}
            >
              {secs}s
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => send({ type: 'start_game', turn_timer_seconds: turnTimer })}
        disabled={!canStart}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-2xl transition-colors"
      >
        Start Game ({players.length} players)
      </button>
      {players.length >= 2 && notReady.length > 0 && (
        <p className="text-xs text-gray-500 text-center -mt-1">
          Waiting for {notReady.join(', ')} to ready up
        </p>
      )}

      <button
        onClick={() => setShowPresets(!showPresets)}
        className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
      >
        {showPresets ? 'Hide' : 'Show'} debug presets
      </button>

      {showPresets && (
        <div className="space-y-1.5 p-3 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Debug Presets</p>
          {Object.entries(DEBUG_PRESETS).map(([key, desc]) => (
            <button
              key={key}
              onClick={() => send({ type: 'start_game', preset: key, turn_timer_seconds: turnTimer })}
              disabled={!canStart}
              className="w-full text-left px-3 py-2 text-xs bg-gray-800/50 hover:bg-gray-700/50 disabled:opacity-30 rounded-lg border border-gray-800 transition-colors group"
            >
              <span className="text-amber-400 font-mono">{key}</span>
              <p className="text-gray-500 mt-0.5 group-hover:text-gray-400">{desc}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
