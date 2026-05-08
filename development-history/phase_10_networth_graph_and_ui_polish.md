# Phase 10 — Networth Graph & UI Polish (tutorial-bugs fixes)

## Goals

Fix a cluster of tutorial-surfaced UI bugs and add a standings graph to the Share Suspend overlay, giving players meaningful context between the closing bell and the next deal.

1. **Networth graph** — animated per-player networth line chart shown during `share_suspend`, seeded by a post-settlement snapshot and re-animated live after each swap.
2. **Stock ticker prev→value display** — replace `value (±diff)` with the cleaner `prev → value` pattern across all four StockTicker viewport variants.
3. **Card reveal polish** — show `old_value → New Value` label, pulse the value on chairman/director recompute, extend the hold timer so players can register the change.
4. **Chairman/director early broadcast** — fix a race where `auto_advance` walked past `card_reveal` before clients received the recomputed delta.

---

## Architecture — Networth History

### Backend

`GameState.networth_history` is a list of `dict[player_id → int]` snapshots, one per day. Day 0 is written in `__init__` (starting cash, no shares). Subsequent days are written by `_snapshot_networth()` in `phases.py`.

Two triggers write/overwrite the snapshot for the current day:

| Trigger | Where | When |
|---------|-------|------|
| A — post-settlement | `_finalize_card_reveal` | After all card effects and currency settlement are applied |
| B — post-swap | `share_suspend_action` | After each company value swap (SS card exercised) |

Because `game_state.current_day` has already advanced to `N+1` by the time `_finalize_card_reveal` runs, `_snapshot_networth` writes into `history[N]` (the just-completed day), using `while len < day: append({})` to fill any gaps.

Networth formula: `cash + Σ(held × value)` for **open** companies only. Closed companies contribute 0 — consistent with the frontend `portfolioValue` computation and the game-over ranking.

`to_dict` / `to_player_dict` both serialize the list; `build_client_state` passes it through unchanged.

### Frontend — NetworthGraph component

`NetworthGraph.tsx` is a pure imperative SVG component rendered via a `useEffect` that re-runs whenever `replayKey` changes. The caller bumps `replayKey` on Trigger A (history length grows) and Trigger B (last snapshot content changes). This gives a clean animation restart without any internal state.

Key design choices:

- **Log scale on Y** — prevents a wealthy leader from crushing everyone else into a flat line. Uses `scaleLog` with a 300–`maxNW×1.18` domain.
- **Animated new segment only** — static history (days 0…N-1) is drawn immediately; only the segment entering day N animates with a `stroke-dashoffset` CSS transition over `TRAVEL_MS = 3200ms`. The dot and name label ride alongside for the full travel.
- **Overtake flourish** — if player A was below player B yesterday but is above them today, a gold ring expands and fades over the dot at the end of travel.
- **Active player halo** — the current suspend-queue holder gets a thicker line and a glow halo.
- **`TRAVEL_MS` is exported** so `ShareSuspendOverlay` can synchronise the countdown start (`TRAVEL_MS + 200ms` delay).

`playerColors.ts` is a new 6-slot palette distinct from the company color map, ensuring player lines never visually merge with the stock ticker lines.

### Frontend — ShareSuspendOverlay integration

The overlay gained a `backendReady` flag (set once the snapshot phase is confirmed — `share_suspend`, `day_end`, `dealing`, `player_turn`, or `game_over`) that gates both the graph animation and the countdown. This keeps all clients synchronized: the backend broadcasts the finalized state to everyone at the same moment, so `backendReady` flips simultaneously across the room.

Countdown changed from 15 s to **5 s**, starting only after the graph travel animation finishes. A "Waiting for players to finish" dot-bounce indicator fills the top-right corner before `backendReady`.

A "SS APPLIED" gold pill replaces the day-number pill whenever Trigger B has fired at least once — giving a clear visual confirmation that a share suspend swap changed the standings.

Company value grid in the overlay was reformatted from `value (±diff)` to `prev → value` with color on the new value, consistent with the StockTicker changes.

---

## Bugs Fixed

### 1. Chairman/director discard race — `broadcast_game_state` ordering

**Symptom:** The last chairman/director discard for the last company triggered `_finalize_card_reveal` which walked through `share_suspend → dealing` (via `auto_advance`). By the time the broadcast reached clients, `reveal_data` was empty. The `CardRevealOverlay`'s recomputed delta/new_value pulse had nothing to render.

**Fix:** In `handle_action`, for `chairman_director` actions specifically, broadcast state *before* calling `auto_advance`. This gives clients a window to see the updated `reveal_data` before it's cleared. The subsequent post-`auto_advance` broadcast is harmless (idempotent for clients that already advanced).

**Location:** `backend/server.py`, `handle_action`.

### 2. CardRevealOverlay value label

- Added `old_value` to the label so players see `$X → New Value: $Y` instead of just `New Value: $Y`.
- Re-keyed the `motion.p` on `new_value` so chairman/director discards that recompute the company total trigger a spring-scale pulse animation ("this just changed" beat).
- Extended the post-CD hold timer from 600 ms to 2200 ms so players have time to register the change before the overlay advances.

**Location:** `frontend/src/components/game/CardRevealOverlay.tsx`.

### 3. StockTicker delta noise

The old `+N` / `−N` suffix was noisy when the number was small. Replaced with `prev → value` across all four viewport variants (compact card, expanded card, mobile list, desktop list). The current value is colored green/red/neutral by direction; the arrow and prev value are muted.

**Location:** `frontend/src/components/game/StockTicker.tsx`.

---

## Files Changed

| File | Change |
|------|--------|
| `backend/engine/models.py` | `GameState.networth_history` field + serialization |
| `backend/engine/phases.py` | `_snapshot_networth()`, Trigger A + B call sites |
| `backend/server.py` | Pass `networth_history` through `build_client_state`; early broadcast for `chairman_director` |
| `frontend/src/types/game.ts` | `networth_history: Record<string, number>[]` on `GameState` |
| `frontend/src/lib/playerColors.ts` | New 6-slot player color palette |
| `frontend/src/components/game/NetworthGraph.tsx` | New animated SVG chart component |
| `frontend/src/components/game/ShareSuspendOverlay.tsx` | NetworthGraph integration, `backendReady`, 5s countdown, SS APPLIED pill, prev→value grid |
| `frontend/src/components/game/StockTicker.tsx` | prev→value display across all variants |
| `frontend/src/components/game/CardRevealOverlay.tsx` | old→new label, re-keyed value pulse, extended hold timer |
