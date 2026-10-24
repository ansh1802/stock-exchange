import type { Chapter, Step } from '../runtime/types'

/**
 * Spec Ch 10 — Chairman & Director (fixture: backend/tutorial/chapters/chairman_director.py).
 * One game, days 5–10, one bell per position:
 *   Day 5  buy 5 YesBank → 50, director: discard your −10 ($5 → $10, not $0).
 *   Day 6  100 YesBank, chairman: your −5 + Arjun's −10 ($10 → $20, not $5).
 *   Day 7  buy 100 Cred under Meera's chair → double director: Meera drops her
 *          −5, you drop −10 and −5 ($15 → $40).
 *   Day 8  150 YesBank: chairman (−10 + Arjun's −10), then director (−5): $20 → $30.
 *   Day 9  all 200 YesBank: chairman (−10 + Meera's −10), double director
 *          (−5, −5): $30 → $40. TCS crashes $45 → $5.
 *   Day 10 Meera and Arjun, seated first, buy 150 TCS; your $400 buys 80 but Max is 50.
 * Chairman/director modal keys: `own:<i>` (your cards of that company, in hand
 * order), `other:<playerId>:<i>`, and `confirm`.
 */

const cd = (company: string) => `chairman_director:${company}`

/** A modal step at the company's chairman/director stage (held so the recompute stays on screen). */
function atCd(company: string, step: Omit<Step, 'holdRevealAt'>): Step {
  return { target: 'cd-modal', ...step, holdRevealAt: cd(company) }
}

