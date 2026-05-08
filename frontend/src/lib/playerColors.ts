// Distinct from company palette so players never blur into the lines on the
// stock ticker. Six slots, indexed by the player's seat order (player.id - 1).
const PLAYER_PALETTE = [
  '#e6c474', // gold (you / seat 1)
  '#7aa9d9', // sky
  '#d97a7a', // coral
  '#9c8ad9', // violet
  '#7ad99c', // mint
  '#d99c7a', // peach
]

export function playerColor(playerId: number): string {
  const idx = (playerId - 1) % PLAYER_PALETTE.length
  return PLAYER_PALETTE[idx < 0 ? 0 : idx]
}
