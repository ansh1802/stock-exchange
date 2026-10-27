import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'
import type { ClientMessage } from '../types/messages'

/**
 * `/game/:code?autostart=bots3` (the tutorial's "Play your first game vs bots"):
 * once the lobby says you're the host of an otherwise empty room, add 3 Easy
 * bots and start. Bots are always ready, so the Ready gate doesn't block.
 * Fires at most once per mount: the ref survives StrictMode's double effects,
 * and a reconnect (or a reload into a running game) never matches again.
 */
export function useBotAutostart(enabled: boolean, send: (msg: ClientMessage) => void, onFired?: () => void) {
  const fired = useRef(false)
  const isConnected = useGameStore((s) => s.isConnected)
  const isHost = useGameStore((s) => s.isHost)
  const lobbySize = useGameStore((s) => s.lobbyPlayers.length)
  const inGame = useGameStore((s) => s.gameState !== null)

  useEffect(() => {
    if (!enabled || fired.current || !isConnected || !isHost || lobbySize !== 1 || inGame) return
    fired.current = true
    for (let i = 0; i < 3; i++) send({ type: 'add_bot', difficulty: 'easy' })
    send({ type: 'start_game' })
    onFired?.() // e.g. strip ?autostart so a reload can't re-create a bot game
  }, [enabled, isConnected, isHost, lobbySize, inGame, send, onFired])
}
