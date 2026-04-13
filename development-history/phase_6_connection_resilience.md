# Phase 6: Connection Resilience & Room Persistence

## Goal

Players on weak connections were getting disconnected mid-game, causing two catastrophic problems:

1. **Game state loss:** When all players briefly disconnected (or just the host on a bad network), `server.py` immediately deleted the room (`if room.connected_count() == 0: rooms.remove_room(room.code)`). Players reconnecting got a brand-new empty room with the same code — 30+ minutes of gameplay gone.
2. **Game stalls:** If the disconnected player was the active player (their turn, or queued for share_suspend / chairman_director / rights_issue / reveal_complete), the game blocked indefinitely until they reconnected.

Secondary issues: no heartbeat to detect stale connections quickly, no reconnection UI feedback, and actions sent during brief disconnects were silently dropped.

The game engine (`backend/engine/`) was already cleanly decoupled from connections — `GameState` uses numeric player IDs, has lossless `to_dict()` serialization, and no WebSocket references. The entire fix was in the server and frontend layers; zero engine changes were needed.

## What Changed

### Room persistence with TTL-based cleanup

**Problem:** A single line (`if room.connected_count() == 0: rooms.remove_room(room.code)`) in the WebSocket disconnect handler permanently destroyed the room the instant all players were simultaneously offline — even for a split-second network blip.

**Fix:** Replaced immediate deletion with deferred, TTL-based cleanup using two different thresholds:

- **Empty lobbies / finished games:** Cleaned up after 5 minutes of zero connections
- **Active games in progress:** Cleaned up after 2 hours of zero connections

**File:** `backend/room_manager.py`

Added `last_activity` timestamp to `Room`, a `touch()` method called on player join/reconnect and successful actions, a `has_active_game` property, and `RoomManager.cleanup_stale_rooms()` that iterates rooms with zero connections and removes only those past their TTL.

**File:** `backend/server.py`

Removed the immediate deletion lines. Added a `cleanup_loop()` background task (runs every 60s) started via FastAPI's `lifespan` context manager:

```python
async def cleanup_loop():
    while True:
        await asyncio.sleep(60)
        rooms.cleanup_stale_rooms()

@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(cleanup_loop())
    yield
    task.cancel()

app = FastAPI(title="Stock Exchange Game", lifespan=lifespan)
```

The `rooms = RoomManager()` instantiation was moved above the lifespan function so the cleanup loop can reference it.

### Application-level heartbeat (ping/pong)

**Problem:** No way to detect dead connections quickly. TCP timeouts can take minutes. A player's browser tab crashing or their network dropping leaves a "connected" ghost on the server.

**Fix:** Server sends `{"type": "ping"}` every 15 seconds per connection. If no pong arrives for 45 seconds (3 missed pings), the connection is marked dead and force-closed.

**File:** `backend/server.py` — New `ping_loop(ws, player_conn)` async function, started as an `asyncio.Task` per WebSocket connection. Cancelled in the `finally` block when the connection closes.

**File:** `backend/room_manager.py` — Added `last_pong` timestamp to `PlayerConn`, reset on reconnection.

**File:** `frontend/src/hooks/useWebSocket.ts` — Handles `ping` message type by immediately sending back `{"type": "pong"}`.

**File:** `frontend/src/types/messages.ts` — Added `{ type: 'ping' }` to `ServerMessage`, `{ type: 'pong' }` to `ClientMessage`.

**Why application-level, not WebSocket protocol-level?** The browser WebSocket API doesn't expose protocol-level ping/pong frames. There's no `onPing` event and no way to send a pong frame from JavaScript. Application-level messages are the only option for browser clients.

### Disconnect timer system (auto-pass for offline players)

**Problem:** Five game phases block on specific players. If that player disconnects, the game stalls indefinitely for everyone else:
- `player_turn` — waiting for buy/sell/pass
- `card_reveal` with CD queue — waiting for chairman/director decision
- `card_reveal` without CD queue — waiting for all players to send `reveal_complete`
- `share_suspend` — waiting for suspend choice
- `rights_issue` — waiting for buy quantity

