# Phase 11 — Room Management & Gameplay Bug Fixes (GitHub #20, #22)

Design: `docs/superpowers/specs/2026-10-18-issues-20-22-design.md`
Plan: `docs/superpowers/plans/2026-10-18-issues-20-22-plan.md`
Commits: `0861011` (#22), `6f14091` + `fc27e10` (#20). Deployed to GCP the same day.

## Goals

**#22 — gameplay bugs reported from real games**
1. First player of a new day loses turn time, and is sometimes auto-skipped.
2. Share suspend: players mis-halt companies because the clickable list is indistinguishable from the read-only price table and one tap commits.
3. Rights Issue: easy to pass by accident when you could have bought.
4. Trade popup: Max / RI buttons cramped on the quantity row; timer hidden behind the popup.

**#20 — room management**
Duplicate-name protection, Ready, Kick, Leave (lobby *and* mid-game), public room discovery. Explicitly **not** built: "close room for everyone".

---

## #22 — what was wrong and what changed

### New-day turn timer (root cause confirmed)
`auto_advance` ran `day_end → dealing → player_turn` immediately after share suspend, and `check_and_start_turn_timer` started the first player's clock at once. Clients were still on `ShareSuspendOverlay` (graph travel 3.2 s + 5 s countdown + swap animations), so with 15–30 s timers the first player lost most of their time or was auto-passed before seeing the board.

Fix (server-authoritative, same shape as `reveal_complete`):
- `Room.day_start_pending` — set of connected player ids, populated when `auto_advance` deals a new day.
- `check_and_start_turn_timer` returns early (no clock, no deadline) while the set is non-empty and arms a **20 s fallback task** (`DAY_START_FALLBACK_SECS`) so a stuck client can't freeze the day.
- New client message `day_start_ready`, sent from `GameBoard.handleSuspendComplete` when the overlay closes. Idempotent; each ack removes the sender; the last ack starts the timer and broadcasts. Disconnected players are pruned, never waited on.
- `day_start_ready` is in the "don't queue while offline" list in `useWebSocket.send`.

### Share suspend two-step
`ShareSuspendOverlay`: tap **selects** (radio-style rows in an amber-bordered panel), a sticky footer outside the scroll area holds `Halt <Company>` + `Pass`. The price table is dimmed, dashed, and `pointer-events-none`. Selection resets whenever the queue head changes. The unused `ShareSuspendModal.tsx` was deleted.

### Rights Issue pass confirm
`RightsIssueModal`: Pass shows an inline "Pass on up to N shares at $X?" confirm only when `maxQty > 0` (eligible AND available AND affordable — `maxQty = min(eligible, floor(cash/price), available)`). Otherwise Pass is immediate. Server-side auto-pass is unaffected.

### Trade popup
`TradeModal`: Max and RI buy/sell moved to their own 2-column row under the stepper (44 px on mobile); `TurnTimerDisplay` in the header.

---

## #20 — design

### Duplicate names — lobby only
`Room.add_player` now returns `(pid, reconnected, error_code)`. Codes: `name_taken`, `left`, `started`, `full`.
- **Lobby:** a name belonging to a *connected* player is refused (`name_taken`). The WS endpoint first pings the existing socket so a refresh that races the old socket's close doesn't self-block.
- **Mid-game:** same name always reclaims the seat, *even if the server still thinks the old socket is live*. Reason: the server only marks a player dead after 45 s of missed pongs, so a strict rule would lock the real owner out while their turn/sub-phase timers run (a phone that slept, a network switch). The owner explicitly accepted that a stranger could take a seat mid-game over that lockout risk, and preferred this to per-browser tokens (rejoining from another device must work).
- Refusals are a distinct `join_refused` message; the client stops reconnecting and returns to the landing page.

### Ready / Kick / Public
- `Room.ready` (set of non-host ids), `Room.is_public`. Host is exempt from Ready (pressing Start is their ready). Joiners start not-ready.
- `handle_start_game` requires `room.all_ready()` — enforced server-side, not just by the disabled button.
- `kick_player` (host only, lobby only). Kicked players may rejoin.
- `set_public` (host only). `GET /api/rooms` lists public, unstarted rooms with connected players: `{code, host, players, ready, max_players}`. Landing page polls it every 5 s.
- `lobby_update` replaces ad-hoc name lists for lobby state: per-player `{name, ready, is_host, connected}` plus a per-recipient `is_host` and `is_public`. `player_joined`/`player_left` are still sent for compatibility.
- `left_room` (`reason: left|kicked`) tells a client it's out; server closes its socket.

### Leave
**Lobby:** `Room.remove_player` drops the seat; host passes to the lowest remaining id.

**Mid-game** (`engine/leave.py :: leave_game`) — **soft removal**. The player stays in `GameState.players` with `Player.left = True`, so indices, ids and `num_players` never shift. On leave:
- shares → `available_shares`, cash → 0 (burned), `update_positions` for every company (chairman/director seats re-evaluated);
- hand discarded so their cards don't count in that day's reveal — **unless the reveal is already on screen** (`reveal_data` computed), in which case already-revealed cards stand, their `currency_effects` are removed (else a Currency+ would resurrect burned cash), and they're dropped from the CD queue / reveal acks;
- removed from the rights-issue, CD and suspend queues; if that empties a queue the sub-phase is finalized (rights issue restores the company value and returns to `player_turn`); if it was their turn, `advance_turn`;
- fewer than 2 active players → `game_over` (last player standing wins).

Everything that iterates players now respects `left`: `advance_turn` (skips them; round ends on index wrap), `deal_cards` (no hand; first turn = `first_active_index`), `complete_card_reveal` (`reveal_acks_missing` counts active players only), server disconnect/reveal auto-ack, `broadcast_game_over` (rankings sort `(left, -net_worth)`, `left` flag included), networth graph (left players filtered out).

Server (`handle_leave_room`): engine call → `room.left_ids.add` → mark disconnected → drop from `day_start_pending` → log line → eject → `auto_advance` / timers / broadcast, or `broadcast_game_over`. **Left seats can never be reclaimed** (`left_ids` checked first in `add_player`). Inactive or disconnected players are **never** auto-removed — leaving is only ever explicit.

### Engine takes real room ids
`GameState(num_players, player_ids=None)`. Room ids are not contiguous once someone leaves/is kicked from the lobby (ids 1,3,4…), but the engine used to assume `1..n`. `handle_start_game` now passes `player_ids=list(room.players)`. Default (`None`) keeps `1..n` for tests and debug tooling.

### Frontend
- `useWebSocket`: `stoppedRef` stops auto-reconnect after `left_room` / `join_refused` / unmount; `onclose` ignores sockets that are no longer `wsRef.current`; `exitRoom()` resets the store (GamePage's existing redirect returns to `/`).
- Lobby: `PlayerList` (ready badges, host crown, **Kick** button for host), `StartButton` (Ready toggle for non-hosts; host gets Public switch + Start gated on `canStart` with a "Waiting for X" hint), Leave room button in `GamePage`.
- Game: Exit icon in `DayRoundIndicator` (mobile + desktop) → `LeaveGameModal` (lists consequences, **type LEAVE** to arm the button).
- `PlayerBoard` / `MobilePlayerBoard`: left players dimmed with a `LEFT` tag; `GameOverScreen` shows `(left)`.
- `LobbyPage`: remembers last name in `localStorage`; `PublicRooms` list (v1 and v2 themes), tapping a room joins at once if a name is set.
- Vite dev proxy gained `/api`.

---

## Other bugs fixed along the way

| Bug | Fix |
|-----|-----|
| A superseded socket's `finally` block marked a *reconnected* player disconnected (old socket closing after the new one attached). | `finally` returns early unless `room.players[pid].ws is websocket`. |
| Deliberate `disconnect()` / unmount triggered the auto-reconnect loop. | `stoppedRef`. |
| Two overlapping `auto_advance` calls could both enter the 3 s pre-reveal pause and double-`begin_card_reveal`. | Guard on `day_end_countdown_deadline`; re-check phase after the sleep (a mid-game leave can end the game during the pause). |

---

## Testing

`tests/test_room_features.py` (71 checks; run with `backend/venv/bin/python tests/test_room_features.py`) drives `server.py` handlers directly with fake websockets:
- day-start hold, ack, disconnected-ignored, fallback;
- engine ids, leave on/off turn, last turn of day, last player standing, rights issue (mid-queue and initiator-last), leave before reveal (cards excluded), during reveal acks, during CD queue (chairman seat vacated), during share suspend, left player not dealt;
- duplicate-name rules (lobby vs mid-game), ready-gated start, kick/leave/host transfer, public listing, mid-game leave via the server (rankings order, no reclaim).

Also verified end-to-end over real WebSockets against a local uvicorn (dup refused, public list, start blocked until ready, mid-game leave → `left_room` → winner `game_over`, rejoin refused).

**Baseline caveat:** `tests/test_mechanics.py` has 5 pre-existing failures that predate this phase — stale assertions from the Rebalance commit (Loan Stock amount, Rights Issue price `10`/`5×10`) and chairman-target validation (partial exercise). Unchanged by this work.

## Gotchas for future work

- **`left` players must stay in `GameState.players`.** Removing them shifts `current_turn` and breaks id/index assumptions everywhere. Any new code that loops over players, builds a queue, or waits for acks must skip `left` (use `active_players()`).
- **Mid-game name reclaim is deliberately permissive** (see above). Don't tighten it without addressing the 45 s stale-socket window.
- **New-day timer ordering:** `check_and_start_turn_timer` still must run before `broadcast_game_state` at every advancement site; the day-start hold makes the deadline `null` until acks arrive, and the ack handler itself broadcasts.
- Deploys end games in progress (in-memory state) — see `DEPLOYMENT.md`.
