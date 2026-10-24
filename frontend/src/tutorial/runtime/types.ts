import type { ClientMessage } from '../../types/messages'
import type { MobileTab } from '../../components/game/MobileTabBar'

export type TargetId = 'ticker' | 'ticker-available' | 'hand' | 'player-board' | 'player-self'
  | 'day-round' | 'timer' | 'log' | 'action-bar' | 'buy-button' | 'sell-button' | 'power-panel'
  | 'trade-company' | 'trade-mode' | 'trade-slider' | 'trade-max' | 'trade-ri' | 'trade-confirm'
  | 'reveal-overlay' | 'suspend-list' | 'suspend-confirm' | 'cd-modal' | 'rights-modal' | 'exit'

export type Advance =
  | { kind: 'next' }
  | { kind: 'click' }                                  // click on the spotlit target
  | { kind: 'value'; equals: number }                  // range input at target reaches this value
  | { kind: 'action'; expect: Partial<ClientMessage> } // intercepted send must match (target = the commit control)
  | { kind: 'auto'; delayMs: number }                  // bot turn / pause, input fully blocked
  | { kind: 'predict'; options: { label: string; correct: boolean }[]; right: string; wrong: string }
  | { kind: 'reveal_wait'; at: string }                // wait until CardRevealOverlay reaches stage key
  | { kind: 'reveal_end' }                             // wait for intercepted reveal_complete
  | { kind: 'suspend_end' }                            // wait for intercepted day_start_ready

export interface Step {
  id: string
  snap: string
  text?: string
  textMobile?: string
  target?: TargetId
  /** Narrows `target` to the descendant tagged `data-tutorial-key=<key>` (e.g. 'TCS', 'own:0'). */
  targetKey?: string
  /** Overrides `target` when mobile; `null` = untargeted on mobile. `targetKey` still applies. */
  targetMobile?: TargetId | null
  advance: Advance
  holdRevealAt?: string
  mobileTab?: MobileTab
  checkpoint?: boolean
}

export interface Chapter {
  id: string
  title: string
  subtitle: string
  minutes: number
  steps: Step[]
  chips: string[]
  hookFrom?: string
}
