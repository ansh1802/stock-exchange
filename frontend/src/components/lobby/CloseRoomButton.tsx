import { useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import ConfirmDialog from './ConfirmDialog'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
}

// The room_closed broadcast (handled in useWebSocket) resets the store and
// stops reconnect attempts for everyone, including the host who sent this —
// no separate navigation needed here.
export default function CloseRoomButton({ send }: Props) {
  const isHost = useGameStore((s) => s.isHost)
  const [confirmOpen, setConfirmOpen] = useState(false)
  if (!isHost) return null

  const close = () => {
    setConfirmOpen(false)
    send({ type: 'close_room' })
  }

  return (
    <>
      <button
        onClick={() => setConfirmOpen(true)}
        className="w-full py-2 text-sm text-red-500 hover:text-red-400 transition-colors"
      >
        Close Room
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="Close room"
        message="Close this room? Everyone currently in it will be removed."
        confirmLabel="Close Room"
        danger
        onConfirm={close}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
