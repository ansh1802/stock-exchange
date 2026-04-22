# Mobile UI Stabilisation — Implementation Plan

## Context

The web app runs well on desktop but the stacked flex layout, the 3×2 PlayerBoard, the fixed-width `w-72` GameLog sidebar, and the 140px-min StockTicker cards all break below ~900px. We need a proper mobile experience without forking the codebase. The design source is Claude-Design's Mobile Plan v3 (fetched from the design API); this plan reconciles it with the real code and with the user's direct feedback.

**Design source:** `Mobile Plan v3.html` — single-codebase approach driven by one `useIsMobile()` hook at the 768px breakpoint. The user reviewed the v3 design and gave per-question direction; this plan incorporates all of it.

**Non-goals:** optimistic updates, backend protocol changes, engine rule changes, PWA/install manifest work, landscape-optimised layout, the Tweaks dev panel (all deferred).

---

## Key user decisions (resolved in plan mode, before implementation)

| # | Topic | Decision |
|---|-------|----------|
| 1 | Desktop DayRoundIndicator | **Unchanged.** v3's "halve for desktop" was a Claude Design misread — keep desktop top bar exactly as it is today. |
| 2 | Mobile DayRoundIndicator | Show `Day 3/10 · Round 2/3` (both denominators, word "Round" not "Rnd", no Turn counter). Replace "Your turn!" badge with the timer. |
| 3 | Ticker casing | Both desktop and mobile go ALL CAPS. Desktop shows the full CAPS name (`VODAFONE`, `YESBANK` …); mobile shows the 4-char ticker (`VODA`, `YESB` …). |
| 4 | Card labels | Both desktop and mobile cards show the 4-char TICKER (not the full name). Same CardComponent, same label. |
| 5 | Ticker on the data model | Add a `ticker` field to the backend `Company` model so every UI surface can read `company.ticker` or `company.name` as needed — frontend-only lookup maps are rejected. |
| 6 | `useIsMobile` breakpoint | `matchMedia('(max-width: 767px)')` → 768px is the desktop threshold (Tailwind `md`). |
| 7 | View All drawer | Build in this iteration. Framer-motion bottom sheet. Cards inside the drawer are readable mobile-sized (~64px wide), not desktop-sized. |
| 8 | Log + Chat on mobile | Single merged tab. Entries interleaved by timestamp. Chat = pill bubbles with sender dot+name. Game-log = monospace plain-text lines with a subtle left border. |
| 9 | Unread badges | **Chat-only** keeps its existing badge. Log entries never badge — no new store slice. |
| 10 | Tweaks panel | **Deferred.** Not in this iteration. |

---

## Discrepancies between the v3 design document and reality (flagged, resolved)

1. **§07 file list vs §04 body contradict each other on card size** — §07 says 30px wide, no company name; §04 says 44×52px with TICKER + value + View All drawer. The v3 design is internally inconsistent. We follow §04 (the later, more detailed section).
2. **§05 references a `TWEAK_DEFAULTS` / `/*EDITMODE-BEGIN*/` pattern** that does not exist in the codebase. The Tweaks panel has no host pattern to slot into. Deferred by decision #10 above.
3. **§10 "no optimistic updates on mobile"** is already how the code works — this is a "keep it that way" rule, not a code change.
4. **§01 halving the DayRoundIndicator on desktop** was based on a misread of the user's feedback; not doing it (decision #1).
5. **§10 "merged chat+log unread counter"** is overridden by decision #9.
6. **§11 overlay audit** is a test step, not code. Called out explicitly in the verification section.

---

## Architecture: how mobile and desktop share code

**One `GameBoard` tree, one `useIsMobile()` fork.** The hook returns `false` on ≥768px so every existing desktop code path is untouched when the hook is integrated.

Two shapes of change live in this plan:

1. **Shared edits** (affect both desktop and mobile) — CardComponent, StockTicker, constants, the new `ticker` field on Company, `playerHelpers.ts`. These apply unconditionally. Desktop users see the effect the moment these commits merge.
2. **Mobile branches** (only visible when `useIsMobile()` is true) — `MobilePlayerBoard`, `MobileTabBar`, `MobileLogChat`, `MobileCardStrip` + `ViewAllDrawer`, and a mobile variant of `DayRoundIndicator`. These are rendered from a single `if (isMobile)` at the top of `GameBoard` and inside the two components whose shape diverges (`DayRoundIndicator`, `StockTicker`).

