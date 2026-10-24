import type { Chapter } from '../runtime/types'

/**
 * Spec Ch 3 — how prices move (fixture: backend/tutorial/chapters/prices.py).
 * The bell walks companies in ticker order, so YesBank (2nd) is explained
 * before TCS (4th) and Reliance (5th). `revealing_cards:Reliance:2` is
 * Arjun's card, the last of three (order pinned in test_prices_lesson).
 */
const prices: Chapter = {
  id: 'prices',
  title: 'How prices move',
  subtitle: 'Everyone’s cards, one closing bell',
  minutes: 3,
  hookFrom: 'objective',
  chips: [
    'At the bell, everyone’s cards for a company are added to its price',
    'You see your cards, not theirs',
    'A company that hits $0 shuts',
    'Currency + adds 10% to your cash at the bell; Currency − takes 10%',
  ],
  steps: [
    {
      id: 'cards', snap: 'table', target: 'hand',
      text: 'So what moves prices? **Cards** — your **TCS +10** and **Reliance −15** each name a company and an amount. Your **Currency +** works differently; watch for it.',
      textMobile: 'So what moves prices? **Cards** — your **TCS +10** and **RELI −15** each name a company and an amount. Your **FX+** card is a **Currency +**; watch for it.',
      advance: { kind: 'next' },
    },
    {
      id: 'private', snap: 'table', target: 'hand',
      text: 'Only you can see your hand — Meera and Arjun hold cards you can’t see. At the closing bell, **everyone’s** cards for a company are added to its price.',
      advance: { kind: 'next' },
    },
    {
      id: 'pass', snap: 'table', target: 'pass-button',
      text: 'Round 3: your last move today. Tap **Pass** — after Meera and Arjun, the bell rings.',
      advance: { kind: 'action', expect: { type: 'pass' } },
    },
    {
      id: 'bots', snap: 'passed',
      text: 'Meera and Arjun make their last moves…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    // ── The closing bell ──
    { id: 'bell', snap: 'bell', checkpoint: true, advance: { kind: 'reveal_wait', at: 'final_value:YesBank' } },
    {
      id: 'yesbank', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'final_value:YesBank',
      text: 'The bell goes company by company. YesBank took Meera’s −15 and Arjun’s −10: $25 → **$0** — a company at 0 shuts; remember that.',
      advance: { kind: 'next' },
    },
    { id: 'to-tcs', snap: 'bell', advance: { kind: 'reveal_wait', at: 'company_intro:TCS' } },
    {
      id: 'predict-tcs', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'company_intro:TCS',
      text: 'TCS is at $55, and your **+10** is in there. Higher or lower at the bell?',
      advance: {
        kind: 'predict',
        options: [{ label: 'Higher', correct: true }, { label: 'Lower', correct: false }],
        right: 'Higher it is — now watch what the others add.',
        wrong: 'It closes higher — now watch what the others add.',
      },
    },
    { id: 'tcs-cards', snap: 'bell', advance: { kind: 'reveal_wait', at: 'final_value:TCS' } },
    {
      id: 'tcs', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'final_value:TCS',
      text: 'Your +10 and Meera’s −5 make **+5**: TCS $55 → **$60**. Your 4 TCS just gained **$20**.',
      advance: { kind: 'next' },
    },
    { id: 'to-reliance', snap: 'bell', advance: { kind: 'reveal_wait', at: 'company_intro:Reliance' } },
    {
      id: 'predict-reliance', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'company_intro:Reliance',
      text: 'Reliance is at $75, and your card here is **−15**. Higher or lower at the bell?',
      advance: {
        kind: 'predict',
        options: [{ label: 'Lower', correct: false }, { label: 'Higher', correct: true }],
        right: 'Exactly — watch your −15 get outweighed.',
        wrong: 'Look again — your −15 is about to be outweighed.',
      },
    },
    { id: 'reliance-cards', snap: 'bell', advance: { kind: 'reveal_wait', at: 'revealing_cards:Reliance:2' } },
    {
      id: 'reliance', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'revealing_cards:Reliance:2',
      text: 'Meera’s +15 and Arjun’s +10 outweigh your −15: **+10**, $75 → **$85**. Your cards are only part of the story.',
      advance: { kind: 'next' },
    },
    { id: 'to-currency', snap: 'bell', advance: { kind: 'reveal_wait', at: 'currency_settlement:-1' } },
    {
      id: 'predict-cash', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'currency_settlement:-1',
      text: 'Last, your **Currency +**. You never played it — what’s your $380 cash after the bell?',
      advance: {
        kind: 'predict',
        options: [{ label: '$380', correct: false }, { label: '$418', correct: true }],
        right: 'Exactly — it pays by itself.',
        wrong: 'Look again — it pays without being played.',
      },
    },
    { id: 'currency-row', snap: 'bell', advance: { kind: 'reveal_wait', at: 'currency_settlement:0' } },
    {
      id: 'currency', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'currency_settlement:0',
      text: '$380 → **$418**: Currency + added 10% to your cash at the bell. Nothing to play — it just happens.',
      advance: { kind: 'next' },
    },
    {
      id: 'mirror', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'currency_settlement:0',
      text: 'So Currency + rewards holding cash. Its mirror, **Currency −**, takes 10% — a reason to spend before the bell.',
      advance: { kind: 'next' },
    },
    { id: 'end', snap: 'bell', advance: { kind: 'reveal_end' } },
  ],
}

export default prices
