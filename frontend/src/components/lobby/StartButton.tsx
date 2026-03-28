import { useGameStore } from '../../store/useGameStore'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function StartButton({ send }: Props) {
  const isHost = useGameStore((s) => s.isHost)
  const players = useGameStore((s) => s.lobbyPlayers)

  if (!isHost) {
    return <p className="mt-4 text-sm text-gray-500 text-center">Waiting for host to start...</p>
  }

  return (
    <button
      onClick={() => send({ type: 'start_game' })}
      disabled={players.length < 2}
      className="mt-4 w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
    >
      Start Game ({players.length} players)
    </button>
  )
}
