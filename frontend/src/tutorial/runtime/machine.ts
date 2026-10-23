import type { ClientMessage } from '../../types/messages'
import type { Chapter, Step } from './types'

export interface RunState { idx: number; picked: number | null; done: boolean }

export type MachineEvent =
  | { type: 'next' }
  | { type: 'click' }
  | { type: 'send'; msg: ClientMessage }
  | { type: 'auto_elapsed' }
  | { type: 'predict'; option: number }
  | { type: 'reveal_stage'; key: string }
  | { type: 'value'; value: number }

export function initialRun(): RunState {
  return { idx: 0, picked: null, done: false }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every(k => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

export function matchesExpected(expect: Partial<ClientMessage>, msg: ClientMessage): boolean {
  const m = msg as unknown as Record<string, unknown>
  return Object.entries(expect).every(([k, v]) => deepEqual(v, m[k]))
}

export function allows(step: Step, msg: ClientMessage): boolean {
  const t = (msg as { type: string }).type
  if (t === 'pong' || t === 'chat' || t === 'leave_room') return true
  return step.advance.kind === 'action' && matchesExpected(step.advance.expect, msg)
}

export function heldRevealStage(step: Step): string | null {
  return step.holdRevealAt ?? (step.advance.kind === 'reveal_wait' ? step.advance.at : null)
}

export function snapChanged(ch: Chapter, fromIdx: number, toIdx: number): boolean {
  return ch.steps[fromIdx]?.snap !== ch.steps[toIdx]?.snap
}

export function rewindToCheckpoint(ch: Chapter, idx: number): number {
  for (let i = Math.min(idx, ch.steps.length - 1); i >= 0; i--) {
    if (ch.steps[i].checkpoint) return i
  }
  return 0
}

function advanceFrom(ch: Chapter, s: RunState): RunState {
  const idx = s.idx + 1
  return idx >= ch.steps.length ? { idx: s.idx, picked: null, done: true } : { idx, picked: null, done: false }
}

export function reduce(ch: Chapter, s: RunState, e: MachineEvent): RunState {
  if (s.done) return s
  const step = ch.steps[s.idx]
  if (!step) return s
  const a = step.advance
  switch (e.type) {
    case 'next':
      if (a.kind === 'next' || (a.kind === 'predict' && s.picked !== null)) return advanceFrom(ch, s)
      return s
    case 'click':
      return a.kind === 'click' ? advanceFrom(ch, s) : s
    case 'auto_elapsed':
      return a.kind === 'auto' ? advanceFrom(ch, s) : s
    case 'predict':
      if (a.kind !== 'predict' || s.picked !== null || e.option < 0 || e.option >= a.options.length) return s
      return { ...s, picked: e.option }
    case 'value':
      return a.kind === 'value' && a.equals === e.value ? advanceFrom(ch, s) : s
    case 'reveal_stage':
      return a.kind === 'reveal_wait' && a.at === e.key ? advanceFrom(ch, s) : s
    case 'send': {
      const t = (e.msg as { type: string }).type
      if (a.kind === 'action' && matchesExpected(a.expect, e.msg)) return advanceFrom(ch, s)
      if (a.kind === 'reveal_end' && t === 'reveal_complete') return advanceFrom(ch, s)
      if (a.kind === 'suspend_end' && t === 'day_start_ready') return advanceFrom(ch, s)
      return s
    }
  }
}