This delivers the answer to the user's last question: **no, future changes do not need to be done twice.** Business logic (engine, store, hooks, server messages) lives above the mobile/desktop split and affects both. Only *layout-shape* changes — grid vs list, sidebar vs tab, fixed panel vs drawer — need a mobile fork, and they're already isolated to the files listed above. Everything else (new actions, new phases, new log entries, new power cards) drops in once and works on both.

---

## Files to modify / create

### Backend (one small change)

| File | Status | What changes |
|------|--------|--------------|
| `backend/engine/constants.py` | MODIFY | Add `COMPANY_TICKERS = ["VODA", "YESB", "CRED", "TCS", "RELI", "INFO"]`. Parallel to `COMPANY_NAMES`. |
| `backend/engine/models.py` | MODIFY | Add `ticker: str` to `Company` dataclass. Populate in constructor (index-based lookup). Serialize via `to_dict()`. |
| `backend/engine/deck.py` or wherever companies are built | VERIFY | Ensure `ticker` is set when `Company` instances are created at game start. |

### Frontend — shared edits (apply to desktop and mobile)

| File | Status | What changes |
|------|--------|--------------|
| `frontend/src/types/game.ts` | MODIFY | Add `ticker: string` to `Company` interface. |
| `frontend/src/lib/constants.ts` | MODIFY | Add `COMPANY_TICKER` lookup map keyed by company `name` (fallback if backend ticker is ever missing; also used for static rendering where only a name string is in hand, e.g. ghost animations, reveal overlays). |
| `frontend/src/components/game/CardComponent.tsx` | MODIFY | Label line uses `COMPANY_TICKER[card.company]` instead of `card.company`. Power cards still show `card.company.replace(' ', '')`. Applies to both desktop and mobile. |
| `frontend/src/components/game/StockTicker.tsx` | MODIFY | Desktop: show full company name upper-cased. Mobile branch uses `company.ticker` and a single-row horizontally-scrollable strip (no sparkline, smaller card — ~72px wide). Branch on `useIsMobile()`. |
| `frontend/src/lib/playerHelpers.ts` | NEW | Extract pure `portfolioValue(player, companies)` and `getPosition(gameState, playerId, companyIdx)` from `PlayerBoard.tsx` so both desktop board and `MobilePlayerBoard` can reuse. No behaviour change. |
| `frontend/src/components/game/PlayerBoard.tsx` | MODIFY | Import helpers from `playerHelpers.ts`. No visual change. |

### Frontend — mobile infrastructure

| File | Status | What changes |
|------|--------|--------------|
| `frontend/src/hooks/useIsMobile.ts` | NEW | `matchMedia('(max-width: 767px)')`, subscribes to `change` events, returns `boolean`. SSR-safe default `false`. |
| `frontend/index.html` | MODIFY | Add `viewport-fit=cover` to the viewport meta (keeps current `width=device-width, initial-scale=1.0`). |
| `frontend/src/index.css` | MODIFY | Add `touch-action: manipulation` on buttons, `-webkit-overflow-scrolling: touch` on scroll areas, `env(safe-area-inset-bottom)` padding utility for the bottom chrome stack. |
| `frontend/src/main.tsx` | MODIFY | Sonner `<Toaster position="top-center" />` on mobile, `"bottom-right"` on desktop. Use `useIsMobile()` in a small wrapper, or just check `window.matchMedia` at render time. |

### Frontend — mobile-only components

