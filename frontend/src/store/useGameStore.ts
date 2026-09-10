import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { GameState, Ranking, LobbyPlayer, AutoreadyState } from '../types/game'
import type { ChatMessage } from '../types/messages'

interface GameStore {
  // Connection
  roomCode: string | null
  playerName: string | null
  // The last name typed/used to join anything, independent of the current
  // room session — survives reset() (unlike playerName/roomCode above) so
  // the landing page can prefill it after a kick, leave, or room close
  // instead of making the player retype their name every time.
  lastPlayerName: string | null
  isHost: boolean
  isConnected: boolean
  isReconnecting: boolean
  lobbyPlayers: LobbyPlayer[]
  isPublic: boolean
  autoready: AutoreadyState | null
  // A terminal join rejection (kicked cooldown, name taken, room full or
  // already started) or a kick/close-room notice — shown once on the
  // landing page, not as a toast. Cleared on the next join/create attempt.
  joinError: string | null

  // Game
  gameState: GameState | null
  gameStarted: boolean
  gameOver: Ranking[] | null

  // Chat
  chatMessages: ChatMessage[]
  chatUnread: number

  // Actions
  setConnection: (roomCode: string, playerName: string) => void
  setLobbyState: (state: { room_code: string; is_public: boolean; players: LobbyPlayer[]; autoready: AutoreadyState | null }) => void
  setConnected: (connected: boolean) => void
  setReconnecting: (reconnecting: boolean) => void
  setGameStarted: () => void
  setGameState: (state: GameState) => void
  setGameOver: (rankings: Ranking[]) => void
  setChatMessages: (messages: ChatMessage[]) => void
  appendChatMessage: (message: ChatMessage) => void
  clearChatUnread: () => void
  setJoinError: (message: string | null) => void
  reset: () => void
}

const initialState = {
  roomCode: null,
  playerName: null,
  isHost: false,
  isConnected: false,
  isReconnecting: false,
  lobbyPlayers: [] as LobbyPlayer[],
  isPublic: false,
  autoready: null as AutoreadyState | null,
  joinError: null as string | null,
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
      lastPlayerName: null as string | null,

      // lastPlayerName is intentionally not part of initialState/reset() —
      // it's meant to outlive the room session that just ended.
      setConnection: (roomCode, playerName) =>
        set({ roomCode, playerName, lastPlayerName: playerName }),

      setLobbyState: ({ room_code, is_public, players, autoready }) =>
        set({
          roomCode: room_code,
          isPublic: is_public,
          lobbyPlayers: players,
          isHost: players.find((p) => p.is_you)?.is_host ?? false,
          autoready,
        }),

      setConnected: (connected) =>
        set({ isConnected: connected }),

      setReconnecting: (reconnecting) =>
        set({ isReconnecting: reconnecting }),

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

      setJoinError: (message) => set({ joinError: message }),

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
        lastPlayerName: s.lastPlayerName,
      }),
    },
  ),
)
