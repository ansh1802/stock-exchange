import { useRef, useEffect, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'

export default function GameLog() {
  const gameState = useGameStore((s) => s.gameState)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null)
  const prevLen = useRef(0)

  const log = gameState?.game_log ?? []

  // Auto-scroll and highlight latest entry
  useEffect(() => {
    if (log.length > prevLen.current) {
      const newIdx = log.length - 1
      setHighlightIdx(newIdx)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

      const t = setTimeout(() => setHighlightIdx(null), 2000)
      prevLen.current = log.length
      return () => clearTimeout(t)
    }
    prevLen.current = log.length
  }, [log.length])

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-3 py-2 border-b border-gray-800">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Game Log</h3>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {log.map((entry, i) => (
          <div
            key={i}
            className={cn(
              'text-xs font-mono leading-relaxed px-1.5 py-0.5 rounded transition-all duration-500',
              i === highlightIdx
                ? 'text-white bg-emerald-900/30 border-l-2 border-emerald-500'
                : 'text-gray-400',
            )}
          >
            {entry}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
