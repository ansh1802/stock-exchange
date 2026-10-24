import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import GameBoard from '../components/game/GameBoard'
import { useIsMobile } from '../hooks/useIsMobile'
import { tutorialStorage } from '../lib/tutorialStorage'
import { useGameStore } from '../store/useGameStore'
import type { ClientMessage } from '../types/messages'
import { CHAPTERS, findChapter, loadFixture, type Fixture } from '../tutorial/chapters/index'
import TutorialLayer from '../tutorial/components/TutorialLayer'
import { TutorialContext, type TutorialApi } from '../tutorial/runtime/TutorialContext'
import {
  allows, heldRevealStage, holdsSuspendClose, initialRun, reduce, rewindToCheckpoint, snapChanged,
  type MachineEvent, type RunState,
} from '../tutorial/runtime/machine'
import { enterTutorialStore, loadSnapshot, restoreStore } from '../tutorial/runtime/storeSwap'
import type { Chapter } from '../tutorial/runtime/types'

/** /tutorial/play/:chapterId — remount per chapter so run state and the store swap reset. */
export default function TutorialPlayerPage() {
  const { chapterId = '' } = useParams<{ chapterId: string }>()
  const chapter = findChapter(chapterId)
  if (!chapter) return <Notice text={`No tutorial chapter "${chapterId}".`} />
  return <ChapterPlayer key={chapter.id} chapter={chapter} />
}

const Z_DONE = 1_000_000_003 // above TutorialLayer (1e9 … 1e9+2)

function ChapterPlayer({ chapter }: { chapter: Chapter }) {
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [run, setRun] = useState<RunState>(initialRun)
  const [restartCount, setRestartCount] = useState(0)
  const runRef = useRef(run)
  const fixtureRef = useRef<Fixture | null>(null)
  const timerSecs = useGameStore((s) => s.gameState?.turn_timer_duration ?? 90)

  // Own the live store for as long as this chapter is on screen. Restoring in
  // cleanup covers Exit, browser back and in-app navigation.
  useLayoutEffect(() => {
    const saved = enterTutorialStore()
    return () => restoreStore(saved)
  }, [])

  const showSnap = useCallback((snapId: string) => {
    const state = fixtureRef.current?.snapshots[snapId]
    if (!state) {
      console.error(`[tutorial] ${chapter.id}: missing snapshot "${snapId}"`)
      setFailed(true)
      return
    }
    loadSnapshot(state)
  }, [chapter])

  // Reload mid-chapter always starts at step 0 (no persisted run state).
  useEffect(() => {
    let cancelled = false
    loadFixture(chapter.id)
      .then((fx) => {
        if (cancelled) return
        fixtureRef.current = fx
        runRef.current = initialRun()
        setRun(runRef.current)
        showSnap(chapter.steps[0].snap)
        setReady(true)
      })
      .catch((e) => {
        if (cancelled) return
        console.error(`[tutorial] ${chapter.id}: fixture failed to load`, e)
        setFailed(true)
      })
    return () => { cancelled = true }
  }, [chapter, showSnap])

  // Single entry for every machine event. runRef (not state) is the source of
  // truth so duplicate sends in one tick advance once. The next snapshot is
  // loaded before React renders the new step.
  const dispatch = useCallback((e: MachineEvent) => {
    if (!fixtureRef.current) return
    const prev = runRef.current
    const next = reduce(chapter, prev, e)
    if (next === prev) return
    runRef.current = next
    if (next.done) tutorialStorage.markChapterDone(chapter.id)
    else if (next.idx !== prev.idx && snapChanged(chapter, prev.idx, next.idx)) showSnap(chapter.steps[next.idx].snap)
    setRun(next)
  }, [chapter, showSnap])

  const exit = useCallback(() => navigate('/tutorial'), [navigate])

  // Outbound messages never reach a socket: every send goes to the machine.
  const intercept = useCallback((msg: ClientMessage) => {
    if (msg.type === 'leave_room') { exit(); return }
    dispatch({ type: 'send', msg })
  }, [dispatch, exit])

  const restart = useCallback(() => {
    const idx = rewindToCheckpoint(chapter, runRef.current.idx)
    runRef.current = { idx, picked: null, done: false }
    showSnap(chapter.steps[idx].snap)
    setRun(runRef.current)
    setRestartCount((c) => c + 1)
  }, [chapter, showSnap])

  // Stable identities: CardRevealOverlay's report effect depends on them.
  const allowsMsg = useCallback((msg: ClientMessage) => allows(chapter.steps[runRef.current.idx], msg), [chapter])
  const reportRevealStage = useCallback((key: string) => dispatch({ type: 'reveal_stage', key }), [dispatch])

  const step = chapter.steps[run.idx]

  // Bot turns / pauses advance on their own.
  useEffect(() => {
    if (!ready || run.done || step.advance.kind !== 'auto') return
    const t = setTimeout(() => dispatch({ type: 'auto_elapsed' }), step.advance.delayMs)
    return () => clearTimeout(t)
  }, [ready, run.done, step, restartCount, dispatch])

  const api = useMemo<TutorialApi>(() => ({
    allows: allowsMsg,
    frozenTimerSecs: timerSecs,
    heldRevealStage: run.done ? null : heldRevealStage(step),
    holdSuspendClose: run.done ? false : holdsSuspendClose(step),
    reportRevealStage,
    forcedMobileTab: step.mobileTab ?? null,
  }), [allowsMsg, timerSecs, run.done, step, reportRevealStage])

  if (failed) return <Notice text="This chapter couldn't load." />

  const boardKey = `${chapter.id}:${restartCount}`
  return (
    <TutorialContext.Provider value={api}>
      <div data-testid="tutorial-player" data-step={run.done ? '' : step.id} style={{ display: 'contents' }}>
        {ready && <GameBoard key={`board:${boardKey}`} send={intercept} />}
        {ready && !run.done && (
          <TutorialLayer
            key={`layer:${boardKey}`}
            step={step}
            picked={run.picked}
            isMobile={isMobile}
            onNext={() => dispatch({ type: 'next' })}
            onClick={() => dispatch({ type: 'click' })}
            onValue={(value) => dispatch({ type: 'value', value })}
            onPredict={(option) => dispatch({ type: 'predict', option })}
            onRestartStep={restart}
            onExit={exit}
          />
        )}
        {run.done && <ChapterDone chapter={chapter} />}
      </div>
    </TutorialContext.Provider>
  )
}

