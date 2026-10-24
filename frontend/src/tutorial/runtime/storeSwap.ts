import { useGameStore } from '../../store/useGameStore'
import type { GameState } from '../../types/game'

type Store = ReturnType<typeof useGameStore.getState>
type Storage = NonNullable<ReturnType<typeof useGameStore.persist.getOptions>['storage']>

export interface SavedStore {
  state: Store
  storage: Storage | undefined
}

/** Swallows writes while the tutorial owns the store, so the tab's persisted
 *  live identity (roomCode / playerName / isHost) is never overwritten. */
const NOOP_STORAGE: Storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
}

/** The real storage, remembered across nested enters (StrictMode). */
let realStorage: Storage | undefined

/** Capture the full store and pause persistence. Call once on tutorial mount. */
export function enterTutorialStore(): SavedStore {
  const current = useGameStore.persist.getOptions().storage
  if (current !== NOOP_STORAGE) realStorage = current
  const saved = { state: { ...useGameStore.getState() }, storage: realStorage }
  useGameStore.persist.setOptions({ storage: NOOP_STORAGE })
  return saved
}

/** Show one tutorial snapshot through the live store. Never touches roomCode. */
export function loadSnapshot(state: GameState): void {
  const you = state.players.find((p) => p.is_you)
  useGameStore.setState({
    gameState: state,
    playerName: you?.name ?? null,
    isConnected: true,
    isReconnecting: false,
    gameStarted: true,
    gameOver: null,
    chatMessages: [],
    chatUnread: 0,
  })
}

/** Put back exactly what `enterTutorialStore` captured, then resume persistence. */
export function restoreStore(saved: SavedStore): void {
  useGameStore.setState(saved.state, true)
  if (saved.storage) useGameStore.persist.setOptions({ storage: saved.storage })
}
