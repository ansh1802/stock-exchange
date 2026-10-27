import type { Chapter } from '../runtime/types'

/**
 * Spec Ch 6 — Loan Stock (fixture: backend/tutorial/chapters/loan_stock.py).
 * Day 2 (day 1 is real engine history: 14 Cred bought, $40 left; Reliance
 * fell to $35). Seats Meera, Arjun, You. Round 1: your Reliance Max is 1, so
 * you close the popup and play Loan Stock (+$85 = 10% of $880, rounded down to
 * a multiple of 5). Round 2: Max is 3 and you buy it. The predict sits before
 * the card is picked — the power panel prints the amount.
 */
const loanStock: Chapter = {
  id: 'loan-stock',
  title: 'Loan Stock',
  subtitle: 'Cash when your cards outrun your wallet',
  minutes: 3,
  hookFrom: 'trading',
  chips: ['Loan Stock: 10% of your net worth in cash, now'],
  steps: [
    {
      id: 'hook', snap: 'start', target: 'player-self', mobileTab: 'players',
      text: 'Your slider max is limited by cash — and yesterday’s 14 Cred left you **$40**.',
      advance: { kind: 'next' },
    },
    {
      id: 'hand', snap: 'start', target: 'hand',
      text: 'Today’s hand: **Reliance +20** — and Reliance fell to **$35** at yesterday’s bell.',
      textMobile: 'Today’s hand: **RELI +20** (Reliance) — and Reliance fell to **$35** at yesterday’s bell.',
      advance: { kind: 'next' },
    },
    {
      id: 'meera-moves', snap: 'start', mobileTab: 'players',
      text: 'Meera’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'arjun-moves', snap: 'meera', mobileTab: 'players',
      text: 'Meera bought 2 Infosys. Arjun’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'open-buy', snap: 'you1', target: 'buy-button', checkpoint: true,
      text: 'Arjun bought 5 Vodafone. Your move — tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-reliance', snap: 'you1', target: 'trade-company', targetKey: 'Reliance',
      text: 'Pick **Reliance** — $35 a share.',
      textMobile: 'Pick **RELI** (Reliance) — $35 a share.',
      advance: { kind: 'click' },
    },
    {
      id: 'small-max', snap: 'you1', target: 'trade-max',
      text: '**Max 1**: your $40 buys one share. One share is all your +20 would ride on.',
      advance: { kind: 'next' },
    },
    {
      id: 'close', snap: 'you1', target: 'trade-close',
      text: 'Not worth your move. Close the popup — a card in your hand fixes this.',
      advance: { kind: 'click' },
    },
    {
      id: 'loan-card', snap: 'you1', target: 'hand', targetKey: 'LoanStock',
      text: 'Your **Loan Stock** pays cash right now, without selling anything — and you never pay it back.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-loan', snap: 'you1', target: 'player-self', mobileTab: 'players',
      text: 'Cash **$40**, net worth **$880**. How much will Loan Stock pay?',
      advance: {
        kind: 'predict',
        options: [
          { label: '$4', correct: false },
          { label: '$85', correct: true },
          { label: '$100', correct: false },
        ],
        right: 'Exactly — 10% of your $880 net worth is $88, rounded down to a multiple of $5.',
        wrong: 'Not quite — it’s 10% of your **net worth**: $88, rounded down to a multiple of $5 = **$85**.',
      },
    },
    {
      id: 'pick-loan', snap: 'you1', target: 'hand', targetKey: 'LoanStock', checkpoint: true,
      text: 'Tap the **Loan Stock** card.',
      advance: { kind: 'click' },
    },
    {
      id: 'use', snap: 'you1', target: 'power-panel', targetKey: 'use',
      text: 'The panel agrees: **+$85**. Tap **Use** — playing a power card is your whole move this round.',
      advance: { kind: 'action', expect: { type: 'loan_stock' } },
    },
    {
      id: 'loaned', snap: 'loaned', target: 'player-self', mobileTab: 'players',
      text: 'Cash $40 → **$125**. That was your move — no trade this round.',
      advance: { kind: 'next' },
    },
    {
      id: 'round2-bots', snap: 'loaned', mobileTab: 'logchat',
      text: 'Round 2: Meera and Arjun move…',
      advance: { kind: 'auto', delayMs: 2000 },
    },
    {
      id: 'open-buy2', snap: 'you2', target: 'buy-button', checkpoint: true,
      text: 'Both passed. Your move — tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-reliance2', snap: 'you2', target: 'trade-company', targetKey: 'Reliance',
      text: '**Reliance** again — still $35.',
      textMobile: '**RELI** (Reliance) again — still $35.',
      advance: { kind: 'click' },
    },
    {
      id: 'qty', snap: 'you2', target: 'trade-slider',
      text: 'Same slider, new ceiling: Max is now **3** — $125 ÷ $35. Drag to **3**.',
      advance: { kind: 'value', equals: 3 },
    },
    {
      id: 'confirm', snap: 'you2', target: 'trade-confirm',
      text: 'Confirm: 3 × $35 = **$105**, leaving $20.',
      advance: { kind: 'action', expect: { type: 'buy', company_num: 5, quantity: 3 } },
    },
    {
      id: 'next-up', snap: 'bought', target: 'player-self', mobileTab: 'players',
      text: '**3 Reliance** on your +20 instead of 1. Next: cash isn’t the only thing a power card can rescue.',
      advance: { kind: 'next' },
    },
  ],
}

export default loanStock
