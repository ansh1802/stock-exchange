"""Regression: a timer-driven auto_advance must survive timer re-checks.

When a turn timer (or disconnect timer) fires on the day's last turn, the
auto_advance it runs pauses 3s before the card reveal. A concurrent
check_and_start_*_timer (disconnect handler, reconnect) used to cancel the
timer task mid-pause, leaving day_end_countdown_deadline set forever and the
reveal never starting.

Run: backend/venv/bin/python tests/test_timer_cancel.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
import server  # noqa: E402
from room_manager import Room  # noqa: E402


class WS:
    async def send_json(self, m):
        pass


def make_room():
    room = Room("TEST")
    room.add_player("Human", WS())
    room.add_bot("easy")
    room.add_bot("easy")
    room.turn_timer_seconds = 1
    room.started = True
    room.game = server.ge.GameState(3, player_ids=list(room.players))
    server.ge.deal_cards(room.game)
    g = room.game
    g.current_round = 2                      # last round of the day
    g.current_turn = len(g.players) - 1      # last seat -> pass ends the day
    return room


async def run(label, recheck):
    room = make_room()
    g = room.game
    await server.check_and_start_turn_timer(room)
    await asyncio.sleep(1.5)                 # timer fired, inside the 3s pause
    assert room.day_end_countdown_deadline is not None, f"{label}: no pause"
    await recheck(room)
    await asyncio.sleep(4)
    ok = room.day_end_countdown_deadline is None and (g.reveal_data or g.game_phase != "card_reveal")
    print(("PASS" if ok else "FAIL"), label)
    for t in (room.bot_task, room.turn_timer_task, room.disconnect_timer):
        if t:
            t.cancel()
    return ok


async def main():
    async def turn_recheck(room):
        await server.check_and_start_turn_timer(room)

    async def disc_recheck(room):
        server.cancel_disconnect_timer(room)
        await server.check_and_start_disconnect_timer(room)
        await server.check_and_start_turn_timer(room)

    results = [
        await run("turn timer survives check_and_start_turn_timer", turn_recheck),
        await run("turn timer survives disconnect-timer cancel + recheck", disc_recheck),
    ]
    sys.exit(0 if all(results) else 1)


asyncio.run(main())
