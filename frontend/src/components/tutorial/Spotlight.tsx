import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  /** Element to highlight. Spotlight tracks its bounding rect on resize/scroll. */
  targetRef: React.RefObject<HTMLElement | null>
  /** Padding (px) around the target. */
  padding?: number
  /** Click-through? Default false: clicks on dimmed area dismiss. */
  onDismiss?: () => void
}

/**
 * Dims everything except a rect around `target`. Uses a single SVG mask so
 * the highlight is one DOM node and the dim layer captures clicks outside.
 * For walkthrough use — fires only inside the tutorial route, not in real
 * gameplay (real-game tooltips use Coachmark without Spotlight).
 */
export default function Spotlight({ targetRef, padding = 6, onDismiss }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!targetRef.current) return
    const compute = () => {
      const r = targetRef.current?.getBoundingClientRect()
      if (r) setRect(r)
    }
    compute()
    window.addEventListener('resize', compute)
    window.addEventListener('scroll', compute, true)
    const obs = new ResizeObserver(compute)
    obs.observe(targetRef.current)
    return () => {
      window.removeEventListener('resize', compute)
      window.removeEventListener('scroll', compute, true)
      obs.disconnect()
    }
  }, [targetRef])

  if (!rect) return null
  const x = rect.left - padding
  const y = rect.top - padding
  const w = rect.width + padding * 2
  const h = rect.height + padding * 2

  return createPortal(
    <svg
      onClick={onDismiss}
      width="100vw"
      height="100vh"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        pointerEvents: 'auto',
      }}
    >
      <defs>
        <mask id="spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={6} ry={6} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(14,26,20,0.62)"
        mask="url(#spotlight-mask)"
      />
      {/* Gold dashed ring around the highlighted region */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        ry={6}
        fill="none"
        stroke="var(--color-gold)"
        strokeWidth={2}
        strokeDasharray="6 4"
        pointerEvents="none"
      />
    </svg>,
    document.body,
  )
}
