// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '../../store/useGameStore'
import type { GameState } from '../../types/game'
import { enterTutorialStore, loadSnapshot, restoreStore } from './storeSwap'

const KEY = 'stock-exchange-session'

const snap = (day: number) => ({
  day,
  phase: 'player_turn',
  players: [
    { id: 1, name: 'You', is_you: true },
    { id: 2, name: 'Meera', is_you: false },
  ],
}) as unknown as GameState

const liveGame = { day: 7, phase: 'player_turn', players: [] } as unknown as GameState

function dataOf(s: ReturnType<typeof useGameStore.getState>) {
  return Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== 'function'))
}

describe('storeSwap', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useGameStore.getState().reset()
    useGameStore.getState().setConnection('ABCD', 'Ann')
    useGameStore.setState({
      isHost: true, isConnected: false, isReconnecting: true, gameState: liveGame,
      gameStarted: true, chatMessages: [{ name: 'Bo', text: 'hi', ts: 1 } as never], chatUnread: 2,
    })
  })

  it('enter → load → restore returns the exact prior state', () => {
    const before = dataOf(useGameStore.getState())
    const saved = enterTutorialStore()
    loadSnapshot(snap(1))
    loadSnapshot(snap(2))
    restoreStore(saved)
    const after = useGameStore.getState()
    expect(dataOf(after)).toEqual(before)
    expect(after.roomCode).toBe('ABCD')
    expect(after.playerName).toBe('Ann')
  })

  it('loadSnapshot shows the snapshot as the "you" seat and never touches roomCode', () => {
    const saved = enterTutorialStore()
    loadSnapshot(snap(3))
    const s = useGameStore.getState()
    expect(s.roomCode).toBe('ABCD')
    expect(s.playerName).toBe('You')
    expect(s.gameState?.day).toBe(3)
    expect(s.isConnected).toBe(true)
    expect(s.isReconnecting).toBe(false)
    expect(s.gameStarted).toBe(true)
    expect(s.gameOver).toBeNull()
    expect(s.chatMessages).toEqual([])
    restoreStore(saved)
  })

  it('sessionStorage identity is unchanged across enter / load / restore', () => {
    const persisted = sessionStorage.getItem(KEY)
    expect(persisted).toContain('"playerName":"Ann"')
    const saved = enterTutorialStore()
    expect(sessionStorage.getItem(KEY)).toBe(persisted)
    loadSnapshot(snap(1))
    expect(sessionStorage.getItem(KEY)).toBe(persisted)
    restoreStore(saved)
    expect(sessionStorage.getItem(KEY)).toBe(persisted)
    // persistence works again after restore
    useGameStore.getState().setConnection('WXYZ', 'Ann')
    expect(sessionStorage.getItem(KEY)).toContain('"roomCode":"WXYZ"')
  })
})
