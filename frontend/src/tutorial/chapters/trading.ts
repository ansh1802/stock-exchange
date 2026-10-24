import type { Chapter } from '../runtime/types'

/**
 * Spec Ch 5 — trading (fixture: backend/tutorial/chapters/trading.py).
 * You move last on day 1, so round 1 plays out first: Meera and Arjun pile
 * into TCS (an alliance), Kabir scatters. You read it, buy 10 TCS, hedge by
 * selling 2 in round 2, and the bell proves the read. Bell cards land in
 * seat order (Meera, Arjun, Kabir, You) — the copy names them that way.
 */
const trading: Chapter = {
  id: 'trading',
  title: 'Trading',
  subtitle: 'Read the table, ride the alliance',
  minutes: 4,
  hookFrom: 'turns',
  chips: [
    'One move = one company',
    'Watch what others buy — it hints at their cards',
  ],
  steps: [
    {
      id: 'hook', snap: 'start', target: 'player-board', mobileTab: 'players',
      text: 'You can’t see their cards — but you can see what they buy. Today you move last, so watch round 1 first.',
      advance: { kind: 'next' },
    },
    {
      id: 'meera-moves', snap: 'start', mobileTab: 'players',
      text: 'Meera’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'arjun-moves', snap: 'meera', mobileTab: 'players',
      text: 'Meera bought 6 TCS. Arjun’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'kabir-moves', snap: 'arjun', mobileTab: 'players',
      text: 'Arjun bought 5 TCS. Kabir’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'log', snap: 'you1', target: 'log', mobileTab: 'logchat',
      text: 'Round 1 in the log: Meera **6 TCS**, Arjun **5 TCS**, Kabir **5 Vodafone**.',
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
      text: 'One move = one company. Put it on TCS — tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-tcs', snap: 'you1', target: 'trade-company', targetKey: 'TCS',
      text: 'Pick **TCS** — $55 a share.',
      advance: { kind: 'click' },
    },
    {
      id: 'qty', snap: 'you1', target: 'trade-slider',
      text: 'Drag to **10**, your Max. Max is what your cash buys or what the bank has left — here $600 ÷ $55 runs out first.',
      advance: { kind: 'value', equals: 10 },
    },
    {
      id: 'confirm', snap: 'you1', target: 'trade-confirm',
      text: 'Balance after: **$50** — not one Infosys share at $80. Your cash backs one real position; confirm it.',
      advance: { kind: 'action', expect: { type: 'buy', company_num: 4, quantity: 10 } },
    },
    {
      id: 'round2-bots', snap: 'bought', mobileTab: 'logchat',
      text: 'Round 2: Meera, Arjun and Kabir move…',
      advance: { kind: 'auto', delayMs: 2000 },
    },
    {
      id: 'round2-log', snap: 'you2', target: 'log', mobileTab: 'logchat',
      text: 'Meera added **3 TCS**, Arjun passed, Kabir bought **4 Cred** — scattered again.',
      advance: { kind: 'next' },
    },
    {
      id: 'open-sell', snap: 'you2', target: 'sell-button', checkpoint: true,
      text: 'Two buyers is a strong hint, not proof. Selling a little keeps some cash safe — tap **Sell**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-tcs-sell', snap: 'you2', target: 'trade-company', targetKey: 'TCS',
      text: 'Pick **TCS**.',
      advance: { kind: 'click' },
    },
    {
      id: 'sell-qty', snap: 'you2', target: 'trade-slider',
      text: 'When selling, Max is what you own: **10**. Set **2**.',
      advance: { kind: 'value', equals: 2 },
    },
    {
      id: 'ri', snap: 'you2', target: 'trade-ri',
      text: 'The **RI** button sizes a trade to keep cash for a Rights Issue — you’ll use it in that chapter.',
      advance: { kind: 'next' },
    },
    {
      id: 'confirm-sell', snap: 'you2', target: 'trade-confirm',
      text: 'Confirm: 2 × $55 = **$110** back, cash $50 → $160.',
      advance: { kind: 'action', expect: { type: 'sell', company_num: 4, quantity: 2 } },
    },
    {
      id: 'round3-bots', snap: 'sold', mobileTab: 'logchat',
      text: 'Round 3: Meera, Arjun and Kabir move…',
      advance: { kind: 'auto', delayMs: 2000 },
    },
    {
      id: 'before-bell', snap: 'you3', target: 'player-self', mobileTab: 'players',
      text: 'All three passed. Your net worth: **$600** — $160 cash + 8 TCS × $55.',
      advance: { kind: 'next' },
    },
    {
      id: 'pass', snap: 'you3', target: 'pass-button',
      text: 'Your last move today — tap **Pass**. Then the bell rings.',
      advance: { kind: 'action', expect: { type: 'pass' } },
    },
    // ── The closing bell ──
    { id: 'bell', snap: 'bell', checkpoint: true, advance: { kind: 'reveal_wait', at: 'final_value:TCS' } },
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
      text: 'Before the bell your net worth was **$600**. What is it now?',
      advance: {
        kind: 'predict',
        options: [{ label: '$800', correct: true }, { label: '$850', correct: false }],
        right: 'Exactly — 8 TCS × $80 + $160 cash.',
        wrong: 'Not this time — you sold 2, so it’s 8 TCS × $80 + $160 cash.',
      },
    },
    { id: 'end', snap: 'bell', advance: { kind: 'reveal_end' } },
    { id: 'standings', snap: 'after', advance: { kind: 'suspend_end' } },
    {
      id: 'worth', snap: 'after', target: 'player-self', mobileTab: 'players',
      text: 'Net worth $600 → **$800**: your 8 TCS gained **$200**. You read the alliance and rode it.',
      advance: { kind: 'next' },
    },
    {
      id: 'bluff', snap: 'after', target: 'player-board', mobileTab: 'players',
      text: 'Here the hint was right, but it can mislead: someone may buy to bluff, or to reach director — you’ll see that later.',
      advance: { kind: 'next' },
    },
    {
      id: 'next-up', snap: 'after', target: 'player-self', mobileTab: 'players',
      text: 'Your Max stopped at 10 because your $600 ran out. Next: a way to raise cash mid-day.',
      advance: { kind: 'next' },
    },
  ],
}

export default trading