| File | Status | What renders |
|------|--------|--------------|
| `frontend/src/components/game/DayRoundIndicator.tsx` | MODIFY | Two return paths gated by `useIsMobile()`. Desktop: unchanged. Mobile: `Day {day}/{MAX_DAYS} · Round {round+1}/{ROUNDS_PER_DAY}` + `<TurnTimerDisplay alwaysShow />` + connection dot. No Turn counter, no "Your turn!" badge. ~32px tall. |
| `frontend/src/components/game/TurnTimerDisplay.tsx` | MODIFY | Add optional `alwaysShow` prop. When true, render even when `!turnUrgency.active` — show neutral gray countdown. `useTurnUrgency()` already derives correct remaining time from `turn_timer_deadline` — no new state. |
| `frontend/src/components/game/GameBoard.tsx` | MODIFY | `useIsMobile()` + mobile tab state (`'players' \| 'logchat'`). Desktop branch unchanged. Mobile branch: `<DayRoundIndicator/>` → `<StockTicker/>` → `<MobileTabContent/>` (flex-1, scrolls) → `<MobileCardStrip/>` (pinned) → `<ActionBar/>` → `<MobileTabBar/>`. `ReconnectingBanner` stays `fixed top-0` with a hard 32px cap on mobile. |
| `frontend/src/components/game/MobilePlayerBoard.tsx` | NEW | All 6 players always visible. YOU pinned at top. Row = dot · name · holdings-pills · `$netWorth`; sub-row = `Cash $X · Stocks $Y`. Holdings are inline pills (`● VODA 40👑`) wrapping to a second line only when a player holds 4+ companies. Pulse dot + green ring on active-turn player. Auto-scrolls to active player on `current_player_name` change — two `useEffect`s (detect change into a ref, then read ref and call `scrollIntoView({block: 'nearest', behavior: 'smooth'})`). `ref` map keyed by `player.id`, never by name. Manual scroll never fights auto-scroll — auto only fires when current-player-id actually changes. |
| `frontend/src/components/game/MobileCardStrip.tsx` | NEW | Horizontally scrollable strip of all 10 cards, 44×52 normal, 52×52 power, 4px gap. Header row inlined: `YOUR CARDS (10)` label + `[View All ↑]` button as the first slot. Card body uses shared CardComponent variant at compact size. Tap selects; tap power card opens PowerCardPanel above the strip via AnimatePresence. Pinned above the ActionBar + TabBar — always visible whether Players or LogChat tab is active. |
| `frontend/src/components/game/ViewAllDrawer.tsx` | NEW | Framer-motion bottom sheet, `y: '100%' → 0` spring. Drag handle at top. All 10 cards laid out at a readable-mobile size (~64px wide) in a wrapping flex grid. Tapping a card inside selects it and closes the drawer (or opens PowerCardPanel if power). Backdrop tap + drag-down both dismiss. |
| `frontend/src/components/game/MobileTabBar.tsx` | NEW | Two tabs: `Players` · `Log+Chat`. 44px tall. Chat unread count (existing `chatUnread` from the store) shown on the Log+Chat tab. Log entries do not increment any badge. |
| `frontend/src/components/game/MobileLogChat.tsx` | NEW | Merged tab content. Reads `gameState.game_log` and `chatMessages` from the store, interleaves by timestamp, renders chat as rounded pill bubbles with the sender's coloured dot + name, renders game-log as monospace plain-text lines with a subtle `border-l` and muted colour. On mount, clears `chatUnread` via the existing store action. Existing `GameLog.tsx` (desktop) stays untouched. |
| `frontend/src/components/game/PlayerHand.tsx` | MODIFY | `useIsMobile()`: on mobile, renders `<MobileCardStrip/>` + `<ViewAllDrawer/>` instead of the current overflow row. Selection + power-card-use logic stays shared (lives in PlayerHand or a small `useHandSelection` hook extracted). Desktop branch unchanged. |
| `frontend/src/components/game/ActionBar.tsx` | MODIFY | Add `min-h-[44px]` on buttons when mobile. No structural change. |
| `frontend/src/components/game/TradeModal.tsx` | MODIFY (minor) | Company grid: `grid-cols-3` on desktop → `grid-cols-2` on mobile. Quantity buttons `w-11 h-11` (44px) on mobile. |

### Frontend — untouched

- `GameLog.tsx` — desktop only, unchanged.
- `useTurnUrgency`, `useMyPlayer`, `useIsMyTurn` — unchanged. Mobile components consume them.
- All overlays (`CardRevealOverlay`, `ChairmanDirectorModal`, `ShareSuspendOverlay`, `RightsIssueOverlay`, `DebentureOverlay`, `CurrencySettlementOverlay`, `GameOverScreen`) — not touched in this iteration. Verification audits their fit at 375px post-implementation; any overflow becomes a follow-up issue.

