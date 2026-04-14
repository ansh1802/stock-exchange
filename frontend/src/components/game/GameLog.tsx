import { useRef, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useGameStore } from '../../store/useGameStore'
import { cn } from '../../lib/cn'
import type { ClientMessage } from '../../types/messages'

type Tab = 'log' | 'chat'

interface Props {
  send: (msg: ClientMessage) => void
}

export default function GameLog({ send }: Props) {
  const gameState = useGameStore((s) => s.gameState)
  const chatMessages = useGameStore((s) => s.chatMessages)
  const chatUnread = useGameStore((s) => s.chatUnread)
  const clearChatUnread = useGameStore((s) => s.clearChatUnread)
  const playerName = useGameStore((s) => s.playerName)

  const [tab, setTab] = useState<Tab>('log')
  const [draft, setDraft] = useState('')

  const logBottomRef = useRef<HTMLDivElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const [highlightIdx, setHighlightIdx] = useState<number | null>(null)
  const prevLogLen = useRef(0)
  const prevChatLen = useRef(0)

  const log = gameState?.game_log ?? []

  useEffect(() => {
    if (log.length > prevLogLen.current) {
      const newIdx = log.length - 1
      setHighlightIdx(newIdx)
      if (tab === 'log') logBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      const t = setTimeout(() => setHighlightIdx(null), 2000)
      prevLogLen.current = log.length
      return () => clearTimeout(t)
    }
    prevLogLen.current = log.length
  }, [log.length, tab])

  useEffect(() => {
    if (chatMessages.length > prevChatLen.current && tab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevChatLen.current = chatMessages.length
  }, [chatMessages.length, tab])

  useEffect(() => {
    if (tab === 'chat' && chatUnread > 0) clearChatUnread()
  }, [tab, chatUnread, clearChatUnread])

  const submitChat = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    send({ type: 'chat', text })
    setDraft('')
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex border-b border-gray-800">
        <button
          onClick={() => setTab('log')}
          className={cn(
            'flex-1 px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors',
            tab === 'log'
              ? 'text-emerald-400 border-b-2 border-emerald-500 -mb-px'
              : 'text-gray-500 hover:text-gray-300',
          )}
        >
          Game Log
        </button>
        <button
          onClick={() => setTab('chat')}
          className={cn(
            'flex-1 px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5',
            tab === 'chat'
              ? 'text-emerald-400 border-b-2 border-emerald-500 -mb-px'
              : 'text-gray-500 hover:text-gray-300',
          )}
        >
          Chat
          {chatUnread > 0 && tab !== 'chat' && (
            <span className="bg-emerald-500 text-black text-[10px] rounded-full px-1.5 py-0.5 font-bold leading-none">
              {chatUnread > 9 ? '9+' : chatUnread}
            </span>
          )}
        </button>
      </div>

      {tab === 'log' ? (
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
          <div ref={logBottomRef} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
            {chatMessages.length === 0 && (
              <div className="text-xs text-gray-600 italic text-center mt-4">
                No messages yet. Say hi!
              </div>
            )}
            {chatMessages.map((m, i) => {
              const mine = m.name === playerName
              return (
                <div key={i} className={cn('text-xs leading-snug', mine ? 'text-right' : 'text-left')}>
                  <span className={cn('font-semibold', mine ? 'text-emerald-400' : 'text-sky-400')}>
                    {mine ? 'You' : m.name}
                  </span>
                  <span className="text-gray-200 ml-1.5 break-words">{m.text}</span>
                </div>
              )
            })}
            <div ref={chatBottomRef} />
          </div>
          <form onSubmit={submitChat} className="border-t border-gray-800 p-2 flex gap-1.5">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={300}
              placeholder="Message..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 placeholder-gray-600 focus:outline-none focus:border-emerald-600"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="px-2.5 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
