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
        pid, _, _ = room.add_player(n, ws)
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


# ── B: engine leave_game ─────────────────────────────────────────────────────

def _engine_game(n=3, ids=None):
    import game_engine as ge
    g = ge.GameState(n, player_ids=ids)
    ge.deal_cards(g)
    return g


def _card(company, value, positive=True):
    from engine.models import Card
    return Card(company, value, positive=positive, is_power=False)


def _power(name):
    from engine.models import Card
    return Card(name, 0, is_power=True)


async def test_engine_ids():
    header("B: engine uses real room ids")
    g = _engine_game(3, ids=[2, 5, 7])
    check("Player ids match room ids", [p.id for p in g.players] == [2, 5, 7])
    check("Networth history keyed by real ids", set(g.networth_history[0]) == {2, 5, 7})


async def test_leave_basics():
    header("B: leave_game returns shares, burns cash, skips turns")
    import game_engine as ge
    g = _engine_game(3)
    p2 = g.players[1]
    ge.buy_stock(g, 1, 4, 5)          # P1 buys TCS, now P2's turn
    ge.buy_stock(g, 2, 4, 6)          # P2 buys 6 TCS, now P3's turn
    avail_before = g.available_shares[3]
    r = ge.leave_game(g, 2)
    check("leave succeeded", r["success"])
    check("P2 marked left", p2.left)
    check("Shares back in market", g.available_shares[3] == avail_before + 6 and p2.stocks["TCS"] == 0)
    check("Cash burned", p2.cash == 0)
    check("Hand discarded", p2.hand == [])
    check("Turn unchanged (was P3's turn)", g.players[g.current_turn].id == 3)
    ge.pass_turn(g, 3)
    check("P3 -> P1 (wraps, round 2)", g.players[g.current_turn].id == 1 and g.current_round == 1)
    ge.pass_turn(g, 1)
    check("P1 -> P3, P2 skipped", g.players[g.current_turn].id == 3)
    check("Leaving twice fails", not ge.leave_game(g, 2)["success"])


async def test_leave_on_own_turn():
    header("B: leaving on your own turn advances the turn")
    import game_engine as ge
    g = _engine_game(3)
    ge.leave_game(g, 1)
    check("Turn moved to P2", g.players[g.current_turn].id == 2)


async def test_leave_last_turn_of_day():
    header("B: leaving on the last turn of the day moves to card_reveal")
    import game_engine as ge
    g = _engine_game(2 + 1)
    for _ in range(2):          # rounds 1-2
        for p in list(g.players):
            ge.pass_turn(g, p.id)
    ge.pass_turn(g, 1)
    ge.pass_turn(g, 2)
    ge.leave_game(g, 3)         # P3's final turn
    check("Phase is card_reveal", g.game_phase == "card_reveal")


async def test_leave_last_player_standing():
    header("B: last player standing ends the game")
    import game_engine as ge
    g = _engine_game(3)
    ge.leave_game(g, 2)
    check("Game continues with 2", g.game_phase == "player_turn")
    ge.leave_game(g, 1)
    check("Game over with 1 remaining", g.game_phase == "game_over")


async def test_leave_rights_issue():
    header("B: leaving during a rights issue")
    import game_engine as ge
    g = _engine_game(3)
    for p in g.players:
        p.stocks["TCS"] = 10
    g.available_shares[3] -= 30
    g.players[0].hand.append(_power("RightsIssue"))
    ge.use_rights_issue(g, 1, 4)
    check("Rights issue queue P1,P2,P3", g.rights_issue_queue == [1, 2, 3])
    ge.leave_game(g, 2)
    check("P2 removed from queue", g.rights_issue_queue == [1, 3])
    ge.rights_issue_buy(g, 1, 0)
    ge.leave_game(g, 3)
    check("Queue emptied -> back to player_turn", g.game_phase == "game_over" or g.game_phase == "player_turn")
    check("TCS value restored", g.companies[3].value == 55)


async def test_leave_rights_issue_initiator_last():
    header("B: rights issue ends when last queued player leaves")
    import game_engine as ge
    g = _engine_game(3)
    g.players[1].stocks["TCS"] = 10
    g.players[0].hand.append(_power("RightsIssue"))
    ge.use_rights_issue(g, 1, 4)
    check("Only P2 queued", g.rights_issue_queue == [2])
    ge.leave_game(g, 2)
    check("Back to player_turn", g.game_phase == "player_turn")
    check("Turn advanced past P1 to P3 (P2 left)", g.players[g.current_turn].id == 3)
    check("TCS value restored", g.companies[3].value == 55)


def _to_card_reveal(g):
    import game_engine as ge
    while g.game_phase == "player_turn":
        ge.pass_turn(g, g.players[g.current_turn].id)


