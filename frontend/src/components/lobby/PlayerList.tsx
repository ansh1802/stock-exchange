import { Crown, Check, Bot, Plus } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import type { BotDifficulty, ClientMessage } from '../../types/messages'

const DIFFICULTIES: BotDifficulty[] = ['easy', 'medium', 'hard']
const DIFFICULTY_STYLE: Record<BotDifficulty, string> = {
  easy: 'bg-sky-600/20 border-sky-500/60 text-sky-300',
  medium: 'bg-amber-600/20 border-amber-500/60 text-amber-300',
  hard: 'bg-red-600/20 border-red-500/60 text-red-300',
}

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
    : names.map((name) => ({ name, ready: false, is_host: false, connected: true, bot: null }))

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
              {p.bot ? (
                <Bot size={14} className="text-gray-400 flex-shrink-0" />
              ) : (
                <span className={cn('w-2 h-2 rounded-full', p.connected ? 'bg-emerald-400' : 'bg-red-400')} />
              )}
              <span className="truncate">{p.name}</span>
              {p.is_host && <Crown size={14} className="text-amber-400 flex-shrink-0" />}
              {isYou && <span className="text-xs text-gray-500">(you)</span>}

              <span className="ml-auto flex items-center gap-2">
                {p.bot ? (
                  isHost ? (
                    <span className="flex gap-1" role="radiogroup" aria-label={`${p.name} difficulty`}>
                      {DIFFICULTIES.map((d) => (
                        <button
                          key={d}
                          role="radio"
                          aria-checked={p.bot === d}
                          onClick={() => p.bot !== d && send({ type: 'set_bot_difficulty', player_name: p.name, difficulty: d })}
                          className={cn(
                            'px-2 min-h-[28px] text-[10px] uppercase tracking-widest rounded-md border transition-colors',
                            p.bot === d
                              ? DIFFICULTY_STYLE[d]
                              : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300',
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </span>
                  ) : (
                    <span className={cn('px-2 py-0.5 text-[10px] uppercase tracking-widest rounded-md border', DIFFICULTY_STYLE[p.bot])}>
                      {p.bot}
                    </span>
                  )
                ) : p.is_host ? (
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
                    className="px-2.5 min-h-[32px] text-xs font-medium rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    {p.bot ? 'Remove' : 'Kick'}
                  </button>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {isHost && players.length < 6 && (
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-[10px] text-gray-500 uppercase tracking-widest mr-1">Add bot</span>
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => send({ type: 'add_bot', difficulty: d })}
              className="flex items-center gap-1 px-2.5 min-h-[32px] text-xs rounded-md border border-gray-700 text-gray-300 hover:border-gray-500 hover:bg-gray-800 transition-colors capitalize"
            >
              <Plus size={12} /> {d}
            </button>
          ))}
        </div>
      )}
      {players.length < 2 && (
        <p className="text-sm text-gray-500 mt-2">Waiting for more players...</p>
      )}
    </div>
  )
}
