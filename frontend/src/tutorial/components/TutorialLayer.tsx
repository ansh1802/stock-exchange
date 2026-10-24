import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Step } from '../runtime/types'
import { findTarget } from './findTarget'
import { placeCoachmark, holeRects, RING_PAD, DOCK_GUTTER, type Box, type Size } from './placement'
import TutorialCoachmark, { type CoachmarkVariant } from './TutorialCoachmark'

interface Props {
  step: Step
  picked: number | null
  isMobile: boolean
  onNext(): void
  onClick(): void
  onValue(v: number): void
  onPredict(i: number): void
  onRestartStep(): void
  onExit(): void
}

/** Sonner's toaster sits at 999999999 — the highest layer in the app. Go above it. */
const Z = 1_000_000_000
const MISSING_MS = 1000
const INTERACTIVE = new Set(['click', 'value', 'action'])
const SILENT = new Set(['reveal_wait', 'reveal_end', 'suspend_end'])
/** Keys that could activate or move a control the lock hides. */
const GUARDED_KEYS = new Set([
  'Enter', ' ', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End',
])

const sameBox = (a: Box | null | undefined, b: Box | null | undefined) =>
  a === b || (!!a && !!b && a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height)

function toBox(r: DOMRect): Box {
  return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
}

const swallow = (e: SyntheticEvent) => { e.stopPropagation(); if (e.type === 'click') e.preventDefault() }
const blockerHandlers = {
  onPointerDown: swallow, onPointerUp: swallow, onMouseDown: swallow, onMouseUp: swallow,
  onClick: swallow, onDoubleClick: swallow, onTouchStart: swallow, onTouchEnd: swallow, onContextMenu: swallow,
}

/**
 * Tutorial chrome over the real game screen. Pointer input is blocked
 * everywhere except a hole over the step's target (four blocking rects —
 * the SVG dim + ring on top is purely visual). One coachmark explains the
 * step; Exit is always reachable.
 */
