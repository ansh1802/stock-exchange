import { cn } from '../../lib/cn'

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Matches the existing in-game modal pattern (ShareSuspendModal,
// RightsIssueModal, etc.) — a dark backdrop + gray-900 card — instead of
// the browser's native confirm(), which looks like a raw site permission
// prompt and breaks out of the app's own styling.
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm space-y-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <p className="text-sm text-gray-400">{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'flex-1 py-2 rounded-lg font-medium transition-colors',
              danger ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white',
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
