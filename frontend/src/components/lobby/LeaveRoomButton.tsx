import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../../store/useGameStore'
import ConfirmDialog from './ConfirmDialog'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
  disconnect: () => void
}

export default function LeaveRoomButton({ send, disconnect }: Props) {
  const navigate = useNavigate()
  const reset = useGameStore((s) => s.reset)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const leave = () => {
    setConfirmOpen(false)
    send({ type: 'leave_room' })
    disconnect()
    reset()
    navigate('/')
  }

  return (
    <>
      <button
        onClick={() => setConfirmOpen(true)}
        className="w-full py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
      >
        Leave Room
      </button>
      <ConfirmDialog
        open={confirmOpen}
        title="Leave room"
        message="Are you sure you want to leave this room?"
        confirmLabel="Leave"
        danger
        onConfirm={leave}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
