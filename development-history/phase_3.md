# Phase 3: UI Restructure, Bug Fixes, and Share Suspend Sync

## Goal

Major UI redesign of the game board layout, fix chairman/director bugs, add power card animations, synchronize card reveal across all players, and add share suspend phase with animations and countdown timer.

## What Changed

### Bug Fix: Chairman promotion via Rights Issue

**Problem:** A player reaching 100 shares through `rights_issue_buy()` was promoted to "double director" instead of chairman because that function never called `update_positions()`.

**Fix:** Added `update_positions(game_state, player, company.name)` call in `actions.py` after shares are purchased in `rights_issue_buy()`.

### Bug Fix: Chairman/Director discard improvements

- **Pass option:** Added ability to pass on chairman/director discard (`discard_own_idx == -1`). Frontend shows a Pass button in `ChairmanDirectorModal`.
- **Turn priority ordering:** CD queue is now sorted by the day's turn order within each company using `player_order = {p.id: i for i, p in enumerate(game_state.players)}`.
- **Delta recomputation:** After a card is discarded, `_recompute_reveal_for_company()` recalculates the reveal_data delta so the animation reflects the updated values.

### Bug Fix: `prev_value` showing base values instead of last day's close

**Problem:** Stock ticker diffs showed change from day-0 base prices instead of previous day's closing prices.

