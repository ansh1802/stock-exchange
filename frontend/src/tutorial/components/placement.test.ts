import { describe, it, expect } from 'vitest'
import { placeCoachmark, holeRects, type Box } from './placement'

const vp = { width: 1280, height: 720 }
const card = { width: 360, height: 140 }
const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height })

describe('placeCoachmark — desktop', () => {
  it('centres when there is no target', () => {
    expect(placeCoachmark(null, card, vp, false)).toEqual({ mode: 'center' })
  })

  it('prefers below the target, centred on it', () => {
    const p = placeCoachmark(box(500, 100, 200, 40), card, vp, false)
    expect(p).toMatchObject({ mode: 'float', side: 'below' })
    if (p.mode !== 'float') throw new Error()
    expect(p.top).toBeGreaterThan(140)
    expect(p.left).toBe(500 + 100 - 180)
  })

  it('flips above when there is no room below', () => {
    const p = placeCoachmark(box(500, 640, 200, 50), card, vp, false)
    expect(p).toMatchObject({ mode: 'float', side: 'above' })
    if (p.mode !== 'float') throw new Error()
    expect(p.top + card.height).toBeLessThan(640)
  })

  it('shifts horizontally to stay inside the viewport', () => {
    const p = placeCoachmark(box(1240, 100, 30, 30), card, vp, false)
    if (p.mode !== 'float') throw new Error()
    expect(p.left + card.width).toBeLessThanOrEqual(vp.width - 12)
    const q = placeCoachmark(box(2, 100, 30, 30), card, vp, false)
    if (q.mode !== 'float') throw new Error()
    expect(q.left).toBeGreaterThanOrEqual(12)
  })

  it('goes beside a tall target, and stays inside when nothing fits', () => {
    expect(placeCoachmark(box(0, 0, 400, 720), card, vp, false)).toMatchObject({ side: 'right' })
    const p = placeCoachmark(box(0, 0, 1280, 720), card, vp, false)
    if (p.mode !== 'float') throw new Error()
    expect(p.top).toBeGreaterThanOrEqual(12)
    expect(p.top + card.height).toBeLessThanOrEqual(vp.height - 12)
  })
})

describe('placeCoachmark — mobile', () => {
  const m = { width: 390, height: 844 }
  it('docks at the bottom when the target is in the top half', () => {
    expect(placeCoachmark(box(0, 60, 390, 100), card, m, true)).toEqual({ mode: 'dock', edge: 'bottom' })
  })
  it('docks at the top when the target sits at the bottom', () => {
    expect(placeCoachmark(box(0, 740, 390, 60), card, m, true)).toEqual({ mode: 'dock', edge: 'top' })
  })
  it('centres with no target', () => {
    expect(placeCoachmark(null, card, m, true)).toEqual({ mode: 'center' })
  })
})

describe('holeRects', () => {
  it('surrounds the hole with four blockers that tile the viewport', () => {
    const r = holeRects(box(100, 50, 200, 30), vp)
    expect(r).toEqual([
      box(0, 0, 1280, 50),        // top
      box(0, 80, 1280, 640),      // bottom
      box(0, 50, 100, 30),        // left
      box(300, 50, 980, 30),      // right
    ])
  })
  it('clamps a hole that runs off-screen', () => {
    const r = holeRects(box(-10, -10, 50, 50), vp)
    expect(r[0].height).toBe(0)
    expect(r[2].width).toBe(0)
    expect(r[1].top).toBe(40)
  })
})
