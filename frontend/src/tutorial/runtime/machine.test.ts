import { describe, it, expect } from 'vitest'
import type { Chapter, Step } from './types'
import {
  initialRun, reduce, matchesExpected, allows, heldRevealStage, holdsSuspendClose, snapChanged, rewindToCheckpoint,
} from './machine'
import type { ClientMessage } from '../../types/messages'

const buy = (q: number): ClientMessage => ({ type: 'buy', company_num: 4, quantity: q }) as ClientMessage

const mk = (steps: Partial<Step>[]): Chapter => ({
  id: 'c', title: 't', subtitle: 's', minutes: 1, chips: [],
  steps: steps.map((p, i) => ({ id: `s${i}`, snap: 'a', advance: { kind: 'next' }, ...p }) as Step),
})

describe('machine', () => {
  it('next advances only on next steps', () => {
    const ch = mk([{ advance: { kind: 'click' } }, { advance: { kind: 'next' } }, {}])
    let s = initialRun()
    expect(reduce(ch, s, { type: 'next' }).idx).toBe(0)
    s = reduce(ch, s, { type: 'click' })
    expect(s.idx).toBe(1)
    expect(reduce(ch, s, { type: 'click' })).toBe(s)
    expect(reduce(ch, s, { type: 'next' }).idx).toBe(2)
  })

  it('click advances only on click', () => {
    const ch = mk([{ advance: { kind: 'click' } }, {}])
    const s = initialRun()
    expect(reduce(ch, s, { type: 'next' })).toBe(s)
    expect(reduce(ch, s, { type: 'click' }).idx).toBe(1)
  })

  it('action matches by listed fields', () => {
    const ch = mk([{ advance: { kind: 'action', expect: { type: 'buy', company_num: 4, quantity: 10 } } }, {}])
    const s = initialRun()
    expect(reduce(ch, s, { type: 'send', msg: buy(9) }).idx).toBe(0)
    expect(reduce(ch, s, { type: 'send', msg: buy(10) }).idx).toBe(1)
  })

  it('duplicate send advances once', () => {
    const ch = mk([
      { advance: { kind: 'action', expect: { type: 'buy' } } },
      { advance: { kind: 'action', expect: { type: 'sell' } } },
      {},
    ])
    let s = reduce(ch, initialRun(), { type: 'send', msg: buy(1) })
    s = reduce(ch, s, { type: 'send', msg: buy(1) })
    expect(s.idx).toBe(1)
  })

  it('stray reveal_complete ignored', () => {
    const ch = mk([{}, {}])
    const s = initialRun()
    expect(reduce(ch, s, { type: 'send', msg: { type: 'reveal_complete' } as ClientMessage })).toBe(s)
  })

  it('reveal_end and suspend_end advance on their sends', () => {
    const ch = mk([{ advance: { kind: 'reveal_end' } }, { advance: { kind: 'suspend_end' } }, {}])
    let s = reduce(ch, initialRun(), { type: 'send', msg: { type: 'reveal_complete' } as ClientMessage })
    expect(s.idx).toBe(1)
    s = reduce(ch, s, { type: 'send', msg: { type: 'day_start_ready' } as ClientMessage })
    expect(s.idx).toBe(2)
  })

  it('auto advances on auto_elapsed', () => {
    const ch = mk([{ advance: { kind: 'auto', delayMs: 10 } }, {}])
    expect(reduce(ch, initialRun(), { type: 'auto_elapsed' }).idx).toBe(1)
  })

  it('predict requires pick then next', () => {
    const ch = mk([
      { advance: { kind: 'predict', options: [{ label: 'a', correct: true }, { label: 'b', correct: false }], right: 'r', wrong: 'w' } },
      {},
    ])
    let s = initialRun()
    expect(reduce(ch, s, { type: 'next' })).toBe(s)
    s = reduce(ch, s, { type: 'predict', option: 1 })
    expect(s).toEqual({ idx: 0, picked: 1, done: false })
    expect(reduce(ch, s, { type: 'predict', option: 0 })).toBe(s)
    s = reduce(ch, s, { type: 'next' })
    expect(s.idx).toBe(1)
    expect(s.picked).toBeNull()
  })

  it('value advances only when value equals', () => {
    const ch = mk([{ advance: { kind: 'value', equals: 7 } }, {}])
    const s = initialRun()
    expect(reduce(ch, s, { type: 'value', value: 6 })).toBe(s)
    expect(reduce(ch, s, { type: 'value', value: 7 }).idx).toBe(1)
  })

  it('reveal_wait advances on matching stage key only', () => {
    const ch = mk([{ advance: { kind: 'reveal_wait', at: 'final_value' } }, {}])
    const s = initialRun()
    expect(reduce(ch, s, { type: 'reveal_stage', key: 'company_intro' })).toBe(s)
    expect(reduce(ch, s, { type: 'reveal_stage', key: 'final_value' }).idx).toBe(1)
  })

  it('past the last step sets done', () => {
    const ch = mk([{}])
    const s = reduce(ch, initialRun(), { type: 'next' })
    expect(s.done).toBe(true)
    expect(reduce(ch, s, { type: 'next' })).toBe(s)
  })

  it('heldRevealStage', () => {
    const [a, b, c] = mk([
      { advance: { kind: 'reveal_wait', at: 'x' } },
      { holdRevealAt: 'y' },
      {},
    ]).steps
    expect(heldRevealStage(a)).toBe('x')
    expect(heldRevealStage(b)).toBe('y')
    expect(heldRevealStage(c)).toBeNull()
  })

  it('allows: action match, pong, chat, leave_room', () => {
    const [st, nx] = mk([{ advance: { kind: 'action', expect: { type: 'buy', quantity: 10 } } }, {}]).steps
    expect(allows(st, buy(10))).toBe(true)
    expect(allows(st, buy(9))).toBe(false)
    expect(allows(nx, buy(10))).toBe(false)
    for (const t of ['pong', 'chat', 'leave_room']) {
      expect(allows(nx, { type: t } as unknown as ClientMessage)).toBe(true)
    }
  })

  it('matchesExpected deep-equals listed keys', () => {
    expect(matchesExpected({ type: 'buy' }, buy(1))).toBe(true)
    expect(matchesExpected({ type: 'sell' }, buy(1))).toBe(false)
  })

  it('snapChanged', () => {
    const ch = mk([{ snap: 'a' }, { snap: 'a' }, { snap: 'b' }])
    expect(snapChanged(ch, 0, 1)).toBe(false)
    expect(snapChanged(ch, 1, 2)).toBe(true)
  })

  it('rewindToCheckpoint', () => {
    const ch = mk([{}, {}, {}, { checkpoint: true }, {}, {}])
    expect(rewindToCheckpoint(ch, 5)).toBe(3)
    expect(rewindToCheckpoint(ch, 2)).toBe(0)
    expect(rewindToCheckpoint(mk([{}, {}]), 1)).toBe(0)
  })

  it('share-suspend overlay is held open on every step except suspend_end', () => {
    const step = (advance: Step['advance']) => ({ id: 'x', snap: 'a', advance }) as Step
    expect(holdsSuspendClose(step({ kind: 'next' }))).toBe(true)
    expect(holdsSuspendClose(step({ kind: 'action', expect: { type: 'share_suspend' } }))).toBe(true)
    expect(holdsSuspendClose(step({ kind: 'auto', delayMs: 1 }))).toBe(true)
    expect(holdsSuspendClose(step({ kind: 'suspend_end' }))).toBe(false)
  })
})

describe('registered chapters', () => {
  it('every non-final reveal_end is followed by a suspend_end (holdsSuspendClose would hang otherwise)', async () => {
    const { CHAPTERS } = await import('../chapters/index')
    for (const ch of CHAPTERS) {
      ch.steps.forEach((st, i) => {
        if (st.advance.kind !== 'reveal_end' || i === ch.steps.length - 1) return
        const later = ch.steps.slice(i + 1).some((x) => x.advance.kind === 'suspend_end')
        expect(later, `${ch.id}:${st.id}`).toBe(true)
      })
    }
  })
})
