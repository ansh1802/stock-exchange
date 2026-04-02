# Architecture, Deployment & Scaling

A deep-dive into the game's architecture, communication patterns, deployment requirements, and NFR (non-functional requirement) numbers.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (per player)                        │
│                                                                    │
│  React 19 + Zustand Store + Framer Motion                         │
│  ┌──────────┐   ┌──────────────┐   ┌────────────────────────────┐ │
│  │ GameBoard │◄──│ useGameStore  │◄──│ useWebSocket               │ │
│  │ Overlays  │   │ (Zustand)    │   │ (single WS conn per tab)   │ │
│  │ Controls  │   └──────────────┘   └─────────┬──────────────────┘ │
│  └──────────┘                                 │ WebSocket          │
└───────────────────────────────────────────────┼─────────────────────┘
                                                │
                              ┌─────────────────┼──── Vite dev proxy
                              │                 │     (prod: nginx/LB)
┌─────────────────────────────┼─────────────────┼─────────────────────┐
│                     BACKEND │(single process) │                     │
│                             ▼                 │                     │
│  ┌──────────────────────────────────┐         │                     │
│  │         server.py (FastAPI)      │         │                     │
│  │  /ws/{room_code}/{player_name}   │◄────────┘                     │
│  │                                  │                               │
│  │  ┌────────────────────────────┐  │                               │
│  │  │    RoomManager             │  │                               │
│  │  │  rooms: {code -> Room}     │  │                               │
│  │  │                            │  │                               │
│  │  │  Room                      │  │                               │
│  │  │  ├─ players: {id->Conn}    │  │                               │
│  │  │  ├─ game: GameState        │  │                               │
│  │  │  └─ game_log: []           │  │                               │
│  │  └────────────────────────────┘  │                               │
│  └──────────┬───────────────────────┘                               │
│             │                                                       │
│  ┌──────────▼───────────────────────┐                               │
│  │     engine/ (pure functions)     │                               │
│  │  actions.py  — buy/sell/pass/pow │                               │
│  │  phases.py   — reveal/suspend/.. │                               │
│  │  helpers.py  — validation        │                               │
│  │  models.py   — GameState/Player  │                               │
│  │  deck.py     — card generation   │                               │
│  │  constants.py — config values    │                               │
│  └──────────────────────────────────┘                               │
└─────────────────────────────────────────────────────────────────────┘
```

## Communication Pattern: Server-Authoritative State

The architecture is **server-authoritative**: the client sends intent, the server sends truth.

```
Client                          Server
  │                               │
  │  {"type":"buy",               │
  │   "company_num":4,            │
  │   "quantity":5}               │
  ├──────────────────────────────►│
  │                               │── validate_turn(player_id)
  │                               │── validate_company(4)
  │                               │── check affordability
  │                               │── mutate GameState
  │                               │── advance_turn()
  │                               │
  │  {"type":"action_result",     │
  │   "success":true, "msg":".."}│
  │◄──────────────────────────────┤  (to acting player only)
  │                               │
  │  {"type":"game_state",        │
  │   "state": {personalized}}    │
  │◄──────────────────────────────┤  (to ALL players, each
  │                               │   gets their own view)
```

Key properties:
- **The client has zero game logic.** It doesn't validate moves, compute prices, or track turns. It sends raw intents and renders whatever the server says.
- **Every player gets a personalized state snapshot.** `to_player_dict()` shows your hand but only `hand_count` for others. During `card_reveal`, all hands become visible.
- **The entire game state is sent every time.** No deltas, no patches — full state replacement. Simple, debuggable, and impossible to desync.

This is the opposite of an "optimistic update" pattern (where clients predict outcomes and reconcile). The approach trades bandwidth for correctness — perfect for a turn-based game where messages are infrequent.

## The State Machine — Phase Lifecycle

The game has a **two-tier state machine**: a backend phase machine that represents truth, and a frontend animation machine that represents what the user is currently seeing.

### Backend phase machine

```
dealing ──► player_turn ──┬──► card_reveal ──► share_suspend ──► currency_settlement ──► day_end ──┐
                          │        │                                                                │
                          │        └── chairman_director (sub-phase, queue-driven)                   │
                          │                                                                         │
                          ├── rights_issue (sub-phase, queue-driven)                                 │
                          │                                                                         │
                          └─────────────────────────────────────────────────────────────────────────┘
                                                                                    (or game_over)
