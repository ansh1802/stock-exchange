# Phase 4: Chairman/Director Fixes, Debug Presets, Crash Fix

## Goal

Fix chairman/director discard bugs (indexing, partial exercise, hooks crash), add debug preset system for testing, and support chairman+director stacking for high-shareholding players.

## What Changed

### Bug Fix: React hooks violation crash (black screen)

**Problem:** After the last chairman/director discard, both players got a black screen. Console showed: `Rendered fewer hooks than expected. This may be caused by an accidental early return statement.` in `ChairmanDirectorModal`.

**Root cause:** `ChairmanDirectorModal.tsx` had an early `return null` (line 27) *before* the `useMemo` hook. When the CD queue emptied after the last discard, the component re-rendered, hit the early return, React saw fewer hooks than the previous render, and crashed the entire component tree — including `CardRevealOverlay`, causing the black screen.

**Fix:** Moved all hooks (`useState` x2, `useMemo` x2) above every conditional return. Derived `queueEntry`, `companyName`, `role` as simple variables from the queue, with the `return null` placed after all hooks.

### Bug Fix: Chairman other-card index mismatch

**Problem:** Selecting certain cards from the "Remove from another player" list caused an "Invalid card index" error.

**Root cause:** The frontend was sending `cardIdx` as the index in the other player's *full hand* (from `all_hands[playerId]`), but the backend expected the index within the *filtered company-only cards*. If the other player had non-matching cards before their company cards, the indices diverged.

```tsx
// BEFORE (bug): ci is index in full hand
hand.forEach((c, ci) => {
  if (c.company === companyName && !c.is_power) {
    cards.push({ playerId: p.id, cardIdx: ci, ... })  // wrong index
  }
})

// AFTER (fix): count only matching cards
let companyIdx = 0
for (const c of hand) {
  if (c.company === companyName && !c.is_power) {
    cards.push({ playerId: p.id, cardIdx: companyIdx, ... })
    companyIdx++
  }
}
```

### Bug Fix: Chairman "passed" when discarding only other's card

**Problem:** When chairman selected only an other player's card (no own card) and clicked "Confirm Discard", the backend returned "Chairman passed" instead of performing the discard.

**Root cause:** The backend's early pass check was `if discard_own_idx == -1:` which triggered whenever no own card was selected, regardless of whether an other-player card was selected. The chairman handler that supported partial exercise (own only, other only, both) was never reached.

**Fix:** Changed check to `if discard_own_idx == -1 and discard_other_player_id is None:` — only a true pass when *both* own and other are unselected.

### Chairman/Director UI rewrite

The `ChairmanDirectorModal` was rewritten cleanly:
- **Aggregated card view:** Other players' cards shown as a flat list (no per-player grouping). Each card shows `+/-value` with company color.
- **Partial exercise for chairman:** Own card section and other-player section both labeled "(optional)". Chairman can discard own only, other only, both, or pass.
- **Double director flexibility:** Can now discard 1 or 2 cards (was forced to pick exactly 2). Label shows "Discard 1-2 of your cards".
- **Pass button:** Always available, side-by-side with Confirm Discard.

### Chairman + Director stacking (150+ / 200+ shares)

**Feature:** A player holding 150+ shares of a company is both chairman AND director. They now get two sequential queue entries — chairman power first, then director power with the updated hand.

- 150+ shares: Chairman (discard own + remove other's) → Director (discard 1 own) = up to 3 total discards
- 200+ shares: Chairman (discard own + remove other's) → Double Director (discard 1-2 own) = up to 4 total discards

**Implementation:** `_build_chairman_director_queue()` in `phases.py` now checks if the chairman's holdings exceed `CHAIRMAN_THRESHOLD + DIRECTOR_THRESHOLD` (150) and adds a second entry. Chairman entries are queued first, then director entries, each group sorted by turn order.

### Debug preset system

**New file:** `backend/engine/debug_presets.py`

A decorator-based preset registry for testing specific game scenarios without playing through manually:

```python
@preset("chairman", "P1 chairman (100 shares), P2 director (75). Both have cards. Last round.")
def preset_chairman(game):
    # ... manipulate game state
```

Six presets available:
- `chairman` — P1 chairman, P2 director of Reliance
- `chairman_no_own_cards` — P1 chairman with no own cards, P2 director has cards
- `double_director` — P1 chairman + P2 double director of Cred
- `share_suspend` — Both players hold ShareSuspend power cards
- `currency` — P1 has Currency+, P2 has Currency-
- `all_powers` — Chairman + ShareSuspend + Currency cards combined

Helper functions: `_inject_company_cards()`, `_remove_company_cards()`, `_inject_power_card()`, `_fast_forward_to_last_round()`.

**Frontend integration:** `StartButton.tsx` shows a toggle-able debug preset selector. Each preset button sends `{ type: 'start_game', preset: key }`.

**Production-safe:** Debug presets are only triggered when a `preset` field is explicitly sent in the `start_game` message. Normal game start ignores them entirely. No code needs to be reverted for deployment.

### Server error handling improvements

- `dispatch_action` catch block widened to `Exception` with `traceback.print_exc()` for better debugging
- WebSocket message loop wraps `handle_action` in try/except to prevent connection crashes on server errors
- `broadcast_game_state` exception handler now prints traceback before marking player disconnected

### CardRevealOverlay cleanup

- Added cleanup return to CD queue watcher effect (prevents stale timer from firing after unmount)
- Content area given `mt-20 max-h-[calc(100vh-6rem)] overflow-y-auto` to fix header text overlapping card list
- Spacing reduced from `space-y-6` to `space-y-4` for better vertical fit

## Files Modified

### Backend
- `engine/phases.py` — Chairman pass fix, double director 1-2 cards, chairman+director stacking, CHAIRMAN_THRESHOLD/DIRECTOR_THRESHOLD imports
- `server.py` — Debug preset support in `handle_start_game`, `list_presets` action, widened exception handling with tracebacks
- `engine/debug_presets.py` — **New file.** Decorator-based preset registry with 6 test scenarios

### Frontend
- `components/game/ChairmanDirectorModal.tsx` — Full rewrite. Hooks above returns, aggregated card view, partial exercise, flexible double director, fixed other-card indexing
- `components/game/CardRevealOverlay.tsx` — CD timer cleanup, overflow fix, spacing fix
- `components/lobby/StartButton.tsx` — Debug preset selector UI
- `types/messages.ts` — `start_game` optional `preset` field, `chairman_director` type updated for nullable other-player fields

## Bugs Encountered and Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Black screen after last CD discard | `useMemo` hook called after early `return null` — React hooks violation crashed component tree | Move all hooks above conditional returns |
| "Invalid card index" on chairman other-card selection | Frontend sent full-hand index, backend expected filtered-company-card index | Use filtered index counter instead of `forEach` index |
| "Chairman passed" when discarding only other's card | Early pass check `discard_own_idx == -1` fired before chairman handler | Add `and discard_other_player_id is None` to pass condition |
| Header text overlapping card list in reveal overlay | No top margin or max-height on content area | Added `mt-20 max-h-[calc(100vh-6rem)] overflow-y-auto` |
| Double director forced to pick exactly 2 cards | Backend validation `len(discard_own_idx) != 2` | Changed to `not in (1, 2)` |
