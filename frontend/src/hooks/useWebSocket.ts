import { useRef, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useGameStore } from '../store/useGameStore'
import type { ServerMessage, ClientMessage } from '../types/messages'

const WS_BASE = import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

// Error codes sent on the initial connection when the server refuses to add
// this player to the room at all (as opposed to an in-game action failing).
// These are terminal — retrying immediately can't succeed, so treat them
// like a kick/close instead of letting onclose schedule another attempt.
const TERMINAL_JOIN_ERROR_CODES = new Set(['kicked_cooldown', 'name_taken', 'started', 'full'])

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number>(0)
  const backoff = useRef(1000)
  const pendingRef = useRef<ClientMessage[]>([])
  // Set right before a close we caused ourselves (explicit disconnect, or a
  // server-driven kick/room-close) so onclose doesn't re-arm a reconnect.
  const suppressReconnectRef = useRef(false)

  const {
    roomCode,
    playerName,
    setConnected,
    setReconnecting,
    setLobbyState,
    setGameStarted,
    setGameState,
    setGameOver,
    setChatMessages,
    appendChatMessage,
    setJoinError,
  } = useGameStore()

  // Shared by the 'kicked'/'room_closed' messages and by a terminal join
  // error: stop reconnecting, show the reason once on the landing page
  // (not a toast — a kicked_cooldown rejection would otherwise re-fire and
  // re-toast on every auto-reconnect attempt), and bounce back to '/'.
  const bailOut = useCallback((ws: WebSocket, message: string) => {
    suppressReconnectRef.current = true
    // reset() first — it would otherwise wipe out the joinError set right
    // after it, since reset() restores the store's initialState wholesale.
    useGameStore.getState().reset()
    setJoinError(message)
    ws.close()
    wsRef.current = null
  }, [setJoinError])

  const connect = useCallback(() => {
    if (!roomCode || !playerName) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const url = `${WS_BASE}/ws/${roomCode}/${playerName}`
    const ws = new WebSocket(url)

    // React StrictMode double-invokes mount effects in dev, which fires
    // connect() then disconnect() then connect() again — the first socket
    // is abandoned but its close event still arrives later, asynchronously.
    // Every handler below checks it's still the socket wsRef points at
    // before touching shared state, so a stale/superseded socket's events
    // can't null out or otherwise clobber the real, live connection.
    const isCurrent = () => wsRef.current === ws

    ws.onopen = () => {
      if (!isCurrent()) return
      const wasReconnecting = useGameStore.getState().isReconnecting
      setConnected(true)
      setReconnecting(false)
      backoff.current = 1000

      // Flush any queued messages
      const pending = pendingRef.current
      pendingRef.current = []
      for (const msg of pending) {
        ws.send(JSON.stringify(msg))
      }

      if (wasReconnecting && useGameStore.getState().gameStarted) {
        toast.success('Reconnected to game')
      }
    }

    ws.onmessage = (event) => {
      if (!isCurrent()) return
      const msg: ServerMessage = JSON.parse(event.data)

      switch (msg.type) {
        case 'ping':
          // Respond to server heartbeat
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'pong' }))
          }
          break
        case 'lobby_state':
          setLobbyState(msg)
          break
        case 'kicked':
        case 'room_closed':
          bailOut(ws, msg.message)
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
          if (msg.error_code && TERMINAL_JOIN_ERROR_CODES.has(msg.error_code)) {
            // Rejected before ever joining the room (kicked cooldown, name
            // taken, room full/started) — show it once on the landing page
            // instead of a toast, and don't let onclose retry the join.
            bailOut(ws, msg.message)
          } else {
            toast.error(msg.message)
          }
          break
        case 'chat_history':
          setChatMessages(msg.messages)
          break
        case 'chat_message':
          appendChatMessage({ name: msg.name, text: msg.text, ts: msg.ts })
          break
      }
    }

    ws.onclose = () => {
      if (!isCurrent()) return
      setConnected(false)
      wsRef.current = null
      if (suppressReconnectRef.current) {
        suppressReconnectRef.current = false
        return
      }
      setReconnecting(true)
      // Auto-reconnect with exponential backoff
      reconnectTimer.current = window.setTimeout(() => {
        backoff.current = Math.min(backoff.current * 2, 30000)
        connect()
      }, backoff.current)
    }

    wsRef.current = ws
  }, [roomCode, playerName, setConnected, setReconnecting, setLobbyState, setGameStarted, setGameState, setGameOver, setChatMessages, appendChatMessage, bailOut])

  const send = useCallback((msg: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    } else {
      // Queue player actions for retry on reconnect (skip animation signals)
      const animSignals = ['reveal_complete', 'pong']
      if (!animSignals.includes(msg.type)) {
        pendingRef.current.push(msg)
        toast.warning('Action queued — will send when reconnected')
      }
    }
  }, [])

  const disconnect = useCallback(() => {
    suppressReconnectRef.current = true
    clearTimeout(reconnectTimer.current)
    wsRef.current?.close()
    wsRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      suppressReconnectRef.current = true
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [])

  return { connect, send, disconnect }
}
