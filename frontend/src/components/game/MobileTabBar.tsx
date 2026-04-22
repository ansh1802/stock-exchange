import { cn } from '../../lib/cn'

export type MobileTab = 'players' | 'logchat'

interface Props {
  active: MobileTab
  onChange: (tab: MobileTab) => void
  chatUnread: number
}

export default function MobileTabBar({ active, onChange, chatUnread }: Props) {
  return (
    <div className="flex border-t border-gray-800 bg-gray-900 pb-safe">
      <button
        onClick={() => onChange('players')}
        className={cn(
          'flex-1 h-11 flex items-center justify-center text-xs font-medium uppercase tracking-wider transition-colors',
          active === 'players'
            ? 'text-emerald-400 border-t-2 border-emerald-500 -mt-px'
            : 'text-gray-500',
        )}
      >
        Players
      </button>
      <button
        onClick={() => onChange('logchat')}
        className={cn(
          'flex-1 h-11 flex items-center justify-center gap-1.5 text-xs font-medium uppercase tracking-wider transition-colors',
          active === 'logchat'
            ? 'text-emerald-400 border-t-2 border-emerald-500 -mt-px'
            : 'text-gray-500',
        )}
      >
        Log + Chat
        {chatUnread > 0 && active !== 'logchat' && (
          <span className="bg-emerald-500 text-black text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none">
            {chatUnread > 9 ? '9+' : chatUnread}
          </span>
        )}
      </button>
    </div>
  )
}