**Fix:** When a player disconnects and they are the active player, start a countdown timer. If they don't reconnect in time, dispatch an auto-action (pass/skip) through the same `dispatch_action` + `auto_advance` code path — no engine changes needed.

**Timeout values:**

| Phase | Timeout | Auto-action |
|-------|---------|-------------|
| `player_turn` | 90s | `pass_turn` |
| `card_reveal` (CD queue) | 60s | `chairman_director` with `discard_own_idx=-1` (pass) |
| `card_reveal` (reveal_complete) | 15s | `complete_card_reveal` for each disconnected player |
| `share_suspend` | 60s | `share_suspend` with `company_num=0` (pass) |
| `rights_issue` | 60s | `rights_issue_buy` with `quantity=0` (pass) |

**File:** `backend/room_manager.py` — Added `disconnect_timer` (asyncio.Task) and `disconnect_timer_player_id` (tracks who the timer is for) to `Room`. Added `get_active_player_id()` method that resolves the player who needs to act based on phase and sub-phase queues.

**File:** `backend/server.py` — Three core functions:

1. `check_and_start_disconnect_timer(room)` — The orchestrator. Determines who needs to act, checks if they're disconnected, and starts/cancels timers. Called after every `broadcast_game_state()`, on player disconnect, and on reconnect. Safe to call repeatedly — only starts a new timer if the active player changed or no timer exists. If the same player is still disconnected and a timer is already running for them, it leaves the timer running (doesn't reset the countdown).

2. `_run_disconnect_timer(room, player_id, timeout_secs, action_data)` — Sleeps for the timeout, then checks if the player is still disconnected. If so, dispatches the auto-action. After the auto-action, recursively checks if the *new* active player is also disconnected (handles cascading disconnects).

3. `_auto_reveal_complete(room, player_ids)` — Special case for card_reveal without a CD queue, where *all* players need to send `reveal_complete`. Auto-completes for each disconnected player after 15 seconds.

**Key design decision:** The timer is keyed to the specific player (`disconnect_timer_player_id`). If player A disconnects during their turn and a 90s timer starts, then the game auto-passes and it becomes player B's turn, the old timer is cancelled and a fresh check runs for player B. This prevents stale timers from firing wrong auto-actions.

**Notification:** When a timer starts, the server broadcasts `{"type": "player_away", "player_name": "...", "timeout_seconds": 90}`. When the player reconnects, it broadcasts `{"type": "player_back", "player_name": "..."}`. These drive the frontend countdown UI.

### Connected status in game state

**File:** `backend/server.py` — `build_client_state()` now includes `"connected": conn.connected if conn else False` in each player entry.

**File:** `frontend/src/types/game.ts` — Added `connected?: boolean` to `Player` interface.

This lets the frontend know which players are online, enabling UI indicators for disconnected players.

### Frontend reconnection UX

**Problem:** The only connection indicator was a tiny dot in the day/round header. Players had no idea what was happening during disconnects — whether the game was lost, whether they'd reconnect, whether their actions would be saved.

**Changes to Zustand store** (`frontend/src/store/useGameStore.ts`):
- Added `isReconnecting: boolean` — true between `ws.onclose` and the next `ws.onopen`
- Added `awayPlayer: { name: string, timeout: number } | null` — set by `player_away`/`player_back` messages

**New component: `ReconnectingBanner.tsx`** — Fixed-position top banner shown when `isReconnecting && gameStarted`. Displays a WifiOff icon, "Connection lost — reconnecting..." message, "Your game is safe" reassurance text, and a spinning animation. Uses `z-50` to overlay everything. Only shows during active games (not in lobby, where reconnection is less critical).

**New component: `AwayPlayerBanner.tsx`** — Fixed-position top banner showing a countdown when another player is offline and holding up the game. Displays "Waiting for {name} to reconnect... auto-skip in {X}s" with a Clock icon. Countdown runs client-side from the `timeout_seconds` provided by the server.

