import type { Chapter } from '../runtime/types'

/**
 * Spec Ch 7 — Debenture (fixture: backend/tutorial/chapters/debenture.py).
 * Day 1 (engine history) took YesBank $25 → $0 with your 10 shares in it.
 * Day 2, round 3: YesBank can't be bought; you pass and the bell lands
 * Arjun's +5 and your +10 on it — still $0 → $0. Day 3: you play the
 * Debenture (YesBank reopens at its $25 base value, net worth $400 → $650),
 * then buy 16 YesBank next round. The DebentureOverlay fires off the log line
 * "You: YesBank reopened at 25." (last line of the `reopened` snapshot).
 * Engine truth: shut shares *can* be sold — for $0 — so the copy says
 * "can't be bought", not "can't be traded".
 */
const debenture: Chapter = {
  id: 'debenture',
  title: 'Debenture',
  subtitle: 'Bringing a shut company back',
  minutes: 4,
  hookFrom: 'loan-stock',
  chips: ['A shut company is frozen at $0 — no buying, no cards — until a Debenture reopens it at its starting price'],
  steps: [
    {
      id: 'hook', snap: 'start', target: 'ticker', targetKey: 'YesBank',
      text: 'Remember the company that hit $0 at the bell? Yesterday it was YesBank: **BANKRUPT** — bankrupt, so it shuts.',
      advance: { kind: 'next' },
    },
    {
      id: 'dead-shares', snap: 'start', target: 'player-self', mobileTab: 'players',
      text: 'You still hold **10 YesBank**, but the board counts them **$0** — your **$400** net worth is all cash.',
      advance: { kind: 'next' },
    },
    {
      id: 'open-buy', snap: 'start', target: 'buy-button', checkpoint: true,
      text: 'Round 3, and your **YesBank +10** says buy. Tap **Buy**.',
      textMobile: 'Round 3, and your **YESB +10** (YesBank) says buy. Tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'greyed', snap: 'start', target: 'trade-company',
      text: 'YesBank is greyed out: a shut company can’t be bought. Selling its shares would pay $0 each.',
      textMobile: '**YESB** (YesBank) is greyed out: a shut company can’t be bought. Selling its shares would pay $0 each.',
      advance: { kind: 'next' },
    },
    {
      id: 'close', snap: 'start', target: 'trade-close',
      text: 'Nothing else to buy — your Vodafone −5 is why you sold Vodafone this morning. Close the popup.',
      textMobile: 'Nothing else to buy — your VODA −5 is why you sold Vodafone this morning. Close the popup.',
      advance: { kind: 'click' },
    },
    {
      id: 'pass', snap: 'start', target: 'pass-button',
      text: 'Tap **Pass** — you move last, so the bell rings.',
      advance: { kind: 'action', expect: { type: 'pass' } },
    },
    // ── The closing bell: YesBank's cards land, its price doesn't move ──
    { id: 'bell', snap: 'bell', checkpoint: true, advance: { kind: 'reveal_wait', at: 'company_intro:YesBank' } },
    {
      id: 'predict-yesbank', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'company_intro:YesBank',
      text: 'YesBank is shut at $0, and your **+10** is in there. Where does it close?',
      advance: {
        kind: 'predict',
        options: [{ label: '$10 or more', correct: false }, { label: '$0', correct: true }],
        right: 'Exactly — a shut company ignores cards. Watch.',
        wrong: 'Not this time — a shut company ignores cards. Watch.',
      },
    },
    { id: 'yesbank-cards', snap: 'bell', advance: { kind: 'reveal_wait', at: 'final_value:YesBank' } },
    {
      id: 'frozen', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'final_value:YesBank',
      text: 'Arjun’s +5 and your +10: delta **+15**, yet **$0 → $0**. A shut company’s cards are revealed but never count.',
      advance: { kind: 'next' },
    },
    {
      id: 'until', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'final_value:YesBank',
      text: 'It stays shut, bell after bell, until someone plays a **Debenture** on it.',
      advance: { kind: 'next' },
    },
    { id: 'end', snap: 'bell', advance: { kind: 'reveal_end' } },
    { id: 'standings', snap: 'after', advance: { kind: 'suspend_end' } },
    {
      id: 'arjun-moves', snap: 'after', mobileTab: 'players',
      text: 'Day 3 — Arjun moves first…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'debenture-card', snap: 'you3', target: 'hand', targetKey: 'Debenture',
      text: 'Arjun bought 4 Cred. Your new hand has a **Debenture** — it reopens a shut company.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-price', snap: 'you3', target: 'ticker', targetKey: 'YesBank',
      text: 'Play it on YesBank. At what price does YesBank reopen?',
      advance: {
        kind: 'predict',
        options: [
          { label: '$15', correct: false },
          { label: '$25', correct: true },
          { label: '$35', correct: false },
        ],
        right: 'Exactly — $25, YesBank’s starting price. Yesterday’s +15 never counted.',
        wrong: 'Not this time — it reopens at YesBank’s starting price, **$25**. Yesterday’s +15 never counted.',
      },
    },
    {
      id: 'pick-debenture', snap: 'you3', target: 'hand', targetKey: 'Debenture', checkpoint: true,
      text: 'Tap the **Debenture** card.',
      advance: { kind: 'click' },
    },
    {
      id: 'play', snap: 'you3', target: 'power-panel', targetKey: 'YesBank',
      text: 'Pick **YesBank**, the shut company. Playing the card is your move this round.',
      advance: { kind: 'action', expect: { type: 'debenture', company_num: 2 } },
    },
    {
      id: 'reopening', snap: 'reopened',
      text: 'YesBank reopens…',
      advance: { kind: 'auto', delayMs: 2800 },
    },
    {
      id: 'worth', snap: 'reopened', target: 'player-self', mobileTab: 'players',
      text: 'YesBank **$0 → $25**: your 10 shares are worth **$250** again. Net worth $400 → **$650**, top of the table.',
      advance: { kind: 'next' },
    },
    {
      id: 'round2-bots', snap: 'reopened', mobileTab: 'logchat',
      text: 'Meera, then Arjun, move…',
      advance: { kind: 'auto', delayMs: 2000 },
    },
    {
      id: 'open-buy2', snap: 'you4', target: 'buy-button', checkpoint: true,
      text: 'Round 2: YesBank trades again. Tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-yesbank', snap: 'you4', target: 'trade-company', targetKey: 'YesBank',
      text: '**YesBank** is back in the list — $25 a share.',
      textMobile: '**YESB** (YesBank) is back in the list — $25 a share.',
      advance: { kind: 'click' },
    },
    {
      id: 'qty', snap: 'you4', target: 'trade-slider',
      text: 'Your $400 sets the slider’s Max: **16**. Drag to 16.',
      advance: { kind: 'value', equals: 16 },
    },
    {
      id: 'confirm', snap: 'you4', target: 'trade-confirm',
      text: 'Confirm: 16 × $25 = **$400**.',
      advance: { kind: 'action', expect: { type: 'buy', company_num: 2, quantity: 16 } },
    },
    {
      id: 'counts', snap: 'bought', target: 'hand',
      text: 'YesBank is open, so at today’s bell its cards count again — your **YesBank +5** included.',
      textMobile: 'YesBank is open, so at today’s bell its cards count again — your **YESB +5** included.',
      advance: { kind: 'next' },
    },
    {
      id: 'next-up', snap: 'bought', target: 'ticker', targetKey: 'YesBank',
      text: 'Trading only happens at today’s price. Next: a Rights Issue gets you shares at half price.',
      advance: { kind: 'next' },
    },
  ],
}

export default debenture
