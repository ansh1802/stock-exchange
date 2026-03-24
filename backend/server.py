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
            "state": room.game.to_player_dict(player_id),
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
        await auto_advance(room)
        await room.broadcast_game_state()


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

    await room.broadcast({"type": "game_started", "num_players": num_players})
    await room.broadcast_game_state()


# ── Auto-advance through automated phases ────────────────────────────────────


async def auto_advance(room):
    """Push the game through phases that don't need player input.

    Phase machine (stops when player input is needed):
        fluctuation  →  currency_settlement  →  share_suspend¹  →  day_end  →  dealing  →  player_turn
                                                                                              ↑ STOP
    ¹ stops only if suspend_queue has entries (players must act)
    """
    game = room.game
    advanced = True

    while advanced:
        advanced = False
        phase = game.game_phase

        if phase == "fluctuation":
            result = ge.fluctuate_values(game)
            await room.broadcast({"type": "phase_change", "phase": "fluctuation", "message": result["message"]})
            advanced = True

        elif phase == "currency_settlement":
            result = ge.currency_settlement(game)
            await room.broadcast({"type": "phase_change", "phase": "currency_settlement", "message": result["message"]})
            advanced = True

        elif phase == "share_suspend" and not game.suspend_queue:
            # No suspend cards — _finalize_suspend already moved to day_end
            advanced = True

        elif phase == "day_end":
            result = ge.end_day(game)
            await room.broadcast({"type": "phase_change", "phase": "day_end", "message": result["message"]})
            if game.game_phase == "game_over":
                await broadcast_game_over(room)
                return
            advanced = True

        elif phase == "dealing":
            result = ge.deal_cards(game)
            await room.broadcast({"type": "phase_change", "phase": "dealing", "message": result["message"]})
            advanced = True

        # player_turn, rights_issue, share_suspend (with queue) → stop and wait


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

    await room.broadcast({"type": "game_over", "rankings": rankings})
