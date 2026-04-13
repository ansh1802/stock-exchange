import { motion } from 'framer-motion'
import { WifiOff } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'

export default function ReconnectingBanner() {
  const isReconnecting = useGameStore((s) => s.isReconnecting)
  const gameStarted = useGameStore((s) => s.gameStarted)

  if (!isReconnecting || !gameStarted) return null

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      className="fixed top-0 left-0 right-0 z-50 bg-amber-900/95 border-b border-amber-700 px-4 py-2.5 flex items-center justify-center gap-3 text-amber-100 text-sm backdrop-blur-sm"
    >
      <WifiOff className="w-4 h-4 flex-shrink-0" />
      <span>Connection lost — reconnecting...</span>
      <span className="text-amber-300/80 text-xs">Your game is safe</span>
      <motion.div
        className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      />
    </motion.div>
  )
}
