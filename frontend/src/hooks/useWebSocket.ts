import { useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useGameStore } from '../store/useGameStore'
import type { ServerMessage, ClientMessage } from '../types/messages'

const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.host}`

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number>(0)
  const backoff = useRef(1000)

  const {
    roomCode,
    playerName,
    setConnected,
    setLobby,
    updateLobbyPlayers,
    setGameStarted,
    setGameState,
    setGameOver,
  } = useGameStore()

  const connect = useCallback(() => {
    if (!roomCode || !playerName) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const url = `${WS_BASE}/ws/${roomCode}/${playerName}`
    const ws = new WebSocket(url)

    ws.onopen = () => {
      setConnected(true)
      backoff.current = 1000
    }

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data)

      switch (msg.type) {
        case 'lobby':
          setLobby(msg.players, msg.is_host)
          break
        case 'player_joined':
          updateLobbyPlayers(msg.players)
          break
        case 'player_left':
          updateLobbyPlayers(msg.players)
          break
        case 'game_started':
          setGameStarted()
          break
        case 'game_state':
          setGameState(msg.state)
          break
        case 'action_result':
          if (msg.success) {
            toast.success(msg.message)
          } else {
            toast.error(msg.message)
          }
          break
        case 'phase_change':
          // Logged via game_log in state; no separate handling needed
          break
        case 'game_over':
          setGameOver(msg.rankings)
          break
        case 'error':
          toast.error(msg.message)
          break
      }
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      // Auto-reconnect with exponential backoff
      reconnectTimer.current = window.setTimeout(() => {
        backoff.current = Math.min(backoff.current * 2, 30000)
        connect()
      }, backoff.current)
    }

    wsRef.current = ws
  }, [roomCode, playerName, setConnected, setLobby, updateLobbyPlayers, setGameStarted, setGameState, setGameOver])

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current)
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [])

  return { connect, send, disconnect }
}
