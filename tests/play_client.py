#!/usr/bin/env python3
"""play_client.py — Reactive WebSocket game client for testing.

Usage:
    python play_client.py <name> <room_code> [--host] [--stop-after-day N] [--delay SECS]
"""

import asyncio
import json
import sys
import random
import websockets


async def play(name, room_code, is_host, stop_day=5, delay=2.0):
    uri = f"ws://localhost:8000/ws/{room_code}/{name}"
    print(f"[{name}] Connecting to {uri}...")

    async with websockets.connect(uri) as ws:
        async for raw in ws:
            msg = json.loads(raw)
            mtype = msg.get("type")

            if mtype == "lobby":
                print(f"[{name}] Joined room {msg['room_code']} | "
                      f"Players: {msg['players']} | Host: {msg['is_host']}")

            elif mtype == "player_joined":
                print(f"[{name}] {msg['player_name']} joined → {msg['players']}")
                if is_host and len(msg["players"]) >= 2:
                    await asyncio.sleep(delay)
                    print(f"[{name}] Starting game...")
                    await ws.send(json.dumps({"type": "start_game"}))

            elif mtype == "player_left":
                print(f"[{name}] {msg['player_name']} left")

            elif mtype == "game_started":
                print(f"[{name}] === Game started ({msg['num_players']} players) ===")

            elif mtype == "action_result":
                tag = "OK" if msg["success"] else "FAIL"
                print(f"[{name}]   [{tag}] {msg['message']}")

            elif mtype == "phase_change":
                print(f"[{name}]   phase → {msg['phase']}: {msg['message']}")

            elif mtype == "game_over":
                print(f"[{name}] === GAME OVER ===")
                for i, r in enumerate(msg["rankings"], 1):
                    print(f"[{name}]   #{i} {r['name']}: "
                          f"cash={r['cash']:.0f}  net_worth={r['net_worth']:.0f}")
                return

            elif mtype == "game_state":
                state = msg["state"]
                day = state["current_day"]
                phase = state["game_phase"]
                my_id = state["your_id"]

                if day > stop_day:
                    print(f"[{name}] Day {day} reached — stopping (target was day {stop_day}).")
                    return

                action = choose_action(state, my_id, phase)
                if action:
                    await asyncio.sleep(delay)
                    label = action["type"]
                    if "company_num" in action and action["type"] in ("buy", "sell"):
                        co = state["companies"][action["company_num"] - 1]["name"]
                        label += f" {action.get('quantity', '')} {co}"
                    print(f"[{name}] Day {day} R{state['current_round']} | {label}")
                    await ws.send(json.dumps(action))

            elif mtype == "error":
                print(f"[{name}] ERROR: {msg['message']}")


def choose_action(state, my_id, phase):
    """Return an action dict if it's our turn, else None."""
    if phase == "player_turn":
        current_id = state["players"][state["current_turn"]]["id"]
        if current_id != my_id:
            return None
        return pick_move(state, my_id)

    if phase == "rights_issue":
        queue = state.get("rights_issue_queue", [])
        if queue and queue[0] == my_id:
            return {"type": "rights_issue_buy", "quantity": 0}
        return None

    if phase == "share_suspend":
        queue = state.get("suspend_queue", [])
        if queue and queue[0] == my_id:
            return {"type": "share_suspend", "company_num": 0}
        return None

    return None


def pick_move(state, my_id):
    """Simple bot AI: 50% buy, 20% sell, 30% pass."""
    me = next(p for p in state["players"] if p["id"] == my_id)
    companies = state["companies"]
    available = state["available_shares"]
    cash = me["cash"]

    roll = random.random()

    if roll < 0.5 and cash > 0:
        open_cos = [
            (i, c) for i, c in enumerate(companies)
            if c["open"] and c["value"] > 0 and available[i] > 0
        ]
        if open_cos:
            idx, co = random.choice(open_cos)
            affordable = int(cash / co["value"])
            can_buy = min(affordable, available[idx], 5)
            if can_buy > 0:
                qty = random.randint(1, can_buy)
                return {"type": "buy", "company_num": idx + 1, "quantity": qty}

    if roll < 0.7:
        held = [
            (i, count)
            for i, (_, count) in enumerate(me["stocks"].items())
            if count > 0
        ]
        if held:
            idx, count = random.choice(held)
            qty = random.randint(1, min(count, 3))
            return {"type": "sell", "company_num": idx + 1, "quantity": qty}

    return {"type": "pass"}


if __name__ == "__main__":
    name = sys.argv[1]
    room = sys.argv[2]
    is_host = "--host" in sys.argv
    stop_day = 5
    delay = 2.0
    for i, arg in enumerate(sys.argv):
        if arg == "--stop-after-day" and i + 1 < len(sys.argv):
            stop_day = int(sys.argv[i + 1])
        if arg == "--delay" and i + 1 < len(sys.argv):
            delay = float(sys.argv[i + 1])

    asyncio.run(play(name, room, is_host, stop_day, delay))
