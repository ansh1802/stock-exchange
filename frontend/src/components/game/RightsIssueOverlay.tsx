import { useEffect } from 'react'
import { motion } from 'framer-motion'

interface Props {
  companyName: string
  onComplete: () => void
}

export default function RightsIssueOverlay({ companyName, onComplete }: Props) {
  useEffect(() => {
    const t = setTimeout(onComplete, 2500)
    return () => clearTimeout(t)
  }, [onComplete])

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-gray-950/90" />

      <div className="relative flex flex-col items-center gap-6">
        {/* Handshake animation */}
        <div className="relative flex items-center justify-center h-32 w-64">
          {/* Left hand */}
          <motion.span
            className="text-6xl absolute"
            initial={{ x: -120, opacity: 0 }}
            animate={{ x: -10, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'backOut' }}
          >
            {'\u{1F91D}'}
          </motion.span>

          {/* Right hand (mirrored) */}
          <motion.span
            className="text-6xl absolute scale-x-[-1]"
            initial={{ x: 120, opacity: 0 }}
            animate={{ x: 10, opacity: 1 }}
            transition={{ duration: 0.6, ease: 'backOut' }}
          >
            {'\u{1F91D}'}
          </motion.span>

          {/* Shake effect on both */}
          <motion.div
            className="absolute inset-0"
            animate={{ x: [0, -3, 3, -3, 3, 0] }}
            transition={{ delay: 0.7, duration: 0.5, repeat: 1 }}
          />
        </div>

        {/* Text */}
        <motion.div
          className="text-center space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <p className="text-xs text-gray-500 uppercase tracking-[0.3em] font-mono">
            Rights Issue Announced
          </p>
          <p
            className="text-3xl font-bold text-amber-400 tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {companyName}
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
}
