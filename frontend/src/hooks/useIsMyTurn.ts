import { useGameStore } from '../store/useGameStore'

export function useIsMyTurn() {
  const gameState = useGameStore((s) => s.gameState)
  if (!gameState) return false
  const { phase, current_player_name, playerName } = {
    ...gameState,
    playerName: useGameStore.getState().playerName,
  }
  if (phase === 'player_turn') {
    return current_player_name === playerName
  }
  // For sub-phases, the server tells us via queue[0] but we match by name
  // The current_player_name reflects whose turn it is in queued phases too
  return current_player_name === playerName
}
