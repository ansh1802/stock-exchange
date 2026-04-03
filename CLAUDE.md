# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A multiplayer stock exchange board game (2-6 players, 10 days, 3 rounds/day) with a FastAPI WebSocket backend, a pure-function game engine, and a React 19 frontend with animated phase transitions.

## Running

```bash
# Backend server (terminal 1)
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Frontend dev server (terminal 2)
cd frontend
npm install
npm run dev

# Integration test (from repo root)
python tests/test_game.py
```

Frontend runs at `http://localhost:5173` and proxies WebSocket to `localhost:8000` via Vite config. Open multiple tabs to test multiplayer.

## Architecture

### Backend (`backend/`)

**`server.py`** — FastAPI WebSocket server. Players connect at `/ws/{room_code}/{player_name}`. Handles lobby (join/start), dispatches player actions to the game engine, auto-advances through automated phases, and broadcasts per-player state after each action. Resolves active player from sub-phase queues (rights_issue, share_suspend, chairman_director) rather than just `current_turn`.

**`room_manager.py`** — `RoomManager` creates/tracks rooms with 4-char codes. `Room` holds player connections, game state, host ID, game log. Supports reconnection by name.

**`game_engine.py`** — Thin wrapper that re-exports the `engine/` package and adds `create_game()`.

**`engine/` package:**
- `constants.py` — Game config (company names/values, card counts, cash/share defaults, chairman/director thresholds)
- `models.py` — `Card`, `Company`, `Player`, `GameState` with `to_dict()` / `to_player_dict()`. GameState includes `chairman` and `directors` position tracking.
- `deck.py` — `build_deck()` produces the 100-card deck (84 company + 16 power)
- `helpers.py` — Shared validation (`validate_turn`, `validate_company`, `advance_turn`), `result()` builder, `update_positions()` for chairman/director tracking after trades
- `actions.py` — Player turn actions: `buy_stock`, `sell_stock`, `pass_turn`, power card functions. Power cards are consumed after use.
- `phases.py` — Phase transitions: `deal_cards`, `begin_card_reveal`, `complete_card_reveal`, `chairman_director_action`, `share_suspend_action`, `currency_settlement`, `complete_currency_settlement`, `end_day`
- `debug_presets.py` — Decorator-based preset registry for testing specific game scenarios (chairman, director, share suspend, currency, etc.)

**Dependency flow:** `constants` ← `models` ← `deck`, `helpers` ← `actions`, `phases`. No circular imports.

### Frontend (`frontend/`)

**Stack:** React 19, Zustand 5, Framer Motion 12, Tailwind CSS 4, Vite 8, TypeScript 5.9, Lucide icons, Sonner toasts.

**`store/useGameStore.ts`** — Zustand store: connection state, lobby state, game state, game over rankings.

**`hooks/useWebSocket.ts`** — WebSocket connect/send/disconnect with exponential backoff reconnect. Routes all server message types to the store.

**`hooks/useIsMyTurn.ts`, `useMyPlayer.ts`** — Derived state helpers.

**`types/game.ts`, `types/messages.ts`** — Full TypeScript interfaces matching the backend state contract. `ServerMessage` and `ClientMessage` discriminated unions.

**`components/game/GameBoard.tsx`** — Main game layout and animation orchestrator. Manages a **decoupled `animPhase`** (separate from backend phase) that tracks which overlay is active. Uses `lastRevealDay` to prevent re-animation on reconnect.

**Key components:**
- `CardRevealOverlay` — Full-screen "Closing Bell" animation with staged card reveal per company. Internal state machine: `company_intro → revealing_cards → final_value → chairman_director → complete`. Uses `useMemo` for derived visible cards (not accumulated state).
- `ShareSuspendOverlay` / `ShareSuspendModal` — Share suspend decision UI
- `CurrencySettlementOverlay` — Cash +/- 10% animation
- `ChairmanDirectorModal` — End-of-day card discard selection
- `StockTicker`, `PlayerHand`, `GameLog` — Core game UI panels
- `PlayerBoard` — Center grid showing all players' cash, net worth, holdings, position icons
- `ActionBar` + `TradeModal` — Bottom trade controls (replaced TradePanel)
- `RightsIssueOverlay`, `DebentureOverlay` — Power card animations

