# Phase 7: Configurable Turn Timer & Disconnect Log

## Goal

Two gameplay / UX issues remained after the connection-resilience work in Phase 6:

1. **Idle connected players could stall the game.** The Phase 6 disconnect timer only auto-passed for *offline* players. A connected player who simply wasn't paying attention could block everyone else indefinitely on their turn.
2. **Disconnect banner was noisy.** The fixed-position `AwayPlayerBanner` overlaid the top of the screen whenever any player was away, drawing more attention than the event warranted. Disconnect/reconnect are routine on mobile networks and don't need a full-width banner.

Additional ask: make the turn duration configurable per lobby, and use the countdown itself as the visible active-turn indicator (replacing the room code + green dot in the top-right).

The backend contract from Phase 6 made this straightforward — `dispatch_action` / `auto_advance` / `broadcast_game_state` already form the single path through which both human actions and auto-actions flow, so the new turn timer plugs into the same pipeline with no engine changes.

## What Changed

### Configurable turn timer, chosen in the lobby

**Problem:** `DISCONNECT_TIMEOUTS["player_turn"]` was hardcoded to 90 seconds and only fired when the active player was disconnected. No way for hosts to pick a shorter pace for fast games.

**Fix:** Host picks from `{15, 30, 45, 60, 75, 90}` seconds in the lobby before starting. Stored on `Room`, used by a dedicated turn-timer system.

**File:** `frontend/src/components/lobby/StartButton.tsx` — Row of six pill buttons above the Start Game button, default 90s. The selected value is included in the `start_game` WebSocket message (both normal and preset-debug variants).

**File:** `backend/room_manager.py` — Added to `Room`:
```python
self.turn_timer_seconds = 90
self.turn_timer_task = None
self.turn_timer_deadline = None    # unix timestamp (float) or None
self.turn_timer_player_id = None
```

**File:** `backend/server.py` — `handle_start_game` now accepts `turn_timer_seconds`, validates against `VALID_TURN_TIMERS = {15, 30, 45, 60, 75, 90}`, and stores the chosen value on the room. Invalid / missing values fall back to 90.

### Dedicated turn-timer state machine (server-authoritative)

**Problem:** The old disconnect timer required the player to actually be offline. To auto-pass a connected-but-idle player we need a timer that runs every turn, regardless of connection state.

**Fix:** Three new helpers in `backend/server.py` model the turn timer separately from the disconnect timer:

1. `check_and_start_turn_timer(room)` — If `game_phase == "player_turn"` and an active player exists, start a timer for them. Safe to call repeatedly: if a timer is already ticking for the same player, leave it alone.
2. `_run_turn_timer(room, player_id, duration)` — Sleeps for the configured duration, then dispatches `pass_turn` if the same player is still up. Feeds the auto-pass through `auto_advance` + `broadcast_game_state` like any player action.
3. `cancel_turn_timer(room)` — Cancels the `asyncio.Task` and clears the deadline.

`"player_turn"` was removed from `DISCONNECT_TIMEOUTS` — the new turn timer subsumes it. `rights_issue`, `share_suspend`, and `card_reveal_cd` still use the Phase 6 disconnect-timer machinery, since those sub-phases don't have an always-visible countdown.

### Deadline broadcast via game state, not a separate message

**Problem:** A naive implementation would broadcast `{"type": "turn_timer_start", ...}` on every turn transition, requiring custom reconnection handling so late-joining clients see the correct remaining time.

**Fix:** `build_client_state` includes `turn_timer_deadline` (unix timestamp in seconds) and `turn_timer_duration` in every broadcast. Reconnecting clients get the deadline for free in the normal `game_state` payload — no special "catch-up" message needed.

**File:** `backend/server.py` — Added to the dict returned by `build_client_state`:
```python
"turn_timer_deadline": room.turn_timer_deadline,
"turn_timer_duration": room.turn_timer_seconds,
```

