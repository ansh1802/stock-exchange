import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import type { ClientMessage } from '../../types/messages'

const DEBUG_PRESETS: Record<string, string> = {
  chairman: 'P1 chairman (100 shares Reliance), P2 director (75). Both have cards. Last round.',
  chairman_no_own_cards: 'P1 chairman with NO own cards. P2 director has cards. Tests partial exercise.',
  double_director: 'P1 chairman + P2 double director (both 100 shares Cred).',
  share_suspend: 'Both players hold ShareSuspend power cards.',
  currency: 'P1 has Currency+, P2 has Currency-.',
  all_powers: 'Chairman + ShareSuspend + Currency cards. Full end-of-day test.',
}

interface Props {
  send: (msg: ClientMessage) => void
}

export default function StartButton({ send }: Props) {
  const isHost = useGameStore((s) => s.isHost)
  const players = useGameStore((s) => s.lobbyPlayers)
  const [showPresets, setShowPresets] = useState(false)

  if (!isHost) {
    return <p className="mt-4 text-sm text-gray-500 text-center">Waiting for host to start...</p>
  }

  return (
    <div className="mt-4 space-y-2">
      <button
        onClick={() => send({ type: 'start_game' })}
        disabled={players.length < 2}
        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
      >
        Start Game ({players.length} players)
      </button>

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
              onClick={() => send({ type: 'start_game', preset: key })}
              disabled={players.length < 2}
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
