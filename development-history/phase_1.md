# Phase 1: FastAPI WebSocket Server + Room Management

## Goal

Add a multiplayer backend: a FastAPI WebSocket server that manages game rooms, routes player actions to the game engine, and broadcasts per-player state in real time.

## What Changed

### Repo restructure

Moved game engine into `backend/`:
- `game_engine.py` → `backend/game_engine.py`
- `engine/` → `backend/engine/`
- Created `backend/server.py`, `backend/room_manager.py`, `backend/requirements.txt`
- Updated `tests/test_game.py` import path to point to `backend/`

### New files

| File | Purpose | Size |
|------|---------|------|
| `backend/server.py` | FastAPI WebSocket server | ~200 lines |
| `backend/room_manager.py` | Room/player connection management | ~110 lines |
| `backend/requirements.txt` | Python dependencies (fastapi, uvicorn, websockets) | 3 lines |

## Server Architecture

### WebSocket Endpoint

`/ws/{room_code}/{player_name}` — single endpoint handles everything:
1. Player connects → room created (if new) or joined (if exists)
2. First player becomes host
3. Host sends `{"type": "start_game"}` → GameState created, cards dealt
4. Players send actions → engine validates → state broadcast to all
5. On disconnect → player marked offline, can reconnect by same name

### Room Manager

**`RoomManager`** — holds all active rooms, creates 4-character uppercase+digit codes.

**`Room`** — one game session:
- `players` dict (player_id → PlayerConn with name, websocket, connected flag)
- `game` (GameState, set when host starts)
- `host_id` (first player to join)
- `_name_to_id` lookup for reconnection
- `broadcast_game_state()` sends each player only their `to_player_dict()` view

**`PlayerConn`** — lightweight connection wrapper: id, name, websocket, connected flag.

### Action Dispatch

`dispatch_action()` maps client message types to engine functions:

| Client `type` | Engine function | Required fields |
|---|---|---|
| `buy` | `buy_stock()` | `company_num`, `quantity` |
| `sell` | `sell_stock()` | `company_num`, `quantity` |
| `pass` | `pass_turn()` | — |
| `loan_stock` | `use_loan_stock()` | — |
| `debenture` | `use_debenture()` | `company_num` |
| `rights_issue` | `use_rights_issue()` | `company_num` |
| `rights_issue_buy` | `rights_issue_buy()` | `quantity` |
| `share_suspend` | `share_suspend_action()` | `company_num` (0 = pass) |

Missing fields return `{"success": false, "message": "Missing field: ..."}` instead of crashing.

### Auto-Advance

After each successful action, `auto_advance()` pushes the game through phases that don't need player input:

```
fluctuation → currency_settlement → share_suspend* → day_end → dealing → player_turn (STOP)
```

\* share_suspend stops and waits only if `suspend_queue` has entries (players must choose).

The loop also stops at `rights_issue` (waiting for eligible players to buy) and `game_over` (broadcasts rankings).

### Game Over

`broadcast_game_over()` calculates net worth for each player:
- `net_worth = cash + Σ(stock_count × company_value)` for open companies
- Rankings sorted descending by net worth
- Includes player name, cash, stocks, net_worth

## Message Protocol

### Client → Server

```json
{"type": "start_game"}
{"type": "buy", "company_num": 4, "quantity": 5}
{"type": "sell", "company_num": 2, "quantity": 3}
{"type": "pass"}
{"type": "loan_stock"}
{"type": "debenture", "company_num": 3}
{"type": "rights_issue", "company_num": 1}
{"type": "rights_issue_buy", "quantity": 2}
{"type": "share_suspend", "company_num": 4}
```

### Server → Client

```json
{"type": "lobby", "room_code": "A3X9", "players": [...], "is_host": true}
{"type": "player_joined", "player_name": "Ansh", "players": [...]}
{"type": "player_left", "player_name": "Ansh", "players": [...]}
{"type": "game_started", "num_players": 3}
{"type": "game_state", "state": {...per-player visible state...}}
{"type": "action_result", "success": true, "message": "Bought 5 of TCS..."}
{"type": "phase_change", "phase": "fluctuation", "message": "Values fluctuated..."}
{"type": "game_over", "rankings": [{...}, {...}]}
{"type": "error", "message": "Only the host can start the game."}
```

## Key Design Decisions

- **Reconnection by name** — if a player disconnects and reconnects with the same name to the same room, their player ID and game state are preserved. No auth needed at this stage.
- **Auto-advance loop** — the server drives phase transitions automatically rather than requiring the client to trigger each one. Only phases needing player input (player_turn, rights_issue, share_suspend with cards) pause and wait.
- **Per-player state broadcast** — after every successful action, ALL players receive their personalised `to_player_dict()` view. This keeps all clients in sync without requiring them to request updates.
- **Empty room cleanup** — when the last player disconnects, the room is removed from the manager.
- **company_num (1-based)** — message protocol uses the same 1-based company numbering as the engine API to avoid off-by-one translation.
- **CORS open** — `allow_origins=["*"]` for development. Must be locked down before production.

## How to Run

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

WebSocket endpoint: `ws://localhost:8000/ws/{room_code}/{player_name}`

Swagger docs: `http://localhost:8000/docs`