---

## Commit-by-commit order

Each commit is independently testable and can be merged on its own.

| # | Commit | Files | Scope |
|---|--------|-------|-------|
| 1 | Add `ticker` to the Company data model (backend + frontend types) | `engine/constants.py`, `engine/models.py`, `engine/deck.py` (if needed), `types/game.ts`, `lib/constants.ts` (fallback map) | Shared |
| 2 | CardComponent + StockTicker use `ticker` / CAPS | `CardComponent.tsx`, `StockTicker.tsx` | Desktop + Mobile |
| 3 | `useIsMobile` hook + viewport-fit=cover + safe-area CSS + mobile Sonner position | `hooks/useIsMobile.ts`, `index.html`, `index.css`, `main.tsx` | Mobile infra |
| 4 | Extract `playerHelpers.ts` | `lib/playerHelpers.ts`, `PlayerBoard.tsx` | Pure refactor |
| 5 | StockTicker mobile branch (single-row scroll, no sparklines) | `StockTicker.tsx` | Mobile |
| 6 | `TurnTimerDisplay.alwaysShow` + mobile `DayRoundIndicator` variant | `TurnTimerDisplay.tsx`, `DayRoundIndicator.tsx` | Mobile |
| 7 | `MobilePlayerBoard` — always-visible rows + auto-scroll | `MobilePlayerBoard.tsx` | Mobile |
| 8 | `MobileCardStrip` + `ViewAllDrawer` + `PlayerHand` mobile branch | `MobileCardStrip.tsx`, `ViewAllDrawer.tsx`, `PlayerHand.tsx` | Mobile |
| 9 | `MobileTabBar` + `MobileLogChat` (merged tab) + `GameBoard` mobile branch | `MobileTabBar.tsx`, `MobileLogChat.tsx`, `GameBoard.tsx` | Mobile |
| 10 | ActionBar touch targets + TradeModal grid/quantity buttons on mobile | `ActionBar.tsx`, `TradeModal.tsx` | Polish |

Commits 1–2 are the only ones that show up visually on desktop (CAPS tickers and TICKER card labels). Commits 3–10 are invisible on desktop because every branch is gated by `useIsMobile()` → `false` at ≥768px.

---

## Dev-history pitfalls we must not re-earn (from v3 §10, applied concretely)

- **All hooks declared above every conditional return** in `MobilePlayerBoard`, `MobileCardStrip`, `ViewAllDrawer`, `MobileLogChat`. The Phase-4 black-screen bug was exactly this pattern.
- **`ref` map keyed by `player.id`**, never `player.name`. React `key=` on rows is `player.id` too. (Phase-2 portfolio key collision.)
- **Two `useEffect`s for auto-scroll**: one detects `current_player_name` change into a `useRef`, one reads the ref and calls `scrollIntoView`. Not a single combined effect. (Phase-3 suspend-timer cleanup bug.)
- **Auto-scroll gated by `gameState.phase === 'player_turn'`** and `current_player_id !== prevRef.current`. Do not scroll on every broadcast. (Phase-5 ghost suspend animations.)
- **Card strip renders `gameState.your_hand` via `useMemo` every render.** No accumulator, no cached card list. Selection is a single `selectedIdx: number | null`. (Phase-2 duplicate card bug.)
- **TurnTimer stays deadline-driven** via `useTurnUrgency()` — no new local `remaining` state. (Phase-7 absolute-deadline rule.)
- **`ReconnectingBanner`** capped 32px, `fixed top-0`, never `bottom`. Text shrinks to "Reconnecting…" on <400px. (Phase-6 resilience.)
- **Sonner toast position `top-center` on mobile** so "Action queued" doesn't sit behind the ActionBar. (Phase-6 pendingRef queue.)
- **`useMyPlayer` / `useIsMyTurn` unchanged** — the sub-phase queue resolution stays shared between desktop and mobile. No mobile-only "active player" logic. (Phases 2–4 sub-phase queues.)
- **No optimistic updates on mobile.** Buy/Sell disables briefly until the server broadcast lands. (Phase 0–2 server-authoritative contract.)

