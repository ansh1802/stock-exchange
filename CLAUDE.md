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

Frontend runs at `http://localhost:5173` and proxies `/ws` (WebSocket) and `/api` to `localhost:8000` via Vite config. If those ports are taken by other projects, run the backend on another port and start Vite with `VITE_WS_URL=ws://localhost:<port> npx vite --port <free> --strictPort` (the proxy target is hardcoded to 8000). Open multiple tabs to test multiplayer.

## Architecture

### Backend (`backend/`)

**`server.py`** — FastAPI WebSocket server. Players connect at `/ws/{room_code}/{player_name}`. Handles lobby (join/start), dispatches player actions to the game engine, auto-advances through automated phases, and broadcasts per-player state after each action. Resolves active player from sub-phase queues (rights_issue, share_suspend, chairman_director) rather than just `current_turn`. Includes heartbeat ping/pong (15s interval, 45s stale threshold), disconnect timer system (auto-passes for offline players), and a background room cleanup loop. Also handles lobby actions (`set_ready`, `kick_player`, `set_public`, `leave_room` — lobby and mid-game), `broadcast_lobby`, the new-day timer hold (`day_start_ready`), and `GET /api/rooms` (public lobby list).

**`room_manager.py`** — `RoomManager` creates/tracks rooms with 4-char codes. `Room` holds player connections, game state, host ID, game log. Supports reconnection by name (lobby: a *connected* player's name is refused with `name_taken`; mid-game: same name always reclaims the seat; players in `left_ids` can never reclaim). Also owns lobby state: `ready`, `is_public`, `remove_player` (host transfer), `lobby_view`, `public_lobbies`. Rooms persist with TTL-based cleanup (5 min for empty lobbies, 2 hours for active games) — never deleted immediately on disconnect.

**`game_engine.py`** — Thin wrapper that re-exports the `engine/` package and adds `create_game()`.

**`engine/` package:**
- `constants.py` — Game config (company names/values, card counts, cash/share defaults, chairman/director thresholds)
- `models.py` — `Card`, `Company`, `Player` (has `left` flag), `GameState(num_players, player_ids=None)` with `to_dict()` / `to_player_dict()`. The server passes real room ids (non-contiguous after lobby leaves). GameState includes `chairman` and `directors` position tracking.
- `deck.py` — `build_deck()` produces the 100-card deck (84 company + 16 power)
- `helpers.py` — Shared validation (`validate_turn`, `validate_company`, `advance_turn` — skips left players), `active_players()`, `first_active_index()`, `result()` builder, `update_positions()` for chairman/director tracking after trades
- `actions.py` — Player turn actions: `buy_stock`, `sell_stock`, `pass_turn`, power card functions. Power cards are consumed after use.
- `leave.py` — `leave_game`: mid-game leave via soft removal (`Player.left`). Shares back to market, cash burned, hand discarded, removed from turns/queues, game over if <2 active players.
- `phases.py` — Phase transitions: `deal_cards`, `begin_card_reveal`, `complete_card_reveal`, `chairman_director_action`, `share_suspend_action`, `currency_settlement`, `complete_currency_settlement`, `end_day`
- `debug_presets.py` — Decorator-based preset registry for testing specific game scenarios (chairman, director, share suspend, currency, etc.)

**Dependency flow:** `constants` ← `models` ← `deck`, `helpers` ← `actions`, `phases`. No circular imports.

### Frontend (`frontend/`)

**Stack:** React 19, Zustand 5, Framer Motion 12, Tailwind CSS 4, Vite 8, TypeScript 5.9, Lucide icons, Sonner toasts.

**`store/useGameStore.ts`** — Zustand store: connection state (isConnected, isReconnecting), lobby state, game state, game over rankings.

**`hooks/useWebSocket.ts`** — WebSocket connect/send/disconnect with exponential backoff reconnect. Routes all server message types to the store. Handles ping/pong heartbeat, queues outbound messages during disconnects (flushed on reconnect), and manages reconnecting state.

**`hooks/useIsMyTurn.ts`, `useMyPlayer.ts`** — Derived state helpers.

**`types/game.ts`, `types/messages.ts`** — Full TypeScript interfaces matching the backend state contract. `ServerMessage` and `ClientMessage` discriminated unions.

**`components/game/GameBoard.tsx`** — Main game layout and animation orchestrator. Manages a **decoupled `animPhase`** (separate from backend phase) that tracks which overlay is active. Uses `lastRevealDay` to prevent re-animation on reconnect.

**Key components:**
- `CardRevealOverlay` — Full-screen "Closing Bell" animation with staged card reveal per company. Internal state machine: `company_intro → revealing_cards → final_value → chairman_director → complete`. Uses `useMemo` for derived visible cards (not accumulated state).
- `ShareSuspendOverlay` — Share suspend decision UI. Two-step: tap selects, sticky Halt/Pass footer commits
- `CurrencySettlementOverlay` — Cash +/- 10% animation
- `ChairmanDirectorModal` — End-of-day card discard selection
- `StockTicker`, `PlayerHand`, `GameLog` — Core game UI panels
- `PlayerBoard` — Center grid showing all players' cash, net worth, holdings, position icons
- `ActionBar` + `TradeModal` — Bottom trade controls (replaced TradePanel). Max / RI buttons on their own row; turn countdown in the header
- `LeaveGameModal` — Mid-game exit confirmation (type LEAVE). Opened from the Exit icon in `DayRoundIndicator`
- `lobby/PlayerList`, `lobby/StartButton`, `lobby/PublicRooms` — Ready badges + host Kick, Ready toggle / Public switch / gated Start, landing-page open-room list
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

**Left players (mid-game leave):** `Player.left` soft-removes a player — they stay in `GameState.players` so ids/indices never shift. Any code that loops over players, builds a queue or waits for acks must skip them (`active_players()`). Their cards are discarded (unless the day's reveal is already computed), they rank last, and `room.left_ids` blocks any rejoin. Disconnected/idle players are never auto-removed — leaving is explicit only.

**Lobby rules:** Start requires every non-host player Ready (server-enforced). Host can Kick (lobby only; kicked players may rejoin) and mark the room Public. Duplicate-name refusal is **lobby only** by design — mid-game reclaim must stay permissive because the server can think a dead socket is live for up to 45s.

**WebSocket message protocol:** Client sends `{"type": "buy", "company_num": 4, "quantity": 5}` etc. Server responds with `{"type": "action_result", ...}` to the actor and `{"type": "game_state", "state": ...}` to all players. Lobby/room messages: client `set_ready`, `set_public`, `kick_player`, `leave_room`, `day_start_ready`; server `lobby_update`, `join_refused` (`name_taken|left|started|full`), `left_room` (`left|kicked`). `join_refused` / `left_room` end the session client-side (no auto-reconnect).

**Animation state is decoupled from backend state.** The frontend maintains its own `animPhase` to drive overlays independently of the backend phase. This prevents re-animation on reconnect and allows smooth transitions. **Important caveat:** Components that react to value changes during animated phases (e.g., ShareSuspendOverlay) must wait for the backend phase to confirm before tracking diffs — the frontend animation may finish before the backend has finalized.

**Connection resilience:**
- Rooms persist with TTL-based cleanup (5 min empty lobbies, 2 hours active games). Never deleted immediately — all players can disconnect and reconnect.
- Server-side heartbeat: pings every 15s, marks stale after 45s (3 missed pongs).
- Disconnect timers: for sub-phases, when the active player disconnects, auto-skips after timeout (60s share_suspend/rights_issue/chairman_director, 15s reveal_complete).
- Frontend: `ReconnectingBanner` shows during your own disconnects, `PlayerBoard` dims disconnected players with WifiOff icon.
- Outbound message queue: actions sent while disconnected are queued and flushed on reconnect.
- Disconnect / reconnect / timeout events are surfaced in the game log, not as banners.

**Turn timer (Phase 7):**
- Host picks duration in lobby: 15/30/45/60/75/90s (default 90). Stored on `Room.turn_timer_seconds`.
- Runs on every `player_turn` regardless of connection state. Auto-passes on expiry via the same `dispatch_action` + `auto_advance` path as human actions.
- Deadline broadcast via `build_client_state` (`turn_timer_deadline` is an absolute unix timestamp) so reconnecting clients get the correct remaining time automatically.
- `useTurnUrgency` hook computes fraction-based urgency (>0.5 calm, >0.25 warning, ≤0.25 critical) — drives both the top-right `TurnTimerDisplay` and the active player's card ring/dot/name color (green → amber → red with faster pulse at critical).
- `check_and_start_turn_timer` must be called *before* `broadcast_game_state` at every advancement site so the broadcast carries the fresh deadline.
- **New-day hold:** after `deal_cards` on day 2+, `room.day_start_pending` holds the first turn's clock until each connected client sends `day_start_ready` (sent when the end-of-day overlay closes), with a 20s fallback (`DAY_START_FALLBACK_SECS`). The deadline is `null` while held.

## Deployment

**Hosted on GCP** in project `stock-exchange-7354` (region `asia-south1`). Migrated off Railway — `railway.toml` is gone. **See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full reference**; the essentials:

- **Frontend** — Firebase Hosting at https://stock-exchange.web.app (the URL to share).
- **Backend** — Cloud Run service `stock-exchange` at https://stock-exchange-116318124618.asia-south1.run.app.
- **Deploy** — `./deploy.sh [backend|frontend|all]`. Manual; no push-to-deploy trigger.
- `Dockerfile` — unchanged. Stage 1: `node:20-slim` builds frontend. Stage 2: `python:3.12-slim` runs uvicorn. The Cloud Run image includes the frontend, so the Cloud Run URL serves a working game on its own — useful for isolating Hosting problems from backend problems.
- `.gcloudignore` — Cloud Build upload context. When present, gcloud ignores `.gitignore`, so `node_modules` must be listed explicitly. Keep in sync with `.dockerignore`.

**Firebase Hosting cannot proxy WebSockets.** A rewrite from Hosting to Cloud Run drops the upgrade handshake. The frontend therefore dials Cloud Run directly: `deploy.sh` bakes `VITE_WS_URL` into the bundle at build time. Without that variable `useWebSocket.ts` falls back to the page origin and auto-detects `ws://` vs `wss://`, which is what keeps local dev and the Cloud Run fallback URL working.

**Cloud Run flags are load-bearing, not cosmetic.** Game state is in process memory, so `--max-instances 1` (a second instance splits a room), `--no-cpu-throttling` (throttled CPU freezes turn timers and the cleanup loop), `--concurrency 250` (the ceiling on simultaneous players), and `--timeout 3600` (the max socket lifetime; reconnect handles the cut) are all required. Two consequences: **deploying ends games in progress**, and a room dies if every player disconnects at once and the instance goes idle. Fixing either means moving room state to Redis or Firestore.

FastAPI serves both WebSocket connections (`/ws/...`) and frontend static files (`/*` catch-all with SPA fallback). The catch-all uses direct `FileResponse` (not `StaticFiles`) to avoid 301 redirects.

## Development History

Detailed design docs for each phase of development live in `development-history/`. Reference these for context on why things are built the way they are, what bugs were encountered and fixed, and the architectural decisions made along the way.

| Phase | File | Summary |
|-------|------|---------|
| Phase 0 | [`development-history/phase_0.md`](development-history/phase_0.md) | Engine refactoring from 6 files to pure-function `engine/` package. 7 bugs fixed (shared class attrs, rights issue logic, card references, etc.). Deck composition, serialization contracts. |
| Phase 1 | [`development-history/phase_1.md`](development-history/phase_1.md) | FastAPI WebSocket server, room management, reconnection, action dispatch, auto-advance loop, game over rankings. Message protocol. |
| Phase 2 | [`development-history/phase_2.md`](development-history/phase_2.md) | Full React frontend with animations. Chairman/Director feature. Phase machine changes (card_reveal replaces fluctuation, pausing phases). 5 bugs fixed (duplicate cards, overflow, key collision, sub-phase active player, power card consumption). |
| Phase 3 | [`development-history/phase_3.md`](development-history/phase_3.md) | UI restructure (PlayerBoard, ActionBar, TradeModal), share suspend sync with animation queue and countdown, sparkline charts, rights issue / debenture overlays, card reveal sync across players. |
| Phase 4 | [`development-history/phase_4.md`](development-history/phase_4.md) | Chairman/director fixes (hooks crash, index mismatch, partial exercise), debug preset system, chairman+director stacking for 150+/200+ shares, double director flexibility. |
| Phase 5 | [`development-history/phase_5_deployment.md`](development-history/phase_5_deployment.md) | Railway deployment (Dockerfile, static serving from FastAPI). Production bug fixes: 3xx redirects from StaticFiles, share suspend ghost animations from animation/backend phase desync, ws/wss auto-detection. |
| Phase 6 | [`development-history/phase_6_connection_resilience.md`](development-history/phase_6_connection_resilience.md) | Connection resilience: TTL-based room persistence (no more instant deletion), ping/pong heartbeat, disconnect timer auto-pass system, reconnection UX (banners, dimmed players, message queue). Zero engine changes. |
| Phase 7 | [`development-history/phase_7_turn_timer.md`](development-history/phase_7_turn_timer.md) | Configurable turn timer (15/30/45/60/75/90s) picked in lobby, visible countdown in top-right replacing room code, green→amber→red urgency colors on active player card. `AwayPlayerBanner` + `player_away`/`player_back` messages removed — disconnects now surface via game log. |
| Phase 8 | [`development-history/phase_8_mobile_ui.md`](development-history/phase_8_mobile_ui.md) | Mobile UI stabilisation. Single codebase, `useIsMobile()` fork at 768px. Backend `Company.ticker`, CAPS tickers across surfaces. New mobile components: `MobilePlayerBoard` (always-visible rows, auto-scroll), `MobileCardStrip` + `ViewAllDrawer`, `MobileTabBar` + `MobileLogChat` (merged log+chat). Mobile `DayRoundIndicator`, `TurnTimerDisplay.alwaysShow`, 44px touch targets, safe-area padding, top-center Sonner on mobile. |
| Phase 9 | [`development-history/phase_9_tutorial_and_currency_refactor.md`](development-history/phase_9_tutorial_and_currency_refactor.md) | Tutorial infrastructure (RulebookPage with 10 chapters, TutorialPage hub, first-encounter tooltips, Coachmark + Spotlight components, tutorialStorage). Currency settlement phase collapsed into `card_reveal`: snapshotted at `begin_card_reveal`, animated as a tail stage in `CardRevealOverlay`, applied at `_finalize_card_reveal` — `CurrencySettlementOverlay` and `complete_currency_settlement` ack deleted. Editorial-casino v2 theme opt-in. Card reveal new-value brightness fix. |
| Phase 10 | [`development-history/phase_10_networth_graph_and_ui_polish.md`](development-history/phase_10_networth_graph_and_ui_polish.md) | Networth standings graph in ShareSuspendOverlay (animated SVG, log scale, overtake flourish, per-player legend with deltas). `networth_history` snapshotted post-settlement (Trigger A) and after each share-suspend swap (Trigger B). StockTicker prev→value display across all viewport variants. CardRevealOverlay old→new label + value pulse on chairman/director recompute. Chairman/director early broadcast fix. |
| Phase 11 | [`development-history/phase_11_room_management_and_bugfixes.md`](development-history/phase_11_room_management_and_bugfixes.md) | GitHub #20/#22. New-day turn-timer hold (`day_start_ready`), two-step share suspend, Rights Issue pass confirm, trade-popup Max/RI row + timer. Room management: lobby-only duplicate-name refusal, Ready-gated Start, Kick, lobby + mid-game Leave (soft-removal `Player.left`, shares to market, cash burned, last player standing wins), public room list (`/api/rooms`). Engine now takes real room player ids. |
| Architecture | [`development-history/game_arch_deploy_numbers.md`](development-history/game_arch_deploy_numbers.md) | Full architectural deep-dive: server-authoritative pattern, phase state machine, auto-advance loop, deployment guide, NFR numbers, scaling progression. |

## Other Directories

- `base_logic_old/` — Original 6-file implementation. Do not modify.
- `tests/` — `test_game.py` (integration test), `test_room_features.py` (server/room/leave tests, 71 checks — `backend/venv/bin/python tests/test_room_features.py`), `test_mechanics.py` (engine mechanics; 5 known pre-existing failures from the Rebalance commit), `play_client.py` (manual bot client)
