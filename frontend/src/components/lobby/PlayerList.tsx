import { useState } from 'react'
import { Crown, WifiOff } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import ConfirmDialog from './ConfirmDialog'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function PlayerList({ send }: Props) {
  const players = useGameStore((s) => s.lobbyPlayers)
  const isHost = useGameStore((s) => s.isHost)
  const [kickTarget, setKickTarget] = useState<{ id: number; name: string } | null>(null)

  const confirmKick = () => {
    if (kickTarget) send({ type: 'kick', player_id: kickTarget.id })
    setKickTarget(null)
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        Players ({players.length}/6)
      </h3>
      <ul className="space-y-1">
        {players.map((player) => {
          const isDisconnected = !player.connected && !player.is_you
          return (
            <li
              key={player.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                isDisconnected ? 'bg-gray-900/30 border border-gray-800/50 opacity-60' : 'bg-gray-800 text-white',
              )}
            >
              {isDisconnected ? (
                <WifiOff size={14} className="text-red-400 flex-shrink-0" />
              ) : (
                <span
                  className={cn('w-2 h-2 rounded-full flex-shrink-0', player.ready ? 'bg-emerald-400' : 'bg-gray-500')}
                  title={player.ready ? 'Ready' : 'Not ready'}
                />
              )}
              {player.is_host && <Crown size={14} className="text-amber-400 flex-shrink-0" />}
              <span className={cn('truncate', isDisconnected && 'text-gray-500')}>{player.name}</span>
              {player.is_you && <span className="text-xs text-gray-500">(you)</span>}

              <span className="ml-auto flex items-center gap-2">
                {!isDisconnected && (
                  <span className={cn('text-xs font-mono', player.ready ? 'text-emerald-400' : 'text-gray-500')}>
                    {player.ready ? 'Ready' : 'Not ready'}
                  </span>
                )}
                {isHost && !player.is_you && (
                  <button
                    onClick={() => setKickTarget({ id: player.id, name: player.name })}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 rounded border border-red-900/50 hover:border-red-700 transition-colors"
                  >
                    Kick
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

      <ConfirmDialog
        open={kickTarget !== null}
        title="Kick player"
        message={kickTarget ? `Kick ${kickTarget.name} from the room? They won't be able to rejoin for 2 minutes.` : ''}
        confirmLabel="Kick"
        danger
        onConfirm={confirmKick}
        onCancel={() => setKickTarget(null)}
      />
    </div>
  )
}
