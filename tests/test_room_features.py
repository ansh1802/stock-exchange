"""test_room_features.py — Server/room tests for issues #20 and #22.

Drives server.py handlers directly with fake websockets (no network).
Run: backend/venv/bin/python tests/test_room_features.py
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

import server
from room_manager import Room

passed = 0
failed = 0


def check(desc, condition):
    global passed, failed
    tag = "✓" if condition else "✗ FAIL"
    print(f"  [{tag}] {desc}")
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
        self.closed = False

    async def send_json(self, msg):
        self.sent.append(msg)

    async def close(self):
        self.closed = True

    def last(self, msg_type):
        for m in reversed(self.sent):
            if m.get("type") == msg_type:
                return m
        return None


def make_room(names):
    room = Room("TEST")
    wss = {}
    for n in names:
        ws = FakeWS()
        pid, _ = room.add_player(n, ws)
        wss[n] = (pid, ws)
    return room, wss


async def start_game(room, wss, timer=15):
    host = next(pid for pid, _ in wss.values() if pid == room.host_id)
    for pid, _ in wss.values():
        if pid != host and hasattr(room, "ready"):
            room.ready.add(pid)
    await server.handle_start_game(room, host, turn_timer_seconds=timer)


def end_turns_to_day_end(room):
    """Pass every turn until card_reveal, then finalize reveal so dealing happens."""
    import game_engine as ge
    g = room.game
    while g.game_phase == "player_turn":
        pid = g.players[g.current_turn].id
        ge.pass_turn(g, pid)


# ── A1: new-day turn timer hold ──────────────────────────────────────────────

async def test_day_start_hold():
    header("A1: first turn of a new day waits for clients")
    import game_engine as ge
    room, wss = make_room(["Ann", "Bob"])
    await start_game(room, wss)
    check("Day 1 turn timer starts immediately", room.turn_timer_deadline is not None)

    # Force a clean day end: no power cards, no CD queue.
    for p in room.game.players:
        p.hand = []
    end_turns_to_day_end(room)
    ge.begin_card_reveal(room.game)
    for p in room.game.players:
        ge.complete_card_reveal(room.game, p.id)
    await server.auto_advance(room)
    await server.check_and_start_turn_timer(room)
    check("Day 2 is in player_turn", room.game.game_phase == "player_turn" and room.game.current_day == 2)
    check("Turn timer held while clients are on the overlay", room.turn_timer_deadline is None)
    check("Fallback task armed", room.day_start_fallback_task is not None)

    ann, bob = wss["Ann"][0], wss["Bob"][0]
    await server.handle_day_start_ready(room, ann)
    check("Still held after one ack", room.turn_timer_deadline is None)
    await server.handle_day_start_ready(room, bob)
    check("Timer starts once all clients ack", room.turn_timer_deadline is not None)
    check("Fallback cancelled", room.day_start_fallback_task is None)
    server.cancel_turn_timer(room)


async def test_day_start_disconnected_ignored():
    header("A1: disconnected players don't hold the new day")
    import game_engine as ge
    room, wss = make_room(["Ann", "Bob"])
    await start_game(room, wss)
    for p in room.game.players:
        p.hand = []
    end_turns_to_day_end(room)
    ge.begin_card_reveal(room.game)
    for p in room.game.players:
        ge.complete_card_reveal(room.game, p.id)
    await server.auto_advance(room)
    room.disconnect_player(wss["Bob"][0])
    await server.handle_day_start_ready(room, wss["Ann"][0])
    check("Timer starts when only connected players have acked", room.turn_timer_deadline is not None)
    server.cancel_turn_timer(room)


async def test_day_start_fallback():
    header("A1: fallback starts the timer if a client never acks")
    import game_engine as ge
    old = server.DAY_START_FALLBACK_SECS
    server.DAY_START_FALLBACK_SECS = 0.05
    try:
        room, wss = make_room(["Ann", "Bob"])
        await start_game(room, wss)
        for p in room.game.players:
            p.hand = []
        end_turns_to_day_end(room)
        ge.begin_card_reveal(room.game)
        for p in room.game.players:
            ge.complete_card_reveal(room.game, p.id)
        await server.auto_advance(room)
        await server.check_and_start_turn_timer(room)
        check("Held initially", room.turn_timer_deadline is None)
        await asyncio.sleep(0.15)
        check("Fallback started the timer", room.turn_timer_deadline is not None)
        server.cancel_turn_timer(room)
    finally:
        server.DAY_START_FALLBACK_SECS = old


TESTS = [
    test_day_start_hold,
    test_day_start_disconnected_ignored,
    test_day_start_fallback,
]


async def main():
    for t in TESTS:
        await t()
    print(f"\n{'═' * 60}\n  RESULTS: {passed} passed, {failed} failed\n{'═' * 60}")
    return failed


if __name__ == "__main__":
    sys.exit(1 if asyncio.run(main()) else 0)
