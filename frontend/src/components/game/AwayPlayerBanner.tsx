import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { useGameStore } from '../../store/useGameStore'

export default function AwayPlayerBanner() {
  const awayPlayer = useGameStore((s) => s.awayPlayer)
  const [remaining, setRemaining] = useState(0)
  const startTime = useRef(0)

  useEffect(() => {
    if (!awayPlayer) {
      setRemaining(0)
      return
    }
    startTime.current = Date.now()
    setRemaining(awayPlayer.timeout)

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime.current) / 1000)
      const left = Math.max(0, awayPlayer.timeout - elapsed)
      setRemaining(left)
      if (left <= 0) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [awayPlayer])

  if (!awayPlayer || remaining <= 0) return null

  return (
    <motion.div
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -40, opacity: 0 }}
      className="fixed top-0 left-0 right-0 z-40 bg-gray-800/95 border-b border-gray-700 px-4 py-2 flex items-center justify-center gap-3 text-gray-200 text-sm backdrop-blur-sm"
    >
      <Clock className="w-4 h-4 flex-shrink-0 text-yellow-400" />
      <span>
        Waiting for <strong>{awayPlayer.name}</strong> to reconnect...
      </span>
      <span className="text-yellow-400 font-mono tabular-nums">
        auto-skip in {remaining}s
      </span>
    </motion.div>
  )
}
