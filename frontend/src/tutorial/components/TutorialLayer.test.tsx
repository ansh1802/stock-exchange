// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import TutorialLayer from './TutorialLayer'
import type { Step } from '../runtime/types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const wait = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)))

function visible(el: HTMLElement, box = { left: 100, top: 100, width: 120, height: 40 }) {
  el.getBoundingClientRect = () =>
    ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height, toJSON: () => ({}) }) as DOMRect
  return el
}

const cb = () => ({
  onNext: vi.fn(), onClick: vi.fn(), onValue: vi.fn(), onPredict: vi.fn(),
  onRestartStep: vi.fn(), onExit: vi.fn(),
})

let host: HTMLDivElement
let root: Root
const q = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)

beforeEach(() => {
  document.body.innerHTML = ''
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => act(() => root.unmount()))

function render(step: Step, handlers: ReturnType<typeof cb>, picked: number | null = null, isMobile = false) {
  act(() => root.render(<TutorialLayer step={step} picked={picked} isMobile={isMobile} {...handlers} />))
}

describe('TutorialLayer', () => {
  it('next step: Next and Exit buttons call back', () => {
    const h = cb()
    render({ id: 's', snap: 'a', text: 'Hello **you**', advance: { kind: 'next' } }, h)
    expect(document.body.textContent).toContain('Hello you')
    expect(document.querySelector('strong')?.textContent).toBe('you')
    act(() => q('tutorial-next')!.click())
    act(() => q('tutorial-exit')!.click())
    expect(h.onNext).toHaveBeenCalledOnce()
    expect(h.onExit).toHaveBeenCalledOnce()
  })

  it('missing target for > 1s shows a centred Restart this step', async () => {
    const h = cb()
    const t0 = performance.now()
    render({ id: 's', snap: 'a', text: 'Tap Buy', target: 'buy-button', advance: { kind: 'click' } }, h)
    await wait(300)
    // Guard against a stalled host (suspended machine) making 300 ms real time exceed 1 s.
    if (performance.now() - t0 < 900) expect(q('tutorial-restart')).toBeNull()
    await wait(1000)
    const restart = q('tutorial-restart')
    expect(restart).not.toBeNull()
    expect(document.body.textContent).toContain('Tap Buy')
    act(() => restart!.click())
    expect(h.onRestartStep).toHaveBeenCalledOnce()
  })

  it('present target: no fallback, four blockers leave a hole, click advances after the native click', async () => {
    const h = cb()
    const order: string[] = []
    const btn = visible(document.createElement('button'))
    btn.setAttribute('data-tutorial', 'buy-button')
    btn.addEventListener('click', () => order.push('native'))
    document.body.appendChild(btn)
    h.onClick.mockImplementation(() => order.push('advance'))
    render({ id: 's', snap: 'a', target: 'buy-button', advance: { kind: 'click' } }, h)
    await wait(1200)
    expect(q('tutorial-restart')).toBeNull()
    expect(document.querySelectorAll('[data-tutorial-blocker]').length).toBe(4)
    act(() => { btn.click(); btn.click() })
    await wait(10)
    expect(order).toEqual(['native', 'native', 'advance'])
  })

  it('read-only step with a target blocks the target too (single full blocker)', async () => {
    const t = visible(document.createElement('div'))
    t.setAttribute('data-tutorial', 'ticker')
    document.body.appendChild(t)
    render({ id: 's', snap: 'a', text: 'x', target: 'ticker', advance: { kind: 'next' } }, cb())
    await wait(50)
    expect(document.querySelectorAll('[data-tutorial-blocker]').length).toBe(1)
  })

  it('drops the previous step\'s spotlight when the next step has no target', async () => {
    const t = visible(document.createElement('div'))
    t.setAttribute('data-tutorial', 'ticker')
    document.body.appendChild(t)
    const h = cb()
    render({ id: 'a', snap: 'a', text: 'x', target: 'ticker', advance: { kind: 'next' } }, h)
    await wait(50)
    expect(document.querySelectorAll('svg rect[stroke]').length).toBeGreaterThan(0)
    render({ id: 'b', snap: 'a', text: 'y', advance: { kind: 'next' } }, h)
    await wait(50)
    expect(document.querySelectorAll('svg rect[stroke]').length).toBe(0)
  })

  it('keyed click step: only a click on the keyed item advances, and the hole is that item', async () => {
    const h = cb()
    const grid = visible(document.createElement('div'), { left: 100, top: 100, width: 300, height: 80 })
    grid.setAttribute('data-tutorial', 'trade-company')
    const mk = (k: string, left: number) => {
      const b = visible(document.createElement('button'), { left, top: 110, width: 80, height: 30 })
      b.setAttribute('data-tutorial-key', k)
      grid.appendChild(b)
      return b
    }
    const cred = mk('Cred', 110)
    const tcs = mk('TCS', 200)
    document.body.appendChild(grid)
    render({ id: 'k', snap: 'a', target: 'trade-company', targetKey: 'TCS', advance: { kind: 'click' } }, h)
    await wait(50)
    const blockers = [...document.querySelectorAll<HTMLElement>('[data-tutorial-blocker]')]
    expect(blockers.length).toBe(4)
    expect(blockers[2].style.width).toBe('200px') // left blocker ends where TCS starts
    act(() => { cred.click(); grid.click() })
    await wait(10)
    expect(h.onClick).not.toHaveBeenCalled()
    act(() => tcs.click())
    await wait(10)
    expect(h.onClick).toHaveBeenCalledOnce()
  })

  it('targetMobile overrides target on mobile only', async () => {
    const h = cb()
    const desk = visible(document.createElement('div'))
    desk.setAttribute('data-tutorial', 'buy-button')
    document.body.appendChild(desk)
    const step: Step = { id: 'm', snap: 'a', target: 'buy-button', targetMobile: 'hand', advance: { kind: 'click' } }
    render(step, h, null, true)
    await wait(1200)
    expect(q('tutorial-restart')).not.toBeNull() // 'hand' absent on mobile
    act(() => desk.click())
    await wait(10)
    expect(h.onClick).not.toHaveBeenCalled()
    const strip = visible(document.createElement('div'))
    strip.setAttribute('data-tutorial', 'hand')
    document.body.appendChild(strip)
    await wait(50)
    expect(q('tutorial-restart')).toBeNull()
    act(() => strip.click())
    await wait(10)
    expect(h.onClick).toHaveBeenCalledOnce()
  })

  it('targetMobile null: untargeted on mobile, centred with Next, no missing fallback', async () => {
    const h = cb()
    const step: Step = { id: 'n', snap: 'a', text: 'Available shares', target: 'ticker-available', targetMobile: null, advance: { kind: 'next' } }
    render(step, h, null, true)
    await wait(1200)
    expect(q('tutorial-restart')).toBeNull()
    expect(document.querySelectorAll('svg rect[stroke]').length).toBe(0)
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!
    expect(dialog.style.top).toBe('50%')
    expect(q('tutorial-next')).not.toBeNull()
    // same step on desktop still looks for the target
    render(step, h, null, false)
    await wait(1200)
    expect(q('tutorial-restart')).not.toBeNull()
  })

  it('value step reports the range input value on input', async () => {
    const h = cb()
    const wrap = visible(document.createElement('div'))
    wrap.setAttribute('data-tutorial', 'trade-slider')
    const input = document.createElement('input')
    input.type = 'range'; input.max = '100'
    wrap.appendChild(input)
    document.body.appendChild(wrap)
    render({ id: 's', snap: 'a', target: 'trade-slider', advance: { kind: 'value', equals: 40 } }, h)
    await wait(50)
    input.value = '40'
    act(() => { input.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(h.onValue).toHaveBeenCalledWith(40)
  })

  it('predict: options, then feedback + Next once picked', () => {
    const h = cb()
    const step: Step = {
      id: 'p', snap: 'a', text: 'Higher or lower?',
      advance: { kind: 'predict', options: [{ label: 'Higher', correct: true }, { label: 'Lower', correct: false }], right: 'Exactly.', wrong: 'Look again.' },
    }
    render(step, h)
    expect(q('tutorial-next')).toBeNull()
    act(() => q('tutorial-predict-1')!.click())
    expect(h.onPredict).toHaveBeenCalledWith(1)
    render(step, h, 1)
    expect(document.body.textContent).toContain('Look again.')
    expect(q('tutorial-next')).not.toBeNull()
  })

  it('reveal steps show no coachmark text but still offer Exit', () => {
    render({ id: 'r', snap: 'a', text: 'hidden', advance: { kind: 'reveal_end' } }, cb())
    expect(document.body.textContent).not.toContain('hidden')
    expect(q('tutorial-exit')).not.toBeNull()
    expect(q('tutorial-next')).toBeNull()
  })

  it('auto step shows a status chip, no Next', () => {
    render({ id: 'a', snap: 'a', text: 'Meera is trading', advance: { kind: 'auto', delayMs: 1500 } }, cb())
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Meera is trading')
    expect(q('tutorial-next')).toBeNull()
  })
})
