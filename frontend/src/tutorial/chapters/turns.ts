import type { Chapter } from '../runtime/types'

/**
 * Spec Ch 4 — your turn, 3 moves a day (fixture: backend/tutorial/chapters/turns.py).
 * One full round goes round the table seat by seat (You buy, Meera buys,
 * Arjun passes, Kabir plays Loan Stock), the round ticks to 2, then You pass.
 */
const turns: Chapter = {
  id: 'turns',
  title: 'Your turn',
  subtitle: 'Three moves a day, one at a time',
  minutes: 2,
  hookFrom: 'prices',
  chips: [
    'A day is 3 rounds; each round, every seat makes one move in turn',
    'One move = buy one company, sell one company, play one power card, or pass',
    'Who moves first shifts one seat each day',
  ],
  steps: [
    {
      id: 'hook', snap: 'start', target: 'hand',
      text: 'Your **TCS +10** will add 10 to TCS at the bell. You get exactly three chances today to act on that.',
      advance: { kind: 'next' },
    },
    {
      id: 'rounds', snap: 'start', target: 'day-round',
      text: 'Day 1, **round 1 of 3**. Each round, every seat makes one move — you, then Meera, Arjun and Kabir.',
      advance: { kind: 'next' },
    },
    {
      id: 'one-move', snap: 'start', target: 'action-bar',
      text: 'One move is exactly one of: buy one company, sell one company, play one power card, or pass.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-two', snap: 'start',
      text: 'You’d like TCS **and** Infosys this turn. Can one move buy both?',
      advance: {
        kind: 'predict',
        options: [{ label: 'No — one company', correct: true }, { label: 'Yes, both at once', correct: false }],
        right: 'Exactly — and you can’t buy and sell in one move either.',
        wrong: 'Look again — one move is one company; you can’t buy and sell together either.',
      },
    },
    {
      id: 'open-buy', snap: 'start', target: 'buy-button', checkpoint: true,
      text: 'Spend this move on TCS. Tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-tcs', snap: 'start', target: 'trade-company', targetKey: 'TCS',
      text: 'Pick **TCS** — $55 a share.',
      advance: { kind: 'click' },
    },
    {
      id: 'qty', snap: 'start', target: 'trade-slider',
      text: 'Set **4** shares: $220 of your $600.',
      advance: { kind: 'value', equals: 4 },
    },
    {
      id: 'confirm', snap: 'start', target: 'trade-confirm',
      text: 'Confirm — this is your whole move for round 1.',
      advance: { kind: 'action', expect: { type: 'buy', company_num: 4, quantity: 4 } },
    },
    {
      id: 'passed-on', snap: 'bought', target: 'player-board', mobileTab: 'players',
      text: 'Cash $600 → **$380**, 4 TCS. The turn is already **Meera’s** — no second move until round 2.',
      advance: { kind: 'next' },
    },
    {
      id: 'meera-moves', snap: 'bought', mobileTab: 'players',
      text: 'Meera’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'arjun-moves', snap: 'meera', mobileTab: 'players',
      text: 'Meera bought 3 Reliance. Arjun’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'predict-round', snap: 'arjun', target: 'player-board', mobileTab: 'players',
      text: 'Arjun passed. Kabir moves last this round — whose turn comes after Kabir’s?',
      advance: {
        kind: 'predict',
        options: [{ label: 'Yours — round 2', correct: true }, { label: 'Kabir again', correct: false }],
        right: 'Exactly — four moves make a round.',
        wrong: 'Look again — once all four have moved, round 2 starts back at you.',
      },
    },
    {
      id: 'kabir-moves', snap: 'arjun', mobileTab: 'players',
      text: 'Kabir’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'round-two', snap: 'round2', target: 'day-round',
      text: 'All four moved once, so it’s **round 2 of 3** — your turn again.',
      advance: { kind: 'next' },
    },
    {
      id: 'log', snap: 'round2', target: 'log', mobileTab: 'logchat',
      text: 'Round 1 in the log: one line per seat — your buy, Meera’s buy, Arjun’s pass, Kabir’s **Loan Stock**, a power card.',
      advance: { kind: 'next' },
    },
    {
      id: 'timer', snap: 'round2', target: 'timer',
      text: 'Your clock again: **90s** per move. If it runs out, you pass automatically and the move is gone.',
      advance: { kind: 'next' },
    },
    {
      id: 'pass', snap: 'round2', target: 'pass-button',
      text: 'Nothing more to do this round — tap **Pass**. A pass uses up your move too.',
      advance: { kind: 'action', expect: { type: 'pass' } },
    },
    {
      id: 'meera-up', snap: 'passed', target: 'player-board', mobileTab: 'players',
      text: 'Round 2 is Meera’s now. Tomorrow Meera moves first — the seat order shifts one seat every day.',
      advance: { kind: 'next' },
    },
    {
      id: 'free-move', snap: 'passed',
      text: 'One exception: when someone **else** plays a Rights Issue on a company you own, you get an extra, free move. You’ll see it later.',
      advance: { kind: 'next' },
    },
    {
      id: 'next-up', snap: 'passed', target: 'log', mobileTab: 'logchat',
      text: 'Every move lands in this log for all to see. You can’t see their cards — but you can see what they buy.',
      advance: { kind: 'next' },
    },
  ],
}

export default turns