```

### The auto-advance loop

After every player action, `server.py:auto_advance()` runs a `while` loop that pushes through phases that don't need human input:

```python
async def auto_advance(room):
    advanced = True
    while advanced:
        advanced = False
        phase = game.game_phase

        if phase == "card_reveal" and not game.reveal_data:
            ge.begin_card_reveal(game)      # compute data
            advanced = True                  # loop again

        # card_reveal with data → STOP (frontend animates)
        # share_suspend with queue → STOP (player chooses)
        # currency_settlement → STOP (frontend animates)

        elif phase == "day_end":
            ge.end_day(game)                 # advance day
            advanced = True                  # loop again

        elif phase == "dealing":
            ge.deal_cards(game)              # deal hands
            advanced = True                  # loop again
```

Example sequence after the last player passes in round 3:
1. `advance_turn()` sets phase to `card_reveal`
2. `auto_advance` fires: `card_reveal` with no `reveal_data` → calls `begin_card_reveal`, sets `advanced = True`
3. Loop again: `card_reveal` now has `reveal_data` → no match → loop exits
4. Server broadcasts state. Frontend sees `card_reveal` with data → plays animation.
5. After the frontend sends `reveal_complete` and `complete_currency_settlement`, the same loop fires again and blasts through `day_end → dealing → player_turn` in one go.

### Pause point architecture

The server auto-advances through everything except three types of moments:
- **Animation pauses** — card reveal, currency settlement (frontend sends a completion signal)
- **Player decision pauses** — share suspend, rights issue, chairman/director (player sends a choice)
- **Turn pauses** — `player_turn` (player buys/sells/passes)

### Frontend animation state (decoupled)

`GameBoard.tsx` maintains its own `animPhase` that transitions independently from the backend phase:

```
card_reveal → share_suspend → currency_settlement → (done, back to normal)
```

This decoupling is needed because:
- On reconnect, the backend might already be at `currency_settlement`, but you don't want to re-play the card reveal animation
- The backend advances through `share_suspend → currency_settlement` instantly when there are no suspend cards, but the frontend still needs to show the "no share suspend" message with a countdown timer
- Overlays need to exit gracefully with animations, not vanish when backend state changes

## The Engine — Pure Function Design

The `engine/` package is a **pure state machine with zero I/O**. Every function:
- Takes `GameState` + parameters
- Returns `{success, message, new_state}`
- Has no `async`, no WebSocket awareness, no imports from `server.py`

```
constants.py ◄── models.py ◄── deck.py
                     ▲
                     │
               helpers.py ◄── actions.py
                     ▲         phases.py
                     │
              (no circular imports)
```

This enables:
- **Testing without a server** — `test_game.py` calls engine functions directly
- **Debug presets** — mutate `GameState` directly without WebSocket connections
- **Future portability** — the engine could be reused with a different transport layer

### Information hiding boundary

`to_dict()` is god-mode (full state, used in tests). `to_player_dict()` is what players see — it calls `to_public_dict()` for other players (hides their hand, shows only `hand_count`).

`build_client_state()` in `server.py` adds a second transformation layer: resolving player IDs to names, computing `prev_value` from price history, injecting `player_name` into reveal cards, determining `current_player_name` from sub-phase queues. This keeps the engine free of "display" concerns.

## The WebSocket Layer

### Connection model

One WebSocket per player per tab, at `/ws/{room_code}/{player_name}`.

The URL carries identity — no auth tokens, no session cookies. `player_name` is both the display name and the reconnection key. `room_code` is the room identifier.

### Reconnection

If a player disconnects and reconnects with the same name, `Room.add_player()` finds them by name (`_name_to_id` map), replaces their WebSocket reference, marks them connected, and sends the current game state. No state is lost. The frontend uses exponential backoff (1s → 2s → 4s → ... → 30s max).

### Message protocol

Discriminated unions on both sides. `ServerMessage` has 8 types, `ClientMessage` has 12 types. TypeScript ensures exhaustive handling on the frontend.

### Broadcast pattern

After every successful action:
```python
# 1. Send result to actor only
await room.send_to(player_id, {"type": "action_result", ...})

# 2. Auto-advance phases
await auto_advance(room)

