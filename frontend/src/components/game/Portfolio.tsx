import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR } from '../../lib/constants'
import { formatCash } from '../../lib/format'

export default function Portfolio() {
  const gameState = useGameStore((s) => s.gameState)
  if (!gameState) return null

  // Build a lookup: player_name -> list of badges
  const badges: Record<string, { company: string; role: string }[]> = {}
  const playerIdToName: Record<number, string> = {}
  gameState.players.forEach((p) => {
    playerIdToName[p.id] = p.name
  })

  for (const [company, chairId] of Object.entries(gameState.chairman)) {
    if (chairId !== null) {
      const name = playerIdToName[chairId]
      if (name) {
        if (!badges[name]) badges[name] = []
        badges[name].push({ company, role: 'C' })
      }
    }
  }
  for (const [company, dirIds] of Object.entries(gameState.directors)) {
    for (const dirId of dirIds) {
      const name = playerIdToName[dirId]
      if (name) {
        if (!badges[name]) badges[name] = []
        const p = gameState.players.find((pl) => pl.name === name)
        const holdings = p?.stocks[company] ?? 0
        badges[name].push({ company, role: holdings >= 100 ? 'DD' : 'D' })
      }
    }
  }

  return (
    <div className="p-3 space-y-2">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Players</h3>
      {gameState.players.map((player) => {
        const isCurrent = player.name === gameState.current_player_name
        const stockEntries = Object.entries(player.stocks)
        const playerBadges = badges[player.name] || []

        return (
          <div
            key={player.id}
            className={cn(
              'p-2.5 rounded-lg border transition-colors',
              player.is_you ? 'bg-emerald-900/10 border-emerald-800/30' : 'bg-gray-800/50 border-gray-800',
              isCurrent && 'ring-1 ring-emerald-500/50',
            )}
          >
            <div className="flex items-center justify-between">
              <span className={cn('text-sm font-medium', player.is_you ? 'text-emerald-400' : 'text-white')}>
                {player.name}
                {player.is_you && <span className="text-[10px] text-gray-500 ml-1">(you)</span>}
              </span>
              <span className="text-sm font-mono text-gray-300">{formatCash(player.cash)}</span>
            </div>
            {playerBadges.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {playerBadges.map((b, i) => (
                  <span
                    key={i}
                    className={cn(
                      'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold',
                      b.role === 'C' ? 'bg-amber-900/40 text-amber-400' : 'bg-sky-900/40 text-sky-400',
                    )}
                  >
                    <span className={cn('w-1 h-1 rounded-full', COMPANY_COLOR[b.company])} />
                    {b.role === 'C' ? 'Chair' : b.role === 'DD' ? '2xDir' : 'Dir'}
                  </span>
                ))}
              </div>
            )}
            {stockEntries.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {stockEntries.map(([name, count]) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-900 rounded text-[10px] text-gray-400"
                  >
                    <span className={cn('w-1 h-1 rounded-full', COMPANY_COLOR[name])} />
                    {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
