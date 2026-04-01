import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Phone } from 'lucide-react'

interface Props {
  companyName: string
  onComplete: () => void
}

export default function DebentureOverlay({ companyName, onComplete }: Props) {
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
        {/* Phone animation */}
        <motion.div
          initial={{ y: -200, opacity: 0, rotate: -20 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 150, damping: 12 }}
        >
          <motion.div
            animate={{ rotate: [-8, 8, -8, 8, 0] }}
            transition={{ delay: 0.5, duration: 0.6, repeat: 2 }}
          >
            <div className="w-24 h-24 rounded-full bg-emerald-900/30 border-2 border-emerald-500/40 flex items-center justify-center">
              <Phone size={44} className="text-emerald-400" />
            </div>
          </motion.div>
        </motion.div>

        {/* Text */}
        <motion.div
          className="text-center space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <p
            className="text-3xl font-bold text-emerald-400 tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {companyName}
          </p>
          <p className="text-sm text-gray-400 font-mono">
            is back in business!
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
}