# 3. Send personalized state to ALL players
await broadcast_game_state(room)
```

Step 3 iterates all players, builds a personalized state for each, and sends it. Every action triggers N WebSocket sends (one per player).

## Frontend State Management

**Zustand store** is intentionally flat. It holds `gameState: GameState | null` which is **replaced wholesale** on every `game_state` message. No merging, no diffing — the server is always right.

Derived values are computed in components or custom hooks:
- `useIsMyTurn` — derives from `gameState.current_player_name === playerName`
- `useMyPlayer` — finds your player object from the players array
- Portfolio value — computed inline in components

Every state update re-renders the game tree. With 6 companies, 6 players, and 10 cards, the state is small enough that React's reconciliation handles it efficiently.

---

## Deployment

### Minimum Viable Deployment (~50 concurrent rooms)

```
┌──────────────────────────────────────────────────┐
│  Single VPS (2 vCPU, 4GB RAM, $10-20/mo)        │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  nginx                                     │  │
│  │  ├─ serves frontend static files           │  │
│  │  ├─ proxies /ws/* → uvicorn :8000          │  │
│  │  └─ TLS termination (Let's Encrypt)        │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │  uvicorn server:app --workers 1            │  │
│  │  (single process, all state in-memory)     │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Frontend: built with `npm run build`,           │
│  served as static files by nginx                 │
└──────────────────────────────────────────────────┘
```

Example nginx config:
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    # Static frontend
    location / {
        root /var/www/stock-exchange/frontend/dist;
        try_files $uri /index.html;
    }

    # WebSocket proxy
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
```

No database. No Redis. No message queue. No container orchestration. The entire backend state lives in Python dictionaries in one process's memory.

### Why single-process works

- Games are short-lived (~30-60 minutes)
- State is small (~5-10 KB per room)
- Players are in the same social group
- Loss of a game in progress is annoying but not catastrophic
- The process restart scenario is rare with a stable server

### What it means

- `RoomManager.rooms` is a Python dict in the uvicorn process
- If the process crashes or restarts, **all games are lost**
- You cannot run multiple backend workers (each would have its own `rooms` dict)

---

## NFR Numbers

### Memory per room

| Component | Size |
|-----------|------|
| `GameState` (6 players, hands, stocks, cash) | ~2 KB |
| `reveal_data` (6 companies, ~8 cards each) | ~1 KB |
| `game_log` (~200 entries) | ~10 KB |
| `Room` overhead (connections, metadata) | ~1 KB |
| **Total per active room** | **~15 KB** |

With 4 GB RAM (minus ~500 MB for OS + Python + uvicorn):
- Theoretical max: ~230,000 rooms
- Practical max: ~50,000 rooms (GC overhead, fragmentation)
- Other limits are hit long before memory

### CPU per action

- `dispatch_action` → engine function → `build_client_state` x N players → JSON serialize x N
- For 6 players: ~0.5ms per action (all dict manipulation, no I/O)
- **Single core can handle ~2,000 actions/second**

### WebSocket connections

- Each player = 1 persistent TCP connection + 1 file descriptor
- Linux default: 1024 fd limit (raise with `ulimit -n 65536`)
- uvicorn with asyncio: comfortably handles **10,000-20,000 concurrent connections**
- 6 players/room → **~1,600-3,300 concurrent rooms**

### Bandwidth per action

- State broadcast: ~3-5 KB JSON x 6 players = ~30 KB per action
- A 6-player game with 90 turns + phase transitions ≈ 150 actions
- Per game: ~4.5 MB total bandwidth
- 1,000 concurrent games: ~75 MB/s peak (bursty, not sustained)

### Single VPS limits summary

| Metric | Limit |
|--------|-------|
| Concurrent rooms | ~1,000-2,000 |
| Concurrent players | ~6,000-12,000 |
| Actions/second | ~2,000 |
| Memory usage | ~30-50 MB |
| Bottleneck | WebSocket connections (fd limit) |

### Latency

Action-to-response is sub-millisecond on the server side. Network RTT dominates. For players on the same continent: 20-80ms round-trip. The game feels instant.

---

## Scaling Progression

### Stage 1: Current — Single Process (0-2,000 rooms)

```
[nginx] → [uvicorn (1 worker)]
```
All state in-memory. Simple. Works great.

### Stage 2: Sticky Sessions + Multiple Processes (2,000-10,000 rooms)

Problem: can't run `--workers 4` because rooms are in-memory. Two players in the same room might hit different workers.

Solution: **sticky load balancing by room code.**
```
[nginx/HAProxy]
  ├─ /ws/ABCD/* → worker 1  (hash on room_code)
  ├─ /ws/EFGH/* → worker 2
  ├─ /ws/IJKL/* → worker 3
  └─ /ws/MNOP/* → worker 4
```

nginx can hash on the URI to route by room code. Each worker owns a subset of rooms. Players in the same room always hit the same worker.

Trade-off: if a worker crashes, its rooms are lost. No cross-worker room migration. But 4x capacity with zero code changes — just nginx config.

### Stage 3: Externalized State + Pub/Sub (10,000-100,000 rooms)

```
┌───────────┐     ┌───────────┐     ┌───────────┐
│ Worker 1  │     │ Worker 2  │     │ Worker N  │
│ (stateless│     │ (stateless│     │ (stateless│
│  FastAPI) │     │  FastAPI) │     │  FastAPI) │
└─────┬─────┘     └─────┬─────┘     └─────┬─────┘
      │                 │                 │
      └────────┬────────┴────────┬────────┘
               │                 │
        ┌──────▼──────┐   ┌─────▼──────┐
        │   Redis     │   │  Redis     │
        │  (state +   │   │  Pub/Sub   │
        │   locks)    │   │  (fanout)  │
        └─────────────┘   └────────────┘
```

Changes needed:
1. **GameState serialization to Redis.** `to_dict()` already serializes everything — store it keyed by room code. Every action: GET → deserialize → mutate → serialize → SET.
2. **Redis Pub/Sub for broadcasts.** When worker 1 processes a buy, it publishes new state to `room:{code}` channel. Other workers holding connections for that room's players receive and forward.
3. **Distributed locking.** Use Redis SETNX or Redlock to ensure only one action processes at a time per room.

The engine stays pure (that's the benefit of the pure-function design), but `server.py` becomes stateless and `room_manager.py` needs a Redis-backed implementation. This is a significant rewrite.

### Stage 4: Dedicated Game Servers (100,000+ rooms)

At this scale:
- **WebSocket gateway** (AWS API Gateway WebSocket, or custom Go/Rust proxy) for connection management
- **Game server fleet** behind the gateway, each handling N rooms
- **Matchmaking service** that assigns rooms to servers
- **State persistence** in Redis Cluster or DynamoDB

This is the architecture of games like Poker Stars, Chess.com, etc.

---

## Architecture Patterns Summary

| Pattern | Where | Why It Works |
|---------|-------|-------------|
| **Server-authoritative state** | All game logic on backend | Prevents cheating, single source of truth |
| **Full state transfer** (not delta) | Every `game_state` message | Simple, no desync bugs, debuggable |
| **Pure function engine** | `engine/` package | Testable without server, no side effects |
| **State machine with auto-advance** | `auto_advance()` loop | Players only see phases that need input |
| **Decoupled animation state** | `animPhase` in frontend | Reconnect doesn't replay animations |
| **Queue-driven sub-phases** | Rights issue, share suspend, CD | Handles N-player sequential actions cleanly |
| **Personalized broadcasts** | `build_client_state()` per player | Information hiding (can't see others' hands) |
| **Exponential backoff reconnect** | `useWebSocket.ts` | Graceful recovery from network blips |
| **Discriminated union messages** | `ServerMessage` / `ClientMessage` | Type-safe exhaustive message handling |
| **Name-based reconnection** | `_name_to_id` in Room | Simple identity without auth system |

## What's Notably Absent (And That's OK)

- **No database.** Games are ephemeral. No need to persist history.
- **No authentication.** Players identified by name within a room. Works for friend groups.
- **No rate limiting.** A malicious client could spam actions. Not a concern for private games.
- **No horizontal scaling.** Single process. Not needed at current scale.
- **No optimistic updates.** Client waits for server confirmation. Adds ~50ms latency but guarantees correctness.
- **No state diffing.** Full state sent every time (~3-5 KB). For 6 players and infrequent actions, cheaper than maintaining diff logic.

Each of these would add complexity. None are needed for a game played by friend groups of 2-6 people. The architecture is correctly sized for the problem.
