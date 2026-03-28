import { useGameStore } from '../../store/useGameStore'

export default function PlayerList() {
  const players = useGameStore((s) => s.lobbyPlayers)
  const playerName = useGameStore((s) => s.playerName)

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        Players ({players.length}/6)
      </h3>
      <ul className="space-y-1">
        {players.map((name) => (
          <li
            key={name}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg text-white"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            {name}
            {name === playerName && (
              <span className="ml-auto text-xs text-gray-500">(you)</span>
            )}
          </li>
        ))}
      </ul>
      {players.length < 2 && (
        <p className="text-sm text-gray-500 mt-2">Waiting for more players...</p>
      )}
    </div>
  )
}
