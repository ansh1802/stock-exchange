import { Crown, Check, X } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function PlayerList({ send }: Props) {
  const details = useGameStore((s) => s.lobbyDetails)
  const names = useGameStore((s) => s.lobbyPlayers)
  const playerName = useGameStore((s) => s.playerName)
  const isHost = useGameStore((s) => s.isHost)

  // lobby_update carries ready/host flags; fall back to bare names until it lands
  const players = details.length > 0
    ? details
    : names.map((name) => ({ name, ready: false, is_host: false, connected: true }))

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        Players ({players.length}/6)
      </h3>
      <ul className="space-y-1">
        {players.map((p) => {
          const isYou = p.name === playerName
          return (
            <li
              key={p.name}
              className={cn(
                'flex items-center gap-2 px-3 min-h-[44px] bg-gray-800 rounded-lg text-white',
                !p.connected && 'opacity-50',
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', p.connected ? 'bg-emerald-400' : 'bg-red-400')} />
              <span className="truncate">{p.name}</span>
              {p.is_host && <Crown size={14} className="text-amber-400 flex-shrink-0" />}
              {isYou && <span className="text-xs text-gray-500">(you)</span>}

              <span className="ml-auto flex items-center gap-2">
                {p.is_host ? (
                  <span className="text-[10px] uppercase tracking-widest text-amber-400/80">Host</span>
                ) : p.ready ? (
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-emerald-400">
                    <Check size={12} /> Ready
                  </span>
                ) : (
                  <span className="text-[10px] uppercase tracking-widest text-gray-500">Not ready</span>
                )}
                {isHost && !isYou && (
                  <button
                    onClick={() => send({ type: 'kick_player', player_name: p.name })}
                    title={`Remove ${p.name}`}
                    aria-label={`Remove ${p.name}`}
                    className="w-8 h-8 flex items-center justify-center rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {players.length < 2 && (
        <p className="text-sm text-gray-500 mt-2">Waiting for more players...</p>
      )}
    </div>
  )
}