---

## Verification (end-to-end)

Run locally in two terminals:

```bash
# Terminal 1
cd backend && uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Terminal 2
cd frontend && npm run dev
```

Then, with Chrome DevTools device emulation at **iPhone SE (375×667)** and **Pixel 5 (393×851)**, and on real iOS Safari / Android Chrome:

1. **Layout fit** — On iPhone SE, ensure no scroll on the outer container. All 6 player rows visible after auto-scroll to the active player. Card strip, ActionBar, and TabBar all visible simultaneously. No content hidden behind the iOS home indicator.
2. **Desktop regression check** — Open a 1440px window: the layout looks exactly like main except for CAPS tickers and TICKER card labels.
3. **Ticker + cards** — Desktop shows `VODAFONE`, `YESBANK`, `CRED`, `TCS`, `RELIANCE`, `INFOSYS` (or `INFO` depending on final space); mobile shows `VODA` … `INFO`. Cards on both show the 4-char ticker in the header.
4. **Turn flow** — Multi-tab game (open 3 tabs in mobile emulation as three players). As the turn advances, mobile auto-scrolls to each player's row. Manual scroll during someone else's turn is not fought.
5. **Card strip** — All 10 cards reachable via horizontal scroll. Selected card shows the green ring. Power card tapped opens PowerCardPanel above the strip. `View All ↑` opens the drawer, cards in drawer tappable, backdrop tap dismisses.
6. **Log+Chat merge** — Post several chat messages while game events happen. Entries are interleaved in timestamp order. Chat entries render as bubbles, log entries as monospace lines. Chat unread badge on the tab increments when Players tab is active, clears on switch.
7. **Reconnection** — Kill the dev server for 5s while a mobile tab is open. `ReconnectingBanner` appears at top, ≤32px, does not cover ActionBar. Turn timer stays correct after reconnect (deadline-driven). Game log shows the disconnect/reconnect entries.
8. **Timer** — `TurnTimerDisplay alwaysShow` renders neutral countdown for other player's turns on mobile; switches to urgency colours on your own turn.
9. **Strict Mode double-render** — Keep `<React.StrictMode>` on; play 2 full days on mobile. No duplicate log entries, no duplicate reveals, no React key warnings in console.
10. **Overlay audit at 375px** — Trigger CardReveal, ChairmanDirector (with a 150+ share chairman+director stack), RightsIssue, ShareSuspend, Debenture, CurrencySettlement, GameOver. Each modal fits within the viewport, scrolls internally when needed, all buttons ≥44px tall. Any overflow → separate follow-up issue, not part of this plan.
11. **Run the integration test** — `python tests/test_game.py` from repo root. Passes without change (pure engine + server, untouched by this plan).

---

## Answer to the cross-cutting question

> **Will every future change require edits for mobile and desktop separately?**

No. After this plan lands, the split is:

- **Business logic, state, networking, the engine, phase transitions, card reveal rules, chairman/director logic** — all live above the mobile/desktop fork. A new action, a new power card, a new game-log entry type, a new WebSocket message, a store slice change, a server rule tweak — each is written once and works on both.
- **Visual layout of the main game frame** — grid vs list, sidebar vs tab, always-visible strip vs drawer — is where mobile and desktop diverge. There are only a handful of files where this divergence lives (`GameBoard`, `DayRoundIndicator`, `StockTicker`, `PlayerHand`, and the mobile-only components listed above). A *new* layout shape (e.g. a new overlay, a new pinned panel) would need both renderings; adding content *inside* an existing shape does not.
- **Shared components like `CardComponent`, `TurnTimerDisplay`, overlays, modals** — one source, rendered at both scales. Responsive classes (`md:` prefix) do the bulk of the work; `useIsMobile()` is only used where the structure differs, not just the sizing.

The practical rule: if you catch yourself writing two near-identical components with only CSS differences, extract a shared one and use Tailwind responsive prefixes. `useIsMobile()` is reserved for *branching behaviour* (which overlay, which tab shape), not styling.
