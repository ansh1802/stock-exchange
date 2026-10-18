"""test_bots.py — bots in rooms (lobby controls + full games through the server).

Drives server.py handlers with fake websockets; asyncio.sleep is sped up
up so bot delays, day-end pauses and turn timers run quickly.
Run: backend/venv/bin/python tests/test_bots.py
"""

import asyncio
import contextlib
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
sys.path.insert(0, os.path.join(ROOT, "balance"))

_real_sleep = asyncio.sleep


async def _fast_sleep(d, *a, **k):
    # Bot delays / day-end pauses: 1000x faster. Turn & disconnect timers
    # (>=15s): only 100x, so a loaded machine can't make a bot "time out".
    await _real_sleep(d / 100 if d >= 15 else d / 1000)


asyncio.sleep = _fast_sleep

import server  # noqa: E402
from room_manager import Room  # noqa: E402

passed = 0
failed = 0


def check(desc, condition):
    global passed, failed
    print(f"  [{'✓' if condition else '✗ FAIL'}] {desc}")
    if condition:
        passed += 1
    else:
        failed += 1
    return condition


def header(title):
    print(f"\n{'═' * 60}\n  {title}\n{'═' * 60}")


class FakeWS:
    def __init__(self):
        self.sent = []

    async def send_json(self, msg):
        self.sent.append(msg)

    async def close(self):
        pass

    def last(self, t):
        return next((m for m in reversed(self.sent) if m.get("type") == t), None)


async def human_loop(room, pid, stop):
    """A lazy human: passes every turn, skips every sub-phase, acks everything."""
    while not stop.is_set():
        g = room.game
        if g is None or g.game_phase == "game_over":
            return
        if room.day_start_pending and pid in room.day_start_pending:
            await server.handle_action(room, pid, {"type": "day_start_ready"})
        active = room.get_active_player_id()
        ph = g.game_phase
        if active == pid:
            msg = {
                "player_turn": {"type": "pass"},
                "rights_issue": {"type": "rights_issue_buy", "quantity": 0},
                "share_suspend": {"type": "share_suspend", "company_num": 0},
                "card_reveal": {"type": "chairman_director", "discard_own_idx": -1},
            }.get(ph)
            if msg:
                await server.handle_action(room, pid, msg)
        elif ph == "card_reveal" and g.reveal_data and not g.chairman_director_queue \
                and pid not in g.reveal_complete_players:
            await server.handle_action(room, pid, {"type": "reveal_complete"})
        await _real_sleep(0.001)


async def lobby_tests():
    header("Lobby: add / tune / kick bots")
    room = Room("BOTS")
    host_ws, guest_ws = FakeWS(), FakeWS()
    host, _, _ = room.add_player("Host", host_ws)
    guest, _, _ = room.add_player("Guest", guest_ws)

    await server.handle_action(room, guest, {"type": "add_bot", "difficulty": "hard"})
    check("non-host can't add a bot", len(room.players) == 2)

    await server.handle_action(room, host, {"type": "add_bot", "difficulty": "hard"})
    await server.handle_action(room, host, {"type": "add_bot", "difficulty": "easy"})
    bots = [c for c in room.players.values() if c.is_bot]
    check("host added two bots", len(bots) == 2)
    check("bots are ready", all(c.id in room.ready for c in bots))
    view = host_ws.last("lobby_update")
    check("lobby_update reports bot difficulty",
          sorted(p["bot"] for p in view["players"] if p["bot"]) == ["easy", "hard"])

    name = bots[1].name
    await server.handle_action(room, host, {"type": "set_bot_difficulty", "player_name": name, "difficulty": "medium"})
    check("host can change bot difficulty", room.players[bots[1].id].bot_difficulty == "medium")
    await server.handle_action(room, host, {"type": "set_bot_difficulty", "player_name": "Guest", "difficulty": "hard"})
    check("can't set difficulty on a human", not room.players[guest].is_bot)

    _, _, err = room.add_player(name, FakeWS())
    check("a human can't take a bot's name", err == "name_taken")

    await server.handle_action(room, host, {"type": "kick_player", "player_name": name})
    check("kick removes a bot", name not in room._name_to_id)

    for _ in range(6):
        await server.handle_action(room, host, {"type": "add_bot", "difficulty": "easy"})
    check("room caps at 6 seats", len(room.players) == 6)

    room.remove_player(host)
    check("host passes to a human, never a bot", room.host_id == guest)
    room.remove_player(guest)
    check("last human leaving clears the bots", len(room.players) == 0)

    r2 = Room("ALIVE")
    h2, _, _ = r2.add_player("Solo", FakeWS())
    r2.add_bot("easy")
    r2.disconnect_player(h2)
    check("bots don't count toward keeping a room alive", r2.connected_count() == 0)


async def full_game(difficulties, timer=90):
    room = Room("GAME")
    ws = FakeWS()
    host, _, _ = room.add_player("Human", ws)
    for d in difficulties:
        await server.handle_action(room, host, {"type": "add_bot", "difficulty": d})
    out = io.StringIO()
    stop = asyncio.Event()
    with contextlib.redirect_stdout(out):
        await server.handle_start_game(room, host, turn_timer_seconds=timer)
        task = asyncio.create_task(human_loop(room, host, stop))
        for _ in range(200000):
            if room.game.game_phase == "game_over":
                break
            await _real_sleep(0.001)
        stop.set()
        await task
    return room, ws, out.getvalue()


async def game_tests():
    header("Full game: human + easy/medium/hard bots")
    room, ws, logs = await full_game(["easy", "medium", "hard"])
    check("game reaches game_over", room.game.game_phase == "game_over")
    check("no bot move was rejected", "[bot]" not in logs)
    over = ws.last("game_over")
    check("human receives game_over rankings", over is not None and len(over["rankings"]) == 4)
    bot_lines = [line for line in room.game_log if line.startswith("Bot ")]
    check("bots traded (log has bot actions)", any("Bought" in line for line in bot_lines))
    check("bots acked reveals without the 15s timeout",
          not any("auto-completed reveal" in line for line in room.game_log))
    check("no bot ever timed out", not any("Bot" in line and "ran out of time" in line for line in room.game_log))
    state = server.build_client_state(room, room.host_id)
    check("client state flags bots", sum(1 for p in state["players"] if p["bot"]) == 3)

    header("Full game: 5 hard bots + human")
    room, ws, logs = await full_game(["hard"] * 5)
    check("6-player bot game completes", room.game.game_phase == "game_over")
    check("no bot move was rejected", "[bot]" not in logs)

    header("Human leaves mid-game -> game ends")
    room = Room("LEAVE")
    ws = FakeWS()
    host, _, _ = room.add_player("Human", ws)
    await server.handle_action(room, host, {"type": "add_bot", "difficulty": "medium"})
    await server.handle_action(room, host, {"type": "add_bot", "difficulty": "medium"})
    await server.handle_start_game(room, host, turn_timer_seconds=90)
    await server.handle_action(room, host, {"type": "leave_room"})
    check("game over once only bots remain", room.game.game_phase == "game_over")
    await _real_sleep(0.05)


async def main():
    await lobby_tests()
    await game_tests()
    print(f"\n{'═' * 60}\n  RESULTS: {passed} passed, {failed} failed\n{'═' * 60}")
    sys.exit(1 if failed else 0)


asyncio.run(main())
