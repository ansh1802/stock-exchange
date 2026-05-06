import { useEffect, useMemo, useRef, type FormEvent, useState } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import type { ClientMessage } from '../../types/messages'

interface Props {
  send: (msg: ClientMessage) => void
}

type Entry =
  | { kind: 'log'; text: string; ts: number; key: string }
  | { kind: 'chat'; name: string; text: string; ts: number; mine: boolean; key: string }

export default function MobileLogChat({ send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const chatMessages = useGameStore((s) => s.chatMessages)
  const chatUnread = useGameStore((s) => s.chatUnread)
  const clearChatUnread = useGameStore((s) => s.clearChatUnread)
  const playerName = useGameStore((s) => s.playerName)

  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // First-seen timestamp for each log entry index. Refs, never state —
  // React can't re-render on mutation here and we don't want it to.
  const logTsRef = useRef<number[]>([])

  const log = gameState?.game_log ?? []

  // Stamp any newly-appeared log entries with Date.now() so we can interleave
  // them against chat messages (which carry backend-assigned ts).
  if (logTsRef.current.length < log.length) {
    const now = Date.now()
    while (logTsRef.current.length < log.length) {
      logTsRef.current.push(now)
    }
  }

  const entries = useMemo<Entry[]>(() => {
    const merged: Entry[] = []
    for (let i = 0; i < log.length; i++) {
      merged.push({
        kind: 'log',
        text: log[i],
        ts: logTsRef.current[i] ?? 0,
        key: `log-${i}`,
      })
    }
    for (let i = 0; i < chatMessages.length; i++) {
      const m = chatMessages[i]
      merged.push({
        kind: 'chat',
        name: m.name,
        text: m.text,
        ts: m.ts * 1000,
        mine: m.name === playerName,
        key: `chat-${i}-${m.ts}`,
      })
    }
    merged.sort((a, b) => a.ts - b.ts)
    return merged
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log.length, chatMessages.length, playerName])

  // Clear chat unread while this tab is mounted.
  useEffect(() => {
    if (chatUnread > 0) clearChatUnread()
  }, [chatUnread, clearChatUnread])

  // Auto-scroll to bottom on new entries.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries.length])

  const submitChat = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    send({ type: 'chat', text })
    setDraft('')
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-950">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto mobile-scroll px-3 py-2 space-y-1.5"
      >
        {entries.length === 0 && (
          <div className="text-xs text-gray-600 italic text-center mt-4">
            No activity yet.
          </div>
        )}
        {entries.map((e) =>
          e.kind === 'log' ? (
            <div
              key={e.key}
              className="text-[11px] font-mono leading-snug text-gray-400 pl-2 border-l-2 border-gray-800"
            >
              {e.text}
            </div>
          ) : (
            <div
              key={e.key}
              className={cn('flex w-full', e.mine ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-3 py-1.5 text-xs leading-snug',
                  e.mine
                    ? 'bg-emerald-600/25 border border-emerald-600/40 text-emerald-50'
                    : 'bg-gray-800 border border-gray-700 text-gray-100',
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      e.mine ? 'bg-emerald-400' : 'bg-sky-400',
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-semibold',
                      e.mine ? 'text-emerald-300' : 'text-sky-300',
                    )}
                  >
                    {e.mine ? 'You' : e.name}
                  </span>
                </div>
                <div className="mt-0.5 break-words">{e.text}</div>
              </div>
            </div>
          ),
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submitChat} className="border-t border-gray-800 p-2 flex gap-1.5 bg-gray-900">
        <input
          type="text"
          value={draft}
          onChange={(ev) => setDraft(ev.target.value)}
          maxLength={300}
          placeholder="Message..."
          className="flex-1 bg-gray-950 border border-gray-700 rounded px-2.5 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-600"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="min-h-[36px] px-3 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  )
}
