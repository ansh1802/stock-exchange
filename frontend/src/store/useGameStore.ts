import { create } from 'zustand'
import type { GameState, Ranking } from '../types/game'

interface GameStore {
  // Connection
  roomCode: string | null
  playerName: string | null
  isHost: boolean
  isConnected: boolean
  lobbyPlayers: string[]

  // Game
  gameState: GameState | null
  gameStarted: boolean
  gameOver: Ranking[] | null

  // Actions
  setConnection: (roomCode: string, playerName: string) => void
  setLobby: (players: string[], isHost: boolean) => void
  setConnected: (connected: boolean) => void
  updateLobbyPlayers: (players: string[]) => void
  setGameStarted: () => void
  setGameState: (state: GameState) => void
  setGameOver: (rankings: Ranking[]) => void
  reset: () => void
}

const initialState = {
  roomCode: null,
  playerName: null,
  isHost: false,
  isConnected: false,
  lobbyPlayers: [],
  gameState: null,
  gameStarted: false,
  gameOver: null,
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setConnection: (roomCode, playerName) =>
    set({ roomCode, playerName }),

  setLobby: (players, isHost) =>
    set({ lobbyPlayers: players, isHost }),

  setConnected: (connected) =>
    set({ isConnected: connected }),

  updateLobbyPlayers: (players) =>
    set({ lobbyPlayers: players }),

  setGameStarted: () =>
    set({ gameStarted: true }),

  setGameState: (state) =>
    set({ gameState: state }),

  setGameOver: (rankings) =>
    set({ gameOver: rankings }),

  reset: () => set(initialState),
}))
