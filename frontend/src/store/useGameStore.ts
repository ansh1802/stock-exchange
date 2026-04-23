import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { GameState, Ranking } from '../types/game'
import type { ChatMessage } from '../types/messages'

interface GameStore {
  // Connection
  roomCode: string | null
  playerName: string | null
  isHost: boolean
  isConnected: boolean
  isReconnecting: boolean
  lobbyPlayers: string[]

  // Game
  gameState: GameState | null
  gameStarted: boolean
  gameOver: Ranking[] | null

  // Chat
  chatMessages: ChatMessage[]
  chatUnread: number

  // Actions
  setConnection: (roomCode: string, playerName: string) => void
  setLobby: (players: string[], isHost: boolean) => void
  setConnected: (connected: boolean) => void
  setReconnecting: (reconnecting: boolean) => void
  updateLobbyPlayers: (players: string[]) => void
  setGameStarted: () => void
  setGameState: (state: GameState) => void
  setGameOver: (rankings: Ranking[]) => void
  setChatMessages: (messages: ChatMessage[]) => void
  appendChatMessage: (message: ChatMessage) => void
  clearChatUnread: () => void
  reset: () => void
}

const initialState = {
  roomCode: null,
  playerName: null,
  isHost: false,
  isConnected: false,
  isReconnecting: false,
  lobbyPlayers: [],
  gameState: null,
  gameStarted: false,
  gameOver: null,
  chatMessages: [] as ChatMessage[],
  chatUnread: 0,
}

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      ...initialState,

      setConnection: (roomCode, playerName) =>
        set({ roomCode, playerName }),

      setLobby: (players, isHost) =>
        set({ lobbyPlayers: players, isHost }),

      setConnected: (connected) =>
        set({ isConnected: connected }),

      setReconnecting: (reconnecting) =>
        set({ isReconnecting: reconnecting }),

      updateLobbyPlayers: (players) =>
        set({ lobbyPlayers: players }),

      setGameStarted: () =>
        set({ gameStarted: true }),

      setGameState: (state) =>
        set({ gameState: state }),

      setGameOver: (rankings) =>
        set({ gameOver: rankings }),

      setChatMessages: (messages) =>
        set({ chatMessages: messages, chatUnread: 0 }),

      appendChatMessage: (message) =>
        set((s) => ({
          chatMessages: [...s.chatMessages, message],
          chatUnread: s.chatUnread + 1,
        })),

      clearChatUnread: () => set({ chatUnread: 0 }),

      reset: () => set(initialState),
    }),
    {
      name: 'stock-exchange-session',
      // sessionStorage is per-tab, so two tabs don't overwrite each other's
      // identity. Reload within a tab still restores the session.
      storage: createJSONStorage(() => sessionStorage),
      partialize: (s) => ({
        roomCode: s.roomCode,
        playerName: s.playerName,
        isHost: s.isHost,
      }),
    },
  ),
)
