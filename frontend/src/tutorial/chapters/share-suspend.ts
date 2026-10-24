import type { Chapter } from '../runtime/types'

/**
 * Spec Ch 9 — Share Suspend (fixture: backend/tutorial/chapters/share_suspend.py).
 * Bell 1 (day 2, shield): Meera and Arjun sold all their Cred this morning;
 *   their −45 beats your +5, Cred $60 → $20. You halt Cred: back to $60, its
 *   price before the bell; standings $420 → $700, top of the table.
 * Bell 2 (day 3, weapon + edge): TCS $55 → $80 (+$100 on your 4); YesBank
 *   $15 → $0, BANKRUPT → CLOSED. Queue You, Meera. You halt YesBank back to
 *   $15 — it stays CLOSED until the suspend phase ends, so the standings
 *   (engine Trigger B, written before the reopen) still count it $0. Meera
 *   halts TCS: $80 → $55, standings $740 → $640 (both bots pass you there).
 *   Day 4 board: YesBank reopened, net worth $700.
 * The overlay's close countdown is held (TutorialApi.holdSuspendClose) until
 * each `suspend_end` step, so coachmarks can be read over it.
 */
const shareSuspend: Chapter = {
  id: 'share-suspend',
  title: 'Share Suspend',
  subtitle: 'Undo the bell for one company',
  minutes: 5,
  hookFrom: 'rights-issue',
  chips: [
    'Share Suspend is played after the bell: it undoes today’s bell for one company, back to its price before the bell',
    'It’s a shield for your companies and a weapon against theirs — and you can’t see who holds one',
    'Halting a company the bell just CLOSED reopens it; one that ended an earlier day CLOSED still needs a Debenture',
  ],
  steps: [
    // ── Bell 1: the shield ──
    {
      id: 'hook', snap: 'start', target: 'hand', targetKey: 'ShareSuspend',
      text: 'Loan Stock, Debenture, Rights Issue: each was played on a turn. **Share Suspend** waits in your hand until after the bell.',
      textMobile: 'Loan Stock, Debenture, Rights Issue: each was played on a turn. **SUSP** (Share Suspend) waits in your hand until after the bell.',
      advance: { kind: 'next' },
    },
    {
      id: 'recall-log', snap: 'start', target: 'log', mobileTab: 'logchat',
      text: 'Remember: watch what others trade. This morning Meera and Arjun both **sold all their Cred**.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-crash', snap: 'start', target: 'ticker', targetKey: 'Cred',
      text: 'You hold **7 Cred** at **$60**, and a **Cred +5**. What will the bell do to Cred?',
      advance: {
        kind: 'predict',
        options: [
          { label: 'Rise — my +5 counts', correct: false },
          { label: 'Fall — their selling hints at − cards', correct: true },
        ],
        right: 'Exactly — two sellers hint at − Cred cards.',
        wrong: 'Not this time — two players dumping Cred hints at − Cred cards.',
      },
    },
    {
      id: 'pass', snap: 'start', target: 'pass-button',
      text: 'You could sell at $60 — or hold, since Share Suspend can undo a bad bell. Tap **Pass**: you move last, so the bell rings.',
      advance: { kind: 'action', expect: { type: 'pass' } },
    },
    { id: 'bell', snap: 'bell1', checkpoint: true, advance: { kind: 'reveal_wait', at: 'final_value:Cred' } },
    {
      id: 'cred-crash', snap: 'bell1', target: 'reveal-overlay', holdRevealAt: 'final_value:Cred',
      text: 'Meera’s and Arjun’s −45 beat your +5: Cred **$60 → $20**. Your 7 shares just lost **$280**.',
      advance: { kind: 'next' },
    },
    { id: 'end1', snap: 'bell1', advance: { kind: 'reveal_end' } },
    {
      id: 'after-play', snap: 'suspend1', target: 'suspend-list',
      text: 'Now your card plays — after the bell, not on a turn. Each row shows a price **before the bell → after**.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-halt', snap: 'suspend1', target: 'suspend-list', targetKey: 'Cred',
      text: 'If you halt Cred, where does its price go?',
      advance: {
        kind: 'predict',
        options: [
          { label: '$60 — its price before the bell', correct: true },
          { label: '$40 — its starting price', correct: false },
          { label: '$20 — a halt just freezes it', correct: false },
        ],
        right: 'Exactly — a halt puts Cred back to its price before the bell.',
        wrong: 'Not this time — a halt puts Cred back to its price before the bell: **$60**.',
      },
    },
    {
      id: 'pick-cred', snap: 'suspend1', target: 'suspend-list', targetKey: 'Cred',
      text: 'Tap **Cred** to select it.',
      advance: { kind: 'click' },
    },
    {
      id: 'halt', snap: 'suspend1', target: 'suspend-confirm',
      text: 'Tap **Halt Cred** — back to $60.',
      advance: { kind: 'action', expect: { type: 'share_suspend', company_num: 3 } },
    },
    {
      id: 'halted', snap: 'halted1', target: 'suspend-list', targetKey: 'Cred',
      text: 'Cred **$20 → $60**: tonight’s crash is undone. Your net worth is back to **$700**, top of the standings.',
      advance: { kind: 'next' },
    },
    { id: 'standings1', snap: 'halted1', advance: { kind: 'suspend_end' } },
    {
      id: 'day3', snap: 'halted1', target: 'ticker', targetKey: 'Cred',
      text: 'Day 3: Cred opens at $60. Two rounds go by…',
      advance: { kind: 'auto', delayMs: 2500 },
    },
    // ── Bell 2: the weapon, and a company the bell just CLOSED ──
    {
      id: 'hand2', snap: 'start2', target: 'hand',
      text: 'Round 3. Your new hand: **TCS +15**, **YesBank +5** — and another **Share Suspend**.',
      textMobile: 'Round 3. Your new hand: **TCS +15**, **YESB +5** (YesBank) — and another **SUSP**.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-safe', snap: 'start2', target: 'player-self', mobileTab: 'players',
      text: 'You hold **4 TCS**, and your +15 should lift it. Is that gain safe once the bell rings?',
      advance: {
        kind: 'predict',
        options: [
          { label: 'Yes — the bell is final', correct: false },
          { label: 'No — any Share Suspend can undo it', correct: true },
        ],
        right: 'Exactly — and you can’t see who holds one.',
        wrong: 'Not this time — any Share Suspend can undo it, and you can’t see who holds one.',
      },
    },
    {
      id: 'pass2', snap: 'start2', target: 'pass-button',
      text: 'No cash to spend: tap **Pass**.',
      advance: { kind: 'action', expect: { type: 'pass' } },
    },
    {
      id: 'meera3', snap: 'meera3', mobileTab: 'logchat',
      text: 'Meera moves last…',
      advance: { kind: 'auto', delayMs: 1800 },
    },
    { id: 'bell2', snap: 'bell2', checkpoint: true, advance: { kind: 'reveal_wait', at: 'final_value:YesBank' } },
    {
      id: 'yesbank', snap: 'bell2', target: 'reveal-overlay', holdRevealAt: 'final_value:YesBank',
      text: 'Meera’s and Arjun’s −20 beat your +5: YesBank **$15 → $0**. It went bankrupt, so it’s **CLOSED**.',
      advance: { kind: 'next' },
    },
    { id: 'to-tcs', snap: 'bell2', advance: { kind: 'reveal_wait', at: 'final_value:TCS' } },
    {
      id: 'tcs', snap: 'bell2', target: 'reveal-overlay', holdRevealAt: 'final_value:TCS',
      text: 'TCS **$55 → $80**: your 4 shares gained **$100**.',
      advance: { kind: 'next' },
    },
    { id: 'end2', snap: 'bell2', advance: { kind: 'reveal_end' } },
    {
      id: 'predict-reopen', snap: 'suspend2', target: 'suspend-list', targetKey: 'YesBank',
      text: 'YesBank is CLOSED at **$0**. If you halt it, what happens?',
      advance: {
        kind: 'predict',
        options: [
          { label: 'Back to $15, and it reopens', correct: true },
          { label: 'Nothing — only a Debenture reopens a CLOSED company', correct: false },
        ],
        right: 'Exactly — the halt undoes tonight’s bell before the close sticks.',
        wrong: 'Not this time — the halt undoes tonight’s bell before the close sticks: back to **$15**.',
      },
    },
    {
      id: 'pick-yesbank', snap: 'suspend2', target: 'suspend-list', targetKey: 'YesBank',
      text: 'Tap **YesBank** to select it.',
      advance: { kind: 'click' },
    },
    {
      id: 'halt2', snap: 'suspend2', target: 'suspend-confirm',
      text: 'Tap **Halt YesBank** — back to $15.',
      advance: { kind: 'action', expect: { type: 'share_suspend', company_num: 2 } },
    },
    {
      id: 'rescued', snap: 'your-halt2', target: 'suspend-list', targetKey: 'YesBank',
      text: 'YesBank **$0 → $15**. It stays CLOSED until the day ends, then reopens — so tonight’s standings don’t count it.',
      advance: { kind: 'next' },
    },
    {
      id: 'contrast', snap: 'your-halt2', target: 'suspend-list', targetKey: 'YesBank',
      text: 'Only tonight’s bell can be undone. A company that ended an earlier day CLOSED still needs a **Debenture**.',
      advance: { kind: 'next' },
    },
    {
      id: 'predict-meera', snap: 'your-halt2', target: 'suspend-list',
      text: 'Meera holds a Share Suspend too. Which company will Meera halt?',
      advance: {
        kind: 'predict',
        options: [
          { label: 'TCS — your $100 gain tonight', correct: true },
          { label: 'YesBank — your rescue', correct: false },
        ],
        right: 'Exactly — Meera went for your biggest gain tonight.',
        wrong: 'Not this time — Meera went for TCS, your biggest gain tonight.',
      },
    },
    {
      id: 'meera-decides', snap: 'your-halt2',
      text: 'Meera decides…',
      advance: { kind: 'auto', delayMs: 2000 },
    },
    {
      id: 'weapon', snap: 'meera-halt', target: 'suspend-list', targetKey: 'TCS',
      text: 'Meera halted TCS: **$80 → $55**, and your **$100** gain is undone. A shield for you is a weapon for them.',
      advance: { kind: 'next' },
    },
    { id: 'standings2', snap: 'meera-halt', advance: { kind: 'suspend_end' } },
    {
      id: 'reopened', snap: 'meera-halt', target: 'player-self', mobileTab: 'players',
      text: 'Day 4: YesBank reopened at **$15**, so the board counts your 4 shares again — net worth **$700**.',
      textMobile: 'Day 4: **YESB** (YesBank) reopened at **$15**, so the board counts your 4 shares again — net worth **$700**.',
      advance: { kind: 'next' },
    },
    {
      id: 'next-up', snap: 'meera-halt',
      text: 'At the bell, every card for a company counts. What if you could throw some away?',
      advance: { kind: 'next' },
    },
  ],
}

export default shareSuspend