async def test_leave_before_reveal_cards_dont_count():
    header("B: leaving before the reveal removes your cards from it")
    import game_engine as ge
    g = _engine_game(2 + 1)
    for p in g.players:
        p.hand = []
    g.players[1].hand = [_card("TCS", 30)]
    g.players[0].hand = [_card("TCS", 5)]
    _to_card_reveal(g)
    ge.leave_game(g, 2)
    ge.begin_card_reveal(g)
    tcs = next(e for e in g.reveal_data if e["company_name"] == "TCS")
    check("Leaver's +30 not in reveal", tcs["delta"] == 5)


async def test_leave_during_reveal_acks():
    header("B: leaving while others wait on reveal acks finalizes")
    import game_engine as ge
    g = _engine_game(3)
    for p in g.players:
        p.hand = []
    g.players[1].hand = [_power("Currency + ")]
    _to_card_reveal(g)
    ge.begin_card_reveal(g)
    ge.complete_card_reveal(g, 1)
    ge.complete_card_reveal(g, 3)
    check("Waiting on P2", g.game_phase == "card_reveal")
    ge.leave_game(g, 2)
    check("Reveal finalized after P2 left", g.game_phase != "card_reveal")
    check("Leaver's Currency+ didn't restore cash", g.players[1].cash == 0)


async def test_leave_during_cd_queue():
    header("B: chairman leaves mid chairman/director queue")
    import game_engine as ge
    from engine.helpers import update_positions
    g = _engine_game(3)
    for p in g.players:
        p.hand = []
    g.players[1].stocks["TCS"] = 100
    g.available_shares[3] -= 100
    update_positions(g, g.players[1], "TCS")
    g.players[1].hand = [_card("TCS", 10)]
    g.players[0].hand = [_card("TCS", 5)]
    _to_card_reveal(g)
    ge.begin_card_reveal(g)
    check("P2 is queued as chairman", g.chairman_director_queue and g.chairman_director_queue[0][0] == 2)
    ge.leave_game(g, 2)
    check("CD queue emptied and reveal finalized", not g.chairman_director_queue and g.game_phase != "card_reveal")
    check("Chairman seat vacated", g.chairman["TCS"] is None)


async def test_leave_during_share_suspend():
    header("B: leaving during share suspend")
    import game_engine as ge
    g = _engine_game(3)
    for p in g.players:
        p.hand = []
    g.players[1].hand = [_power("ShareSuspend")]
    _to_card_reveal(g)
    ge.begin_card_reveal(g)
    for p in g.players:
        ge.complete_card_reveal(g, p.id)
    check("In share_suspend waiting on P2", g.game_phase == "share_suspend" and g.suspend_queue == [2])
    ge.leave_game(g, 2)
    check("Suspend finalized -> day_end", g.game_phase == "day_end")


async def test_left_player_not_dealt():
    header("B: left players get no hand on later days")
    import game_engine as ge
    g = _engine_game(3)
    ge.leave_game(g, 3)
    for p in g.players:
        p.hand = []
    _to_card_reveal(g)
    ge.begin_card_reveal(g)
    for p in g.players:
        ge.complete_card_reveal(g, p.id)
    ge.end_day(g)
    ge.deal_cards(g)
    left = next(p for p in g.players if p.id == 3)
    check("No hand for left player", left.hand == [])
    check("First turn is an active player", not g.players[g.current_turn].left)


# ── B: room / server ─────────────────────────────────────────────────────────

async def test_duplicate_names():
    header("B: duplicate names (lobby only)")
    room, wss = make_room(["Ann", "Bob"])
    pid, rec, err = room.add_player("Ann", FakeWS())
    check("Lobby: connected name refused", pid is None and err == "name_taken")
    room.disconnect_player(wss["Ann"][0])
    pid, rec, err = room.add_player("Ann", FakeWS())
    check("Lobby: disconnected seat reclaimed", pid == wss["Ann"][0] and rec)
    room.ready.add(wss["Bob"][0])
    await server.handle_start_game(room, room.host_id)
    pid, rec, err = room.add_player("Bob", FakeWS())
    check("Mid-game: same name reclaims even if 'connected'", pid == wss["Bob"][0] and rec)
    pid, rec, err = room.add_player("Zed", FakeWS())
    check("Mid-game: new name refused", err == "started")
    server.cancel_turn_timer(room)


