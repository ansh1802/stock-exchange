# Phase 2: Frontend UI, Animations, and Chairman/Director Feature

## Goal

Build a complete React frontend for the multiplayer stock exchange game with real-time WebSocket communication, animated phase transitions, and a new Chairman/Director mechanic based on share holdings.

## What Changed

### New: Frontend application (`frontend/`)

Full React 19 SPA with Vite, TypeScript, Tailwind CSS 4, Zustand state management, and Framer Motion animations.

| Area | Files | Purpose |
|------|-------|---------|
| Pages | `LobbyPage.tsx`, `GamePage.tsx` | Top-level route components |
| Game components | 13 files in `components/game/` | Board, panels, modals, overlays |
| Lobby components | 2 files in `components/lobby/` | Player list, start button |
| State | `store/useGameStore.ts` | Zustand store for connection + game state |
| WebSocket | `hooks/useWebSocket.ts` | Connect/send/disconnect with exponential backoff reconnect |
| Hooks | `useIsMyTurn.ts`, `useMyPlayer.ts` | Derived state helpers |
| Types | `types/game.ts`, `types/messages.ts` | Full TypeScript interfaces matching backend contract |
| Lib | `constants.ts`, `cn.ts`, `format.ts` | Company colors, clsx utility, cash formatting |

**Stack:** React 19, Zustand 5, Framer Motion 12, Tailwind CSS 4, Vite 8, TypeScript 5.9, Lucide icons, Sonner toasts, Playfair Display + JetBrains Mono fonts.

### New: Chairman/Director mechanic (backend + frontend)

**Rules:**
- **100 shares** of a company → Chairman. Power: at end of day, discard one of your own cards for that company AND choose one card of that company from another player's hand to discard.
- **50 shares** → Director. Power: at end of day, discard one of your own cards for that company.
- Max 1 Chairman + 2 Directors per company.
- If two players both reach 100 shares, first buyer gets Chairman, second becomes "double Director" (can discard 2 of their own cards).
- Positions revoked when holdings drop below threshold on sell.

**Backend changes:**
- `constants.py` — Added `CHAIRMAN_THRESHOLD = 100`, `DIRECTOR_THRESHOLD = 50`
- `models.py` — Added `chairman: dict[str, int | None]` and `directors: dict[str, list[int]]` to `GameState`, included in `to_dict()` and `to_player_dict()`
- `helpers.py` — Added `update_positions()` called after every buy/sell to check thresholds
- `actions.py` — `buy_stock()` and `sell_stock()` call `update_positions()` after success
- `phases.py` — `begin_card_reveal()` builds `chairman_director_queue` from position holders; `chairman_director_action()` handles the discard logic within card_reveal phase
- `server.py` — New `chairman_director` action dispatch, queue-aware `current_player_name` resolution, state contract includes `chairman`, `directors`, `chairman_director_queue`

