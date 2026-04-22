# Phase 8 — Mobile UI Stabilisation

## Goal

The app ran well at desktop widths but broke below ~900px: stacked flex layout, 3×2 `PlayerBoard` grid, fixed `w-72` log sidebar, and 140px-min ticker cards all overflowed on phones. This phase delivers a proper mobile experience from a single codebase — one `GameBoard` tree forked by a `useIsMobile()` hook at the 768px (Tailwind `md`) breakpoint.

## Architecture

**Single codebase, one hook.** `useIsMobile()` returns `true` below 768px. Desktop code paths are untouched when the hook is integrated. Only *layout-shape* changes (grid vs list, sidebar vs tab, panel vs drawer) live behind the mobile fork; business logic, state, networking, engine rules, overlays — all remain single-source and affect both platforms.

**Backend-authoritative ticker.** Each `Company` now carries a 4-char `ticker` (`VODA`, `YESB`, `CRED`, `TCS`, `RELI`, `INFO`) so every UI surface can choose `company.name` or `company.ticker` as space allows. No frontend-only lookup hack.

## What changed

### Backend
- `engine/constants.py` — `COMPANY_TICKERS = ["VODA", "YESB", "CRED", "TCS", "RELI", "INFO"]`
- `engine/models.py` — `Company.__init__(name, value, ticker="")` + serialisation via `to_dict()`; `GameState` zips `COMPANY_TICKERS` at build time
- `server.py` — `build_client_state` passes `ticker` through to every broadcast

### Frontend — shared (desktop + mobile)
- `types/game.ts` — `ticker: string` on `Company`
- `lib/constants.ts` — `COMPANY_TICKER` fallback map for surfaces that only hold a name string
- `CardComponent` — TICKER in the header; added `compact` prop (44×52 normal / 52×52 power) for the mobile strip
- `StockTicker` — desktop shows full CAPS name, mobile branch renders a single-row horizontally-scrollable strip of ticker pills (no sparkline)
- `playerHelpers.ts` — pure `portfolioValue()` + `getPosition()` extracted from `PlayerBoard` so the mobile board can reuse

### Frontend — mobile infrastructure
- `hooks/useIsMobile.ts` — `matchMedia('(max-width: 767px)')`, subscribes to `change`, SSR-safe default
- `index.html` — `viewport-fit=cover`
- `index.css` — `.mobile-scroll` (`-webkit-overflow-scrolling: touch`), `.pb-safe` / `.pt-safe` with `env(safe-area-inset-*)`, `touch-action: manipulation` on buttons
- `MobileAwareToaster.tsx` — Sonner position flips to `top-center` on mobile so "Action queued" toasts don't hide behind the ActionBar

### Frontend — mobile layout
- `MobilePlayerBoard` — all 6 players always visible as rows. YOU pinned at top. Row = dot · name · net worth; sub-row = `Cash $X · Stocks $Y`; pills row shows holdings with crown/target position icons. Auto-scroll to the active player via **two separate `useEffect`s** (detect id change into a ref, then call `scrollIntoView`), gated on `phase === 'player_turn'`, refs keyed by `player.id`.
- `MobileCardStrip` — horizontally scrollable strip of all 10 cards with an inline `CARDS (N) / View All ↑` header slot. Hand derived from props via `useMemo` — no accumulator.
- `ViewAllDrawer` — framer-motion bottom sheet with drag-to-dismiss and backdrop-tap dismiss, cards rendered at readable mobile size.
- `MobileTabBar` — two tabs (`Players` / `Log+Chat`), 44px tall, chat-unread badge on the Log+Chat tab, `pb-safe` bottom padding.
- `MobileLogChat` — merged feed. Game log entries render as monospace lines with a muted left border; chat renders as pill bubbles with the sender's coloured dot + name. Interleaved by timestamp (log entries stamped `Date.now()` on first render via a ref; chats carry their backend `ts`). Clears `chatUnread` while mounted.
- `PlayerHand` — mobile branch renders `MobileCardStrip` + `ViewAllDrawer` + the existing `PowerCardPanel` above the strip. All hooks declared above the conditional (Phase-4 rule).
- `DayRoundIndicator` — mobile variant shows `Day X/10 · Round Y/3 · TurnTimer · connection dot`. Desktop layout intentionally unchanged (explicit user direction).
- `TurnTimerDisplay` — added `alwaysShow` prop that renders a neutral countdown derived from `turn_timer_deadline` when the turn isn't urgent (mobile surfaces the timer always).
- `ActionBar` / `TradeModal` — 44px min touch targets on mobile; TradeModal's company grid drops from `grid-cols-3` to `grid-cols-2` and shows TICKER labels; quantity buttons grow to `w-11 h-11`.
- `GameBoard` — mobile branch renders: `ReconnectingBanner → DayRoundIndicator → StockTicker → {MobilePlayerBoard | MobileLogChat} → PlayerHand → ActionBar → MobileTabBar`. All overlays (CardReveal, ShareSuspend, CurrencySettlement, RightsIssue, Debenture, CD modal) factored into a shared block rendered under both branches.

## Dev-history pitfalls we deliberately avoided

Every mobile component was written with the regression log in mind:

- **Hooks above every conditional return** (Phase-4 black screen)
- **Refs keyed by `player.id`, never `player.name`** (Phase-2 portfolio key collision)
- **Auto-scroll via two `useEffect`s, not one combined effect** (Phase-3 cleanup bug)
- **Auto-scroll gated on `phase === 'player_turn'`** and player-id change (Phase-5 ghost suspend animations)
- **Card strip derives `your_hand` via `useMemo` each render** — no accumulator, no cached list (Phase-2 duplicate cards)
- **TurnTimerDisplay stays deadline-driven** — no new local `remaining` state (Phase-7)
- **No optimistic updates on mobile** — same server-authoritative contract

## How future development proceeds

After Phase 8, the split is:

- **Business logic, state, networking, engine phases, overlays, sub-phase queues, chairman/director stacking, power cards** — all sit above the mobile/desktop fork. A new action, log entry, message type, store slice, or engine rule is written once and works on both.
- **Layout-shape changes** — grid vs list, sidebar vs tab, pinned panel vs drawer — are the only things that need a mobile fork. The divergence lives in a small set of files (`GameBoard`, `DayRoundIndicator`, `StockTicker`, `PlayerHand`, and the `Mobile*` / `ViewAllDrawer` components).
- **Shared components like `CardComponent`, `TurnTimerDisplay`, every overlay** — one source, rendered at both scales. `useIsMobile()` is reserved for *branching behaviour*; responsive Tailwind prefixes handle pure sizing.

Practical rule: if you catch yourself writing two near-identical components differing only in CSS, extract a shared one and lean on `md:` prefixes.
