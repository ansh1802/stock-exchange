"""Watchdog: a missed bot wake-up in card_reveal must self-heal and be logged.

Run: backend/venv/bin/python tests/test_watchdog.py
"""
import asyncio
import contextlib
import io
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import server  # noqa: E402
from room_manager import Room  # noqa: E402


class WS:
    async def send_json(self, m):
        pass


async def main():
    room = Room("WDOG")
    pid, *_ = room.add_player("Human", WS())
    room.add_bot("easy"); room.add_bot("easy")
    room.started = True
    room.game = g = server.ge.GameState(3, player_ids=list(room.players))
    for p_id, conn in room.players.items():     # what handle_start_game does for bots
        if conn.bot_difficulty:
            conn.bot = server.make_bot(p_id, conn.bot_difficulty, seed=1)
    server.ge.deal_cards(g)
    g.game_phase = "card_reveal"
    server.ge.begin_card_reveal(g)
    g.chairman_director_queue = []           # plain reveal: only acks outstanding
    bots = [p.id for p in g.players if p.id != pid]
    assert g.reveal_data and room.bot_task is None   # nothing woke the bots

    server.REVEAL_STALL_LOG_SECS = 0
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        server._watch_room(room)             # first tick: starts the clock + wakes bots
        server._watch_room(room)             # second tick: logs the stall
        await asyncio.sleep(2.5)             # bots ack (0.5s each)
    acked = all(b in g.reveal_complete_players for b in bots)
    logged = "[watchdog]" in out.getvalue() and "Human" in out.getvalue()
    print(("PASS" if acked else "FAIL"), "bots acked after watchdog wake-up")
    print(("PASS" if logged else "FAIL"), "stall logged with missing human ack")

    # No-op safety: a room outside card_reveal is left alone
    room.game.game_phase = "player_turn"
    server._watch_room(room)
    ok = room.reveal_wait_since is None
    print(("PASS" if ok else "FAIL"), "reset outside card_reveal")
    sys.exit(0 if (acked and logged and ok) else 1)


asyncio.run(main())