async def test_ready_gates_start():
    header("B: start requires everyone ready")
    room, wss = make_room(["Ann", "Bob", "Cat"])
    host = room.host_id
    await server.handle_start_game(room, host)
    check("Not started with nobody ready", not room.started)
    check("Host got an error", wss["Ann"][1].last("error") is not None)
    await server.handle_action(room, wss["Bob"][0], {"type": "set_ready", "ready": True})
    await server.handle_start_game(room, host)
    check("Not started with one of two ready", not room.started)
    await server.handle_action(room, wss["Cat"][0], {"type": "set_ready", "ready": True})
    check("Lobby update shows ready", any(p["ready"] for p in wss["Ann"][1].last("lobby_update")["players"]))
    await server.handle_start_game(room, host)
    check("Started when all non-host ready", room.started)
    server.cancel_turn_timer(room)


async def test_kick_and_leave_lobby():
    header("B: kick + lobby leave + host transfer")
    room, wss = make_room(["Ann", "Bob", "Cat"])
    await server.handle_action(room, wss["Bob"][0], {"type": "kick_player", "player_name": "Cat"})
    check("Non-host can't kick", "Cat" in room.get_player_names())
    await server.handle_action(room, wss["Ann"][0], {"type": "kick_player", "player_name": "Cat"})
    check("Host kicked Cat", "Cat" not in room.get_player_names())
    check("Cat told she was kicked", wss["Cat"][1].last("left_room")["reason"] == "kicked" and wss["Cat"][1].closed)
    pid, _, err = room.add_player("Cat", FakeWS())
    check("Kicked player can rejoin", err is None)
    await server.handle_action(room, wss["Ann"][0], {"type": "leave_room"})
    check("Host left", "Ann" not in room.get_player_names())
    check("Host passed to Bob", room.host_id == wss["Bob"][0])
    check("Bob's lobby view says host", wss["Bob"][1].last("lobby_update")["is_host"])


async def test_public_listing():
    header("B: public room discovery")
    room, wss = make_room(["Ann", "Bob"])
    server.rooms.rooms[room.code] = room
    try:
        check("Private by default", not any(r["code"] == room.code for r in server.rooms.public_lobbies()))
        await server.handle_action(room, wss["Bob"][0], {"type": "set_public", "is_public": True})
        check("Non-host can't make public", not room.is_public)
        await server.handle_action(room, wss["Ann"][0], {"type": "set_public", "is_public": True})
        listed = [r for r in server.rooms.public_lobbies() if r["code"] == room.code]
        check("Listed once public", len(listed) == 1 and listed[0]["players"] == 2)
        room.ready.add(wss["Bob"][0])
        await server.handle_start_game(room, room.host_id)
        check("Hidden once started", not any(r["code"] == room.code for r in server.rooms.public_lobbies()))
        server.cancel_turn_timer(room)
    finally:
        server.rooms.rooms.pop(room.code, None)


async def test_mid_game_leave_server():
    header("B: mid-game leave via server")
    room, wss = make_room(["Ann", "Bob", "Cat"])
    await start_game(room, wss)
    bob = wss["Bob"][0]
    await server.handle_action(room, bob, {"type": "leave_room"})
    check("Bob in left_ids", bob in room.left_ids)
    check("Bob ejected", wss["Bob"][1].last("left_room") is not None and wss["Bob"][1].closed)
    pid, _, err = room.add_player("Bob", FakeWS())
    check("Bob can't reclaim his seat", pid is None and err == "left")
    state = wss["Ann"][1].last("game_state")["state"]
    check("Client state marks Bob left", any(p["name"] == "Bob" and p["left"] for p in state["players"]))
    check("Log mentions leave", any("Bob left the game" in l for l in room.game_log))
    await server.handle_action(room, wss["Cat"][0], {"type": "leave_room"})
    go = wss["Ann"][1].last("game_over")
    check("Game over broadcast with Ann first", go is not None and go["rankings"][0]["name"] == "Ann")
    check("Left players ranked last", [r["left"] for r in go["rankings"]] == [False, True, True])


TESTS = [
    test_day_start_hold,
    test_day_start_disconnected_ignored,
    test_day_start_fallback,
    test_engine_ids,
    test_leave_basics,
    test_leave_on_own_turn,
    test_leave_last_turn_of_day,
    test_leave_last_player_standing,
    test_leave_rights_issue,
    test_leave_rights_issue_initiator_last,
    test_leave_before_reveal_cards_dont_count,
    test_leave_during_reveal_acks,
    test_leave_during_cd_queue,
    test_leave_during_share_suspend,
    test_left_player_not_dealt,
    test_duplicate_names,
    test_ready_gates_start,
    test_kick_and_leave_lobby,
    test_public_listing,
    test_mid_game_leave_server,
]


async def main():
    for t in TESTS:
        await t()
    print(f"\n{'═' * 60}\n  RESULTS: {passed} passed, {failed} failed\n{'═' * 60}")
    return failed


if __name__ == "__main__":
    sys.exit(1 if asyncio.run(main()) else 0)