const chairmanDirector: Chapter = {
  id: 'chairman-director',
  title: 'Chairman & Director',
  subtitle: 'Hold enough shares to shape the bell',
  minutes: 9,
  hookFrom: 'share-suspend',
  chips: [
    'Hold 50 / 100 / 150 / 200 of one company and you get a say in its bell',
    'Director (50+): discard one of your own cards. Chairman (100+, one per company): also remove one of another player’s',
    'Double director (100+ under someone else’s chair): discard up to 2 of your own',
    'Each company has only 200 shares: the bank’s supply, your cash and seat order decide who gets them',
  ],
  steps: [
    // ── Day 5: director ──
    {
      id: 'hook', snap: 'd5', target: 'hand', targetKey: 'YesBank',
      text: 'At the bell, every card for a company counts. What if you could throw some away?',
      advance: { kind: 'next' },
    },
    {
      id: 'your-card', snap: 'd5', target: 'hand', targetKey: 'YesBank',
      text: 'Day 5. You hold **45 YesBank** at **$5** — and this **YesBank −10** will drag it down.',
      textMobile: 'Day 5. You hold **45 YesBank** at **$5** — and this **YESB −10** (YesBank) will drag it down.',
      advance: { kind: 'next' },
    },
    {
      id: 'recall-director', snap: 'd5', target: 'player-self', mobileTab: 'players',
      text: 'Remember: players may buy just to reach **director** — **50** shares of one company. You’re 5 short.',
      advance: { kind: 'next' },
    },
    {
      id: 'open-buy5', snap: 'd5', target: 'buy-button', checkpoint: true,
      text: 'Tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-yesbank', snap: 'd5', target: 'trade-company', targetKey: 'YesBank',
      text: 'Pick **YesBank** — $5 a share.',
      textMobile: 'Pick **YESB** (YesBank) — $5 a share.',
      advance: { kind: 'click' },
    },
    {
      id: 'qty5', snap: 'd5', target: 'trade-slider',
      text: 'Drag to **5** — just enough for 50.',
      advance: { kind: 'value', equals: 5 },
    },
    {
      id: 'confirm5', snap: 'd5', target: 'trade-confirm',
      text: 'Confirm: 5 × $5 = **$25**.',
      advance: { kind: 'action', expect: { type: 'buy', company_num: 2, quantity: 5 } },
    },
    {
      id: 'director-icon', snap: 'd5-bought', target: 'player-self', mobileTab: 'players',
      text: '**50 YesBank**: the director icon appears beside it. Positions change the moment holdings cross 50 or 100.',
      advance: { kind: 'next' },
    },
    {
      id: 'rounds5', snap: 'd5-bought', mobileTab: 'logchat',
      text: 'Rounds 2 and 3 go by…',
      advance: { kind: 'auto', delayMs: 2200 },
    },
    { id: 'bell5', snap: 'bell5', checkpoint: true, advance: { kind: 'reveal_wait', at: 'final_value:YesBank' } },
    {
      id: 'would-crash', snap: 'bell5', target: 'reveal-overlay', holdRevealAt: 'final_value:YesBank',
      text: 'Your −10 and Meera’s +5: YesBank **$5 → $0**, BANKRUPT. But directors act before prices apply.',
      advance: { kind: 'next' },
    },
    { id: 'to-cd5', snap: 'bell5', advance: { kind: 'reveal_wait', at: cd('YesBank') } },
    atCd('YesBank', {
      id: 'cd-director', snap: 'bell5',
      text: 'As director you may discard **one of your own** YesBank cards.',
      advance: { kind: 'next' },
    }),
    atCd('YesBank', {
      id: 'predict-director', snap: 'bell5',
      text: 'Discard your −10: where does YesBank close?',
      advance: {
        kind: 'predict',
        options: [
          { label: '$10', correct: true },
          { label: '$5 — no change', correct: false },
          { label: '$0 — still bankrupt', correct: false },
        ],
        right: 'Exactly — only Meera’s +5 is left.',
        wrong: 'Not this time — only Meera’s +5 is left: **$10**.',
      },
    }),
    atCd('YesBank', {
      id: 'pick-own5', snap: 'bell5', targetKey: 'own:0',
      text: 'Tap your **−10**.',
      advance: { kind: 'click' },
    }),
    atCd('YesBank', {
      id: 'discard5', snap: 'bell5', targetKey: 'confirm',
      text: 'Tap **Confirm Discard**.',
      advance: { kind: 'action', expect: { type: 'chairman_director', discard_own_idx: 0 } },
    }),
    atCd('YesBank', {
      id: 'director-payoff', snap: 'cd5', target: 'reveal-overlay',
      text: 'YesBank **$5 → $10** instead of $0. Your 50 shares are worth **$500**, not nothing.',
      advance: { kind: 'next' },
    }),
    { id: 'end5', snap: 'cd5', advance: { kind: 'reveal_end' } },
    { id: 'standings5', snap: 'd6', advance: { kind: 'suspend_end' } },

    // ── Day 6: chairman ──
    {
      id: 'chairman-crown', snap: 'd6', target: 'player-self', mobileTab: 'players',
      text: 'Day 6: you bought **50 more** YesBank this morning. At **100** you’re its **chairman** — the crown.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-chairman', snap: 'd6', target: 'hand', targetKey: 'YesBank',
      text: 'You hold **YesBank −5**. As chairman, what can you throw away at the bell?',
      textMobile: 'You hold **YESB −5** (YesBank). As chairman, what can you throw away at the bell?',
      advance: {
        kind: 'predict',
        options: [
          { label: 'One of mine and one of theirs', correct: true },
          { label: 'Only my own', correct: false },
        ],
        right: 'Exactly — you see your cards, not theirs. But at the bell a chairman can remove one of theirs.',
        wrong: 'Not this time — you see your cards, not theirs. But at the bell a chairman can remove one of theirs.',
      },
    },
    {
      id: 'arjun-last6', snap: 'd6', mobileTab: 'logchat',
      text: 'Arjun moves last…',
      advance: { kind: 'auto', delayMs: 1800 },
    },
    { id: 'bell6', snap: 'bell6', checkpoint: true, advance: { kind: 'reveal_wait', at: 'final_value:YesBank' } },
    {
      id: 'chairman-sum', snap: 'bell6', target: 'reveal-overlay', holdRevealAt: 'final_value:YesBank',
      text: 'Arjun’s **−10** and your −5 outweigh Meera’s +10: YesBank **$10 → $5**.',
      advance: { kind: 'next' },
    },
    { id: 'to-cd6', snap: 'bell6', advance: { kind: 'reveal_wait', at: cd('YesBank') } },
    atCd('YesBank', {
      id: 'cd-chairman', snap: 'bell6',
      text: 'Top row: your YesBank cards. Bottom row: everyone else’s — remove one.',
      advance: { kind: 'next' },
    }),
    atCd('YesBank', {
      id: 'pick-own6', snap: 'bell6', targetKey: 'own:0',
      text: 'Tap your **−5**…',
      advance: { kind: 'click' },
    }),
    atCd('YesBank', {
      id: 'pick-other6', snap: 'bell6', targetKey: 'other:3:0',
      text: '…and **−10**: Arjun’s card, dragging your company.',
      advance: { kind: 'click' },
    }),
    atCd('YesBank', {
      id: 'predict-chairman-value', snap: 'bell6',
      text: 'Both gone: where does YesBank close?',
      advance: {
        kind: 'predict',
        options: [
          { label: '$20', correct: true },
          { label: '$15', correct: false },
          { label: '$5', correct: false },
        ],
        right: 'Exactly — only Meera’s +10 is left.',
        wrong: 'Not this time — only Meera’s +10 is left: **$20**.',
      },
    }),
    atCd('YesBank', {
      id: 'discard6', snap: 'bell6', targetKey: 'confirm',
      text: 'Tap **Confirm Discard**.',
      advance: {
        kind: 'action',
        expect: { type: 'chairman_director', discard_own_idx: 0, discard_other_player_id: 3, discard_other_idx: 0 },
      },
    }),
    atCd('YesBank', {
      id: 'chairman-payoff', snap: 'cd6', target: 'reveal-overlay',
      text: 'YesBank **$10 → $20**: **+$1,000** on your 100 shares. You’re shaping the bell now, not just reading it.',
      advance: { kind: 'next' },
    }),
    { id: 'end6', snap: 'cd6', advance: { kind: 'reveal_end' } },
    { id: 'standings6', snap: 'd7', advance: { kind: 'suspend_end' } },

    // ── Day 7: double director under Meera's chair ──
    {
      id: 'meera-chair', snap: 'd7', target: 'player-board', mobileTab: 'players',
      text: 'Day 7: Meera holds **100 Cred** — the crown by it makes her its chairman. The bank holds the other 100.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-who', snap: 'd7', target: 'player-board', mobileTab: 'players',
      text: 'If you buy those **100 Cred**, who’s chairman?',
      advance: {
        kind: 'predict',
        options: [
          { label: 'Meera — she got there first', correct: true },
          { label: 'You — the newest 100', correct: false },
        ],
        right: 'Exactly — one chairman per company, and Meera keeps the chair.',
        wrong: 'Not this time — one chairman per company, and Meera keeps the chair.',
      },
    },
    {
      id: 'open-buy7', snap: 'd7', target: 'buy-button', checkpoint: true,
      text: 'You hold **Cred −10** and **Cred −5** — a director can throw those away. Tap **Buy**.',
      textMobile: 'You hold **CRED −10** and **CRED −5** — a director can throw those away. Tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-cred', snap: 'd7', target: 'trade-company', targetKey: 'Cred',
      text: 'Pick **Cred** — $15 a share.',
      textMobile: 'Pick **CRED** (Cred) — $15 a share.',
      advance: { kind: 'click' },
    },
    {
      id: 'qty7', snap: 'd7', target: 'trade-slider',
      text: 'Drag to **100**.',
      advance: { kind: 'value', equals: 100 },
    },
    {
      id: 'confirm7', snap: 'd7', target: 'trade-confirm',
      text: 'Confirm: 100 × $15 = **$1,500**.',
      advance: { kind: 'action', expect: { type: 'buy', company_num: 3, quantity: 100 } },
    },
    {
      id: 'double-icon', snap: 'd7-bought', target: 'player-self', mobileTab: 'players',
      text: 'Two director icons by your Cred: **100** under someone else’s chair makes you a **double director**.',
      advance: { kind: 'next' },
    },
    {
      id: 'rounds7', snap: 'd7-bought', mobileTab: 'logchat',
      text: 'Rounds 2 and 3 go by…',
      advance: { kind: 'auto', delayMs: 2200 },
    },
    { id: 'bell7', snap: 'bell7', checkpoint: true, advance: { kind: 'reveal_wait', at: 'final_value:Cred' } },
    {
      id: 'cred-sum', snap: 'bell7', target: 'reveal-overlay', holdRevealAt: 'final_value:Cred',
      text: 'Every Cred card counted: **$15 → $20**.',
      advance: { kind: 'next' },
    },
    { id: 'to-cd7', snap: 'bell7', advance: { kind: 'reveal_wait', at: cd('Cred') } },
    atCd('Cred', {
      id: 'predict-meera', snap: 'bell7',
      text: 'The chairman acts first. Meera holds Cred −5 and +15 — which way will her move push Cred?',
      advance: {
        kind: 'predict',
        options: [
          { label: 'Up — she holds 100 Cred', correct: true },
          { label: 'Down', correct: false },
        ],
        right: 'Exactly — she holds 100 Cred, so she throws away a card against it.',
        wrong: 'Not this time — she holds 100 Cred, so she throws away a card against it.',
      },
    }),
    atCd('Cred', {
      id: 'meera-decides', snap: 'bell7',
      text: 'Meera decides…',
      advance: { kind: 'auto', delayMs: 2000 },
    }),
    atCd('Cred', {
      id: 'meera-did', snap: 'cd7-meera', target: 'reveal-overlay',
      text: 'Meera discarded her **−5**: Cred **$15 → $25**. Your turn: discard up to **2** of your own.',
      advance: { kind: 'next' },
    }),
    atCd('Cred', {
      id: 'predict-double', snap: 'cd7-meera',
      text: 'Discard both your −10 and −5: where does Cred close?',
      advance: {
        kind: 'predict',
        options: [
          { label: '$40', correct: true },
          { label: '$30', correct: false },
          { label: '$25', correct: false },
        ],
        right: 'Exactly — only Meera’s +15 and Arjun’s +10 are left.',
        wrong: 'Not this time — only Meera’s +15 and Arjun’s +10 are left: **$40**.',
      },
    }),
    atCd('Cred', {
      id: 'pick-double-1', snap: 'cd7-meera', targetKey: 'own:0',
      text: 'Tap **−10**…',
      advance: { kind: 'click' },
    }),
    atCd('Cred', {
      id: 'pick-double-2', snap: 'cd7-meera', targetKey: 'own:1',
      text: '…and **−5**.',
      advance: { kind: 'click' },
    }),
    atCd('Cred', {
      id: 'discard7', snap: 'cd7-meera', targetKey: 'confirm',
      text: 'Tap **Confirm Discard**.',
      advance: { kind: 'action', expect: { type: 'chairman_director', discard_own_idx: [0, 1] } },
    }),
    atCd('Cred', {
      id: 'double-payoff', snap: 'cd7', target: 'reveal-overlay',
      text: 'Cred **$15 → $40**: **+$2,500** on your 100 shares.',
      advance: { kind: 'next' },
    }),
    { id: 'end7', snap: 'cd7', advance: { kind: 'reveal_end' } },
    { id: 'standings7', snap: 'd8', advance: { kind: 'suspend_end' } },

    // ── Day 8: 150 — chairman, then director ──
    {
      id: 'holding-150', snap: 'd8', target: 'player-self', mobileTab: 'players',
      text: 'Day 8: **50 more** YesBank this morning makes **150**. That’s chairman **and** director — chairman first, then director.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-150', snap: 'd8', target: 'hand', targetKey: 'YesBank',
      text: 'You hold **YesBank −10** and **−5**. How many cards can you remove at the bell?',
      textMobile: 'You hold **YESB −10** and **−5** (YesBank). How many cards can you remove at the bell?',
      advance: {
        kind: 'predict',
        options: [
          { label: '3 — two of mine, one of theirs', correct: true },
          { label: '2 — one of mine, one of theirs', correct: false },
        ],
        right: 'Exactly — chairman: one of yours and one of theirs. Then director: one more of yours.',
        wrong: 'Not this time — chairman: one of yours and one of theirs. Then director: one more of yours.',
      },
    },
    {
      id: 'meera-last8', snap: 'd8', mobileTab: 'logchat',
      text: 'Meera moves last…',
      advance: { kind: 'auto', delayMs: 1800 },
    },
    { id: 'bell8', snap: 'bell8', checkpoint: true, advance: { kind: 'reveal_wait', at: 'final_value:YesBank' } },
    {
      id: 'sum8', snap: 'bell8', target: 'reveal-overlay', holdRevealAt: 'final_value:YesBank',
      text: 'Arjun’s **−10** and your −15 outweigh Meera’s +10: YesBank **$20 → $5**.',
      advance: { kind: 'next' },
    },
    { id: 'to-cd8', snap: 'bell8', advance: { kind: 'reveal_wait', at: cd('YesBank') } },
    atCd('YesBank', {
      id: 'pick-own8', snap: 'bell8', targetKey: 'own:0',
      text: 'Chairman first: tap your **−10**…',
      advance: { kind: 'click' },
    }),
    atCd('YesBank', {
      id: 'pick-other8', snap: 'bell8', targetKey: 'other:3:0',
      text: '…and Arjun’s **−10**.',
      advance: { kind: 'click' },
    }),
    atCd('YesBank', {
      id: 'predict-150-chairman', snap: 'bell8',
      text: 'Where does YesBank close now?',
      advance: {
        kind: 'predict',
        options: [
          { label: '$25', correct: true },
          { label: '$20', correct: false },
          { label: '$5', correct: false },
        ],
        right: 'Exactly — your −5 and Meera’s +10 are left.',
        wrong: 'Not this time — your −5 and Meera’s +10 are left: **$25**.',
      },
    }),
    atCd('YesBank', {
      id: 'discard8-chairman', snap: 'bell8', targetKey: 'confirm',
      text: 'Tap **Confirm Discard**.',
      advance: {
        kind: 'action',
        expect: { type: 'chairman_director', discard_own_idx: 0, discard_other_player_id: 3, discard_other_idx: 0 },
      },
    }),
    atCd('YesBank', {
      id: 'mid8', snap: 'cd8-chair', target: 'reveal-overlay',
      text: 'YesBank **$20 → $25**. Now your director power: one more of your own.',
      advance: { kind: 'next' },
    }),
    atCd('YesBank', {
      id: 'predict-150-director', snap: 'cd8-chair',
      text: 'Discard your −5 too: where does YesBank close?',
      advance: {
        kind: 'predict',
        options: [
          { label: '$30', correct: true },
          { label: '$25', correct: false },
        ],
        right: 'Exactly — only Meera’s +10 is left.',
        wrong: 'Not this time — only Meera’s +10 is left: **$30**.',
      },
    }),
    atCd('YesBank', {
      id: 'pick-own8-director', snap: 'cd8-chair', targetKey: 'own:0',
      text: 'Tap your **−5**.',
      advance: { kind: 'click' },
    }),
    atCd('YesBank', {
      id: 'discard8-director', snap: 'cd8-chair', targetKey: 'confirm',
      text: 'Tap **Confirm Discard**.',
      advance: { kind: 'action', expect: { type: 'chairman_director', discard_own_idx: 0 } },
    }),
    atCd('YesBank', {
      id: 'payoff8', snap: 'cd8', target: 'reveal-overlay',
      text: 'YesBank **$20 → $30**: three cards gone, **+$1,500** on your 150 shares.',
      advance: { kind: 'next' },
    }),
    { id: 'end8', snap: 'cd8', advance: { kind: 'reveal_end' } },
    { id: 'standings8', snap: 'd9', advance: { kind: 'suspend_end' } },

    // ── Day 9: 200 — chairman + double director ──
    {
      id: 'holding-200', snap: 'd9', target: 'ticker', targetKey: 'YesBank', targetMobile: 'player-self', mobileTab: 'players',
      text: 'Day 9: you bought the **last 50** YesBank — the ticker shows **0** avail. You hold all **200**.',
      textMobile: 'Day 9: you bought the **last 50** YesBank. You hold all **200** — the bank has none left.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-200', snap: 'd9', target: 'hand', targetKey: 'YesBank',
      text: '**200** = chairman **and** double director. With **YesBank −10, −5, −5**, how many cards can you remove?',
      textMobile: '**200** = chairman **and** double director. With **YESB −10, −5, −5** (YesBank), how many cards can you remove?',
      advance: {
        kind: 'predict',
        options: [
          { label: '4', correct: true },
          { label: '3', correct: false },
        ],
        right: 'Exactly — chairman: one of yours and one of theirs. Double director: two more of yours.',
        wrong: 'Not this time — chairman: one of yours and one of theirs. Double director: two more of yours.',
      },
    },
    {
      id: 'arjun-last9', snap: 'd9', mobileTab: 'logchat',
      text: 'Arjun moves last…',
      advance: { kind: 'auto', delayMs: 1800 },
    },
    { id: 'bell9', snap: 'bell9', checkpoint: true, advance: { kind: 'reveal_wait', at: 'final_value:YesBank' } },
    {
      id: 'sum9', snap: 'bell9', target: 'reveal-overlay', holdRevealAt: 'final_value:YesBank',
      text: 'Meera’s **−10** and your −20 outweigh Arjun’s +10: YesBank **$30 → $10**.',
      advance: { kind: 'next' },
    },
    { id: 'to-cd9', snap: 'bell9', advance: { kind: 'reveal_wait', at: cd('YesBank') } },
    atCd('YesBank', {
      id: 'pick-own9', snap: 'bell9', targetKey: 'own:0',
      text: 'Chairman: tap your **−10**…',
      advance: { kind: 'click' },
    }),
    atCd('YesBank', {
      id: 'pick-other9', snap: 'bell9', targetKey: 'other:2:0',
      text: '…and Meera’s **−10**.',
      advance: { kind: 'click' },
    }),
    atCd('YesBank', {
      id: 'predict-200-chairman', snap: 'bell9',
      text: 'Where does YesBank close now?',
      advance: {
        kind: 'predict',
        options: [
          { label: '$30', correct: true },
          { label: '$20', correct: false },
          { label: '$10', correct: false },
        ],
        right: 'Exactly — your two −5s cancel Arjun’s +10.',
        wrong: 'Not this time — your two −5s cancel Arjun’s +10: **$30**.',
      },
    }),
    atCd('YesBank', {
      id: 'discard9-chairman', snap: 'bell9', targetKey: 'confirm',
      text: 'Tap **Confirm Discard**.',
      advance: {
        kind: 'action',
        expect: { type: 'chairman_director', discard_own_idx: 0, discard_other_player_id: 2, discard_other_idx: 0 },
      },
    }),
    atCd('YesBank', {
      id: 'mid9', snap: 'cd9-chair', target: 'reveal-overlay',
      text: 'Back to **$30**. Now double director: both your **−5**s.',
      advance: { kind: 'next' },
    }),
    atCd('YesBank', {
      id: 'predict-200-double', snap: 'cd9-chair',
      text: 'Without both −5s, where does YesBank close?',
      advance: {
        kind: 'predict',
        options: [
          { label: '$40', correct: true },
          { label: '$35', correct: false },
        ],
        right: 'Exactly — only Arjun’s +10 is left.',
        wrong: 'Not this time — only Arjun’s +10 is left: **$40**.',
      },
    }),
    atCd('YesBank', {
      id: 'pick-double9-1', snap: 'cd9-chair', targetKey: 'own:0',
      text: 'Tap **−5**…',
      advance: { kind: 'click' },
    }),
    atCd('YesBank', {
      id: 'pick-double9-2', snap: 'cd9-chair', targetKey: 'own:1',
      text: '…and the other **−5**.',
      advance: { kind: 'click' },
    }),
    atCd('YesBank', {
      id: 'discard9-double', snap: 'cd9-chair', targetKey: 'confirm',
      text: 'Tap **Confirm Discard**.',
      advance: { kind: 'action', expect: { type: 'chairman_director', discard_own_idx: [0, 1] } },
    }),
    atCd('YesBank', {
      id: 'payoff9', snap: 'cd9', target: 'reveal-overlay',
      text: 'YesBank **$30 → $40**: four cards gone, **+$2,000** on your 200 shares.',
      advance: { kind: 'next' },
    }),
    { id: 'to-tcs9', snap: 'cd9', advance: { kind: 'reveal_wait', at: 'final_value:TCS' } },
    {
      id: 'tcs-crash', snap: 'cd9', target: 'reveal-overlay', holdRevealAt: 'final_value:TCS',
      text: 'Meanwhile TCS: **$45 → $5**. Nobody holds it — all 200 shares sit in the bank.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-tcs', snap: 'cd9', target: 'reveal-overlay', holdRevealAt: 'final_value:TCS',
      text: 'Tomorrow everyone wants TCS at $5. Who gets the most?',
      advance: {
        kind: 'predict',
        options: [
          { label: 'Whoever moves first with the cash', correct: true },
          { label: 'Whoever has the most cash', correct: false },
        ],
        right: 'Exactly — first come, first served.',
        wrong: 'Not this time — the shares go to whoever moves first with the cash.',
      },
    },
    { id: 'end9', snap: 'cd9', advance: { kind: 'reveal_end' } },
    { id: 'standings9', snap: 'd10-dawn', advance: { kind: 'suspend_end' } },

    // ── Day 10: the 200 supply ──
    {
      id: 'seats10', snap: 'd10-dawn', target: 'player-board', mobileTab: 'players',
      text: 'Day 10. Seats rotate every day — today Meera and Arjun move before you.',
      advance: { kind: 'next' },
    },
    {
      id: 'meera10', snap: 'd10-dawn', mobileTab: 'logchat',
      text: 'Meera’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'arjun10', snap: 'd10-meera', mobileTab: 'logchat',
      text: 'Meera bought **100 TCS**. Arjun’s move…',
      advance: { kind: 'auto', delayMs: 1500 },
    },
    {
      id: 'log10', snap: 'd10', target: 'log', mobileTab: 'logchat',
      text: 'Arjun bought **50 TCS**: 150 of the 200 gone before your move.',
      advance: { kind: 'next' },
    },
    {
      id: 'avail10', snap: 'd10', target: 'ticker', targetKey: 'TCS', targetMobile: null,
      text: 'The ticker’s “avail”: **50** TCS left in the bank.',
      textMobile: 'That leaves **50** TCS in the bank.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-max', snap: 'd10', target: 'player-self', mobileTab: 'players',
      text: 'You have **$400** — enough for 80 TCS at $5. Where will your slider max stop?',
      advance: {
        kind: 'predict',
        options: [
          { label: '50', correct: true },
          { label: '80', correct: false },
        ],
        right: 'Exactly — Max is what your cash buys or what the bank has left.',
        wrong: 'Not this time — Max is what your cash buys or what the bank has left: **50**.',
      },
    },
    {
      id: 'open-buy10', snap: 'd10', target: 'buy-button', checkpoint: true,
      text: 'Tap **Buy**.',
      advance: { kind: 'click' },
    },
    {
      id: 'pick-tcs', snap: 'd10', target: 'trade-company', targetKey: 'TCS',
      text: 'Pick **TCS** — $5 a share.',
      advance: { kind: 'click' },
    },
    {
      id: 'max10', snap: 'd10', target: 'trade-max',
      text: '**Max 50**: your cash buys 80, but the bank has only 50. Tap it.',
      advance: { kind: 'click' },
    },
    {
      id: 'confirm10', snap: 'd10', target: 'trade-confirm',
      text: 'Confirm: 50 × $5 = **$250**.',
      advance: { kind: 'action', expect: { type: 'buy', company_num: 4, quantity: 50 } },
    },
    {
      id: 'turn-order', snap: 'd10-bought', target: 'player-board', mobileTab: 'players',
      text: 'Meera moved first with the cash: 100 TCS, and its chair. Liquidity and seat order decide who capitalises.',
      advance: { kind: 'next' },
    },
    {
      id: 'tie-back', snap: 'd10-bought', target: 'player-self', mobileTab: 'players',
      text: 'And you hold all 200 YesBank: **200** is the whole company — the chairman + double director tier.',
      advance: { kind: 'next' },
    },
    {
      id: 'next-up', snap: 'd10-bought',
      text: 'You’ve seen every card and every seat on the board. Time to play.',
      advance: { kind: 'next' },
    },
  ],
}

export default chairmanDirector
