import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/useGameStore'
import { useWebSocket } from '../hooks/useWebSocket'
import WaitingRoom from '../components/lobby/WaitingRoom'
import GameBoard from '../components/game/GameBoard'
import GameOverScreen from '../components/game/GameOverScreen'

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const { connect, send, disconnect } = useWebSocket()

  const playerName = useGameStore((s) => s.playerName)
  const gameState = useGameStore((s) => s.gameState)
  const gameOver = useGameStore((s) => s.gameOver)
  const storeRoomCode = useGameStore((s) => s.roomCode)

  // Redirect if no player name set
  useEffect(() => {
    if (!playerName || !storeRoomCode) {
      navigate('/')
    }
  }, [playerName, storeRoomCode, navigate])

  // Connect WebSocket
  useEffect(() => {
    if (playerName && roomCode) {
      connect()
    }
    return () => disconnect()
  }, [playerName, roomCode, connect, disconnect])

  if (!playerName) return null

  // Game over screen
  if (gameOver) {
    return <GameOverScreen rankings={gameOver} />
  }

  // Game in progress
  if (gameState) {
    return <GameBoard send={send} />
  }

  // Lobby / waiting room
  return <WaitingRoom roomCode={roomCode ?? ''} send={send} disconnect={disconnect} />
}
