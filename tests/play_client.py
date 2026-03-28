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

# Company name → index mapping (1-based company_num for the API)
COMPANY_NAMES = ["Vodafone", "YesBank", "Cred", "TCS", "Reliance", "Infosys"]
COMPANY_INDEX = {name: i + 1 for i, name in enumerate(COMPANY_NAMES)}


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
                day = state["day"]
                phase = state["phase"]

                if day > stop_day:
                    print(f"[{name}] Day {day} reached — stopping (target was day {stop_day}).")
                    return

                action = choose_action(state, name, phase)
                if action:
                    await asyncio.sleep(delay)
                    label = action["type"]
                    if "company_num" in action and action["type"] in ("buy", "sell"):
                        co = state["companies"][action["company_num"] - 1]["name"]
                        label += f" {action.get('quantity', '')} {co}"
                    print(f"[{name}] Day {day} R{state['round']} | {label}")
                    await ws.send(json.dumps(action))

            elif mtype == "error":
                print(f"[{name}] ERROR: {msg['message']}")


def choose_action(state, my_name, phase):
    """Return an action dict if it's our turn, else None."""
    if phase == "player_turn":
        if state["current_player_name"] != my_name:
            return None
        return pick_move(state, my_name)

    if phase == "rights_issue":
        # rights_issue_queue contains player IDs, but we can check current_player_name
        # For simplicity, just pass on rights issue buys
        queue = state.get("rights_issue_queue", [])
        if queue:
            return {"type": "rights_issue_buy", "quantity": 0}
        return None

    if phase == "share_suspend":
        queue = state.get("suspend_queue", [])
        if queue:
            return {"type": "share_suspend", "company_num": 0}
        return None

    if phase == "card_reveal":
        # If reveal_data is present and no CD queue, send reveal_complete to advance
        if state.get("reveal_data") and not state.get("chairman_director_queue"):
            return {"type": "reveal_complete"}
        queue = state.get("chairman_director_queue", [])
        if queue and state["current_player_name"] == my_name:
            _pid, _company, role = queue[0]
            if role == "double_director":
                return {"type": "chairman_director", "discard_own_idx": [0, 1]}
            elif role == "chairman":
                # Discard own card 0, pick first other player
                others = [p for p in state["players"] if not p.get("is_you")]
                target_id = 1  # fallback
                if others:
                    target_id = others[0].get("id", 1)
                return {
                    "type": "chairman_director",
                    "discard_own_idx": 0,
                    "discard_other_player_id": target_id,
                    "discard_other_idx": 0,
                }
            else:
                return {"type": "chairman_director", "discard_own_idx": 0}
        return None

    if phase == "currency_settlement":
        return {"type": "complete_currency_settlement"}

    return None


def pick_move(state, my_name):
    """Simple bot AI: 50% buy, 20% sell, 30% pass."""
    me = next(p for p in state["players"] if p["name"] == my_name)
    companies = state["companies"]
    available = state["available_shares"]
    cash = me["cash"]

    roll = random.random()

    if roll < 0.5 and cash > 0:
        open_cos = [
            (i, c) for i, c in enumerate(companies)
            if c["is_open"] and c["value"] > 0 and available[i] > 0
        ]
        if open_cos:
            idx, co = random.choice(open_cos)
            affordable = int(cash / co["value"])
            can_buy = min(affordable, available[idx], 5)
            if can_buy > 0:
                qty = random.randint(1, can_buy)
                return {"type": "buy", "company_num": idx + 1, "quantity": qty}

    if roll < 0.7:
        # stocks is now a sparse dict {company_name: count}
        held = [
            (COMPANY_INDEX[comp_name], count)
            for comp_name, count in me["stocks"].items()
            if count > 0
        ]
        if held:
            company_num, count = random.choice(held)
            qty = random.randint(1, min(count, 3))
            return {"type": "sell", "company_num": company_num, "quantity": qty}

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
