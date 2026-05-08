# Phase 9 — Tutorial Infrastructure & Currency Settlement Refactor

## Goals

Two independent workstreams shipped together:

1. **Tutorial infrastructure** — give new players a way to learn the game without jumping into a live room. Three-surface plan: scripted bot walkthrough (stubbed, long build), static rulebook (ships now), first-encounter tooltips (ships now).
2. **Currency settlement phase collapse** — the dedicated `currency_settlement` phase and its overlay were a separate animation stop requiring a second frontend ack (`complete_currency_settlement`). The architecture was clean but added unnecessary round-trips and a full AnimationPhase state that only existed to sequence one overlay. Collapsed it into `card_reveal` so a single `reveal_complete` ack covers everything.

---

## Architecture — Tutorial

### Surfaces

| Surface | Route | Ships in Phase 9? |
|---------|-------|-------------------|
| A — Scripted walkthrough | `/tutorial` | Stub only (multi-week build) |
| B — Rulebook | `/rulebook`, `/rulebook/:chapterId` | ✅ Full |
| C — First-encounter tooltips | In-game overlays | ✅ Full |

### New files

- **`frontend/src/pages/TutorialPage.tsx`** — hub page linking all three surfaces. Surface A is a "coming soon" panel; surfaces B and C are fully wired. Also exposes a toggle to disable first-encounter tips (stored in localStorage).
- **`frontend/src/pages/RulebookPage.tsx`** — index view (chapter list with estimated read times) and chapter detail view. Uses `useParams` to fork between the two. Inline prev/next navigation.
- **`frontend/src/tutorial/chapters.tsx`** — 10 chapters exported as `CHAPTERS: RulebookChapter[]`. Each chapter has an `id`, `title`, `subtitle`, `seconds` (read-time estimate), and a JSX `body`. Inline diagram primitives (`CardChip`, `Diagram`, `EdgeCase`) keep chapter content self-contained without external components.
- **`frontend/src/lib/tutorialStorage.ts`** — thin localStorage wrapper: `isCompleted()`, `setCompleted()`, `areTipsDisabled()`, `setTipsDisabled()`, `markTipSeen(id)`, `hasTipBeenSeen(id)`. Handles missing/corrupted JSON gracefully.
- **`frontend/src/hooks/useFirstEncounterTip.ts`** — returns `{ show, dismiss }` for a named tip. Shows only once (checks tutorialStorage), auto-dismisses after configurable `autoDismissMs`. Skips entirely when tips are disabled.
- **`frontend/src/components/tutorial/Coachmark.tsx`** — anchored tooltip overlay for first-encounter tips. Accepts `anchorRef` + `placement` to position relative to any DOM element. Framer-motion enter/exit.
- **`frontend/src/components/tutorial/Spotlight.tsx`** — cut-out spotlight that dims everything except a rect around the anchor. Shares the same placement logic as `Coachmark`.

### Routing

Two new routes added to `App.tsx`:

```
/tutorial             → TutorialPage
/rulebook             → RulebookPage (index)
/rulebook/:chapterId  → RulebookPage (chapter detail)
```

A "Learn to play" link appears in the v2 lobby below the join/create form (only rendered when `useTheme() === 'v2'`). Desktop v1 lobby is unchanged.

---

## Architecture — Currency Settlement Collapse

### Before

```
card_reveal  → STOP (frontend animates cards, sends reveal_complete)
share_suspend → STOP (frontend animates suspend picker, sends share_suspend_done / skips)
currency_settlement → STOP (frontend animates cash delta, sends complete_currency_settlement)
day_end → dealing → ...
```

The currency settlement overlay (`CurrencySettlementOverlay`) was a standalone component mounted by `GameBoard` when `animPhase === 'currency_settlement'`. It received its data from `gameState.currency_effects` (populated live during the phase). The problem: by the time all players sent their `reveal_complete` ack, the backend had already cleared `currency_effects` from the state, so latecomers saw an empty overlay.

### After

```
card_reveal  → STOP (frontend animates cards + currency settlement tail, sends reveal_complete)
share_suspend → STOP (frontend animates suspend picker)
day_end → dealing → ...
```

Currency effects are **snapshotted** in `begin_card_reveal` — before any chairman/director discards or multi-player `reveal_complete` races — and emitted to all clients via the regular `game_state` broadcast. The frontend's `CardRevealOverlay` reads and freezes this snapshot into a `currencyRef` on first non-empty read, so it's immune to later state updates clearing the list.

Effects are **applied** (cash mutated) in `_finalize_card_reveal`, alongside card value changes, and then cleared. So values are correct whether the player reconnects before or after finalize.