**Fix:** `build_client_state()` in `server.py` now uses `price_history[-1]` (last day's closing snapshot) for `prev_value`, falling back to `base_value` only on day 1.

### Backend: Price history and card reveal sync

- **Price history:** `GameState` tracks `price_history` (list of per-company value snapshots). `end_day()` appends current prices. Sent to frontend for sparkline charts.
- **Card reveal sync:** `complete_card_reveal()` now tracks per-player completion via `reveal_complete_players` set. Values are only applied when ALL players have finished the animation, preventing one player from advancing the phase while another is still watching.
- **`deal_cards()`** clears `reveal_complete_players` at the start of each day.

### Frontend: Complete layout restructure

Old layout: stock ticker, trade panel (left), portfolio (center), game log + hand (right).

New layout:
```
┌──────────────────────────────────────────────────────────────┐
│  Day X/10  ·  Round Y/3  ·  Turn Z/N       Room: ABCD  ●    │
├──────────────────────────────────────────────────────────────┤
│  [Vodafone $25 ▁▂▃ +5] [YesBank $30 ▄▃▂ -3] [TCS ...] ...  │
├─────────────────────────────────────────┬────────────────────┤
│         PLAYER BOARD (3×2 grid)         │   Game Log         │
│                                         │   (scrollable,     │
│  ┌─────────────┐  ┌─────────────┐  ... │    latest entry     │
│  │ Name  $NW   │  │ Name  $NW   │      │    highlighted)     │
│  │ Cash / Stk  │  │ Cash / Stk  │      │                    │
│  │ Holdings    │  │ Holdings    │      │                    │
│  └─────────────┘  └─────────────┘      │                    │
├─────────────────────────────────────────┴────────────────────┤
│  [ Buy ]  [ Sell ]  [ Pass ]   ← or "Waiting for ..."       │
├──────────────────────────────────────────────────────────────┤
│  🃏 [+15 TCS] [-5 Voda] [RightsIssue] [LoanStock] ...       │
└──────────────────────────────────────────────────────────────┘
```

### Frontend: New components

| Component | Purpose |
|-----------|---------|
| `PlayerBoard.tsx` | Center 3×2 grid showing all players' cash, net worth, holdings with company colors, chairman/director icons (Crown/Target from Lucide), loan stock piggy bank animation. Fixed 6-slot layout with empty placeholders for <6 players. Current turn player highlighted with emerald ring. |
| `ActionBar.tsx` | Bottom bar with Buy/Sell/Pass buttons. Colored when your turn, grayed + "Waiting for..." otherwise. Buy/Sell open TradeModal. |
| `TradeModal.tsx` | Modal with company selector grid, quantity stepper (±1, ±5), cost preview, balance after, confirm button. |
| `RightsIssueOverlay.tsx` | Full-screen handshake animation: two hand emojis slide in from sides, meet in center with "Rights Issue Announced — [Company]". Auto-dismisses after 2.5s. |
| `DebentureOverlay.tsx` | Full-screen phone animation: receiver drops from top, rings/swings with "[Company] is back in business!". Auto-dismisses after 2.5s. Triggered by detecting "reopened" in game log. |

### Frontend: Modified components

| Component | Changes |
|-----------|---------|
| `GameBoard.tsx` | Complete layout rewire. Decoupled `animPhase` always transitions card_reveal → share_suspend → currency_settlement. Detects rights_issue phase entry and debenture actions via game log for overlay triggers. |
| `StockTicker.tsx` | Added inline SVG sparkline showing last 5 days + current value from `price_history`. Company-colored strokes. |
| `DayRoundIndicator.tsx` | Added "Turn X/N" display. |
| `GameLog.tsx` | Latest entry highlights with emerald left border + background flash for 2 seconds. |
| `ChairmanDirectorModal.tsx` | Added Pass button, sends `discard_own_idx: -1`. |
| `CardRevealOverlay.tsx` | Fixed `useRef` initialization for TypeScript strict mode. |
| `ShareSuspendOverlay.tsx` | Complete rewrite (see below). |

### Frontend: Deleted components

- `TradePanel.tsx` — replaced by `ActionBar.tsx` + `TradeModal.tsx`
- `Portfolio.tsx` — replaced by `PlayerBoard.tsx`

### Share Suspend: Sync, animation, and countdown

The share suspend overlay went through several iterations to get right:

**Key challenges solved:**
1. **Backend phase races frontend:** When the suspend queue empties, the backend immediately calls `_finalize_suspend()` which advances to `currency_settlement`. The overlay can't check `gameState.phase === 'share_suspend'` — it's already gone. Solution: the overlay is mount-controlled by `animPhase` in GameBoard and ignores the backend phase entirely.

2. **Animation cleanup killing timers:** A single `useEffect` that both set `currentAnim` and started a `setTimeout` to clear it would cancel the timeout on re-render (cleanup runs when dependencies change). Solution: split into two effects — one to dequeue, one to auto-clear after 2.5s.

3. **Timer not starting:** Using `useRef` guards and `setTimeout` delays for timer start created race conditions where the timer never fired. Solution: simple `useEffect` with `setCountdown(15)` — condition `hasQueue || animBusy || countdown !== null` gates it; no refs needed.

**Final design:**
- After card reveal, GameBoard always sets `animPhase` to `share_suspend`
- Overlay shows "Share Suspend" title with prices table (always visible)
- If suspend cards exist: players take turns selecting companies or passing
- Each suspend action triggers a HALTED animation banner (queued sequentially for multiple players)
- When queue empty + animations done: 15s countdown starts, timer in top right
- Timer turns red at ≤5s
- At 0: `onComplete()` transitions to currency settlement overlay
- "No share suspend cards this round" shown when no cards existed

## Files Modified

### Backend
- `engine/actions.py` — `update_positions()` call in `rights_issue_buy()`
- `engine/models.py` — `price_history`, `reveal_complete_players` fields
- `engine/phases.py` — CD pass/ordering/recompute, card reveal sync, price history snapshot
- `server.py` — `prev_value` fix, `price_history`/`num_players` in client state, `player_id` to `complete_card_reveal`

### Frontend
- `types/game.ts` — `num_players`, `price_history` fields
- `components/game/GameBoard.tsx` — Layout rewire + overlay orchestration
- `components/game/ShareSuspendOverlay.tsx` — Full rewrite with animation queue + timer
- `components/game/StockTicker.tsx` — Sparkline charts
- `components/game/DayRoundIndicator.tsx` — Turn counter
- `components/game/GameLog.tsx` — Entry highlighting
- `components/game/ChairmanDirectorModal.tsx` — Pass button
- `components/game/CardRevealOverlay.tsx` — useRef fix
- New: `ActionBar.tsx`, `TradeModal.tsx`, `PlayerBoard.tsx`, `RightsIssueOverlay.tsx`, `DebentureOverlay.tsx`
- Deleted: `TradePanel.tsx`, `Portfolio.tsx`

## Bugs Encountered and Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Player with 104 shares shown as double director instead of chairman | `rights_issue_buy()` didn't call `update_positions()` | Added the call |
| Stock ticker diff showing change from day 0 | `prev_value` used `base_value` instead of last day's close | Use `price_history[-1]` |
| Share suspend overlay stuck with no timer | Backend phase already `currency_settlement` when queue empty; overlay checked phase | Ignore backend phase, use mount-controlled state |
| HALTED animation never cleared | Single effect's cleanup killed the setTimeout on re-render | Split into dequeue + auto-clear effects |
| Timer never started (no suspend cards case) | `useRef` guard + `setTimeout` delay race condition | Simple effect with direct `setCountdown(15)` |
| Card reveal desync between players | No sync mechanism; first player to finish advanced the phase | Per-player tracking via `reveal_complete_players` set |
| Build error: unused imports | `cn` in ActionBar, `activePlayerId` in ChairmanDirectorModal | Removed unused bindings |
| Build error: `useRef()` no argument | TypeScript strict mode requires initial value | Changed to `useRef<...>(undefined)` |