const card = {
  background: 'var(--color-paper)',
  color: 'var(--color-ink)',
  borderRadius: 4,
  boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 0 1px var(--color-gold-deep)',
} as const

const primaryBtn = {
  background: 'var(--color-ink)',
  color: 'var(--color-gold-soft)',
  border: '1px solid var(--color-gold)',
} as const

const ghostBtn = {
  background: 'transparent',
  color: 'var(--color-ink)',
  border: '1px solid var(--color-paper-line)',
} as const

function ChapterDone({ chapter }: { chapter: Chapter }) {
  const navigate = useNavigate()
  const i = CHAPTERS.findIndex((c) => c.id === chapter.id)
  const next = i >= 0 ? CHAPTERS[i + 1] : undefined
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: Z_DONE, background: 'rgba(6,10,8,0.7)', padding: 16 }}
    >
      <div data-testid="tutorial-chapter-done" className="w-full max-w-md px-6 py-6" style={card}>
        <div className="font-mono uppercase" style={{ fontSize: 10, letterSpacing: '0.2em', color: 'var(--color-gold-deep)' }}>
          Chapter complete
        </div>
        <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 28, lineHeight: 1.1, margin: '6px 0 14px' }}>
          {chapter.title}
        </h2>
        <ul className="space-y-2" style={{ marginBottom: 20 }}>
          {chapter.chips.map((chip) => (
            <li
              key={chip}
              className="px-3 py-2"
              style={{ background: 'var(--color-paper-2)', border: '1px solid var(--color-gold)', borderRadius: 3, fontSize: 13 }}
            >
              ✦ {chip}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          {next && (
            <button
              data-testid="tutorial-next-chapter"
              onClick={() => navigate(`/tutorial/play/${next.id}`)}
              className="min-h-[44px] rounded font-mono uppercase"
              style={{ ...primaryBtn, fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer' }}
            >
              Next chapter: {next.title}
            </button>
          )}
          <button
            data-testid="tutorial-all-chapters"
            onClick={() => navigate('/tutorial')}
            className="min-h-[44px] rounded font-mono uppercase"
            style={{ ...(next ? ghostBtn : primaryBtn), fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer' }}
          >
            All chapters
          </button>
        </div>
      </div>
    </div>
  )
}

function Notice({ text }: { text: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-felt)', padding: 16 }}>
      <div className="w-full max-w-sm px-6 py-6 text-center" style={card}>
        <p style={{ fontSize: 14, marginBottom: 16 }}>{text}</p>
        <Link to="/tutorial" className="font-mono uppercase" style={{ fontSize: 11, letterSpacing: '0.15em', color: 'var(--color-gold-deep)' }}>
          All chapters
        </Link>
      </div>
    </div>
  )
}
