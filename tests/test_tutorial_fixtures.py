"""test_tutorial_fixtures.py — tutorial fixture generator (Scenario + build_fixtures).

Run: backend/venv/bin/python tests/test_tutorial_fixtures.py
"""

import os
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

import server  # noqa: E402
from tutorial import build_fixtures  # noqa: E402
from tutorial.chapters import CHAPTERS  # noqa: E402
from tutorial.scenario import Scenario  # noqa: E402

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


def mk():
    return Scenario("t", ["You", "Ada", "Bo"])


def test_setup_hands():
    header("setup hands")
    s = mk()
    s.setup(hands={1: ["TCS+10", "LoanStock"]})
    s.snap("a")
    hand = s.to_fixture()["snapshots"]["a"]["your_hand"]
    check("hand maps card specs", hand == [
        {"company": "TCS", "value": 10, "positive": True, "is_power": False},
        {"company": "LoanStock", "value": 0, "positive": True, "is_power": True},
    ])
    s2 = mk()
    s2.setup(hands={1: ["YesBank-15", "Currency+", "Currency-"]})
    h = [(c.company_name, c.value, c.positive) for c in s2.room.game.players[0].hand]
    check("negative + currency specs", h == [("YesBank", 15, False), ("Currency + ", 0, True), ("Currency - ", 0, True)])


def test_setup_holdings():
    header("setup holdings")
    s = mk()
    s.setup(stocks={1: {"TCS": 120}, 2: {"TCS": 30}}, prices={"TCS": 60}, cash={1: 100}, closed=["Cred"])
    g = s.room.game
    check("available shares recomputed", g.available_shares[3] == 50)
    check("chairman tracked", g.chairman["TCS"] == 1)
    check("price/cash/closed", g.companies[3].value == 60 and g.players[0].cash == 100 and not g.companies[2].open)


def test_snap_shape():
    header("snap shape")
    s = mk()
    s.snap("a")
    snap = s.to_fixture()["snapshots"]["a"]
    keys = set(server.build_client_state(s.room, 1).keys())
    check("keys match build_client_state", set(snap.keys()) == keys)
    check("you seat", snap["players"][0]["name"] == "You" and snap["players"][0]["is_you"] is True)
    check("timers nulled", snap["turn_timer_deadline"] is None and snap["day_end_countdown_deadline"] is None
          and snap["turn_timer_duration"] == 90)
    check("bots flagged", snap["players"][1]["bot"] == "easy" and snap["players"][0]["bot"] is None)
    try:
        s.snap("a")
        check("duplicate id raises", False)
    except Exception:
        check("duplicate id raises", True)


def test_act_logs_like_server():
    header("act logs")
    s = mk()
    s.act(1, {"type": "buy", "company_num": 4, "quantity": 2})
    s.snap("a")
    log = s.to_fixture()["snapshots"]["a"]["game_log"]
    check("log line", log[-1].startswith("You: Bought 2 of TCS"))
    check("available shares", s.room.game.available_shares[3] == 198)


def test_failed_act_raises():
    header("failed act")
    s = mk()
    try:
        s.act(1, {"type": "buy", "company_num": 4, "quantity": 50})
        check("raises", False)
    except AssertionError as e:
        check("raises with engine message", "afford" in str(e))


def test_bell_and_next_day():
    header("bell and next day")
    s = mk()
    s.setup(hands={1: ["TCS+10"], 2: ["TCS+5"], 3: ["Cred-5"]})
    for _ in range(3):
        for pid in (1, 2, 3):
            s.act(pid, {"type": "pass"})
    g = s.room.game
    check("card_reveal with data", g.game_phase == "card_reveal" and bool(g.reveal_data))
    s.ack_reveal()
    check("dealing after ack", g.game_phase == "dealing")
    s.next_day({1: ["TCS+10"], 2: [], 3: []})
    check("day 2 player_turn", g.current_day == 2 and g.game_phase == "player_turn" and g.current_round == 0)


def test_check_detects_drift():
    header("check detects drift")
    def build():
        s = mk()
        s.snap("a")
        return s
    CHAPTERS["_drift"] = build
    orig = build_fixtures.OUT_DIR
    try:
        with tempfile.TemporaryDirectory() as d:
            build_fixtures.OUT_DIR = d
            check("write returns 0", build_fixtures.main(["_drift"]) == 0)
            check("unmutated check 0", build_fixtures.main(["--check", "_drift"]) == 0)
            p = os.path.join(d, "_drift.json")
            with open(p, "a") as f:
                f.write(" ")
            check("mutated check 1", build_fixtures.main(["--check", "_drift"]) == 1)
            check("check wrote nothing", open(p).read().endswith(" "))
    finally:
        build_fixtures.OUT_DIR = orig
        CHAPTERS.pop("_drift", None)
    check("throwaway unregistered", "_drift" not in CHAPTERS)


for t in (test_setup_hands, test_setup_holdings, test_snap_shape, test_act_logs_like_server,
          test_failed_act_raises, test_bell_and_next_day, test_check_detects_drift):
    t()

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
