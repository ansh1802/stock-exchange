import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import type { PublicRoom } from '../../types/messages'

// Same origin as the WebSocket: VITE_WS_URL (wss://host) → https://host.
// Falls back to the page origin (local dev via Vite proxy, Cloud Run URL).
const HTTP_BASE = (import.meta.env.VITE_WS_URL || '').replace(/^ws/, 'http')

const POLL_MS = 5000

interface Props {
  onPick: (code: string) => void
  variant: 'v1' | 'v2'
}

export default function PublicRooms({ onPick, variant }: Props) {
  const [rooms, setRooms] = useState<PublicRoom[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch(`${HTTP_BASE}/api/rooms`)
        if (!res.ok) return
        const data: { rooms: PublicRoom[] } = await res.json()
        if (!cancelled) setRooms(data.rooms)
      } catch {
        // Backend unreachable — keep showing the last list.
      }
    }
    load()
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  if (rooms.length === 0) return null

  const v2 = variant === 'v2'

  return (
    <div className="mt-4 space-y-2">
      <p
        className={v2 ? 'font-mono uppercase text-center' : 'text-xs text-gray-500 uppercase tracking-widest text-center'}
        style={v2 ? { fontSize: 10, letterSpacing: '0.18em', color: 'rgba(244,236,219,0.6)' } : undefined}
      >
        Open rooms
      </p>
      <ul className="space-y-1.5">
        {rooms.map((r) => {
          const full = r.players >= r.max_players
          return (
            <li key={r.code}>
              <button
                type="button"
                onClick={() => onPick(r.code)}
                disabled={full}
                className={
                  v2
                    ? 'w-full flex items-center gap-3 px-3 min-h-[44px] text-left disabled:opacity-40'
                    : 'w-full flex items-center gap-3 px-3 min-h-[44px] text-left bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg transition-colors disabled:opacity-40'
                }
                style={
                  v2
                    ? {
                        background: 'rgba(244,236,219,0.06)',
                        border: '1px solid rgba(201,161,74,0.35)',
                        borderRadius: 3,
                        color: 'var(--color-paper)',
                      }
                    : undefined
                }
              >
                <span className={v2 ? 'font-mono font-bold tracking-[0.2em]' : 'font-mono font-bold tracking-widest text-white'}>
                  {r.code}
                </span>
                <span className={v2 ? 'text-sm truncate opacity-80' : 'text-sm text-gray-400 truncate'}>
                  {r.host}&apos;s room
                </span>
                <span className={v2 ? 'ml-auto flex items-center gap-1 font-mono text-xs opacity-80' : 'ml-auto flex items-center gap-1 font-mono text-xs text-gray-400'}>
                  <Users size={12} />
                  {r.players}/{r.max_players}
                  <span className="opacity-60">· {r.ready} ready</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
