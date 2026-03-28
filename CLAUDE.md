# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A multiplayer stock exchange board game (2-6 players, 10 days, 3 rounds/day) with a FastAPI WebSocket server and a pure-function game engine.

## Running

```bash
# Backend server (from backend/ directory)
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# Integration test (from repo root)
python tests/test_game.py
```

## Architecture

### Backend (`backend/`)

**`server.py`** — FastAPI WebSocket server. Players connect at `/ws/{room_code}/{player_name}`. Handles lobby (join/start), dispatches player actions to the game engine, auto-advances through automated phases (card_reveal → share_suspend → currency_settlement → day_end → deal), and broadcasts per-player state after each action.

**`room_manager.py`** — `RoomManager` creates/tracks rooms with 4-char codes. `Room` holds player connections, game state, host ID. Supports reconnection by name. `broadcast_game_state()` sends each player only their visible state.

**`game_engine.py`** — Thin wrapper that re-exports the `engine/` package and adds `create_game()`.

**`engine/` package:**
- `constants.py` — Game config (company names/values, card counts, cash/share defaults)
- `models.py` — `Card`, `Company`, `Player`, `GameState` with `to_dict()` / `to_player_dict()`
- `deck.py` — `build_deck()` produces the 100-card deck
- `helpers.py` — Shared validation (`validate_turn`, `validate_company`, `advance_turn`) and `result()` builder
- `actions.py` — Player turn actions: `buy_stock`, `sell_stock`, `pass_turn`, power card functions
- `phases.py` — Phase transitions: `deal_cards`, `begin_card_reveal`, `chairman_director_action`, `share_suspend_action`, `currency_settlement`, `end_day`

**Dependency flow:** `constants` ← `models` ← `deck`, `helpers` ← `actions`, `phases`. No circular imports.

## Key Design Contracts

**Every engine function** returns `{"success": bool, "message": str, "new_state": dict}`. Failed actions return early without mutating state.

**Phase state machine:** `dealing → player_turn → card_reveal → share_suspend → currency_settlement → day_end → (dealing | game_over)`. The `rights_issue` sub-phase interrupts `player_turn`. Chairman/director discard actions are handled within `card_reveal`. The server auto-advances through phases that don't need player input. During `card_reveal`, all player hands are visible (cards being revealed).

**Company numbers are 1-based** in the API (1=Vodafone through 6=Infosys).

**WebSocket message protocol:** Client sends `{"type": "buy", "company_num": 4, "quantity": 5}` etc. Server responds with `{"type": "action_result", ...}` to the actor and `{"type": "game_state", "state": ...}` to all players.

## Other Directories

- `base_logic_old/` — Original 6-file implementation. Do not modify.
- `development-history/` — Design docs. `phase_0.md` covers the engine refactoring and bug fixes.