**Key ordering detail:** `check_and_start_turn_timer(room)` is called **before** `broadcast_game_state(room)` at every site (after `handle_start_game`, after successful action dispatch, after `_run_turn_timer`'s own auto-pass, after `_run_disconnect_timer`'s auto-skip that transitions into player_turn, after `_auto_reveal_complete`'s auto_advance, and on reconnect). Calling in the other order would leak a broadcast with the stale deadline from the previous turn — observable as a 1-frame "old timer" flash in the UI.

### Visible countdown in the top-right

**Problem:** The old top-right just showed the room code + a static green connection dot during gameplay. Players had to look at the player-board ring to know whose turn it was, and there was no time pressure.

**Fix:** During `player_turn`, the top-right shows `<Clock /> 27s` instead of the room code. Outside `player_turn` (card_reveal, share_suspend, currency_settlement, day_end) the original room code + connection dot comes back.

**File:** `frontend/src/components/game/TurnTimerDisplay.tsx` (new) — Compact widget. Color and pulse speed driven by urgency (see below).

**File:** `frontend/src/components/game/DayRoundIndicator.tsx` — Conditional render based on `useTurnUrgency().active`.

### Urgency color system (green → amber → red)

**Problem:** A monochrome countdown doesn't convey "you should hurry" at a glance. The active-player card in `PlayerBoard` was always a constant emerald, regardless of time remaining.

**Fix:** A single `useTurnUrgency()` hook computes `{ remaining, urgency, fraction }` from `gameState.turn_timer_deadline` and `turn_timer_duration`. Thresholds are fractions of the configured duration so 30-second and 90-second games feel proportional:

| Fraction remaining | Urgency   | Colors                          |
|--------------------|-----------|---------------------------------|
| `> 0.5`            | `calm`    | emerald ring/dot/text, soft pulse |
| `0.25 < f ≤ 0.5`   | `warning` | amber ring/dot/text, soft pulse |
| `≤ 0.25`           | `critical`| red ring/dot/text, 0.6s pulse   |

**File:** `frontend/src/hooks/useTurnUrgency.ts` (new) — Uses the Phase 6 `AwayPlayerBanner` client-tick pattern: a `setInterval(tick, 250)` reads `Date.now()` against the absolute deadline. 250ms resolution (vs. 1s) makes the color transitions feel smooth when a tick crosses a threshold boundary.

**File:** `frontend/src/components/game/PlayerBoard.tsx` — Replaced hardcoded emerald classes with a `URGENCY_STYLE` map:
```ts
const URGENCY_STYLE = {
  calm:     { ring: 'ring-emerald-500/70', border: 'border-emerald-800/50', dot: 'bg-emerald-400', text: 'text-emerald-300', pulse: 'animate-pulse' },
  warning:  { ring: 'ring-amber-500/70',   border: 'border-amber-800/50',   dot: 'bg-amber-400',   text: 'text-amber-300',   pulse: 'animate-pulse' },
  critical: { ring: 'ring-red-500/80',     border: 'border-red-800/60',     dot: 'bg-red-500',     text: 'text-red-300',     pulse: 'animate-[pulse_0.6s_ease-in-out_infinite]' },
  none:     { ring: 'ring-emerald-500/70', border: 'border-emerald-800/50', dot: 'bg-emerald-400', text: 'text-emerald-300', pulse: 'animate-pulse' },
}
```
`TurnTimerDisplay` consumes the same hook, so the top-right widget and the active-player card always show the same color at the same time.

### Disconnect banner → game-log entries

**Problem:** `AwayPlayerBanner` was a fixed-position, full-width banner that appeared every time a player went away during a sub-phase. With mobile players on spotty connections, it flashed in and out frequently enough to be distracting.

**Fix:** Killed the banner and both `player_away` / `player_back` WebSocket message types. Disconnect/reconnect events are now appended to `room.game_log`, which already streams to the right-side `GameLog` panel via the normal `game_state` broadcast:

- Plain disconnect: `"{name} disconnected"`
- Disconnect while active in a sub-phase: `"{name} disconnected — auto-skip in 60s"` (preserves the timeout info)
- Reconnect: `"{name} reconnected"`
- Sub-phase timeout: `"{name} timed out — auto-skipped"` (unchanged from Phase 6)
- Turn timer expiry: `"{name} ran out of time — auto-passed"`

**Files removed:**
- `frontend/src/components/game/AwayPlayerBanner.tsx`

**Files updated:**
- `frontend/src/types/messages.ts` — removed `player_away` / `player_back` from `ServerMessage`
- `frontend/src/store/useGameStore.ts` — removed `awayPlayer` state, `AwayPlayer` interface, `setAwayPlayer` action
- `frontend/src/hooks/useWebSocket.ts` — removed the `player_away` / `player_back` switch branches
- `frontend/src/components/game/GameBoard.tsx` — removed `<AwayPlayerBanner />` mount
- `backend/server.py` — `check_and_start_disconnect_timer` appends to `room.game_log` + broadcasts fresh state instead of sending a separate `player_away` message; the reconnect path logs `"{name} reconnected"` + broadcasts; the `game_ws` `finally` block logs `"{name} disconnected"` for every disconnect, then runs both timer checks and broadcasts once

## Files Modified

### Backend
| File | Changes |
|------|---------|
| `room_manager.py` | `Room`: `turn_timer_seconds`, `turn_timer_task`, `turn_timer_deadline`, `turn_timer_player_id` |
| `server.py` | `VALID_TURN_TIMERS`; removed `player_turn` from `DISCONNECT_TIMEOUTS`; new `cancel_turn_timer`, `check_and_start_turn_timer`, `_run_turn_timer`; `handle_start_game` accepts `turn_timer_seconds`; `build_client_state` emits deadline + duration; replaced `player_away`/`player_back` broadcasts with game-log entries + fresh `broadcast_game_state`; `check_and_start_turn_timer` called before every broadcast in start, dispatch, reconnect, and both auto-timer paths |

### Frontend
| File | Changes |
|------|---------|
| `types/messages.ts` | `start_game` gains `turn_timer_seconds?`; removed `player_away`, `player_back` |
| `types/game.ts` | `GameState` gains `turn_timer_deadline`, `turn_timer_duration` |
| `store/useGameStore.ts` | Removed `awayPlayer` state, interface, action |
| `hooks/useWebSocket.ts` | Removed `player_away` / `player_back` handling |
| `hooks/useTurnUrgency.ts` | **New** — `{ active, remaining, urgency, fraction, duration }` hook, 250ms tick |
| `components/lobby/StartButton.tsx` | Six-pill timer selector above Start Game; value included in both start_game variants |
| `components/game/DayRoundIndicator.tsx` | Conditional `TurnTimerDisplay` during `player_turn`, else room code + connection dot |
| `components/game/TurnTimerDisplay.tsx` | **New** — compact `<Clock /> 27s` widget with urgency colors |
| `components/game/PlayerBoard.tsx` | `URGENCY_STYLE` map drives the active-player ring, border, dot, name-text color |
| `components/game/GameBoard.tsx` | Unmounted `AwayPlayerBanner` |

### Files Deleted
| File | Reason |
|------|--------|
| `components/game/AwayPlayerBanner.tsx` | Replaced by game-log entries |

## Architectural Decisions

### Why store the timer on `Room`, not `GameState`?

The turn timer is a room-level setting, not engine state. Putting it on `Room` keeps the engine pure — `GameState.to_dict()` still serializes only gameplay data, and no engine file imports anything connection-related. The alternative (stashing it on `GameState`) would have muddied the engine/server boundary that the rest of this codebase leans on heavily.

### Why broadcast the absolute deadline, not the remaining seconds?

An absolute unix timestamp is idempotent: multiple broadcasts during a single turn (e.g., another player buying shares mid-turn triggers a re-broadcast) all carry the same deadline, and the client displays the same countdown. If we broadcast `remaining_seconds` instead, each broadcast would reset the client's countdown to the most recently received value — causing visible "jumps" whenever state is re-sent.

Clock skew between server and clients can cause a 1-2 second display offset, which is well within acceptable tolerance for a 15-90 second timer.

### Why a fraction-based urgency threshold, not fixed seconds?

Thresholds at `0.5` and `0.25` of the configured duration mean:
- 90s game: calm 90→46, warning 45→23, critical 22→0
- 30s game: calm 30→16, warning 15→8, critical 7→0
- 15s game: calm 15→8, warning 7→4, critical 3→0

Fixed-second thresholds (e.g., "red below 10s") would make a 15-second game start in red immediately. Proportional thresholds let the color transitions feel equally paced regardless of the configured duration.

### Why a 250ms tick instead of 1000ms?

The `remaining` display updates once per second (since it's `Math.ceil(deadline - now)`), but urgency transitions happen at fractional boundaries. A 1000ms tick could cause a visible ~1s lag between crossing a boundary (e.g., from 51% remaining to 49%) and the color actually changing. 250ms is fine-grained enough that the color change lines up with the displayed number flipping.

### Why not reuse the disconnect timer for player_turn?

Initially considered — the disconnect timer already handles auto-passing. But its lifecycle is keyed to connection state, and expanding it to "also auto-pass connected idle players" would have required two separate trigger conditions per timer, complicating reasoning. A dedicated turn timer that runs unconditionally is simpler to reason about: if the phase is `player_turn`, there's a timer; otherwise there isn't. The disconnect timer remains focused on sub-phases (`share_suspend`, `rights_issue`, `card_reveal_cd`) where a visible countdown doesn't make sense.

### Why kill the banner entirely instead of just making it smaller?

The game log on the right is already the canonical place where players look to understand what just happened. Adding disconnects to that feed is consistent with how every other game event is surfaced. A banner is appropriate for *your own* state (you're disconnected and might be worried) — hence `ReconnectingBanner` stays — but not for informational events about *other* players.

## Verification Scenarios

1. **Lobby selector:** Host sees six pills [15, 30, 45, 60, 75, 90] with 90 preselected. Non-host sees "Waiting for host". Selecting 30s and starting works.
2. **Synced countdown:** With two tabs, both show the same number (±1s) in the top-right during player 1's turn. Room code / green dot no longer appear during `player_turn`.
3. **Urgency colors at 30s:** t=30→16s emerald; t=15→8s amber; t=7→0s red with faster pulse. Timer widget color matches the active-player card color at every instant.
4. **Auto-pass (connected):** Idle through the window — turn auto-passes, log shows `"{name} ran out of time — auto-passed"`. Next player's card resets to emerald.
5. **Auto-pass (disconnected):** Close active player's tab — log shows `"{name} disconnected"`. At timer expiry the turn auto-passes with the ran-out-of-time log line.
6. **Mid-turn reconnect:** Close & reopen a non-active player's tab. Reopened tab shows correct remaining time and correct urgency color. Log shows `"{name} reconnected"`.
7. **No banner:** Disconnects never produce a top-of-screen banner anymore — only log entries.
8. **Timer hidden in sub-phases:** During card_reveal, share_suspend, rights_issue, currency_settlement, day_end — top-right shows the original room code + green dot.
9. **Sub-phase disconnect still auto-skips:** Disconnect during share_suspend → 60s later the action auto-skips (log entries only, no banner).
10. **Invalid timer rejected:** `start_game` with `turn_timer_seconds: 5` falls back to 90s default server-side (no client changes attempted).

## Lessons Learned

- **Broadcast order matters when state carries a timer.** Every site that advances the phase must call `check_and_start_turn_timer(room)` *before* `broadcast_game_state(room)`, not after — otherwise the broadcast carries the previous turn's deadline and the UI briefly shows the wrong countdown. There are six such sites (start, dispatch, both auto-timers, auto-reveal-complete, reconnect). Forgetting any of them produces a subtle "1-frame flash" bug.
- **Absolute deadlines beat relative seconds for server→client time.** Re-broadcasts during a turn would otherwise reset the client countdown.
- **Proportional urgency thresholds scale cleanly across durations.** Fixed-second thresholds don't — a 15-second game would be red before it started.
- **Game log is a better channel than banners for events about other players.** The banner drew the eye too aggressively for routine mobile-network disconnects. The log is already the go-to place for "what happened" and integrates without extra UI chrome.
- **A dedicated timer for each phase keeps the state machine legible.** Collapsing the turn timer and disconnect timer into one would have saved ~30 lines of code at the cost of making both harder to reason about. They overlap in spirit but differ in triggering conditions — separation is cheaper than cleverness.
