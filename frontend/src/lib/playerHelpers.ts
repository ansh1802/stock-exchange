import type { Company, GameState, Player } from '../types/game'

export type Position = 'chairman' | 'director' | 'double_director' | null

/**
 * Total net worth: cash + (held shares × current value) for every open company.
 * Closed companies contribute zero — matches desktop PlayerBoard behaviour.
 */
export function portfolioValue(player: Player, companies: Company[]): number {
  let total = player.cash
  for (const co of companies) {
    const held = player.stocks[co.name] ?? 0
    if (held > 0 && co.is_open) {
      total += held * co.value
    }
  }
  return total
}

/**
 * Resolve a player's position for a given company:
 *   - 'chairman' if they hold the chairman slot
 *   - 'double_director' if they're in directors AND hold ≥100 shares
 *   - 'director' if they're in directors with <100 shares
 *   - null otherwise
 */
export function getPosition(
  gameState: Pick<GameState, 'chairman' | 'directors' | 'players'>,
  playerId: number,
  companyName: string,
): Position {
  if (gameState.chairman[companyName] === playerId) return 'chairman'
  if (gameState.directors[companyName]?.includes(playerId)) {
    const p = gameState.players.find((pl) => pl.id === playerId)
    if (p && (p.stocks[companyName] ?? 0) >= 100) return 'double_director'
    return 'director'
  }
  return null
}
