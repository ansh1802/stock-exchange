import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface Props {
  onClose: () => void
}

const UPDATES = [
  'Rights Issue price is now 50% of the company\'s current market value, floored to the nearest $5 — no longer a flat $10',
  'Loan Stock now grants 10% of your net worth in cash instead of a flat $100',
  'Rights Issue modal now shows your holdings, RI eligibility, cash, availability, and max purchasable qty with the limiting factor',
  'Max button added to Buy and Sell modals — fills quantity to the most you can trade',
  'RI Buy button in the Buy modal — smart-fills the most you can buy while keeping enough cash to fully exercise a Rights Issue afterwards',
  'RI Sell button in the Sell modal — smart-fills the minimum to sell so your cash funds a full Rights Issue on remaining holdings',
  'RI eligible count and cost shown live in the Buy / Sell preview as you adjust quantity',
]

export default function RollingUpdatesModal({ onClose }: Props) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-amber-500 uppercase tracking-widest font-mono mb-0.5">
                What's new
              </p>
              <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                Rolling Updates
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Updates list */}
          <ul className="space-y-2.5">
            {UPDATES.map((text, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-300">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                {text}
              </li>
            ))}
          </ul>

          {/* Dismiss */}
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition-colors"
          >
            Got it
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
