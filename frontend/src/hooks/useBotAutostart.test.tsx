// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useBotAutostart } from './useBotAutostart'
import { useGameStore } from '../store/useGameStore'
import type { ClientMessage } from '../types/messages'
import type { GameState } from '../types/game'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Probe({ enabled, send }: { enabled: boolean; send: (m: ClientMessage) => void }) {
  useBotAutostart(enabled, send)
  return null
}

let host: HTMLDivElement
let root: Root
let send: ReturnType<typeof vi.fn<(m: ClientMessage) => void>>

const mount = (enabled = true) => act(() => {
  root.render(<StrictMode><Probe enabled={enabled} send={send} /></StrictMode>)
})
const setStore = (s: Partial<ReturnType<typeof useGameStore.getState>>) => act(() => { useGameStore.setState(s) })
const lobby = (players: string[], isHost: boolean) => setStore({ isConnected: true, lobbyPlayers: players, isHost })

const EXPECTED: ClientMessage[] = [
  { type: 'add_bot', difficulty: 'easy' },
  { type: 'add_bot', difficulty: 'easy' },
  { type: 'add_bot', difficulty: 'easy' },
  { type: 'start_game' },
]

beforeEach(() => {
  useGameStore.getState().reset()
  send = vi.fn<(m: ClientMessage) => void>()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

describe('useBotAutostart', () => {
  it('waits for the lobby, then adds 3 Easy bots and starts — once (StrictMode)', () => {
    mount()
    expect(send).not.toHaveBeenCalled() // not connected yet
    lobby(['You'], true)
    expect(send.mock.calls.map((c) => c[0])).toEqual(EXPECTED)
  })

  it('never fires again: reconnect re-sends the lobby', () => {
    mount()
    lobby(['You'], true)
    setStore({ isConnected: false })
    lobby(['You'], true)
    expect(send).toHaveBeenCalledTimes(4)
  })

  it('does nothing when not the host', () => {
    mount()
    lobby(['Ann', 'You'], false)
    expect(send).not.toHaveBeenCalled()
  })

  it('does nothing when others are already in the room', () => {
    mount()
    lobby(['You', 'Ann'], true)
    expect(send).not.toHaveBeenCalled()
  })

  it('does nothing once a game is running (reload into a started game)', () => {
    setStore({ gameState: {} as GameState })
    mount()
    lobby(['You'], true)
    expect(send).not.toHaveBeenCalled()
  })

  it('does nothing without ?autostart', () => {
    mount(false)
    lobby(['You'], true)
    expect(send).not.toHaveBeenCalled()
  })
})