### What was deleted

- **`backend/engine/phases.py`** — `currency_settlement()` and `complete_currency_settlement()` functions removed. `_finalize_suspend` now advances to `day_end` instead of `currency_settlement`.
- **`frontend/src/components/game/CurrencySettlementOverlay.tsx`** — deleted entirely.
- **`frontend/src/components/game/GameBoard.tsx`** — `currency_settlement` removed from `AnimationPhase` union; `handleCurrencyComplete` removed; `animPhase === 'currency_settlement'` branch removed. `handleSuspendComplete` now calls `setAnimPhase('none')` directly.
- **`frontend/src/types/messages.ts`** — `complete_currency_settlement` removed from `ClientMessage` union.
- **`backend/server.py`** — `complete_currency_settlement` case removed from action dispatch; auto-advance comment updated.

### What was added

- **`GameState.currency_effects`** field (list) initialised in `__init__`, serialised in both `to_dict()` and `to_player_dict()`. Populated by `begin_card_reveal`, consumed by `_finalize_card_reveal`.
- **`CardRevealOverlay`** — `currency_settlement` stage added to the `Stage` union. After the last company's `final_value` stage, the overlay sequences through each currency effect staggered at 600 ms intervals with an 800 ms intro and 1 500 ms tail before emitting `reveal_complete`. Currency effects are frozen in a `currencyRef` to protect against race-cleared state.
- **`types/game.ts`** — `CurrencyEffect` interface added; `currency_effects: CurrencyEffect[]` added to `GameState`.

### Server broadcast addition

`server.py`'s `build_client_state` now includes `previous_values` (the pre-card-reveal company value snapshot) in every client state so `ShareSuspendOverlay` can show the pre-fluctuation value as the swap target. Previously this required a workaround.

---

## Visual Refactor v2 (editorial-casino theme)

Shipped alongside tutorial work. The theme is opt-in via `useTheme()` hook (reads a `localStorage` flag). All existing game components continue to render with the v1 (dark/glass) theme unchanged.

### New files

- **`frontend/src/theme-v2.css`** — full CSS custom-property palette: `--color-felt` (dark green baize), `--color-paper` / `--color-paper-2` (warm ivory card stock), `--color-ink` / `--color-ink-muted`, `--color-gold` / `--color-gold-deep` / `--color-gold-soft`, `--color-buy` / `--color-sell`. DM Serif Display imported as `--font-display`.
- **`frontend/src/hooks/useTheme.ts`** — reads `localStorage.getItem('theme')`, returns `'v2'` or `'v1'`.
- **`frontend/src/lib/sortHand.ts`** — pure sort function: company cards sorted by company number (1–6), power cards last, stable within each group.

### Modified files

- **`LobbyPage`** — full v2 variant behind `theme === 'v2'` check. Editorial wordmark (`STOCK / Exchange`), paper-card join form, "Learn to play" link.
- **`CardComponent`** — redesigned with paper texture, serif value, TICKER sub-label, `compact` prop.
- **`StockTicker`** — v2 branch renders horizontal pill strip with serif company names and `↑/↓` arrows.
- **`GameOverScreen`** — v2 variant with podium layout, serif display, gold/silver/bronze medal spots.
- **`PlayerHand`** — calls `sortHand()` on the hand before rendering in v2 mode.

---

## Bug fixes

### Card reveal: new value duller than delta

**Symptom:** In `final_value` stage the "NEW VALUE" text was rendered in `text-emerald-300` / `text-red-300`, which is visually lighter than the "DELTA" text using `text-emerald-400` / `text-red-400`. The final value — the actual outcome — should draw the eye more strongly than the intermediate running total.

**Fix:** `CardRevealOverlay.tsx` line ~376: changed new-value colour classes from `-300` to `-400` variants (`text-emerald-400`, `text-red-400`, `text-gray-400`).

---

## Pitfalls avoided

- **Currency snapshot race** — backend clears `currency_effects` on finalize once all `reveal_complete` acks land. By freezing into `currencyRef` on first non-empty read, `CardRevealOverlay` stays immune to the cleared state regardless of which player triggered finalize.
- **`currency_settlement` AnimationPhase ghost** — in Phase 5 / 6 we learned that ghost overlays appear when `animPhase` advances before the backend phase confirms. Removing the phase entirely (not just the overlay) eliminates the ghost vector entirely.
- **Hooks above every conditional** — `TutorialPage` and `RulebookPage` follow the Phase-4 rule: all `useState` / `useEffect` hooks declared before any early `return`.
