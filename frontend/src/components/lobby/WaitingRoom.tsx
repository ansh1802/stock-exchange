import { useGameStore } from '../../store/useGameStore'
import { useTheme } from '../../hooks/useTheme'
import PlayerList from './PlayerList'
import ReadyButton from './ReadyButton'
import StartButton from './StartButton'
import LeaveRoomButton from './LeaveRoomButton'
import CloseRoomButton from './CloseRoomButton'
import type { ClientMessage } from '../../types/messages'

interface Props {
  roomCode: string
  send: (msg: ClientMessage) => void
  disconnect: () => void
}

export default function WaitingRoom({ roomCode, send, disconnect }: Props) {
  const isConnected = useGameStore((s) => s.isConnected)
  const isPublic = useGameStore((s) => s.isPublic)
  const theme = useTheme()

  const header = (
    <div className="text-center">
      <h2
        className="text-2xl font-bold"
        style={theme === 'v2' ? { color: 'var(--color-paper)', fontFamily: 'DM Serif Display, serif' } : { color: 'white' }}
      >
        Room: {roomCode}
      </h2>
      <div className="mt-1 flex items-center justify-center gap-2 text-sm flex-wrap">
        <span className={`inline-block w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400' : 'bg-red-400'}`} />
        <span className="text-gray-400">{isConnected ? 'Connected' : 'Connecting...'}</span>
        <span className="text-gray-600">·</span>
        <span className="text-gray-400">{isPublic ? 'Public room' : 'Private room'}</span>
      </div>
    </div>
  )

  // The gameplay UI (GameBoard/PlayerBoard) this waiting room hands off to
  // is intentionally dark/emerald regardless of theme, so the functional
  // card stays that same dark style in both themes — only the page
  // background and heading pick up the v2 felt/gold treatment.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4" style={theme === 'v2' ? { background: 'var(--color-felt)' } : undefined}>
      <div className="w-full max-w-md space-y-6">
        {header}

        <div className="bg-gray-900 p-6 rounded-xl border border-gray-800">
          <PlayerList send={send} />
          <div className="mt-4">
            <ReadyButton send={send} />
          </div>
          <StartButton send={send} />
          <div className="mt-4 pt-3 border-t border-gray-800 space-y-1">
            <LeaveRoomButton send={send} disconnect={disconnect} />
            <CloseRoomButton send={send} />
          </div>
        </div>
      </div>
    </div>
  )
}