**Frontend changes:**
- `ChairmanDirectorModal.tsx` — Interactive modal for card discard selection (own cards + other player's cards for chairman)
- `Portfolio.tsx` — Chairman (C) and Director (D/DD) badges per player
- `CardRevealOverlay.tsx` — `chairman_director` stage pauses animation for player input
- `types/game.ts` — Added chairman/director fields to `GameState`

### Modified: Server phase machine

**Before (Phase 1):**
```
dealing → player_turn → fluctuation → currency_settlement → share_suspend → day_end
```

**After (Phase 2):**
```
dealing → player_turn → card_reveal → share_suspend → currency_settlement → day_end
```

Key changes:
- `fluctuation` renamed to `card_reveal` — now a frontend-animated phase instead of instant computation
- Card reveal **pauses** for frontend animation. Frontend sends `reveal_complete` when done.
- Chairman/director discard actions happen **within** card_reveal (queue-driven, before moving on)
- Currency settlement also pauses for frontend animation. Frontend sends `complete_currency_settlement`.
- Share suspend moved before currency settlement (matches original game rules)

### Modified: Server state contract (`build_client_state`)

New fields added to the game state JSON sent to each player:

```json
{
  "chairman": {"Vodafone": 1, "TCS": null, ...},
  "directors": {"Vodafone": [2, 3], "TCS": [], ...},
  "chairman_director_queue": [[player_id, company_name], ...],
  "reveal_data": [{"company_name": "TCS", "old_value": 55, "new_value": 70, "cards": [...]}],
  "all_hands": {"1": [...], "2": [...]},
  "game_log": ["Game started", "Alice: Bought 5 of TCS @ $55", ...]
}
```

Active player resolution now checks sub-phase queues:
1. `rights_issue` phase → `rights_issue_queue[0]`
2. `share_suspend` phase → `suspend_queue[0]`
3. `card_reveal` phase with CD queue → `chairman_director_queue[0][0]`
4. Otherwise → `players[current_turn]`

### Modified: Power card consumption

Power cards (LoanStock, Debenture, RightsIssue) are now removed from the player's hand after use. Previously they stayed in hand and also affected fluctuation.

### Modified: Phase completion (idempotent)

`complete_card_reveal()` and `complete_currency_settlement()` are idempotent — duplicate calls from multiple clients return success with "already" in the message, and the server skips broadcasting for these no-ops.

## Frontend Architecture

### State Management

**Zustand store** (`useGameStore.ts`) holds:
- Connection state: `roomCode`, `playerName`, `isHost`, `isConnected`
- Lobby state: `players` list, `reconnected` flag
- Game state: `gameState` (full `GameState`), `gameStarted`
- Game over: `gameOver` (Ranking array)

**WebSocket hook** (`useWebSocket.ts`) handles:
- Connection to `ws://host:8000/ws/{room_code}/{player_name}`
- Message routing: `lobby`, `player_joined`, `game_started`, `game_state`, `action_result`, `phase_change`, `game_over`, `error`
- Auto-reconnect with exponential backoff (1s → 2s → 4s → 8s → 16s cap)
- Returns `{ connect, send, disconnect }` interface

### Animation State Machine (decoupled from backend)

`GameBoard.tsx` manages a separate `animPhase` state (`none | card_reveal | share_suspend | currency_settlement`) that is **decoupled** from the backend phase. This is critical for:
- Preventing re-animation on reconnect (tracks `lastRevealDay`)
- Allowing each overlay to complete its animation before transitioning
- Handling the case where backend has already advanced past a phase

Flow:
1. Backend sends `game_state` with `phase: "card_reveal"` and `reveal_data`
2. `GameBoard` sets `animPhase = "card_reveal"` (only if day changed)
3. `CardRevealOverlay` runs staged animation → sends `reveal_complete` → calls `onComplete`
4. `GameBoard` transitions to `share_suspend` or `currency_settlement` as needed
5. Each overlay sends its completion signal to the backend

### Card Reveal Overlay (`CardRevealOverlay.tsx`)

Internal state machine:
```
company_intro → revealing_cards(cardIdx: 0..N) → final_value → chairman_director* → company_intro(next) → ... → complete
```
\* chairman_director stage only if the company has entries in `chairman_director_queue`

Key design:
- **Derived state via `useMemo`** — visible cards are derived from `stage`, not accumulated in separate state. This prevents React Strict Mode double-invocation bugs.
- **Auto-timed progression** — company_intro (1s), revealing_cards (400ms per card), final_value (1.8s), then auto-advance or wait for chairman/director input
- **Scrollable card list** — `max-h-[40vh] overflow-y-auto` prevents overflow with many cards
- **Running delta** — derived from visible cards, not stored in stage

### Component Breakdown

| Component | Purpose |
|-----------|---------|
| `GameBoard` | Main layout, animation orchestration, modal/overlay rendering |
| `StockTicker` | Horizontal company value bar with prev-value change indicators |
| `DayRoundIndicator` | Day X / Round Y badge, connection status dot |
| `TradePanel` | Buy/sell quantity selectors, pass button, disabled when not your turn |
| `PlayerHand` | Your cards grid, power card action triggers |
| `Portfolio` | Sidebar: all players with cash, stock counts, chairman/director badges |
| `GameLog` | Scrollable game event log |
| `CardRevealOverlay` | Full-screen "Closing Bell" animation with per-company card reveal |
| `ShareSuspendOverlay` | Full-screen overlay for share suspend decisions |
| `ShareSuspendModal` | Individual player's suspend choice (swap or pass) |
| `CurrencySettlementOverlay` | Full-screen animation showing cash +/- 10% |
| `ChairmanDirectorModal` | Card discard selection (inline during card reveal, or standalone) |
| `RightsIssueModal` | Rights issue share purchase dialog |
| `PowerCardPanel` | Power card action buttons |
| `GameOverScreen` | Final rankings by net worth |

## Bugs Fixed

### 1. Card reveal displaying duplicate cards

**Root cause:** `setRevealedCards()` was called inside a `setStage()` updater function. React Strict Mode double-invokes updater functions to detect side effects, so each card was added to the map twice.

**Fix:** Eliminated `revealedCards` state entirely. Visible cards are now derived from `stage` via `useMemo`:
```typescript
const revealedForCompany = useMemo((): RevealCard[] => {
  if (!currentCompany) return []
  if (stage.type === 'company_intro') return []
  if (stage.type === 'revealing_cards') {
    return currentCompany.cards.slice(0, stage.cardIdx + 1)
  }
  return currentCompany.cards // final_value, chairman_director
}, [stage, currentCompany])
```

**Lesson:** Never put side effects inside React state updater functions. Prefer derived state over accumulated state.

### 2. Card list overflowing viewport

**Root cause:** Card container had `min-h-[180px]` with no max-height constraint. With many cards (6 players × multiple cards per company), the list pushed delta/new value indicators off-screen.

**Fix:** Changed to `max-h-[40vh] overflow-y-auto` with thin scrollbar styling.

### 3. Portfolio React key collision

**Root cause:** `key={player.name}` in Portfolio.tsx player list caused "Encountered two children with the same key" warnings (player names not guaranteed unique across React renders).

**Fix:** Changed to `key={player.id}`.

### 4. Active player wrong during sub-phases

**Root cause:** `build_client_state()` in server.py always derived `current_player_name` from `players[current_turn]`. During rights_issue, share_suspend, and chairman/director phases, the active player comes from the respective queue, not the regular turn index.

**Fix:** Check phase and resolve from the appropriate queue:
- `rights_issue` → `rights_issue_queue[0]`
- `share_suspend` → `suspend_queue[0]`
- `card_reveal` with CD queue → `chairman_director_queue[0][0]`

### 5. Power cards not consumed after use

**Root cause:** LoanStock, Debenture, and RightsIssue action handlers checked for card existence with `any(...)` but never removed the card from `player.hand`.

**Fix:** After validation, find and remove the first matching card with `next()` + `player.hand.remove()`.

## Key Design Decisions

- **Decoupled animation state** — Frontend maintains its own animation phase separate from backend phase. Backend pauses at animated phases; frontend drives progression by sending completion signals. This enables smooth reconnect (no re-animation) and clean separation of concerns.
- **Derived state over accumulated state** — Card reveal uses `useMemo` to derive visible cards from the stage index rather than maintaining a separate accumulating state. Eliminates an entire class of bugs (duplicates, stale state, strict mode issues).
- **Idempotent phase completion** — Multiple clients can send `reveal_complete` / `complete_currency_settlement` without causing errors or duplicate transitions. Server detects "already completed" and skips broadcasting.
- **Queue-driven sub-phases** — Rights issue, share suspend, and chairman/director all use queues that drain one player at a time. The active player is always `queue[0]`, and the phase advances when the queue empties.
- **Per-player state broadcast** — Every successful action triggers a full state broadcast to all connected players. Each player receives only their visible state (own hand hidden from others except during card_reveal).
- **Game log** — Server maintains a `game_log` list appended after each action. Duplicate/idempotent messages (containing "already") are filtered out. Log is included in every state broadcast.

## How to Run

```bash
# Backend (terminal 1)
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Frontend (terminal 2)
cd frontend
npm install
npm run dev
```

Frontend proxies WebSocket connections to `localhost:8000` via Vite config.

Open `http://localhost:5173` in multiple browser tabs to test multiplayer.

## Testing

```bash
# Integration test (headless, from repo root)
python tests/test_game.py

# Manual bot client
python tests/play_client.py
```

Playwright MCP plugin was used for browser-based testing: two tabs, automated game flow through multiple days, verified card counts matched expected values and no duplicate cards appeared.
