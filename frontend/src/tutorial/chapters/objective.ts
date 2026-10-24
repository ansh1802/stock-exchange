import type { Chapter } from '../runtime/types'

/** Spec Ch 2 — the goal in one popup (fixture: backend/tutorial/chapters/objective.py). */
const objective: Chapter = {
  id: 'objective',
  title: 'What you’re playing for',
  subtitle: 'Net worth, ten days, one bell a day',
  minutes: 1,
  hookFrom: 'orientation',
  chips: [
    'Net worth = cash + every share × its price',
    'Highest net worth after day 10 wins',
  ],
  steps: [
    {
      id: 'goal', snap: 'table',
      text: 'You’re playing for the highest **net worth** when day 10 ends. Whoever has it wins.',
      advance: { kind: 'next' },
    },
    {
      id: 'net-worth', snap: 'table',
      text: 'Net worth is cash plus every share at its price — the gold number on your seat. Yours: $165 + 5 TCS × $70 + 4 Cred × $50 = **$715**.',
      advance: { kind: 'next' },
    },
    {
      id: 'bell', snap: 'table',
      text: 'Each day is 3 rounds of moves, then the **closing bell** reprices every company. So what moves prices?',
      advance: { kind: 'next' },
    },
  ],
}

export default objective
