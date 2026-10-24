import type { Chapter } from '../runtime/types'

/** Dev-only harness chapter (registered only when import.meta.env.DEV). */
const smoke: Chapter = {
  id: '_smoke',
  title: 'Smoke test',
  subtitle: 'Harness check: one buy, one bell',
  minutes: 1,
  chips: ['The harness walks every step kind'],
  steps: [
    { id: 'intro', snap: 'start', text: 'Smoke chapter. Press **Next**.', advance: { kind: 'next' } },
    { id: 'open-buy', snap: 'start', target: 'buy-button', text: 'Tap **Buy**.', advance: { kind: 'click' } },
    { id: 'pick-tcs', snap: 'start', target: 'trade-company', targetKey: 'TCS', text: 'Pick **TCS**.', advance: { kind: 'click' } },
    {
      id: 'confirm', snap: 'start', target: 'trade-confirm', text: 'Confirm 1 share.',
      advance: { kind: 'action', expect: { type: 'buy', company_num: 4, quantity: 1 } },
    },
    { id: 'bots', snap: 'bought', text: 'Meera and Arjun pass.', advance: { kind: 'auto', delayMs: 1200 } },
    { id: 'bell', snap: 'bell', advance: { kind: 'reveal_end' } },
  ],
}

export default smoke
