import { useGameStore } from '../store/useGameStore'

export function useMyPlayer() {
  const gameState = useGameStore((s) => s.gameState)
  if (!gameState) return null
  return gameState.players.find((p) => p.is_you) ?? null
}
