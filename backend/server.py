"""server.py — FastAPI WebSocket server for the Stock Exchange game.

Run from the backend/ directory:
    uvicorn server:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

import game_engine as ge
from room_manager import RoomManager

app = FastAPI(title="Stock Exchange Game")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rooms = RoomManager()


# ── WebSocket endpoint ───────────────────────────────────────────────────────


@app.websocket("/ws/{room_code}/{player_name}")
async def game_ws(websocket: WebSocket, room_code: str, player_name: str):
    await websocket.accept()

    room = rooms.get_or_create(room_code)
    player_id, reconnected = room.add_player(player_name, websocket)

    if player_id is None:
        await websocket.send_json({
            "type": "error",
            "message": "Cannot join: game already started or room is full.",
        })
        await websocket.close()
        return

    # Send lobby state to the joining player
    await websocket.send_json({
        "type": "lobby",
        "room_code": room.code,
        "players": room.get_player_names(),
        "is_host": player_id == room.host_id,
        "reconnected": reconnected,
    })

    # If reconnecting to a live game, send current state
    if reconnected and room.started and room.game:
        await room.send_to(player_id, {
            "type": "game_state",
            "state": build_client_state(room, player_id),
        })

    # Notify everyone
    await room.broadcast({
        "type": "player_joined",
        "player_name": player_name,
        "players": room.get_player_names(),
    })

    try:
        while True:
            data = await websocket.receive_json()
            await handle_action(room, player_id, data)
    except WebSocketDisconnect:
        room.disconnect_player(player_id)
        await room.broadcast({
            "type": "player_left",
            "player_name": player_name,
            "players": room.get_player_names(),
        })
        if room.connected_count() == 0:
            rooms.remove_room(room.code)


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
    companies = []
    for i, c in enumerate(raw["companies"]):
        companies.append({
            "name": c["name"],
            "value": c["value"],
            "is_open": c["open"],
            "prev_value": last_day_values[i] if i < len(last_day_values) else c["base_value"],
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
        "price_history": raw.get("price_history", []),
    }


# ── Action handling ──────────────────────────────────────────────────────────


async def handle_action(room, player_id, data):
    """Route an incoming player message to the right game engine function."""
    try:
        action_type = data.get("type")
    except (AttributeError, TypeError):
        await room.send_to(player_id, {"type": "error", "message": "Invalid message format."})
        return

    # ── Lobby action ─────────────────────────────────────────────────────
    if action_type == "start_game":
        await handle_start_game(room, player_id)
        return

    # ── All other actions require a running game ─────────────────────────
    if not room.started or not room.game:
        await room.send_to(player_id, {"type": "error", "message": "Game has not started yet."})
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
        # Skip logging and broadcasting for idempotent no-ops (e.g. duplicate reveal_complete)
        if "already" not in result["message"]:
            conn = room.players.get(player_id)
            actor = conn.name if conn else f"Player {player_id}"
            room.game_log.append(f"{actor}: {result['message']}")

            await auto_advance(room)
            await broadcast_game_state(room)


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

        if action == "complete_currency_settlement":
            return ge.complete_currency_settlement(game)

    except (KeyError, TypeError) as exc:
        return {"success": False, "message": f"Missing field: {exc}", "new_state": game.to_dict()}

    return None


# ── Game start ───────────────────────────────────────────────────────────────


async def handle_start_game(room, player_id):
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

    room.game = ge.GameState(num_players)
    room.started = True
    ge.deal_cards(room.game)

    room.game_log.append("Game started — cards dealt")
    await room.broadcast({"type": "game_started", "num_players": num_players})
    await broadcast_game_state(room)


# ── Broadcast game state ─────────────────────────────────────────────────────


async def broadcast_game_state(room):
    """Send each player their personalised state using the frontend contract."""
    if not room.game:
        return
    for player in room.players.values():
        if player.connected:
            try:
                state = build_client_state(room, player.id)
                await player.ws.send_json({"type": "game_state", "state": state})
            except Exception:
                player.connected = False


# ── Auto-advance through automated phases ────────────────────────────────────


async def auto_advance(room):
    """Push the game through phases that don't need player input.

    Phase machine (stops when frontend animation / player input is needed):
        card_reveal¹ → share_suspend² → currency_settlement³ → day_end → dealing → player_turn
                                                                                      ↑ STOP
    ¹ always stops — frontend animates card reveal, sends reveal_complete
    ² stops if suspend_queue has entries (player chooses)
    ³ always stops — frontend animates, sends complete_currency_settlement
    """
    game = room.game
    advanced = True

    while advanced:
        advanced = False
        phase = game.game_phase

        if phase == "card_reveal" and not game.reveal_data:
            # Just entered card_reveal — compute reveal data and CD queue
            r = ge.begin_card_reveal(game)
            room.game_log.append(r["message"])
            await room.broadcast({"type": "phase_change", "phase": "card_reveal", "message": r["message"]})
            # reveal_data is now populated — loop will stop (condition won't match)
            advanced = True

        # card_reveal (with reveal_data) → STOP — frontend animates
        # share_suspend (with queue) → STOP — player acts
        # currency_settlement → STOP — frontend animates

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
        })

    rankings.sort(key=lambda r: r["net_worth"], reverse=True)

    room.game_log.append("Game over!")
    await room.broadcast({"type": "game_over", "rankings": rankings})
