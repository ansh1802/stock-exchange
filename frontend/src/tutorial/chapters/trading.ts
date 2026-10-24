import type { Chapter } from '../runtime/types'

/**
 * Spec Ch 5 — trading (fixture: backend/tutorial/chapters/trading.py).
 * Day 2 (day 1 is real engine history: you hold 10 Vodafone). You move last,
 * so round 1 plays out first: Meera and Arjun pile into TCS (an alliance),
 * Kabir scatters. You read it and buy 7 TCS; in round 2 you sell 5 Vodafone
 * on your −5 card; the bell proves both reads. Bell cards land in seat order
 * (Meera, Arjun, Kabir, You) — the copy names them that way.
 */
const trading: Chapter = {
  id: 'trading',
  title: 'Trading',
  subtitle: 'Read the table, ride the alliance',
  minutes: 4,
  hookFrom: 'turns',
  chips: [
    'Each buy or sell is one company',
    'Watch what others buy — it hints at their cards',
  ],
  steps: [
    {
      id: 'hook', snap: 'start', target: 'player-board', mobileTab: 'players',
      text: 'You can’t see their cards — but you can see what they buy. Day 2, and you move last: watch round 1 first.',
      advance: { kind: 'next' },
    },
    {
      id: 'meera-moves', snap: 'start', mobileTab: 'players',
      text: 'Meera’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'arjun-moves', snap: 'meera', mobileTab: 'players',
      text: 'Meera bought 4 TCS. Arjun’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'kabir-moves', snap: 'arjun', mobileTab: 'players',
      text: 'Arjun bought 5 TCS. Kabir’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'log', snap: 'you1', target: 'log', mobileTab: 'logchat',
      text: 'Round 1 in the log: Meera **4 TCS**, Arjun **5 TCS**, Kabir **4 Cred**.',
      advance: { kind: 'next' },
    },
    {
      id: 'board', snap: 'you1', target: 'player-board', mobileTab: 'players',
      text: 'The player board shows the same: two players now hold TCS, and Kabir went elsewhere.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-alliance', snap: 'you1', target: 'player-board', mobileTab: 'players',
      text: 'Meera and Arjun both chose TCS. What cards do they probably hold?',
      advance: {
        kind: 'predict',
        options: [{ label: '+ TCS cards', correct: true }, { label: '− TCS cards', correct: false }],
        right: 'Exactly — two players piling in is an alliance. Their cards push TCS up alongside yours.',
        wrong: 'Look again — nobody buys what they expect to fall. They likely hold + TCS: an alliance.',
      },
    },
    {
      id: 'predict-rise', snap: 'you1', target: 'hand',
      text: 'You hold **TCS +10** and **Infosys +10**. Which will rise more at the bell?',
      textMobile: 'You hold **TCS +10** and **INFO +10** (Infosys). Which will rise more at the bell?',
      advance: {
        kind: 'predict',
        options: [{ label: 'TCS', correct: true }, { label: 'Infosys', correct: false }],
        right: 'That’s the read — nobody is backing Infosys.',
        wrong: 'Look again — the alliance’s cards stack on your TCS +10; nobody backs Infosys.',
      },
    },
    {
      id: 'open-buy', snap: 'you1', target: 'buy-button', checkpoint: true,
      text: 'One move, and a buy is one company — make it TCS. Tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-tcs', snap: 'you1', target: 'trade-company', targetKey: 'TCS',
      text: 'Pick **TCS** — $55 a share.',
      advance: { kind: 'click' },
    },
    {
      id: 'qty', snap: 'you1', target: 'trade-slider',
      text: 'Drag to **7**, your Max. Max is what your cash buys or what the bank has left — here $400 ÷ $55 runs out first.',
      advance: { kind: 'value', equals: 7 },
    },
    {
      id: 'confirm', snap: 'you1', target: 'trade-confirm',
      text: 'Balance after: **$15** — not one Infosys share at $80. Your cash backs one real position; confirm it.',
      advance: { kind: 'action', expect: { type: 'buy', company_num: 4, quantity: 7 } },
    },
    {
      id: 'round2-bots', snap: 'bought', mobileTab: 'logchat',
      text: 'Round 2: Meera, Arjun and Kabir move…',
      advance: { kind: 'auto', delayMs: 2000 },
    },
    {
      id: 'round2-log', snap: 'you2', target: 'log', mobileTab: 'logchat',
      text: 'Meera added **2 TCS**, Arjun passed, Kabir bought **3 YesBank** — scattered again.',
      advance: { kind: 'next' },
    },
    {
      id: 'vodafone-card', snap: 'you2', target: 'hand',
      text: 'Your **Vodafone −5** will pull Vodafone down at the bell — and you hold 10 Vodafone from yesterday.',
      textMobile: 'Your **VODA −5** will pull Vodafone down at the bell — and you hold 10 Vodafone from yesterday.',
      advance: { kind: 'next' },
    },
    {
      id: 'open-sell', snap: 'you2', target: 'sell-button', checkpoint: true,
      text: 'Act on that card this move — tap **Sell**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-vodafone', snap: 'you2', target: 'trade-company', targetKey: 'Vodafone',
      text: 'Pick **Vodafone** — $30 a share.',
      textMobile: 'Pick **VODA** (Vodafone) — $30 a share.',
      advance: { kind: 'click' },
    },
    {
      id: 'sell-qty', snap: 'you2', target: 'trade-slider',
      text: 'When selling, Max is what you own: **10**. Sell **5** — cards you can’t see could still lift it.',
      advance: { kind: 'value', equals: 5 },
    },
    {
      id: 'ri', snap: 'you2', target: 'trade-ri',
      text: 'The **RI** button sizes a trade to keep cash for a Rights Issue — you’ll use it in that chapter.',
      advance: { kind: 'next' },
    },
    {
      id: 'confirm-sell', snap: 'you2', target: 'trade-confirm',
      text: 'Confirm: 5 × $30 = **$150** back, cash $15 → $165.',
      advance: { kind: 'action', expect: { type: 'sell', company_num: 1, quantity: 5 } },
    },
    {
      id: 'round3-bots', snap: 'sold', mobileTab: 'logchat',
      text: 'Round 3: Meera, Arjun and Kabir move…',
      advance: { kind: 'auto', delayMs: 2000 },
    },
    {
      id: 'before-bell', snap: 'you3', target: 'player-self', mobileTab: 'players',
      text: 'All three passed. Your net worth going into the bell: **$700**.',
      advance: { kind: 'next' },
    },
    {
      id: 'pass', snap: 'you3', target: 'pass-button',
      text: 'Your last move today — tap **Pass**. Then the bell rings.',
      advance: { kind: 'action', expect: { type: 'pass' } },
    },
    // ── The closing bell ──
    { id: 'bell', snap: 'bell', checkpoint: true, advance: { kind: 'reveal_wait', at: 'final_value:Vodafone' } },
    {
      id: 'vodafone', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'final_value:Vodafone',
      text: 'Your −5: Vodafone $30 → **$25**. The 5 you sold dodged it — **$25** kept.',
      advance: { kind: 'next' },
    },
    { id: 'to-tcs', snap: 'bell', advance: { kind: 'reveal_wait', at: 'final_value:TCS' } },
    {
      id: 'tcs', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'final_value:TCS',
      text: 'Meera’s +10, Arjun’s +5 and your +10: **+25**, TCS $55 → **$80**. The alliance was real.',
      advance: { kind: 'next' },
    },
    { id: 'to-infosys', snap: 'bell', advance: { kind: 'reveal_wait', at: 'company_intro:Infosys' } },
    {
      id: 'predict-infosys', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'company_intro:Infosys',
      text: 'Infosys is at $80, and your **+10** is in. Where does it close?',
      advance: {
        kind: 'predict',
        options: [{ label: '$90', correct: false }, { label: 'Below $90', correct: true }],
        right: 'Exactly — someone holds a card against it.',
        wrong: 'Not this time — someone holds a card against it.',
      },
    },
    { id: 'infosys-cards', snap: 'bell', advance: { kind: 'reveal_wait', at: 'final_value:Infosys' } },
    {
      id: 'infosys', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'final_value:Infosys',
      text: 'Kabir’s −5 against your +10: only **+5**, Infosys $80 → **$85**. Nobody backed it.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-worth', snap: 'bell', target: 'reveal-overlay', holdRevealAt: 'final_value:Infosys',
      text: 'You went into the bell at **$700**. Where did it leave you?',
      advance: {
        kind: 'predict',
        options: [{ label: '$825', correct: false }, { label: '$850', correct: true }],
        right: 'Exactly — +$175 on TCS, and only −$25 on the 5 Vodafone you kept.',
        wrong: 'Not this time — $825 is if you’d kept all 10 Vodafone. Selling 5 made it $850.',
      },
    },
    { id: 'end', snap: 'bell', advance: { kind: 'reveal_end' } },
    { id: 'standings', snap: 'after', advance: { kind: 'suspend_end' } },
    {
      id: 'worth', snap: 'after', target: 'player-self', mobileTab: 'players',
      text: 'Net worth $700 → **$850** — top of the table. You read the alliance and rode it.',
      advance: { kind: 'next' },
    },
    {
      id: 'bluff', snap: 'after', target: 'player-board', mobileTab: 'players',
      text: 'Here the hint was right, but it can mislead: someone may buy to bluff, or to reach director — you’ll see that later.',
      advance: { kind: 'next' },
    },
    {
      id: 'next-up', snap: 'after', target: 'player-self', mobileTab: 'players',
      text: 'Your Max stopped at 7 because your $400 ran out. Next: a way to raise cash mid-day.',
      advance: { kind: 'next' },
    },
  ],
}

export default trading
