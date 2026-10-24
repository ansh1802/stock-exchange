import type { Chapter } from '../runtime/types'

/** Spec Ch 1 — a spotlight tour of a live 6-seat table (fixture: backend/tutorial/chapters/orientation.py). */
const orientation: Chapter = {
  id: 'orientation',
  title: 'The trading floor',
  subtitle: 'A walk around a live table',
  minutes: 2,
  chips: [
    'The ticker shows each price and how many of its 200 shares the bank still has',
    'On your turn: Buy, Sell or Pass — before the clock passes for you',
  ],
  steps: [
    {
      id: 'welcome', snap: 'floor',
      text: 'Welcome to the floor: you and five bots, day 3 of a 10-day game. Let’s walk the room.',
      advance: { kind: 'next' },
    },
    {
      id: 'ticker', snap: 'floor', target: 'ticker',
      text: 'Six companies, one share price each. The line traces recent closes — YesBank slid from **$20** to **$10**.',
      textMobile: 'Six companies, one share price each. YesBank trades at **$10**, TCS at **$70**.',
      advance: { kind: 'next' },
    },
    {
      id: 'available', snap: 'floor', target: 'ticker', targetKey: 'YesBank', targetMobile: null,
      text: 'Each company has 200 shares; “avail” is what the bank still holds. YesBank shows **150** — someone just bought 50.',
      textMobile: 'Each company has 200 shares in the bank: buys take from it, sells put back. YesBank’s is down to **150** — someone just bought 50.',
      advance: { kind: 'next' },
    },
    {
      id: 'hand', snap: 'floor', target: 'hand',
      text: 'Your hand: cards that push prices up or down at the closing bell. Only you can see them — tap one.',
      advance: { kind: 'click' },
    },
    {
      id: 'board', snap: 'floor', target: 'player-board', mobileTab: 'players',
      text: 'The table: each player’s cash, holdings and net worth in gold. The ◎ by Kabir’s 50 YesBank marks a **director** (50+ shares).',
      advance: { kind: 'next' },
    },
    {
      id: 'you', snap: 'floor', target: 'player-self', mobileTab: 'players',
      text: 'This is you: **$165** cash, 5 TCS and 4 Cred. Tap your seat.',
      advance: { kind: 'click' },
    },
    {
      id: 'day-round', snap: 'floor', target: 'day-round',
      text: 'Day 3 of 10, round 2 of 3. Each day everyone moves once per round, in seat order — you go first.',
      advance: { kind: 'next' },
    },
    {
      id: 'timer', snap: 'floor', target: 'timer',
      text: 'Your turn clock: **90s** at this table. If it runs out, you pass automatically.',
      advance: { kind: 'next' },
    },
    {
      id: 'log', snap: 'floor', target: 'log', mobileTab: 'logchat',
      text: 'Every move lands in the log, newest last. There’s Kabir’s 50 YesBank for **$500**.',
      advance: { kind: 'next' },
    },
    {
      id: 'pass', snap: 'floor', target: 'pass-button',
      text: 'Each turn you Buy, Sell or Pass. Nothing to trade yet — tap **Pass**.',
      advance: { kind: 'action', expect: { type: 'pass' } },
    },
    {
      id: 'exit', snap: 'passed', target: 'exit',
      text: 'Your turn passed to Meera. Exit sits up here any time — now, what are you actually playing for?',
      advance: { kind: 'next' },
    },
  ],
}

export default orientation
