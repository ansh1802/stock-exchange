import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useGameStore } from '../store/useGameStore'
import { useTheme } from '../hooks/useTheme'
import { tutorialStorage } from '../lib/tutorialStorage'

interface PublicRoom {
  code: string
  host_name: string
  player_count: number
  max_players: number
  status: 'waiting' | 'in_progress'
}

export default function LobbyPage() {
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [isPublicRoom, setIsPublicRoom] = useState(false)
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([])
  const [creatingRoom, setCreatingRoom] = useState(false)
  const navigate = useNavigate()
  const setConnection = useGameStore((s) => s.setConnection)
  const joinError = useGameStore((s) => s.joinError)
  const setJoinError = useGameStore((s) => s.setJoinError)
  const theme = useTheme()
  const tutorialCompleted = tutorialStorage.isCompleted()

  // Private rooms (the default) never show up here — this only lists rooms
  // whose host opted into "Public" when creating them.
  const fetchPublicRooms = useCallback(() => {
    fetch('/api/rooms')
      .then((res) => (res.ok ? res.json() : { rooms: [] }))
      .then((data) => setPublicRooms(data.rooms ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchPublicRooms()
    const interval = setInterval(fetchPublicRooms, 4000)
    return () => clearInterval(interval)
  }, [fetchPublicRooms])

  const join = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return
    setJoinError(null)
    const roomCode = code.trim().toUpperCase()
    setConnection(roomCode, name.trim())
    navigate(`/game/${roomCode}`)
  }

  const joinRoomCode = (roomCode: string) => {
    if (!name.trim()) return
    setJoinError(null)
    setConnection(roomCode, name.trim())
    navigate(`/game/${roomCode}`)
  }

  const createRoom = async () => {
    if (creatingRoom) return
    setCreatingRoom(true)
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: isPublicRoom }),
      })
      if (!res.ok) throw new Error('request failed')
      const data = await res.json()
      if (data.code) setCode(data.code)
    } catch {
      toast.error("Couldn't reach the server — try again in a moment.")
    } finally {
      setCreatingRoom(false)
    }
  }

  const joinErrorBanner = joinError && (
    <div className="w-full max-w-md mb-4 px-4 py-3 bg-red-950/60 border border-red-800/60 rounded-lg text-sm text-red-300">
      {joinError}
    </div>
  )

  const publicRoomsSection = (
    <div className="w-full max-w-md mt-6 space-y-1.5">
      <h3 className="text-xs text-gray-500 uppercase tracking-widest">Public Rooms</h3>
      {publicRooms.length === 0 && (
        <p className="text-sm text-gray-600">No public rooms open right now.</p>
      )}
      {publicRooms.map((room) => (
        <button
          key={room.code}
          type="button"
          disabled={!name.trim() || room.status === 'in_progress'}
          onClick={() => joinRoomCode(room.code)}
          className="w-full flex items-center gap-3 px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-left disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-700 transition-colors"
        >
          <span className="font-mono tracking-widest text-emerald-400">{room.code}</span>
          <span className="text-sm text-gray-400 truncate">{room.host_name}'s room</span>
          <span className="ml-auto text-xs text-gray-500 font-mono">{room.player_count}/{room.max_players}</span>
          <span className={`text-xs ${room.status === 'in_progress' ? 'text-amber-400' : 'text-gray-500'}`}>
            {room.status === 'in_progress' ? 'In progress' : 'Waiting'}
          </span>
        </button>
      ))}
    </div>
  )

  if (theme === 'v2') {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen p-4"
        style={{ background: 'var(--color-felt)' }}
      >
        <div className="w-full max-w-md">
          {/* Wordmark */}
          <div className="text-center mb-8">
            <div
              className="font-mono uppercase mb-3"
              style={{
                color: 'var(--color-gold-deep)',
                fontSize: 11,
                letterSpacing: '0.3em',
              }}
            >
              · The Floor ·
            </div>
            <div className="relative inline-block">
              <span
                style={{
                  fontFamily: 'DM Serif Display, serif',
                  fontSize: 14,
                  letterSpacing: '0.5em',
                  color: 'var(--color-paper)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                STOCK
              </span>
              <span
                style={{
                  fontFamily: 'DM Serif Display, serif',
                  fontStyle: 'italic',
                  fontSize: 64,
                  lineHeight: 1,
                  color: 'var(--color-gold)',
                  display: 'block',
                }}
              >
                Exchange
              </span>
              <div
                style={{
                  marginTop: 8,
                  height: 1,
                  background: 'linear-gradient(to right, transparent, var(--color-gold) 30%, var(--color-gold) 70%, transparent)',
                }}
              />
            </div>
            <p
              className="mt-4 font-mono"
              style={{
                color: 'rgba(244,236,219,0.6)',
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              Bombay · 1992 · 2–6 players
            </p>
          </div>

          {/* Tutorial CTA — gold prominence for first-timers, ghost link after */}
          {!tutorialCompleted ? (
            <Link
              to="/tutorial"
              className="block px-5 py-4 mb-4 text-center"
              style={{
                background: 'rgba(201,161,74,0.12)',
                border: '1px solid var(--color-gold)',
                borderRadius: 4,
                color: 'var(--color-paper)',
                textDecoration: 'none',
                boxShadow: '0 4px 16px rgba(201,161,74,0.18)',
              }}
            >
              <div
                style={{
                  fontFamily: 'DM Serif Display, serif',
                  fontSize: 22,
                  color: 'var(--color-gold-soft)',
                  lineHeight: 1.1,
                }}
              >
                Learn to Play
              </div>
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  color: 'rgba(244,236,219,0.65)',
                  marginTop: 4,
                }}
              >
                First time? Read the rulebook → 6 min
              </div>
            </Link>
          ) : (
            <div className="text-center mb-3">
              <Link
                to="/rulebook"
                className="font-mono"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'rgba(244,236,219,0.55)',
                  textDecoration: 'none',
                }}
              >
                ⓘ Open rulebook
              </Link>
            </div>
          )}

          {joinErrorBanner}

          <form
            onSubmit={join}
            className="space-y-4 p-6"
            style={{
              background: 'var(--color-paper)',
              color: 'var(--color-ink)',
              borderRadius: 4,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px var(--color-gold-deep)',
            }}
          >
            <div>
              <label
                className="block font-mono uppercase mb-1.5"
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  color: 'var(--color-ink-muted)',
                }}
              >
                Your Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                className="w-full px-3 py-2 focus:outline-none"
                style={{
                  background: 'var(--color-paper-2)',
                  border: '1px solid var(--color-paper-line)',
                  borderRadius: 3,
                  color: 'var(--color-ink)',
                  fontFamily: 'Inter Variable, system-ui',
                }}
              />
            </div>

            <div>
              <label
                className="block font-mono uppercase mb-1.5"
                style={{ fontSize: 10, letterSpacing: '0.18em', color: 'var(--color-ink-muted)' }}
              >
                Room Code
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABCD"
                  maxLength={4}
                  className="flex-1 min-w-0 px-3 py-2 font-mono tracking-[0.3em] text-center uppercase focus:outline-none"
                  style={{
                    background: 'var(--color-paper-2)',
                    border: '1px solid var(--color-paper-line)',
                    borderRadius: 3,
                    color: 'var(--color-ink)',
                    fontWeight: 700,
                  }}
                />
                <button
                  type="button"
                  onClick={createRoom}
                  disabled={creatingRoom}
                  className="px-3 py-2 font-mono uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
                  style={{
                    background: 'var(--color-paper-2)',
                    border: '1px solid var(--color-paper-line)',
                    borderRadius: 3,
                    color: 'var(--color-ink-2)',
                    fontSize: 11,
                    letterSpacing: '0.12em',
                  }}
                >
                  {creatingRoom ? 'Creating…' : 'Create Room'}
                </button>
              </div>
              <label
                className="flex items-center gap-1.5 mt-1.5 font-mono"
                style={{ fontSize: 10, letterSpacing: '0.1em', color: 'var(--color-ink-muted)' }}
              >
                <input
                  type="checkbox"
                  checked={isPublicRoom}
                  onChange={(e) => setIsPublicRoom(e.target.checked)}
                />
                Make new room discoverable in Public Rooms below
              </label>
            </div>

            <button
              type="submit"
              disabled={!name.trim() || !code.trim()}
              className="w-full py-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'var(--color-ink)',
                color: 'var(--color-gold-soft)',
                border: '1px solid var(--color-gold)',
                borderRadius: 3,
                fontFamily: 'DM Serif Display, serif',
                fontSize: 18,
                letterSpacing: '0.04em',
              }}
            >
              Take a seat
            </button>
          </form>

          <p
            className="mt-6 text-center font-mono"
            style={{ color: 'rgba(244,236,219,0.4)', fontSize: 10, letterSpacing: '0.15em' }}
          >
            10 DAYS · 3 ROUNDS · ONE BELL
          </p>

          {publicRoomsSection}
        </div>
      </div>
    )
  }

  // v1
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">Stock Exchange</h1>
          <p className="mt-2 text-gray-400">Multiplayer trading game</p>
        </div>

        {joinErrorBanner}

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
                className="flex-1 min-w-0 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono tracking-widest text-center uppercase placeholder-gray-500 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={createRoom}
                disabled={creatingRoom}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex-shrink-0"
              >
                {creatingRoom ? 'Creating…' : 'Create Room'}
              </button>
            </div>
            <label className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={isPublicRoom}
                onChange={(e) => setIsPublicRoom(e.target.checked)}
              />
              Make new room discoverable in Public Rooms below
            </label>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !code.trim()}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium rounded-lg transition-colors"
          >
            Join Room
          </button>
        </form>

        {publicRoomsSection}
      </div>
    </div>
  )
}