export default function TutorialLayer({
  step, picked, isMobile, onNext, onClick, onValue, onPredict, onRestartStep, onExit,
}: Props) {
  const kind = step.advance.kind
  const wantsTarget = !!step.target && !SILENT.has(kind)

  const [el, setEl] = useState<HTMLElement | null>(null)
  const [rect, setRect] = useState<Box | null>(null)
  const [missing, setMissing] = useState(false)
  const [vp, setVp] = useState<Size>(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const [card, setCard] = useState<Size | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const layerRef = useRef<HTMLDivElement | null>(null)

  // Track target + viewport every frame: modals spring in, rows scroll,
  // trees swap at 768px. Only changed values hit state.
  useEffect(() => {
    let raf = 0
    let missingSince: number | null = null
    let lastEl: HTMLElement | null | undefined = undefined // undefined = force first write
    let lastRect: Box | null | undefined = undefined
    setMissing(false)
    const tick = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      setVp((v) => (v.width === w && v.height === h ? v : { width: w, height: h }))
      const found = wantsTarget && step.target ? findTarget(step.target) : null
      if (found !== lastEl) { lastEl = found; setEl(found) }
      const r = found ? toBox(found.getBoundingClientRect()) : null
      if (!sameBox(r, lastRect)) { lastRect = r; setRect(r) }
      if (wantsTarget && !found) {
        const now = performance.now()
        missingSince ??= now
        if (now - missingSince > MISSING_MS) setMissing(true)
      } else {
        missingSince = null
        setMissing(false)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [step, wantsTarget])

  const interactive = INTERACTIVE.has(kind) && !!el && !!rect && !missing

  // `click` advance: capture listener on the target; defer so the target's own
  // (React, bubble-phase) handler runs first — e.g. Buy opens the trade popup.
  useEffect(() => {
    if (kind !== 'click' || !el) return
    let fired = false
    let t: ReturnType<typeof setTimeout> | undefined
    const handler = () => {
      if (fired) return
      fired = true
      t = setTimeout(onClick, 0)
    }
    el.addEventListener('click', handler, true)
    return () => { el.removeEventListener('click', handler, true); clearTimeout(t) }
  }, [kind, el, onClick])

  // `value` advance: the native range input inside the target. While a drag is
  // in progress the value is reported on release, so the step can't advance
  // mid-drag and leave the thumb moving under the next step's lock. Tick
  // labels (clicks that set the value via React) are read after the click.
  useEffect(() => {
    if (kind !== 'value' || !el) return
    const input = el.matches('input[type=range]') ? (el as HTMLInputElement) : el.querySelector<HTMLInputElement>('input[type=range]')
    if (!input) return
    let dragging = false
    let t: ReturnType<typeof setTimeout> | undefined
    const report = () => onValue(Number(input.value))
    const later = () => { clearTimeout(t); t = setTimeout(report, 0) }
    const onInput = () => { if (!dragging) report() }
    const onDown = (e: PointerEvent) => { if (e.target === input) dragging = true }
    const onUp = () => { if (dragging) { dragging = false; later() } }
    input.addEventListener('input', onInput)
    el.addEventListener('pointerdown', onDown, true)
    el.addEventListener('click', later, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('pointercancel', onUp, true)
    return () => {
      clearTimeout(t)
      input.removeEventListener('input', onInput)
      el.removeEventListener('pointerdown', onDown, true)
      el.removeEventListener('click', later, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('pointercancel', onUp, true)
    }
  }, [kind, el, onValue])

  // Keyboard can't reach around the lock: activation keys only work inside the
  // coachmark, or inside the target on an action step.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!GUARDED_KEYS.has(e.key)) return
      const active = document.activeElement
      if (active && layerRef.current?.contains(active)) return
      if (interactive && active && el?.contains(active)) return
      e.preventDefault()
      e.stopImmediatePropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [interactive, el])

  // Measure the coachmark for desktop float placement.
  useLayoutEffect(() => {
    const node = cardRef.current
    if (!node) { setCard(null); return }
    const measure = () => {
      const r = node.getBoundingClientRect()
      setCard((c) => (c && c.width === r.width && c.height === r.height ? c : { width: r.width, height: r.height }))
    }
    measure()
    const obs = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null
    obs?.observe(node)
    return () => obs?.disconnect()
  }, [step.id, kind, missing]) // the card node is keyed by step + variant; ResizeObserver covers content changes

  // --- what to draw -------------------------------------------------------
  const spot = rect && !missing ? rect : null
  const fullScreen = !!spot && spot.width >= vp.width * 0.9 && spot.height >= vp.height * 0.9
  const silent = SILENT.has(kind)
  const untargetedRead = !step.target && (kind === 'next' || kind === 'predict')
  const dim = !silent && (missing || untargetedRead || (!!spot && !fullScreen))

  const variant: CoachmarkVariant | null = missing ? 'missing' : silent ? null : kind === 'auto' ? 'chip' : 'card'
  const placement = missing
    ? ({ mode: 'center' } as const)
    : placeCoachmark(spot, card ?? { width: 360, height: 140 }, vp, isMobile)

  const width = isMobile ? `calc(100vw - ${DOCK_GUTTER * 2}px)` : variant === 'chip' ? 'max-content' : 'min(360px, calc(100vw - 24px))'
  const cardStyle: CSSProperties = { position: 'fixed', zIndex: Z + 2, width, maxWidth: `calc(100vw - ${DOCK_GUTTER * 2}px)` }
  if (placement.mode === 'center') {
    Object.assign(cardStyle, { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
  } else if (placement.mode === 'dock') {
    Object.assign(cardStyle, placement.edge === 'top'
      ? { top: `calc(${DOCK_GUTTER}px + env(safe-area-inset-top, 0px))`, left: DOCK_GUTTER }
      : { bottom: `calc(${DOCK_GUTTER}px + env(safe-area-inset-bottom, 0px))`, left: DOCK_GUTTER })
  } else {
    Object.assign(cardStyle, { top: placement.top, left: placement.left, visibility: card ? 'visible' : 'hidden' })
  }

  const hole = interactive && rect ? rect : null
  const blockers = hole
    ? holeRects(hole, vp)
    : [{ left: 0, top: 0, width: vp.width, height: vp.height }]

  // Padded ring, kept 3px inside the viewport so edge-hugging targets (log, ticker) show all four sides.
  const ring = spot && !fullScreen
    ? (() => {
        const x0 = Math.max(3, spot.left - RING_PAD)
        const y0 = Math.max(3, spot.top - RING_PAD)
        const x1 = Math.min(vp.width - 3, spot.left + spot.width + RING_PAD)
        const y1 = Math.min(vp.height - 3, spot.top + spot.height + RING_PAD)
        return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) }
      })()
    : null

  return createPortal(
    <div ref={layerRef} data-tutorial-layer="">
      <style>{LAYER_CSS}</style>

      {blockers.map((b, i) => (
        <div
          key={i}
          aria-hidden
          data-tutorial-blocker=""
          {...blockerHandlers}
          style={{ position: 'fixed', zIndex: Z, left: b.left, top: b.top, width: b.width, height: b.height, pointerEvents: 'auto', touchAction: 'none' }}
        />
      ))}

      <svg
        aria-hidden
        width={vp.width}
        height={vp.height}
        style={{ position: 'fixed', inset: 0, zIndex: Z + 1, pointerEvents: 'none' }}
      >
        <defs>
          <mask id="tutorial-hole">
            <rect width="100%" height="100%" fill="white" />
            {ring && <rect x={ring.x} y={ring.y} width={ring.w} height={ring.h} rx={10} fill="black" />}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(6,10,8,0.6)"
          mask="url(#tutorial-hole)"
          className="tut-dim"
          style={{ opacity: dim ? 1 : 0 }}
        />
        {ring && (
          <>
            <rect x={ring.x - 3} y={ring.y - 3} width={ring.w + 6} height={ring.h + 6} rx={13}
              fill="none" stroke="var(--color-gold)" strokeOpacity={0.22} strokeWidth={6} />
            <rect x={ring.x} y={ring.y} width={ring.w} height={ring.h} rx={10}
              fill="none" stroke="var(--color-gold-soft)" strokeWidth={1.5}
              className={interactive ? 'tut-breathe' : undefined} />
          </>
        )}
      </svg>

      {variant && (
        <TutorialCoachmark
          key={`${step.id}:${variant}`}
          variant={variant}
          step={step}
          picked={picked}
          isMobile={isMobile}
          style={cardStyle}
          cardRef={cardRef}
          onNext={onNext}
          onPredict={onPredict}
          onRestartStep={onRestartStep}
          onExit={onExit}
        />
      )}

      {!variant && (
        <button
          type="button"
          data-testid="tutorial-exit"
          className="font-mono"
          onClick={onExit}
          style={{
            position: 'fixed',
            zIndex: Z + 2,
            left: DOCK_GUTTER,
            bottom: `calc(${DOCK_GUTTER}px + env(safe-area-inset-bottom, 0px))`,
            minHeight: isMobile ? 44 : 32,
            padding: '0 14px',
            background: 'rgba(20,18,14,0.72)',
            color: 'var(--color-paper)',
            border: '1px solid rgba(201,161,74,0.45)',
            borderRadius: 999,
            fontSize: 10,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        >
          Exit tutorial
        </button>
      )}
    </div>,
    document.body,
  )
}

const LAYER_CSS = `
[data-tutorial-layer] .tut-dim { transition: opacity 260ms ease; }
[data-tutorial-layer] .tut-enter { animation: tut-enter 220ms ease-out both; }
[data-tutorial-layer] .tut-breathe { animation: tut-breathe 2.4s ease-in-out infinite; }
[data-tutorial-layer] .tut-dots i { width: 5px; height: 5px; border-radius: 50%; background: var(--color-gold-deep); animation: tut-dot 1.2s ease-in-out infinite; }
[data-tutorial-layer] .tut-dots i:nth-child(2) { animation-delay: 0.15s; }
[data-tutorial-layer] .tut-dots i:nth-child(3) { animation-delay: 0.3s; }
@keyframes tut-enter { from { opacity: 0; translate: 0 6px; } to { opacity: 1; translate: 0 0; } }
@keyframes tut-breathe { 0%, 100% { stroke-opacity: 1; } 50% { stroke-opacity: 0.45; } }
@keyframes tut-dot { 0%, 100% { opacity: 0.25; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  [data-tutorial-layer] .tut-enter, [data-tutorial-layer] .tut-breathe, [data-tutorial-layer] .tut-dots i { animation: none; }
  [data-tutorial-layer] .tut-dim { transition: none; }
}
`
