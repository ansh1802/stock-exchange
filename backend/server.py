"""server.py — FastAPI WebSocket server for the Stock Exchange game.

Run from the backend/ directory:
    uvicorn server:app --reload --host 0.0.0.0 --port 8000
"""

import os
import random
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import game_engine as ge
from room_manager import RoomManager
from engine.debug_presets import apply_preset, PRESETS
from bots import make_bot

rooms = RoomManager()


async def cleanup_loop():
    """Periodically remove stale rooms where all players disconnected."""
    while True:
        await asyncio.sleep(60)
        rooms.cleanup_stale_rooms()


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(cleanup_loop())
    yield
    task.cancel()


app = FastAPI(title="Stock Exchange Game", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Heartbeat & disconnect timer ────────────────────────────────────────────

import time as _time


async def ping_loop(ws, player_conn):
    """Send periodic pings; mark connection dead if pongs stop arriving."""
    try:
        while True:
            await asyncio.sleep(15)
            if _time.time() - player_conn.last_pong > 45:
                player_conn.connected = False
                try:
                    await ws.close()
                except Exception:
                    pass
                return
            try:
                await ws.send_json({"type": "ping"})
            except Exception:
                player_conn.connected = False
                return
    except asyncio.CancelledError:
        pass


# Phase → (timeout_seconds, auto-action builder)
# player_turn is handled by the dedicated turn timer (configurable per room),
# not this table.
DISCONNECT_TIMEOUTS = {
    "rights_issue":   (60,  lambda pid: ("rights_issue_buy",    {"type": "rights_issue_buy", "quantity": 0})),
    "share_suspend":  (60,  lambda pid: ("share_suspend",       {"type": "share_suspend", "company_num": 0})),
    "card_reveal_cd": (60,  lambda pid: ("chairman_director",   {"type": "chairman_director", "discard_own_idx": -1})),
}

VALID_TURN_TIMERS = {15, 30, 45, 60, 75, 90}

JOIN_ERRORS = {
    "name_taken": "That name is taken in this room. Pick another.",
    "left": "You left this game and can't rejoin it.",
    "started": "That game has already started.",
    "full": "That room is full (6 players).",
}

# Max wait for clients to finish the end-of-day overlay before the first turn
# timer of a new day starts anyway (covers stuck / reconnecting clients).
DAY_START_FALLBACK_SECS = 20


async def check_and_start_disconnect_timer(room):
    """If the active player is disconnected, start an auto-action timer.

    Safe to call repeatedly — only starts a new timer if the active player
    changed or no timer is running.
    """
    if not room.game or room.game.game_phase == "game_over":
        cancel_disconnect_timer(room)
        return

    game = room.game
    phase = game.game_phase
    active_pid = room.get_active_player_id()

    # Special case: card_reveal waiting for reveal_complete from all players
    if phase == "card_reveal" and active_pid is None and not game.chairman_director_queue:
        # Check if any disconnected player hasn't sent reveal_complete
        missing = [
            p.id for p in game.players
            if not p.left
            and p.id not in game.reveal_complete_players
            and not room.players.get(p.id, _StubConn()).connected
        ]
        if missing:
            # Auto-complete reveal for disconnected players after short delay
            if room.disconnect_timer and room.disconnect_timer_player_id == "reveal_multi":
                return  # timer already running for this
            cancel_disconnect_timer(room)
            room.disconnect_timer_player_id = "reveal_multi"
            room.disconnect_timer = asyncio.create_task(
                _auto_reveal_complete(room, missing)
            )
        else:
            cancel_disconnect_timer(room)
        return

    if active_pid is None:
        cancel_disconnect_timer(room)
        return

    player_conn = room.players.get(active_pid)
    if not player_conn or player_conn.connected:
        # Active player is connected — no timer needed
        cancel_disconnect_timer(room)
        return

    # Active player is disconnected — start timer if not already running for them
    if room.disconnect_timer and room.disconnect_timer_player_id == active_pid:
        return  # already timing this player

    cancel_disconnect_timer(room)

    # Determine phase key for timeout lookup
    if phase == "card_reveal" and game.chairman_director_queue:
        phase_key = "card_reveal_cd"
    else:
        phase_key = phase

    timeout_entry = DISCONNECT_TIMEOUTS.get(phase_key)
    if not timeout_entry:
        return

    timeout_secs, action_builder = timeout_entry
    _, action_data = action_builder(active_pid)

    room.disconnect_timer_player_id = active_pid
    room.disconnect_timer = asyncio.create_task(
        _run_disconnect_timer(room, active_pid, timeout_secs, action_data)
    )

    # Surface via game log (no banner)
    player_name = player_conn.name
    room.game_log.append(
        f"{player_name} disconnected — auto-skip in {timeout_secs}s"
    )
    await broadcast_game_state(room)


async def _run_disconnect_timer(room, player_id, timeout_secs, action_data):
    """Wait, then auto-act if the player is still disconnected."""
    try:
        await asyncio.sleep(timeout_secs)
        player_conn = room.players.get(player_id)
        if not player_conn or player_conn.connected:
            return  # they reconnected in time
        if not room.game:
            return

        # Log and dispatch the auto-action
        room.game_log.append(f"{player_conn.name} timed out — auto-skipped")
        result = dispatch_action(room.game, player_id, action_data)
        if result and result["success"]:
            await auto_advance(room)
            await check_and_start_turn_timer(room)
            await broadcast_game_state(room)
            # Check if the NEW active player is also disconnected
            await check_and_start_disconnect_timer(room)
    except asyncio.CancelledError:
        pass
    finally:
        if room.disconnect_timer_player_id == player_id:
            room.disconnect_timer = None
            room.disconnect_timer_player_id = None


async def _auto_reveal_complete(room, player_ids):
    """Auto-complete card reveal for disconnected players."""
    try:
        await asyncio.sleep(15)
        if not room.game:
            return
        for pid in player_ids:
            pc = room.players.get(pid)
            if pc and not pc.connected and pid not in room.game.reveal_complete_players:
                room.game_log.append(f"{pc.name} timed out — auto-completed reveal")
                result = ge.complete_card_reveal(room.game, pid)
                if result and result["success"]:
                    await auto_advance(room)
                    await check_and_start_turn_timer(room)
                    await broadcast_game_state(room)
        # Check if next phase also needs a timer
        await check_and_start_disconnect_timer(room)
    except asyncio.CancelledError:
        pass
    finally:
        if room.disconnect_timer_player_id == "reveal_multi":
            room.disconnect_timer = None
            room.disconnect_timer_player_id = None


class _StubConn:
    """Fallback for missing player connections in dict lookups."""
    connected = True


def cancel_disconnect_timer(room):
    """Cancel any running disconnect timer."""
    if room.disconnect_timer:
        room.disconnect_timer.cancel()
        room.disconnect_timer = None
        room.disconnect_timer_player_id = None


def cancel_turn_timer(room):
    """Cancel any running player_turn auto-pass timer."""
    if room.turn_timer_task:
        room.turn_timer_task.cancel()
    room.turn_timer_task = None
    room.turn_timer_deadline = None
    room.turn_timer_player_id = None


async def check_and_start_turn_timer(room):
    """Start/refresh the player_turn auto-pass timer for the current active player.

    Safe to call repeatedly — only starts a new timer if the active player changed.
    """
    if not room.game or room.game.game_phase != "player_turn":
        cancel_turn_timer(room)
        return

    active_pid = room.get_active_player_id()
    if active_pid is None:
        cancel_turn_timer(room)
        return

    # New day: hold the first turn's clock until clients are back on the board.
    if room.day_start_pending:
        room.day_start_pending = {
            pid for pid in room.day_start_pending
            if room.players.get(pid) and room.players[pid].connected
        }
    if room.day_start_pending:
        cancel_turn_timer(room)
        if not room.day_start_fallback_task:
            room.day_start_fallback_task = asyncio.create_task(_day_start_fallback(room))
        return
    clear_day_start(room)

    if room.turn_timer_task and room.turn_timer_player_id == active_pid:
        return  # already ticking for this player

    cancel_turn_timer(room)
    duration = room.turn_timer_seconds
    room.turn_timer_player_id = active_pid
    room.turn_timer_deadline = _time.time() + duration
    room.turn_timer_task = asyncio.create_task(
        _run_turn_timer(room, active_pid, duration)
    )


def clear_day_start(room):
    """Drop the new-day hold (and its fallback task)."""
    room.day_start_pending = None
    task = room.day_start_fallback_task
    room.day_start_fallback_task = None
    if task and task is not asyncio.current_task():
        task.cancel()


async def _day_start_fallback(room):
    """Start the first turn timer anyway if some client never acks."""
    try:
        await asyncio.sleep(DAY_START_FALLBACK_SECS)
        room.day_start_fallback_task = None
        room.day_start_pending = None
        await check_and_start_turn_timer(room)
        await broadcast_game_state(room)
    except asyncio.CancelledError:
        pass


async def handle_day_start_ready(room, player_id):
    """Client finished the end-of-day overlay and is back on the board."""
    if not room.day_start_pending or player_id not in room.day_start_pending:
        return
    room.day_start_pending.discard(player_id)
    if not room.day_start_pending:
        await check_and_start_turn_timer(room)
        await broadcast_game_state(room)


async def _run_turn_timer(room, player_id, duration):
    """Wait the configured duration, then auto-pass if still the same turn."""
    try:
        await asyncio.sleep(duration)
        if (room.game
                and room.game.game_phase == "player_turn"
                and room.get_active_player_id() == player_id):
            conn = room.players.get(player_id)
            actor = conn.name if conn else f"Player {player_id}"
            room.game_log.append(f"{actor} ran out of time — auto-passed")
            result = ge.pass_turn(room.game, player_id)
            if result and result["success"]:
                await auto_advance(room)
                await check_and_start_turn_timer(room)
                await broadcast_game_state(room)
                await check_and_start_disconnect_timer(room)
    except asyncio.CancelledError:
        pass
    finally:
        if room.turn_timer_player_id == player_id:
            room.turn_timer_task = None
            room.turn_timer_deadline = None
            room.turn_timer_player_id = None


# ── WebSocket endpoint ───────────────────────────────────────────────────────


@app.websocket("/ws/{room_code}/{player_name}")
async def game_ws(websocket: WebSocket, room_code: str, player_name: str):
    await websocket.accept()

    room = rooms.get_or_create(room_code)

    # Lobby name clash: probe the existing socket first. A page refresh can
    # land before the server has processed the old socket's close.
    existing_id = room._name_to_id.get(player_name)
    if not room.started and existing_id is not None:
        existing = room.players[existing_id]
        if existing.connected:
            try:
                await existing.ws.send_json({"type": "ping"})
            except Exception:
                existing.connected = False

    player_id, reconnected, join_error = room.add_player(player_name, websocket)

    if player_id is None:
        await websocket.send_json({
            "type": "join_refused",
            "code": join_error,
            "message": JOIN_ERRORS.get(join_error, "Cannot join this room."),
        })
        await websocket.close()
        return

    player_conn = room.players[player_id]

    # Send lobby state to the joining player
    await websocket.send_json({
        "type": "lobby",
        "room_code": room.code,
        "players": room.get_player_names(),
        "is_host": player_id == room.host_id,
        "reconnected": reconnected,
    })

    # Seed chat history for joining / reconnecting player
    await websocket.send_json({
        "type": "chat_history",
        "messages": list(room.chat_messages),
    })

    # If reconnecting to a live game, send current state and cancel any disconnect timer
    if reconnected and room.started and room.game:
        room.game_log.append(f"{player_name} reconnected")
        await room.send_to(player_id, {
            "type": "game_state",
            "state": build_client_state(room, player_id),
        })
        await broadcast_game_state(room)
        await check_and_start_disconnect_timer(room)
        await check_and_start_turn_timer(room)

    # Notify everyone
    await room.broadcast({
        "type": "player_joined",
        "player_name": player_name,
        "players": room.get_player_names(),
    })
    await broadcast_lobby(room)

    # Start heartbeat ping loop
    ping_task = asyncio.create_task(ping_loop(websocket, player_conn))

    try:
        while True:
            data = await websocket.receive_json()
            # Handle pong responses
            if data.get("type") == "pong":
                player_conn.last_pong = _time.time()
                continue
            try:
                await handle_action(room, player_id, data)
            except Exception as exc:
                import traceback
                traceback.print_exc()
                try:
                    await websocket.send_json({"type": "error", "message": f"Server error: {exc}"})
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        ping_task.cancel()
        conn = room.players.get(player_id)
        # Left / kicked (seat gone or marked left), or this socket was
        # superseded by a reconnect — nothing more to report.
        if conn is None or conn.ws is not websocket or player_id in room.left_ids:
            return
        room.disconnect_player(player_id)
        room.touch()
        await broadcast_lobby(room)
        await room.broadcast({
            "type": "player_left",
            "player_name": player_name,
            "players": room.get_player_names(),
        })
        # Start auto-action timer if the disconnected player was the active player
        if room.started and room.game:
            room.game_log.append(f"{player_name} disconnected")
            await check_and_start_disconnect_timer(room)
            await check_and_start_turn_timer(room)
            await broadcast_game_state(room)
        # Room cleanup is handled by the background cleanup_loop —
        # never delete immediately, so players can reconnect.


# ── State transformation ─────────────────────────────────────────────────────


def build_client_state(room, player_id):
    """Transform engine state into the frontend JSON contract.

    Reshapes to_player_dict() output: injects player names, separates hand,
    filters zero-stock holdings, includes prev_value per company, and appends
    the accumulated game log.

    During card_reveal phase, all hands are visible (reveal_data has card details,
    and to_player_dict exposes all hands).
    """
    game = room.game
    raw = game.to_player_dict(player_id)
    phase = raw["game_phase"]

    # Build player list with names, is_you flag, sparse stocks
    players = []
    your_hand = []
    all_hands = {}  # player_id -> hand cards (during card_reveal)
    for p in raw["players"]:
        conn = room.players.get(p["id"])
        name = conn.name if conn else f"Player {p['id']}"
        sparse_stocks = {k: v for k, v in p["stocks"].items() if v > 0}

        entry = {
            "id": p["id"],
            "name": name,
            "cash": p["cash"],
            "stocks": sparse_stocks,
            "is_you": p["id"] == player_id,
            "connected": conn.connected if conn else False,
            "left": p.get("left", False),
            "bot": conn.bot_difficulty if conn else None,
        }
        players.append(entry)

        # Extract hand for the requesting player
        if p["id"] == player_id and "hand" in p:
            your_hand = [
                {
                    "company": c["company_name"],
                    "value": c["value"],
                    "positive": c["positive"],
                    "is_power": c["is_power"],
                }
                for c in p["hand"]
            ]

        # During card_reveal, collect all hands for the reveal animation
        if phase == "card_reveal" and "hand" in p:
            all_hands[p["id"]] = [
                {
                    "company": c["company_name"],
                    "value": c["value"],
                    "positive": c["positive"],
                    "is_power": c["is_power"],
                }
                for c in p["hand"]
            ]

    # Build companies with prev_value (last day's closing price, not base value)
    last_day_values = game.price_history[-1] if game.price_history else [c.base_value for c in game.companies]
    pre_fluct = raw.get("previous_values") or []
    companies = []
    for i, c in enumerate(raw["companies"]):
        companies.append({
            "name": c["name"],
            "ticker": c.get("ticker", ""),
            "value": c["value"],
            "is_open": c["open"],
            "prev_value": last_day_values[i] if i < len(last_day_values) else c["base_value"],
            # pre_fluct_value: today's pre-card-reveal value, used by ShareSuspendOverlay
            # to show the swap target. Falls back to current value when the snapshot is empty.
            "pre_fluct_value": pre_fluct[i] if i < len(pre_fluct) else c["value"],
        })

    # Resolve current player name — during sub-phases, the active player
    # comes from the queue, not the regular current_turn index.
    active_player_id = None

    if phase == "rights_issue" and raw.get("rights_issue_queue"):
        active_player_id = raw["rights_issue_queue"][0]
    elif phase == "share_suspend" and raw.get("suspend_queue"):
        active_player_id = raw["suspend_queue"][0]
    elif phase == "card_reveal" and raw.get("chairman_director_queue"):
        active_player_id = raw["chairman_director_queue"][0][0]
    else:
        current_turn_idx = raw["current_turn"]
        if current_turn_idx < len(raw["players"]):
            active_player_id = raw["players"][current_turn_idx]["id"]

    current_player_name = ""
    if active_player_id is not None:
        conn = room.players.get(active_player_id)
        current_player_name = conn.name if conn else f"Player {active_player_id}"

    # Enrich reveal_data with player names for the frontend
    reveal_data = raw.get("reveal_data", [])
    if reveal_data:
        for company_reveal in reveal_data:
            for card in company_reveal.get("cards", []):
                pid = card["player_id"]
                conn = room.players.get(pid)
                card["player_name"] = conn.name if conn else f"Player {pid}"

    return {
        "room_code": room.code,
        "phase": phase,
        "day": raw["current_day"],
        "round": raw["current_round"],
        "current_turn": raw["current_turn"],
        "num_players": raw["num_players"],
        "current_player_name": current_player_name,
        "companies": companies,
        "available_shares": raw["available_shares"],
        "players": players,
        "your_hand": your_hand,
        "game_log": list(room.game_log),
        # Sub-phase data
        "rights_issue_company": raw.get("rights_issue_company"),
        "rights_issue_queue": raw.get("rights_issue_queue", []),
        "suspend_queue": raw.get("suspend_queue", []),
        # Chairman / Director data
        "chairman": raw.get("chairman", {}),
        "directors": raw.get("directors", {}),
        "chairman_director_queue": raw.get("chairman_director_queue", []),
        # Card reveal animation data
        "reveal_data": reveal_data,
        "all_hands": all_hands if all_hands else None,
        # Currency settlement snapshot (populated by begin_card_reveal,
        # animated after the final company reveal within card_reveal phase)
        "currency_effects": raw.get("currency_effects", []),
        "price_history": raw.get("price_history", []),
        # Networth history (per-day per-player) — drives the standings graph
        # shown during share_suspend. Snapshotted post-settlement (Trigger A) and
        # rewritten in-place on each share_suspend swap (Trigger B).
        "networth_history": raw.get("networth_history", []),
        # Turn timer (null deadline outside player_turn)
        "turn_timer_deadline": room.turn_timer_deadline,
        "turn_timer_duration": room.turn_timer_seconds,
        # Pre-reveal "ending day in Ns" countdown — non-null only during the
        # 3s pause between final turn and closing bell.
        "day_end_countdown_deadline": room.day_end_countdown_deadline,
    }


# ── Action handling ──────────────────────────────────────────────────────────


async def handle_action(room, player_id, data):
    """Route an incoming player message to the right game engine function."""
    try:
        action_type = data.get("type")
    except (AttributeError, TypeError):
        await room.send_to(player_id, {"type": "error", "message": "Invalid message format."})
        return

    # ── Chat (works in lobby and in-game) ────────────────────────────────
    if action_type == "chat":
        text = (data.get("text") or "").strip()
        if not text:
            return
        if len(text) > 300:
            text = text[:300]
        conn = room.players.get(player_id)
        name = conn.name if conn else f"Player {player_id}"
        msg = {"name": name, "text": text, "ts": _time.time()}
        room.chat_messages.append(msg)
        room.touch()
        await room.broadcast({"type": "chat_message", **msg})
        return

    # ── Leave (lobby or mid-game) ────────────────────────────────────────
    if action_type == "leave_room":
        await handle_leave_room(room, player_id)
        return

    # ── Lobby actions ────────────────────────────────────────────────────
    if action_type in ("add_bot", "set_bot_difficulty"):
        if room.started:
            await room.send_to(player_id, {"type": "error", "message": "Game already started."})
            return
        if player_id != room.host_id:
            await room.send_to(player_id, {"type": "error", "message": "Only the host can manage bots."})
            return
        if action_type == "add_bot":
            _, err = room.add_bot(data.get("difficulty", "medium"))
            if err:
                await room.send_to(player_id, {"type": "error", "message": JOIN_ERRORS.get(err, "Can't add a bot.")})
                return
        elif not room.set_bot_difficulty(data.get("player_name"), data.get("difficulty")):
            await room.send_to(player_id, {"type": "error", "message": "Can't change that bot."})
            return
        await broadcast_lobby(room)
        return

    if action_type in ("set_ready", "kick_player", "set_public"):
        if room.started:
            await room.send_to(player_id, {"type": "error", "message": "Game already started."})
            return
        if action_type == "set_ready":
            if player_id != room.host_id:
                if data.get("ready"):
                    room.ready.add(player_id)
                else:
                    room.ready.discard(player_id)
        elif action_type == "set_public":
            if player_id != room.host_id:
                await room.send_to(player_id, {"type": "error", "message": "Only the host can change this."})
                return
            room.is_public = bool(data.get("is_public"))
        else:
            await handle_kick(room, player_id, data.get("player_name"))
            return
        room.touch()
        await broadcast_lobby(room)
        return

    if action_type == "start_game":
        await handle_start_game(
            room, player_id,
            debug_preset=data.get("preset"),
            turn_timer_seconds=data.get("turn_timer_seconds"),
        )
        return

    if action_type == "list_presets":
        await room.send_to(player_id, {
            "type": "presets",
            "presets": {k: v["description"] for k, v in PRESETS.items()},
        })
        return

    # ── All other actions require a running game ─────────────────────────
    if not room.started or not room.game:
        await room.send_to(player_id, {"type": "error", "message": "Game has not started yet."})
        return

    if action_type == "day_start_ready":
        await handle_day_start_ready(room, player_id)
        return

    result = dispatch_action(room.game, player_id, data)
    if result is None:
        await room.send_to(player_id, {"type": "error", "message": f"Unknown action: {action_type}"})
        return

    # Send feedback to the acting player
    await room.send_to(player_id, {
        "type": "action_result",
        "success": result["success"],
        "message": result["message"],
    })

    if result["success"]:
        await after_action(room, player_id, action_type, result)


async def after_action(room, player_id, action_type, result):
    """Log, advance and broadcast after a successful game action (human or bot)."""
    room.touch()
    # Skip logging and broadcasting for idempotent no-ops (e.g. duplicate reveal_complete)
    # and for "Waiting for N more..." acks during multi-player completion phases.
    if "already" not in result["message"] and not result["message"].startswith("Waiting for"):
        conn = room.players.get(player_id)
        actor = conn.name if conn else f"Player {player_id}"
        room.game_log.append(f"{actor}: {result['message']}")

        # Surface the post-action state BEFORE auto_advance for cases where
        # the engine mutates reveal_data and then auto_advance immediately
        # walks past phases that would clear it. Specifically: the LAST
        # chairman/director discard for the LAST company (e.g. Infosys)
        # triggers _finalize_card_reveal → share_suspend → ... → dealing,
        # and deal_cards() empties reveal_data. Without this early push,
        # clients never see the recomputed delta / new_value that the
        # CardRevealOverlay's pulse animation keys off of.
        if action_type == "chairman_director":
            await broadcast_game_state(room)

        await auto_advance(room)
        await check_and_start_turn_timer(room)
        await broadcast_game_state(room)
        await check_and_start_disconnect_timer(room)


def dispatch_action(game, player_id, data):
    """Map a client message to a game_engine function call. Returns result dict or None."""
    action = data.get("type")

    try:
        if action == "buy":
            return ge.buy_stock(game, player_id, data["company_num"], data["quantity"])

        if action == "sell":
            return ge.sell_stock(game, player_id, data["company_num"], data["quantity"])

        if action == "pass":
            return ge.pass_turn(game, player_id)

        if action == "loan_stock":
            return ge.use_loan_stock(game, player_id)

        if action == "debenture":
            return ge.use_debenture(game, player_id, data["company_num"])

        if action == "rights_issue":
            return ge.use_rights_issue(game, player_id, data["company_num"])

        if action == "rights_issue_buy":
            return ge.rights_issue_buy(game, player_id, data["quantity"])

        if action == "share_suspend":
            return ge.share_suspend_action(game, player_id, data.get("company_num", 0))

        if action == "chairman_director":
            return ge.chairman_director_action(
                game, player_id,
                data["discard_own_idx"],
                data.get("discard_other_player_id"),
                data.get("discard_other_idx"),
            )

        if action == "reveal_complete":
            return ge.complete_card_reveal(game, player_id)

    except Exception as exc:
        import traceback
        traceback.print_exc()
        return {"success": False, "message": f"Server error: {exc}", "new_state": game.to_dict()}

    return None


# ── Lobby / leave ────────────────────────────────────────────────────────────


async def broadcast_lobby(room):
    """Send each lobby client its view (players, ready, host, public)."""
    if room.started:
        return
    for pid in list(room.players):
        await room.send_to(pid, room.lobby_view(pid))


async def _eject(room, conn, reason):
    """Tell a client it's out of the room and close its socket."""
    try:
        await conn.ws.send_json({"type": "left_room", "reason": reason})
    except Exception:
        pass
    try:
        await conn.ws.close()
    except Exception:
        pass


async def handle_kick(room, player_id, target_name):
    if player_id != room.host_id:
        await room.send_to(player_id, {"type": "error", "message": "Only the host can remove players."})
        return
    target_id = room._name_to_id.get(target_name)
    if target_id is None or target_id == player_id:
        await room.send_to(player_id, {"type": "error", "message": "Can't remove that player."})
        return
    conn = room.remove_player(target_id)
    await _eject(room, conn, "kicked")
    await broadcast_lobby(room)


async def handle_leave_room(room, player_id):
    """Explicit leave. Lobby: drop the seat. Mid-game: engine leave_game."""
    conn = room.players.get(player_id)
    if conn is None:
        return

    if not room.started or not room.game:
        room.remove_player(player_id)
        await _eject(room, conn, "left")
        await broadcast_lobby(room)
        return

    if room.game.game_phase == "game_over" or player_id in room.left_ids:
        await _eject(room, conn, "left")
        return

    result = ge.leave_game(room.game, player_id)
    if not result["success"]:
        await room.send_to(player_id, {"type": "error", "message": result["message"]})
        return

    room.left_ids.add(player_id)
    conn.connected = False
    if room.day_start_pending:
        room.day_start_pending.discard(player_id)
    room.touch()
    room.game_log.append(f"{conn.name} left the game — shares returned to market, cash forfeited")
    await _eject(room, conn, "left")

    if not any(pid not in room.left_ids for pid in room.human_ids()):
        room.game.game_phase = "game_over"  # only bots left — nobody to play for

    if room.game.game_phase == "game_over":
        cancel_turn_timer(room)
        cancel_disconnect_timer(room)
        clear_day_start(room)
        await broadcast_game_state(room)
        await broadcast_game_over(room)
        return

    await auto_advance(room)
    await check_and_start_turn_timer(room)
    await broadcast_game_state(room)
    await check_and_start_disconnect_timer(room)


# ── Bots ─────────────────────────────────────────────────────────────────────

# Pause before a bot's move so humans can follow the table (and see it "think").
BOT_MOVE_DELAY = (1.2, 2.4)
BOT_ACK_DELAY = 0.5  # reveal_complete acks: no reason to make humans wait


def _bot_move(room):
    """(conn, message) for the first bot that needs to act now, else (None, None)."""
    game = room.game
    bots = [(pid, c) for pid, c in room.players.items() if c.bot is not None and pid not in room.left_ids]
    for _, conn in bots:
        conn.bot.observe(game)  # every bot snapshots the day start, not just the actor
    for pid, conn in bots:
        msg = conn.bot.act(game)
        if msg is not None:
            return conn, msg
    return None, None


def schedule_bots(room):
    """Start the bot driver if a bot has a move and none is pending."""
    if not room.game or room.game.game_phase == "game_over":
        return
    if room.bot_task and not room.bot_task.done():
        return
    if not any(c.bot for c in room.players.values()):
        return
    conn, _ = _bot_move(room)
    if conn is not None:
        room.bot_task = asyncio.create_task(_run_bot(room))


async def _run_bot(room):
    try:
        conn, msg = _bot_move(room)
        if conn is None:
            return
        quick = msg["type"] == "reveal_complete"
        await asyncio.sleep(BOT_ACK_DELAY if quick else random.uniform(*BOT_MOVE_DELAY))
        if not room.game or room.game.game_phase == "game_over":
            return
        # The table may have moved on while we waited — decide afresh.
        conn, msg = _bot_move(room)
        if conn is None:
            return
        result = dispatch_action(room.game, conn.id, msg)
        if not result or not result["success"]:
            fallback = {
                "player_turn": {"type": "pass"},
                "rights_issue": {"type": "rights_issue_buy", "quantity": 0},
                "share_suspend": {"type": "share_suspend", "company_num": 0},
                "card_reveal": {"type": "chairman_director", "discard_own_idx": -1},
            }.get(room.game.game_phase)
            print(f"[bot] {conn.name} move {msg} rejected: {result and result['message']}")
            if fallback is None:
                return
            msg = fallback
            result = dispatch_action(room.game, conn.id, msg)
            if not result or not result["success"]:
                return
        room.bot_task = None  # let the broadcast below schedule the next bot
        await after_action(room, conn.id, msg["type"], result)
        schedule_bots(room)  # "waiting for N more" acks don't broadcast
    except asyncio.CancelledError:
        pass
    except Exception:
        import traceback
        traceback.print_exc()
    finally:
        if room.bot_task is asyncio.current_task():
            room.bot_task = None


# ── Game start ───────────────────────────────────────────────────────────────


async def handle_start_game(room, player_id, debug_preset=None, turn_timer_seconds=None):
    if player_id != room.host_id:
        await room.send_to(player_id, {"type": "error", "message": "Only the host can start the game."})
        return

    if room.started:
        await room.send_to(player_id, {"type": "error", "message": "Game already started."})
        return

    num_players = len(room.players)
    if num_players < 2:
        await room.send_to(player_id, {"type": "error", "message": "Need at least 2 players."})
        return

    if not room.all_ready():
        await room.send_to(player_id, {"type": "error", "message": "Everyone needs to be ready first."})
        return

    if turn_timer_seconds in VALID_TURN_TIMERS:
        room.turn_timer_seconds = turn_timer_seconds

    room.game = ge.GameState(num_players, player_ids=list(room.players))
    room.started = True
    for pid, conn in room.players.items():
        if conn.is_bot:
            conn.bot = make_bot(pid, conn.bot_difficulty, seed=random.randrange(1 << 30))
    ge.deal_cards(room.game)

    if debug_preset:
        ok, msg = apply_preset(room.game, debug_preset)
        if not ok:
            await room.send_to(player_id, {"type": "error", "message": msg})
            return
        room.game_log.append(f"Debug preset '{debug_preset}' applied")

    room.game_log.append(
        f"Game started — cards dealt (turn timer: {room.turn_timer_seconds}s)"
    )
    await room.broadcast({"type": "game_started", "num_players": num_players})
    await check_and_start_turn_timer(room)
    await broadcast_game_state(room)


# ── Broadcast game state ─────────────────────────────────────────────────────


async def broadcast_game_state(room):
    """Send each player their personalised state using the frontend contract."""
    if not room.game:
        return
    for player in room.players.values():
        if player.connected and not player.is_bot:
            try:
                state = build_client_state(room, player.id)
                await player.ws.send_json({"type": "game_state", "state": state})
            except Exception as exc:
                import traceback
                traceback.print_exc()
                player.connected = False
    # Every state change ends in a broadcast — the one place bots get woken.
    schedule_bots(room)


# ── Auto-advance through automated phases ────────────────────────────────────


async def auto_advance(room):
    """Push the game through phases that don't need player input.

    Phase machine (stops when frontend animation / player input is needed):
        card_reveal¹ → share_suspend² → day_end → dealing → player_turn
                                                              ↑ STOP
    ¹ always stops — frontend animates card reveal + currency settlement,
      sends reveal_complete (single ack covers both)
    ² stops if suspend_queue has entries (player chooses)
    """
    game = room.game
    advanced = True

    while advanced:
        advanced = False
        phase = game.game_phase

        if phase == "card_reveal" and not game.reveal_data:
            if room.day_end_countdown_deadline is not None:
                break  # another auto_advance is already in the pre-reveal pause
            # Pause for 3s so players can register the final turn's outcome
            # before the closing bell animation. The deadline is broadcast as
            # `day_end_countdown_deadline` so the top indicator can render
            # "Ending day in 3,2,1" — driven by the same absolute-timestamp
            # pattern as the turn timer.
            import time as _time
            room.day_end_countdown_deadline = _time.time() + 3.0
            await broadcast_game_state(room)
            await asyncio.sleep(3.0)
            room.day_end_countdown_deadline = None
            if game.game_phase != "card_reveal" or game.reveal_data:
                break  # a mid-game leave ended the game during the pause
            # Just entered card_reveal — compute reveal data and CD queue
            r = ge.begin_card_reveal(game)
            room.game_log.append(r["message"])
            await room.broadcast({"type": "phase_change", "phase": "card_reveal", "message": r["message"]})
            # reveal_data is now populated — loop will stop (condition won't match)
            advanced = True

        # card_reveal (with reveal_data) → STOP — frontend animates cards + currency
        # share_suspend (with queue) → STOP — player acts

        elif phase == "day_end":
            r = ge.end_day(game)
            room.game_log.append(r["message"])
            await room.broadcast({"type": "phase_change", "phase": "day_end", "message": r["message"]})
            if game.game_phase == "game_over":
                await broadcast_game_over(room)
                return
            advanced = True

        elif phase == "dealing":
            r = ge.deal_cards(game)
            room.game_log.append(r["message"])
            # Clients are still on the end-of-day overlay — hold the first
            # turn timer until they ack `day_start_ready` (or the fallback).
            clear_day_start(room)
            room.day_start_pending = {
                pid for pid, conn in room.players.items() if conn.connected and not conn.is_bot
            }
            await room.broadcast({"type": "phase_change", "phase": "dealing", "message": r["message"]})
            advanced = True

        # card_reveal (with CD queue), share_suspend (with queue),
        # player_turn, rights_issue → stop and wait for player input


# ── Game over ────────────────────────────────────────────────────────────────


async def broadcast_game_over(room):
    """Calculate net worth rankings and broadcast final results."""
    game = room.game

    rankings = []
    for player in game.players:
        net_worth = player.cash
        for company in game.companies:
            held = player.stocks[company.name]
            if held > 0 and company.open:
                net_worth += held * company.value

        conn = room.players.get(player.id)
        rankings.append({
            "player_id": player.id,
            "name": conn.name if conn else f"Player {player.id}",
            "cash": player.cash,
            "net_worth": net_worth,
            "stocks": dict(player.stocks),
            "left": player.left,
        })

    # Players who left rank below everyone still in the game.
    rankings.sort(key=lambda r: (r["left"], -r["net_worth"]))

    room.game_log.append("Game over!")
    await room.broadcast({"type": "game_over", "rankings": rankings})


# ── Public room discovery ────────────────────────────────────────────────────


@app.get("/api/rooms")
async def list_public_rooms():
    return {"rooms": rooms.public_lobbies()}


# ── Serve frontend static files (production) ────────────────────────────────

frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Serve actual file if it exists (JS, CSS, favicon, etc.)
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise serve index.html (SPA fallback)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