**Changes to `PlayerBoard.tsx`:**
- Added `WifiOff` icon import from Lucide
- Added `isDisconnected` computed flag (`player.connected === false && !isYou` — don't dim yourself)
- Disconnected players get `opacity-50`, muted background, and a red WifiOff icon replacing the turn indicator dot
- Name text is grayed out for disconnected players

**Changes to `GameBoard.tsx`:**
- Mounted `<ReconnectingBanner />` and `<AwayPlayerBanner />` at the top of the component tree

### Message queue for brief disconnects

**Problem:** `send()` in `useWebSocket.ts` silently dropped messages when the WebSocket was closed. A player who clicked "Buy" during a 2-second network hiccup would see nothing happen.

**Fix:** Added `pendingRef = useRef<ClientMessage[]>([])` for queued messages.

**Modified `send()`:**
- If WebSocket is OPEN: send normally
- If not OPEN: push to `pendingRef.current` and show `toast.warning('Action queued — will send when reconnected')`

**On reconnect (`ws.onopen`):** Flush all pending messages by sending each one, then clear the array.

**Selective queuing:** Only intentional player actions (buy, sell, pass, etc.) are queued. Animation signals (`reveal_complete`, `complete_currency_settlement`, `pong`) are not queued — they'll be handled naturally by game state sync on reconnect, and sending stale animation signals could confuse the phase machine.

**Reconnect toast:** On successful reconnect during an active game, shows `toast.success('Reconnected to game')`.

## Files Modified

### Backend
| File | Changes |
|------|---------|
| `room_manager.py` | `time` import, `last_pong` on PlayerConn, `last_activity` / `disconnect_timer` / `disconnect_timer_player_id` on Room, `touch()`, `has_active_game`, `get_active_player_id()`, `cleanup_stale_rooms()` |
| `server.py` | Removed immediate room deletion, added lifespan + cleanup_loop, `ping_loop()`, `DISCONNECT_TIMEOUTS`, `check_and_start_disconnect_timer()`, `_run_disconnect_timer()`, `_auto_reveal_complete()`, `_StubConn`, `cancel_disconnect_timer()`, pong handling, `connected` in `build_client_state()`, `player_away`/`player_back` broadcasts, `room.touch()` on actions |

### Frontend
| File | Changes |
|------|---------|
| `types/messages.ts` | Added `ping`, `player_away`, `player_back` to ServerMessage; `pong` to ClientMessage |
| `types/game.ts` | Added `connected?: boolean` to Player |
| `store/useGameStore.ts` | Added `AwayPlayer` interface, `isReconnecting`, `awayPlayer` state, `setReconnecting`, `setAwayPlayer` actions |
| `hooks/useWebSocket.ts` | Pong response to pings, `pendingRef` message queue with flush on reconnect, `setReconnecting(true)` on close, `player_away`/`player_back` handling, reconnect toast |
| `components/game/GameBoard.tsx` | Mounted `ReconnectingBanner` and `AwayPlayerBanner` |
| `components/game/PlayerBoard.tsx` | `WifiOff` icon, `isDisconnected` flag, dimmed styling + icon for offline players |

### New Files
| File | Purpose |
|------|---------|
| `components/game/ReconnectingBanner.tsx` | "Connection lost" banner during your own disconnects |
| `components/game/AwayPlayerBanner.tsx` | "Waiting for {name}" countdown banner when another player is offline |

### Documentation
| File | Changes |
|------|---------|
| `CLAUDE.md` | Updated server.py, room_manager.py, useGameStore.ts, useWebSocket.ts descriptions; added "Connection resilience" section to Key Design Contracts |

## Architectural Decisions

### Why TTL-based cleanup instead of reference counting?

Reference counting (`connected_count() == 0 → delete`) is fragile for multiplayer games. All players can be simultaneously disconnected for a split second (server restart, CDN hiccup, mobile network switch). TTL-based cleanup tolerates these transients — rooms survive brief total disconnects and are only cleaned up after extended inactivity.

The dual-threshold approach (5 min for lobbies, 2 hours for games) balances memory usage against gameplay value. An empty lobby has no invested time; an active game represents significant player investment.

### Why per-connection ping tasks instead of a global sweep?

A global sweep (one timer checking all connections) would be simpler but creates issues:
- All stale connection detections cluster at sweep intervals rather than being distributed
- Force-closing a stale WebSocket from outside the connection handler can race with the message loop

Per-connection tasks naturally interleave, and each task has direct access to its own WebSocket for clean shutdown.

### Why dispatch auto-actions through the normal action path?

The disconnect timer dispatches auto-actions through the same `dispatch_action()` → `auto_advance()` → `broadcast_game_state()` path as player actions. This was intentional:
- No separate code path means no divergence in game logic
- All validation, state transitions, and broadcasts work identically
- The game log records "timed out — auto-skipped" so players can see what happened
- If the auto-action fails (game state changed between timer start and fire), the failure is handled gracefully

### Why not reset the timer when the same player is still disconnected?

If player A disconnects during their turn and a 90s timer starts, subsequent calls to `check_and_start_disconnect_timer()` (e.g., from other players' state broadcasts) check whether the timer is already running for player A. If so, they leave it alone. Resetting would mean a flurry of state broadcasts could keep pushing the auto-skip further out, potentially stalling the game longer than intended.

### Why queue player actions but not animation signals?

Animation signals (`reveal_complete`, `complete_currency_settlement`) are not queued because:
- On reconnect, the client receives fresh game state and re-derives which animations to play
- Sending a stale `reveal_complete` after reconnecting could advance a phase prematurely
- The disconnect timer system handles these anyway (auto-completes reveal after 15s)

Player actions (buy, sell, pass) are safe to queue because they include all necessary context and will either succeed or fail gracefully when replayed.

## Verification Scenarios

1. **Room persistence:** Start a game with 2+ players, close all browser tabs, wait 10s, reopen tabs with same names — game resumes from exact state
2. **Disconnect timer:** During player 2's turn, close player 2's tab — after 90s the turn auto-passes and game continues
3. **Heartbeat:** Open game, simulate network loss (DevTools → Network → Offline) — server detects within ~45s
4. **Reconnection UX:** During a game, toggle offline in DevTools — amber "Connection lost" banner appears, disappears on reconnect with "Reconnected" toast
5. **Disconnected player indicator:** With 3+ players, disconnect one — others see dimmed card with WifiOff icon
6. **Message queue:** While briefly offline, click buy — "Action queued" toast appears, action executes after reconnect
7. **Phase-specific tests:** Test disconnect during card_reveal, share_suspend, chairman_director, rights_issue — each auto-skips after its respective timeout
8. **Cascading disconnects:** Disconnect player A (active) and player B (next in turn) — after A is auto-skipped, timer immediately starts for B

## Lessons Learned

- **The engine/server boundary paid off:** Because the game engine is pure functions operating on `GameState` with no connection awareness, the entire resilience system was built in the server layer without touching a single line of engine code. The `dispatch_action` path works identically for human players and auto-actions.
- **Timer identity matters:** Disconnect timers must be keyed to the specific player they're timing, not just "a timer is running." Without `disconnect_timer_player_id`, the system can't distinguish between a timer for the previous active player and the current one, leading to either double-fires or missed auto-actions.
- **Don't reset running timers on re-check:** The `check_and_start_disconnect_timer` function is called from many places (after broadcasts, on disconnect, on reconnect). If it reset the timer each time, the effective timeout would be far longer than intended because every state broadcast would restart the clock.
- **Browser WebSocket API has no ping/pong:** Unlike server-side WebSocket libraries, the browser API doesn't expose protocol-level ping/pong frames. Application-level JSON messages are the only reliable heartbeat mechanism for browser clients.