**`lib/constants.ts`** — Company color/text-color maps, company number lookups (1-based).

## Key Design Contracts

**Every engine function** returns `{"success": bool, "message": str, "new_state": dict}`. Failed actions return early without mutating state.

**Phase state machine:**
```
dealing → player_turn → card_reveal → share_suspend → currency_settlement → day_end → (dealing | game_over)
                |                |
                |                +-- chairman_director (sub-phase, queue-driven)
                +-- rights_issue (sub-phase, queue-driven)
```
The server auto-advances through phases that don't need player input. Card reveal and currency settlement **pause** for frontend animation — the frontend sends `reveal_complete` / `complete_currency_settlement` to proceed. These completion signals are idempotent (safe for multiple clients to send).

**Chairman/Director positions:**
- 100 shares → Chairman (1 per company). Discard own card + remove one from another player. Both optional (partial exercise).
- 50 shares → Director (max 2 per company). Discard 1 own card.
- 100 shares (when someone else is chairman) → Double Director. Discard 1-2 own cards.
- 150+ shares → Chairman AND Director. Queued sequentially — chairman power first, then director.
- 200+ shares → Chairman AND Double Director. Up to 4 total discards.
- Positions tracked in `GameState.chairman` and `GameState.directors`, updated on every buy/sell via `update_positions()`.
- Pass (`discard_own_idx == -1` with no other selection) skips the action entirely.

**Company numbers are 1-based** in the API (1=Vodafone through 6=Infosys).

**WebSocket message protocol:** Client sends `{"type": "buy", "company_num": 4, "quantity": 5}` etc. Server responds with `{"type": "action_result", ...}` to the actor and `{"type": "game_state", "state": ...}` to all players.

**Animation state is decoupled from backend state.** The frontend maintains its own `animPhase` to drive overlays independently of the backend phase. This prevents re-animation on reconnect and allows smooth transitions.

## Development History

Detailed design docs for each phase of development live in `development-history/`. Reference these for context on why things are built the way they are, what bugs were encountered and fixed, and the architectural decisions made along the way.

| Phase | File | Summary |
|-------|------|---------|
| Phase 0 | [`development-history/phase_0.md`](development-history/phase_0.md) | Engine refactoring from 6 files to pure-function `engine/` package. 7 bugs fixed (shared class attrs, rights issue logic, card references, etc.). Deck composition, serialization contracts. |
| Phase 1 | [`development-history/phase_1.md`](development-history/phase_1.md) | FastAPI WebSocket server, room management, reconnection, action dispatch, auto-advance loop, game over rankings. Message protocol. |
| Phase 2 | [`development-history/phase_2.md`](development-history/phase_2.md) | Full React frontend with animations. Chairman/Director feature. Phase machine changes (card_reveal replaces fluctuation, pausing phases). 5 bugs fixed (duplicate cards, overflow, key collision, sub-phase active player, power card consumption). |
| Phase 3 | [`development-history/phase_3.md`](development-history/phase_3.md) | UI restructure (PlayerBoard, ActionBar, TradeModal), share suspend sync with animation queue and countdown, sparkline charts, rights issue / debenture overlays, card reveal sync across players. |
| Phase 4 | [`development-history/phase_4.md`](development-history/phase_4.md) | Chairman/director fixes (hooks crash, index mismatch, partial exercise), debug preset system, chairman+director stacking for 150+/200+ shares, double director flexibility. |
| Architecture | [`development-history/game_arch_deploy_numbers.md`](development-history/game_arch_deploy_numbers.md) | Full architectural deep-dive: server-authoritative pattern, phase state machine, auto-advance loop, deployment guide, NFR numbers, scaling progression. |

## Other Directories

- `base_logic_old/` — Original 6-file implementation. Do not modify.
- `tests/` — `test_game.py` (integration test), `play_client.py` (manual bot client)
