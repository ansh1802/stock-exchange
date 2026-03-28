import { useRef, useEffect } from 'react'
import { useGameStore } from '../../store/useGameStore'

export default function GameLog() {
  const gameState = useGameStore((s) => s.gameState)
  const bottomRef = useRef<HTMLDivElement>(null)

  const log = gameState?.game_log ?? []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log.length])

  return (
    <div className="flex-1 bg-gray-900 rounded-xl border border-gray-800 overflow-hidden flex flex-col min-h-0">
      <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-2 border-b border-gray-800">
        Game Log
      </h3>
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-xs font-mono">
        {log.map((entry, i) => (
          <div key={i} className="text-gray-400 leading-relaxed">
            {entry}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
