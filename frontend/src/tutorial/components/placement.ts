/** Pure layout math for the tutorial layer — no DOM access, unit-tested. */

export interface Box { left: number; top: number; width: number; height: number }
export interface Size { width: number; height: number }

export type Placement =
  | { mode: 'center' }
  | { mode: 'dock'; edge: 'top' | 'bottom' }
  | { mode: 'float'; side: 'below' | 'above' | 'right' | 'left' | 'inside'; top: number; left: number }

/** Visual padding between the target and the spotlight ring. */
export const RING_PAD = 6
/** Gap between the ring and the coachmark. */
const GAP = 12
/** Minimum distance from the viewport edge (desktop). */
const EDGE = 12
/** Mobile dock inset from the screen edge. */
export const DOCK_GUTTER = 16

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi))

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0))
}

/**
 * Desktop: float next to the target (below → above → right → left), shifted to
 * stay fully inside the viewport; if no side fits (huge target) sit inside the
 * viewport's lower edge. Mobile: dock to whichever edge covers less of the target.
 */
export function placeCoachmark(target: Box | null, card: Size, vp: Size, isMobile: boolean): Placement {
  if (isMobile) {
    if (!target) return { mode: 'dock', edge: 'bottom' }
    const t0 = target.top - RING_PAD
    const t1 = target.top + target.height + RING_PAD
    const bottomCover = overlap(vp.height - DOCK_GUTTER - card.height, vp.height - DOCK_GUTTER, t0, t1)
    const topCover = overlap(DOCK_GUTTER, DOCK_GUTTER + card.height, t0, t1)
    return { mode: 'dock', edge: topCover < bottomCover ? 'top' : 'bottom' }
  }
  if (!target) return { mode: 'center' }

  const right = target.left + target.width
  const bottom = target.top + target.height
  const cx = target.left + target.width / 2
  const cy = target.top + target.height / 2
  const hLeft = clamp(cx - card.width / 2, EDGE, vp.width - card.width - EDGE)
  const vTop = clamp(cy - card.height / 2, EDGE, vp.height - card.height - EDGE)

  const below = bottom + RING_PAD + GAP
  if (below + card.height <= vp.height - EDGE) return { mode: 'float', side: 'below', top: below, left: hLeft }
  const above = target.top - RING_PAD - GAP - card.height
  if (above >= EDGE) return { mode: 'float', side: 'above', top: above, left: hLeft }
  const toRight = right + RING_PAD + GAP
  if (toRight + card.width <= vp.width - EDGE) return { mode: 'float', side: 'right', top: vTop, left: toRight }
  const toLeft = target.left - RING_PAD - GAP - card.width
  if (toLeft >= EDGE) return { mode: 'float', side: 'left', top: vTop, left: toLeft }
  return {
    mode: 'float',
    side: 'inside',
    top: clamp(vp.height - card.height - EDGE * 2, EDGE, vp.height - card.height - EDGE),
    left: hLeft,
  }
}

/**
 * Four blocking rects (top, bottom, left, right) that tile the viewport around
 * `hole`, leaving exactly the hole clickable. The hole is clamped to the viewport.
 */
export function holeRects(hole: Box, vp: Size): [Box, Box, Box, Box] {
  const top = clamp(hole.top, 0, vp.height)
  const bottom = clamp(hole.top + hole.height, top, vp.height)
  const left = clamp(hole.left, 0, vp.width)
  const right = clamp(hole.left + hole.width, left, vp.width)
  const h = bottom - top
  return [
    { left: 0, top: 0, width: vp.width, height: top },
    { left: 0, top: bottom, width: vp.width, height: vp.height - bottom },
    { left: 0, top, width: left, height: h },
    { left: right, top, width: vp.width - right, height: h },
  ]
}
