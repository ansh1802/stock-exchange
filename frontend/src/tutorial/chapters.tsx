import type { ReactNode } from 'react'
import { GAME_CONSTANTS } from '../lib/constants'

const C = GAME_CONSTANTS

export interface RulebookChapter {
  id: string
  title: string
  subtitle: string
  /** Estimated read time in seconds — shown in the index */
  seconds: number
  body: ReactNode
}

// ─── Tiny inline diagram primitives ─────────────────────────────
function CardChip({ value, sign }: { value: number; sign: '+' | '−' }) {
  return (
    <span
      className="inline-flex items-center justify-center font-serif"
      style={{
        width: 36,
        height: 50,
        background: 'var(--color-paper-2)',
        border: '1px solid var(--color-paper-line)',
        borderRadius: 3,
        color: sign === '+' ? 'var(--color-buy)' : 'var(--color-sell)',
        fontSize: 16,
      }}
    >
      {sign}{value}
    </span>
  )
}

function EdgeCase({ children }: { children: ReactNode }) {
  return (
    <div
      className="my-3 px-3 py-2"
      style={{
        background: 'rgba(184,58,46,0.06)',
        borderLeft: '3px solid var(--color-sell)',
        borderRadius: 3,
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.15em',
          color: 'var(--color-sell)',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        Edge case
      </div>
      <div style={{ fontSize: 12 }}>{children}</div>
    </div>
  )
}

function Diagram({ children }: { children: ReactNode }) {
  return (
    <div
      className="my-3 px-3 py-3"
      style={{
        background: 'rgba(201,161,74,0.08)',
        border: '1px solid rgba(201,161,74,0.3)',
        borderRadius: 3,
      }}
    >
      <div
        className="font-mono"
        style={{
          fontSize: 9,
          letterSpacing: '0.15em',
          color: 'var(--color-gold-deep)',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        Diagram
      </div>
      {children}
    </div>
  )
}

// ─── 10 chapters ────────────────────────────────────────────────
export const CHAPTERS: RulebookChapter[] = [
  {
    id: 'goal',
    title: 'The goal',
    subtitle: 'Build the biggest portfolio over 10 days.',
    seconds: 45,
    body: (
      <>
        <p>
          You are trading on a single floor for ten days. Each day has three
          rounds of trading, then a "closing bell" reveals what every player
          played and prices move accordingly. After day {C.MAX_DAYS} the player
          with the highest <strong>net worth</strong> (cash + value of held
          shares at final prices) wins.
        </p>
        <p>
          Net worth ≠ cash. A pile of cheap shares of a company about to surge
          can outweigh a fat wallet. Knowing what other players are about to
          play — and influencing the closing — is the real game.
        </p>
        <Diagram>
          <div className="font-mono" style={{ fontSize: 12 }}>
            net&nbsp;worth&nbsp;=&nbsp;cash&nbsp;+&nbsp;Σ (shares&nbsp;×&nbsp;price)
          </div>
        </Diagram>
      </>
    ),
  },
  {
    id: 'hand',
    title: 'Cards in hand',
    subtitle: `Each day you are dealt ${C.CARDS_PER_HAND} cards.`,
    seconds: 60,
    body: (
      <>
        <p>
          A regular card names a company and a signed value (e.g. <em>TCS +5</em>
          or <em>YesBank −10</em>). At the closing bell, every regular card
          you hold for an open company is summed into that company's price.
        </p>
        <Diagram>
          <div className="flex items-center gap-2 flex-wrap">
            <CardChip value={5} sign="+" />
            <CardChip value={10} sign="+" />
            <CardChip value={3} sign="−" />
            <span className="font-mono" style={{ fontSize: 13 }}>→</span>
            <span className="font-serif" style={{ fontSize: 18 }}>
              +12 to that company at close
            </span>
          </div>
        </Diagram>
        <p>
          Six <strong>power cards</strong> can also appear in your hand:
          Rights Issue, Share Suspend, Loan Stock, Debenture, Currency +,
          Currency −. They are spent during your trading turn for an
          immediate effect (covered in chapter 6).
        </p>
      </>
    ),
  },
  {
    id: 'turns',
    title: 'Trading turns',
    subtitle: `${C.ROUNDS_PER_DAY} rounds per day. Each turn: buy, sell, or pass.`,
    seconds: 60,
    body: (
      <>
        <p>
          Within a day, players take turns in seat order, three rounds in
          total. On your turn you can:
        </p>
        <ul style={{ paddingLeft: 18, marginTop: 6 }}>
          <li>
            <strong>Buy</strong> any number of shares of an open company at
            its current price (limited by available shares and your cash).
          </li>
          <li>
            <strong>Sell</strong> any quantity of your holdings at the
            current price.
          </li>
          <li>
            <strong>Pass</strong> — do nothing, end your turn.
          </li>
          <li>
            <strong>Play a power card</strong> — immediate effect, then
            your turn ends.
          </li>
        </ul>
        <p>
          You start each game with <strong>{C.STARTING_CASH}</strong> cash;
          the bank holds <strong>{C.STARTING_SHARES}</strong> shares of every
          company. When a company runs out of available shares, no one can
          buy more until someone sells.
        </p>
      </>
    ),
  },
  {
    id: 'closing-bell',
    title: 'The closing bell',
    subtitle: 'When prices actually move.',
    seconds: 75,
    body: (
      <>
        <p>
          Trading stops at the end of each day's rounds and the bell rings.
          Every regular card every player holds is revealed company-by-company
          and its value applied to that company's price.
        </p>
        <Diagram>
          <div className="flex items-center gap-2 flex-wrap">
            <CardChip value={5} sign="+" />
            <CardChip value={4} sign="+" />
            <CardChip value={2} sign="−" />
            <span className="font-mono" style={{ fontSize: 13 }}>→</span>
            <span className="font-serif" style={{ fontSize: 18 }}>+7</span>
            <span className="font-mono" style={{ fontSize: 13 }}>→</span>
            <span className="font-mono" style={{ fontSize: 13 }}>$55 → $62</span>
          </div>
        </Diagram>
        <p>
          The price change applies <strong>after</strong> the round, so any
          shares you held going into the bell now sit at the new price. The
          reveal is the only time prices move during normal play.
        </p>
        <EdgeCase>
          If a player held a <strong>Share Suspend</strong> card for that
          company, it is frozen for the day — no fluctuation applied.
        </EdgeCase>
        <EdgeCase>
          A company whose price drops to <strong>0 or below</strong> is closed.
          You keep your shares but cannot trade them again unless a Rights
          Issue or share-suspend swap pulls it back into the positive.
        </EdgeCase>
      </>
    ),
  },
  {
    id: 'power-cards',
    title: 'Power cards',
    subtitle: 'Six special cards. Each plays for an immediate effect.',
    seconds: 90,
    body: (
      <>
        <p>
          Power cards are spent during your trading turn. They take the place
          of a buy/sell action and trigger immediately.
        </p>
        <div className="grid gap-2 my-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="px-3 py-2"
            style={{ background: 'var(--color-paper-2)', border: '1px solid var(--color-paper-line)', borderRadius: 3 }}>
            <div className="font-serif" style={{ fontSize: 16 }}>Rights Issue</div>
            <div style={{ fontSize: 12 }}>
              Pick a company. You buy any number of shares at a fixed
              <strong> ${C.RIGHTS_ISSUE_VALUE}</strong>. Other players are
              then offered the same deal in turn order.
            </div>
          </div>
          <div className="px-3 py-2"
            style={{ background: 'var(--color-paper-2)', border: '1px solid var(--color-paper-line)', borderRadius: 3 }}>
            <div className="font-serif" style={{ fontSize: 16 }}>Share Suspend</div>
            <div style={{ fontSize: 12 }}>
              Played silently — kept until the closing bell, then it
              swaps the company's new value with its <em>pre-fluctuation</em>
              price (no day's gain/loss for that company).
            </div>
          </div>
          <div className="px-3 py-2"
            style={{ background: 'var(--color-paper-2)', border: '1px solid var(--color-paper-line)', borderRadius: 3 }}>
            <div className="font-serif" style={{ fontSize: 16 }}>Loan Stock</div>
            <div style={{ fontSize: 12 }}>
              Take <strong>${C.LOAN_STOCK_AMOUNT}</strong> from the bank.
              No interest, no payback — just free cash. (Your net worth
              still has to cover it eventually.)
            </div>
          </div>
          <div className="px-3 py-2"
            style={{ background: 'var(--color-paper-2)', border: '1px solid var(--color-paper-line)', borderRadius: 3 }}>
            <div className="font-serif" style={{ fontSize: 16 }}>Debenture</div>
            <div style={{ fontSize: 12 }}>
              Burn one of your cards plus a target company card from
              another player. Used to scrub a known move from the bell.
            </div>
          </div>
          <div className="px-3 py-2"
            style={{ background: 'var(--color-paper-2)', border: '1px solid var(--color-paper-line)', borderRadius: 3 }}>
            <div className="font-serif" style={{ fontSize: 16 }}>Currency +</div>
            <div style={{ fontSize: 12 }}>
              Resolved at currency settlement (after the bell). Adds
              <strong> {(C.CURRENCY_RATE * 100).toFixed(0)}%</strong>
              {' '}to your cash for that day.
            </div>
          </div>
          <div className="px-3 py-2"
            style={{ background: 'var(--color-paper-2)', border: '1px solid var(--color-paper-line)', borderRadius: 3 }}>
            <div className="font-serif" style={{ fontSize: 16 }}>Currency −</div>
            <div style={{ fontSize: 12 }}>
              The mirror — subtracts
              <strong> {(C.CURRENCY_RATE * 100).toFixed(0)}%</strong>
              {' '}from your cash that day. Drawn cards aren't optional;
              you eat the loss.
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    id: 'positions',
    title: 'Director & Chairman',
    subtitle: 'Holding shares earns you board seats.',
    seconds: 75,
    body: (
      <>
        <p>
          Three thresholds matter while holding a single company's shares:
        </p>
        <Diagram>
          <div className="grid grid-cols-2 gap-2" style={{ fontSize: 12 }}>
            <div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--color-ink-muted)' }}>
                ≥ {C.DIRECTOR_THRESHOLD} shares
              </div>
              <div className="font-serif" style={{ fontSize: 16 }}>Director</div>
              <div>Discard one own card of that company at the bell.</div>
            </div>
            <div>
              <div className="font-mono" style={{ fontSize: 10, color: 'var(--color-ink-muted)' }}>
                ≥ {C.CHAIRMAN_THRESHOLD} shares
              </div>
              <div className="font-serif" style={{ fontSize: 16, color: 'var(--color-gold-deep)' }}>
                Chairman
              </div>
              <div>
                Discard one own card <em>and</em> remove one card from
                another player. Either part is optional.
              </div>
            </div>
          </div>
        </Diagram>
        <p>
          A player with <strong>≥ {C.CHAIRMAN_THRESHOLD + C.DIRECTOR_THRESHOLD}</strong> shares
          is Chairman <em>and</em> Director — both powers fire in sequence.
          With <strong>≥ {C.CHAIRMAN_THRESHOLD * 2}</strong> shares the player
          becomes a "Double Director" who can discard up to two cards.
        </p>
        <p>
          Only one Chairman per company. A second player who reaches{' '}
          {C.CHAIRMAN_THRESHOLD} while someone else is Chairman becomes a
          Double Director instead.
        </p>
      </>
    ),
  },
  {
    id: 'reading-ticker',
    title: 'Reading the ticker',
    subtitle: 'What the prices do and don\'t tell you.',
    seconds: 45,
    body: (
      <>
        <p>
          The strip across the top shows each company's current price and the
          delta from yesterday's close. A small sparkline tracks the last few
          days. The "available" number under each price is bank stock — when
          it hits zero no one can buy until a player sells.
        </p>
        <p>
          During trading, the price never moves. It only updates at the bell.
          So the ticker tells you where prices ended yesterday, not where
          they're going.
        </p>
      </>
    ),
  },
  {
    id: 'currency',
    title: 'Currency settlement',
    subtitle: `${(C.CURRENCY_RATE * 100).toFixed(0)}% bumps to your cash, after the bell.`,
    seconds: 30,
    body: (
      <>
        <p>
          After the bell, every <em>Currency +</em> card you hold adds
          {' '}{(C.CURRENCY_RATE * 100).toFixed(0)}% of your current cash; every{' '}
          <em>Currency −</em> subtracts the same percentage. Multiple cards
          stack multiplicatively.
        </p>
        <p>
          You can't choose to skip them — held cards apply automatically. Plan
          to spend before settlement if you fear a Currency − is coming.
        </p>
      </>
    ),
  },
  {
    id: 'last-day',
    title: 'Last day',
    subtitle: 'Day 10 plays out, then the game ends.',
    seconds: 25,
    body: (
      <>
        <p>
          Day {C.MAX_DAYS} resolves like any other day — three rounds, a bell,
          currency settlement. After the day-end snapshot, the game enters{' '}
          <strong>Game Over</strong>: your final net worth is your portfolio
          at that moment's prices, and the leaderboard is shown.
        </p>
        <p>
          There is no "after the buzzer" trade. If you were going to dump a
          dying company before the final reveal, you had to do it on day{' '}
          {C.MAX_DAYS}'s rounds.
        </p>
      </>
    ),
  },
  {
    id: 'glossary',
    title: 'Glossary',
    subtitle: 'Quick reference.',
    seconds: 60,
    body: (
      <>
        <ul style={{ paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
          <li><strong>Bell</strong> — end-of-day reveal that applies all cards to prices.</li>
          <li><strong>Open / Closed</strong> — a company at price {'>'}0 is open; at 0 it is closed and cannot be traded.</li>
          <li><strong>Pre-fluctuation value</strong> — the price before the bell applied today's cards. Share Suspend swaps to this.</li>
          <li><strong>Director</strong> — ≥{C.DIRECTOR_THRESHOLD} shares of one company. Up to two per company.</li>
          <li><strong>Chairman</strong> — ≥{C.CHAIRMAN_THRESHOLD} shares of one company. One per company.</li>
          <li><strong>Net worth</strong> — cash + (shares × current price), summed over all companies.</li>
          <li><strong>Bankrupt</strong> — a company whose price reaches 0 closes. Held shares are stuck unless re-opened.</li>
        </ul>
      </>
    ),
  },
]
