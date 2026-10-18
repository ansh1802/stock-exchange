import { useState } from 'react'
import { motion } from 'framer-motion'
import { LogOut } from 'lucide-react'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
  onClose: () => void
}

const CONFIRM_WORD = 'LEAVE'

// Mid-game exit is permanent and costly, so it's gated behind typing a word
// rather than a single tap.
export default function LeaveGameModal({ send, onClose }: Props) {
  const [typed, setTyped] = useState('')
  const armed = typed.trim().toUpperCase() === CONFIRM_WORD

  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-gray-900 border border-red-500/40 rounded-2xl p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-red-400">
          <LogOut size={18} />
          <h3 className="text-lg font-bold">Leave this game?</h3>
        </div>
        <ul className="text-sm text-gray-300 space-y-1.5 list-disc pl-5">
          <li>All your shares go back to the market.</li>
          <li>Your cash is forfeited.</li>
          <li>Your cards won&apos;t count today.</li>
          <li><span className="text-white font-medium">You can&apos;t rejoin this game.</span></li>
        </ul>
        <label className="block space-y-1.5">
          <span className="text-xs text-gray-400">
            Type <span className="font-mono font-bold text-red-300">{CONFIRM_WORD}</span> to confirm
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full px-3 min-h-[44px] bg-gray-800 border border-gray-700 rounded-lg text-white font-mono tracking-widest uppercase focus:outline-none focus:border-red-500"
          />
        </label>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 min-h-[44px] bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-medium"
          >
            Stay
          </button>
          <button
            onClick={() => send({ type: 'leave_room' })}
            disabled={!armed}
            className="flex-1 min-h-[44px] bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed"
          >
            Leave game
          </button>
        </div>
      </motion.div>
    </div>
  )
}
