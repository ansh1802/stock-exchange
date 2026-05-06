import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import type { Card } from '../../types/game'
import CardComponent from './CardComponent'

interface Props {
  open: boolean
  hand: Card[]
  selectedIdx: number | null
  isMyTurn: boolean
  onSelect: (index: number) => void
  onClose: () => void
}

export default function ViewAllDrawer({
  open,
  hand,
  selectedIdx,
  isMyTurn,
  onSelect,
  onClose,
}: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-40"
          />
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onClose()
            }}
            className="fixed inset-x-0 bottom-0 z-50 bg-gray-900 border-t border-gray-700 rounded-t-2xl pb-safe"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-2">
              <div className="w-10 h-1 rounded-full bg-gray-700" />
            </div>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-gray-400">
                Your Cards ({hand.length})
              </span>
              <button
                onClick={onClose}
                aria-label="Close"
                className="text-gray-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto mobile-scroll px-3 pb-4">
              <div className="flex flex-wrap gap-2 justify-center">
                {hand.map((card, i) => (
                  <CardComponent
                    key={i}
                    card={card}
                    selected={selectedIdx === i}
                    onClick={() => {
                      if (!isMyTurn) return
                      onSelect(i)
                    }}
                  />
                ))}
                {hand.length === 0 && (
                  <p className="text-gray-500 text-sm py-4">No cards in hand</p>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
