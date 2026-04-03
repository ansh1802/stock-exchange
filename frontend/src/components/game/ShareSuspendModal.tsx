import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import { COMPANY_COLOR } from '../../lib/constants'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function ShareSuspendModal({ send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const playerName = useGameStore((s) => s.playerName)

  if (!gameState) return null

  const isMyTurn = gameState.current_player_name === playerName

  const handleSelect = (companyNum: number) => {
    send({ type: 'share_suspend', company_num: companyNum })
  }

  const handlePass = () => {
    send({ type: 'share_suspend', company_num: 0 })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-lg font-bold text-white">Share Suspend</h3>
        <p className="text-sm text-gray-400">
          Swap a company's value with its pre-fluctuation value
        </p>

        {isMyTurn ? (
          <>
            <div className="space-y-1.5">
              {gameState.companies.map((co, i) => (
                <button
                  key={co.name}
                  onClick={() => handleSelect(i + 1)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full', COMPANY_COLOR[co.name])} />
                    <span className="text-sm text-white">{co.name}</span>
                  </span>
                  <span className="text-sm font-mono">
                    <span className="text-gray-400">{co.prev_value}</span>
                    <span className="text-gray-600 mx-1">&rarr;</span>
                    <span className="text-white">{co.value}</span>
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={handlePass}
              className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium"
            >
              Pass
            </button>
          </>
        ) : (
          <p className="text-gray-400 text-center py-4">
            Waiting for <span className="text-white">{gameState.current_player_name}</span>...
          </p>
        )}
      </div>
    </div>
  )
}
