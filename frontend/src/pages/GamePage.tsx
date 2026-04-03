import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/useGameStore'
import { useWebSocket } from '../hooks/useWebSocket'
import PlayerList from '../components/lobby/PlayerList'
import StartButton from '../components/lobby/StartButton'
import GameBoard from '../components/game/GameBoard'
import GameOverScreen from '../components/game/GameOverScreen'

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const navigate = useNavigate()
  const { connect, send, disconnect } = useWebSocket()

  const playerName = useGameStore((s) => s.playerName)
  const isConnected = useGameStore((s) => s.isConnected)
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
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white">Room: {roomCode}</h2>
          <div className="mt-1 flex items-center justify-center gap-2 text-sm">
            <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
            <span className="text-gray-400">{isConnected ? 'Connected' : 'Connecting...'}</span>
          </div>
        </div>

        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <PlayerList />
          <StartButton send={send} />
        </div>
      </div>
    </div>
  )
}
