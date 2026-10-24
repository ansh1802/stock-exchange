import type { Chapter } from '../runtime/types'

/**
 * Spec Ch 8 — Rights Issue, two parts (fixture: backend/tutorial/chapters/rights_issue.py).
 * Day 3, seats Arjun, Kabir, You, Meera; you hold 6 YesBank and $450.
 * 8a: round 1 the RI button buys 6 TCS ($330), keeping $120 for the issue
 *     (3 × $25 = $75; Max 8 would leave $10). Round 2 you play Rights Issue
 *     on TCS: $55 → $25, you buy 3, TCS restores to $55: net worth $660 → $750.
 * 8b: round 3 Arjun plays Rights Issue on YesBank ($35 → $15). Queue Arjun,
 *     You — Kabir and Meera hold none. You buy 3 with your last $45; YesBank
 *     restores: $750 → $810. Then Kabir's normal move, then yours (you pass).
 * The RightsIssueOverlay plays on entering the rights_issue phase (GameBoard),
 * and hides the modal for 2.5 s — hence the 2.8 s auto steps.
 */
const rightsIssue: Chapter = {
  id: 'rights-issue',
  title: 'Rights Issue',
  subtitle: 'Half-price shares — yours and theirs',
  minutes: 5,
  hookFrom: 'debenture',
  chips: [
    'Rights Issue: own it, keep cash, then play it — every holder buys up to half their shares at half price',
    'Someone else’s Rights Issue on a company you own = a free move',
  ],
  steps: [
    // ── 8a: you play it ──
    {
      id: 'hook', snap: 'you1', target: 'ticker', targetKey: 'TCS',
      text: 'Trading happens at today’s price: TCS is **$55**. A **Rights Issue** sells shares at half price — but only to players who already own that company.',
      advance: { kind: 'next' },
    },
    {
      id: 'hand', snap: 'you1', target: 'hand', targetKey: 'RightsIssue',
      text: 'You hold a **Rights Issue** and **TCS +10**. To use it on TCS you need two things first: TCS shares, and cash to buy more.',
      advance: { kind: 'next' },
    },
    {
      id: 'open-buy', snap: 'you1', target: 'buy-button', checkpoint: true,
      text: 'Round 1: get both. Tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-tcs', snap: 'you1', target: 'trade-company', targetKey: 'TCS',
      text: 'Pick **TCS** — $55 a share.',
      advance: { kind: 'click' },
    },
    {
      id: 'max', snap: 'you1', target: 'trade-max',
      text: '**Max 8** spends nearly all your cash, leaving too little for the issue.',
      advance: { kind: 'next' },
    },
    {
      id: 'ri-button', snap: 'you1', target: 'trade-ri',
      text: 'Remember the **RI** button from Trading? Tap it: it buys the most TCS that still leaves cash for the full issue.',
      advance: { kind: 'click' },
    },
    {
      id: 'preview', snap: 'you1', target: 'trade-preview',
      text: 'RI picked **6**. Balance after: **$120**, and the issue would cost 3 × $25 = **$75** — covered.',
      advance: { kind: 'next' },
    },
    {
      id: 'price', snap: 'you1', target: 'trade-preview',
      text: '**$25** is the issue price: half of $55, rounded down to a multiple of $5 — never below $5.',
      advance: { kind: 'next' },
    },
    {
      id: 'confirm', snap: 'you1', target: 'trade-confirm',
      text: 'Confirm: 6 × $55 = **$330**.',
      advance: { kind: 'action', expect: { type: 'buy', company_num: 4, quantity: 6 } },
    },
    {
      id: 'round2-bots', snap: 'bought', mobileTab: 'logchat',
      text: 'Meera, then Arjun and Kabir, move…',
      advance: { kind: 'auto', delayMs: 2000 },
    },
    {
      id: 'predict-allowance', snap: 'you2', target: 'player-self', mobileTab: 'players',
      text: 'Round 2. You hold **6 TCS** and **$120**. How many TCS can your Rights Issue sell you?',
      advance: {
        kind: 'predict',
        options: [
          { label: '3 — half of your 6', correct: true },
          { label: '4 — all your $120 buys at $25', correct: false },
          { label: '6 — one per share you hold', correct: false },
        ],
        right: 'Exactly — up to half your holdings, if your cash and the bank’s shares allow.',
        wrong: 'Not this time — you may buy up to half your holdings: **3**.',
      },
    },
    {
      id: 'pick-card', snap: 'you2', target: 'hand', targetKey: 'RightsIssue', checkpoint: true,
      text: 'Tap the **Rights Issue** card.',
      advance: { kind: 'click' },
    },
    {
      id: 'play', snap: 'you2', target: 'power-panel', targetKey: 'TCS',
      text: 'Pick **TCS**. Playing the card is your move this round.',
      advance: { kind: 'action', expect: { type: 'rights_issue', company_num: 4 } },
    },
    {
      id: 'announce', snap: 'ri',
      text: 'Rights Issue on TCS…',
      advance: { kind: 'auto', delayMs: 2800 },
    },
    {
      id: 'issue', snap: 'ri', target: 'rights-modal',
      text: 'TCS sells at **$25** during the issue. You’re the only TCS holder, so the issue is yours alone.',
      advance: { kind: 'next' },
    },
    {
      id: 'max-ri', snap: 'ri', target: 'rights-modal', targetKey: 'max',
      text: 'Max purchase: **3**, half your 6. Tap **Max**.',
      advance: { kind: 'click' },
    },
    {
      id: 'buy-ri', snap: 'ri', target: 'rights-modal', targetKey: 'buy',
      text: 'Buy 3 × $25 = **$75**.',
      advance: { kind: 'action', expect: { type: 'rights_issue_buy', quantity: 3 } },
    },
    {
      id: 'restored', snap: 'ri-done', target: 'player-self', mobileTab: 'players',
      text: 'The issue is over and TCS is back to **$55**, so the 3 shares you bought at $25 gained **$90**. Net worth **$750**, with $45 cash left.',
      advance: { kind: 'next' },
    },
    // ── 8b: someone else plays it ──
    {
      id: 'round3', snap: 'ri-done', mobileTab: 'logchat', checkpoint: true,
      text: 'Meera moves, then Round 3 — Arjun first…',
      advance: { kind: 'auto', delayMs: 2000 },
    },
    {
      id: 'announce-arjun', snap: 'arjun-ri',
      text: 'Arjun plays a Rights Issue…',
      advance: { kind: 'auto', delayMs: 2800 },
    },
    {
      id: 'free-move', snap: 'arjun-ri', target: 'rights-modal',
      text: 'Arjun’s Rights Issue on **YesBank**: **$15** a share. You own 6 YesBank, so here’s the free move promised in Your turn.',
      advance: { kind: 'next' },
    },
    {
      id: 'arjun-buys', snap: 'arjun-ri', target: 'rights-modal',
      text: 'Arjun holds YesBank, so they buy first…',
      advance: { kind: 'auto', delayMs: 2000 },
    },
    {
      id: 'skipped', snap: 'your-issue', target: 'rights-modal',
      text: 'Arjun bought 2. Kabir and Meera hold no YesBank, so they’re skipped — your turn in the issue.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-move', snap: 'your-issue', target: 'rights-modal',
      text: 'Does buying here use up your Round 3 move?',
      advance: {
        kind: 'predict',
        options: [
          { label: 'Yes — a buy is a move', correct: false },
          { label: 'No — my move still comes', correct: true },
        ],
        right: 'Exactly — the issue sits outside the turn order. Your move still comes.',
        wrong: 'Not this time — the issue sits outside the turn order. Your move still comes.',
      },
    },
    {
      id: 'max-free', snap: 'your-issue', target: 'rights-modal', targetKey: 'max',
      text: 'Half your 6 is **3**, and your **$45** covers 3 × $15. Tap **Max**.',
      advance: { kind: 'click' },
    },
    {
      id: 'buy-free', snap: 'your-issue', target: 'rights-modal', targetKey: 'buy',
      text: 'Buy 3 for **$45**.',
      advance: { kind: 'action', expect: { type: 'rights_issue_buy', quantity: 3 } },
    },
    {
      id: 'free-payoff', snap: 'issue-done', target: 'player-self', mobileTab: 'players',
      text: 'YesBank is back to **$35**: your 3 new shares gained **$60**. Net worth **$810**, top of the table.',
      textMobile: '**YESB** (YesBank) is back to **$35**: your 3 new shares gained **$60**. Net worth **$810**, top of the table.',
      advance: { kind: 'next' },
    },
    {
      id: 'kabir', snap: 'issue-done', mobileTab: 'logchat',
      text: 'Turns pick up after Arjun: Kabir’s normal move…',
      advance: { kind: 'auto', delayMs: 1800 },
    },
    {
      id: 'your-move', snap: 'you3', target: 'pass-button',
      text: 'Your Round 3 move is still yours — the issue buy was free. You’re out of cash, so tap **Pass**.',
      advance: { kind: 'action', expect: { type: 'pass' } },
    },
    {
      id: 'next-up', snap: 'passed',
      text: 'Every card so far was played on someone’s turn. One card waits until after the bell — and can undo it.',
      advance: { kind: 'next' },
    },
  ],
}

export default rightsIssue
