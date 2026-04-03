import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/useGameStore'

export default function LobbyPage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const navigate = useNavigate()
  const setConnection = useGameStore((s) => s.setConnection)

  const join = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    const roomCode = code.trim().toUpperCase()
    setConnection(roomCode, name.trim())
    navigate(`/game/${roomCode}`)
  }

  const createRoom = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let generated = ''
    for (let i = 0; i < 4; i++) generated += chars[Math.floor(Math.random() * chars.length)]
    setCode(generated)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">Stock Exchange</h1>
          <p className="mt-2 text-gray-400">Multiplayer trading game</p>
        </div>

        <form onSubmit={join} className="space-y-4 bg-gray-900 p-6 rounded-xl border border-gray-800">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Your Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Room Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD"
                maxLength={4}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono tracking-widest text-center uppercase placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={createRoom}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                Generate
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !code.trim()}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
          >
            Join Room
          </button>
        </form>
      </div>
    </div>
  )
}
