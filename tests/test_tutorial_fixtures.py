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


def snaps(chapter_id):
    return CHAPTERS[chapter_id]().to_fixture()["snapshots"]


def you(snap):
    return next(p for p in snap["players"] if p["is_you"])


def test_orientation_lesson():
    header("orientation lesson")
    if not check("orientation registered", "orientation" in CHAPTERS):
        return
    s = snaps("orientation")
    floor = s["floor"]
    names = [p["name"] for p in floor["players"]]
    check("6 seats, fixed cast", names == ["You", "Meera", "Arjun", "Kabir", "Zoya", "Dev"])
    check("You's turn on the floor", floor["phase"] == "player_turn" and floor["current_player_name"] == "You")
    check("day 3, round 2", floor["day"] == 3 and floor["round"] == 1 and floor["current_turn"] == 0)
    check("some company below 200 available", any(a < 200 for a in floor["available_shares"]))
    check("YesBank 150 avail", floor["available_shares"][1] == 150)
    check("log has >= 3 entries", len(floor["game_log"]) >= 3)
    check("log shows Kabir's 50 YesBank for 500",
          any(l.startswith("Kabir: Bought 50 of YesBank for 500") for l in floor["game_log"]))
    check("a director exists (Kabir, YesBank)", floor["directors"]["YesBank"] == [4]
          and any(v for v in floor["directors"].values()))
    prices = {c["name"]: c["value"] for c in floor["companies"]}
    check("ticker prices", prices == {"Vodafone": 25, "YesBank": 10, "Cred": 50, "TCS": 70,
                                      "Reliance": 65, "Infosys": 90})
    check("sparkline: YesBank closes 20 -> 10", [d[1] for d in floor["price_history"]] == [20, 10])
    me = you(floor)
    check("your seat: $165, 5 TCS, 4 Cred",
          me["cash"] == 165 and {k: v for k, v in me["stocks"].items() if v} == {"TCS": 5, "Cred": 4})
    check("10 cards, no power cards", len(floor["your_hand"]) == 10
          and not any(c["is_power"] for c in floor["your_hand"]))
    check("turn timer 90s", floor["turn_timer_duration"] == 90)
    passed_snap = s["passed"]
    check("after pass: Meera's turn", passed_snap["current_player_name"] == "Meera")
    check("pass logged", passed_snap["game_log"][-1] == "You: Turn passed.")


def test_objective_lesson():
    header("objective lesson")
    if not check("objective registered", "objective" in CHAPTERS):
        return
    s = snaps("objective")
    check("single snapshot", list(s) == ["table"])
    t = s["table"]
    check("6 seats", len(t["players"]) == 6)
    me = you(t)
    prices = {c["name"]: c["value"] for c in t["companies"]}
    worth = me["cash"] + sum(q * prices[n] for n, q in me["stocks"].items())
    check("net worth $165 + 5x70 + 4x50 = $715",
          me["cash"] == 165 and me["stocks"]["TCS"] == 5 and prices["TCS"] == 70
          and me["stocks"]["Cred"] == 4 and prices["Cred"] == 50 and worth == 715)
    check("same table as orientation's end", t == snaps("orientation")["passed"])


def test_prices_lesson():
    header("prices lesson")
    if not check("prices registered", "prices" in CHAPTERS):
        return
    from engine.constants import COMPANY_BASE_VALUES, CURRENCY_RATE, STARTING_CASH
    s = snaps("prices")
    check("snapshots table/passed/bell", list(s) == ["table", "passed", "bell"])
    t = s["table"]
    check("3 seats, fixed cast", [p["name"] for p in t["players"]] == ["You", "Meera", "Arjun"])
    check("day 1, round 3, your turn", t["day"] == 1 and t["round"] == 2
          and t["phase"] == "player_turn" and t["current_player_name"] == "You")
    check("your hand: TCS +10, Reliance -15, Currency +", t["your_hand"] == [
        {"company": "TCS", "value": 10, "positive": True, "is_power": False},
        {"company": "Reliance", "value": 15, "positive": False, "is_power": False},
        {"company": "Currency + ", "value": 0, "positive": True, "is_power": True},
    ])
    me = you(t)
    check("you: 4 TCS bought at $55, $380 cash", me["stocks"]["TCS"] == 4 and me["cash"] == 380
          and me["cash"] == STARTING_CASH - 4 * 55)
    check("Meera and Arjun bought Reliance this morning",
          any(l.startswith("Meera: Bought 3 of Reliance") for l in t["game_log"])
          and any(l.startswith("Arjun: Bought 2 of Reliance") for l in t["game_log"]))
    check("passed: Meera's turn", s["passed"]["current_player_name"] == "Meera"
          and s["passed"]["game_log"][-1] == "You: Turn passed.")

    b = s["bell"]
    check("bell: card_reveal on day 1", b["phase"] == "card_reveal" and b["day"] == 1)
    rd = {r["company_name"]: r for r in b["reveal_data"]}
    check("reveal in ticker order", [r["company_name"] for r in b["reveal_data"]]
          == ["Vodafone", "YesBank", "Cred", "TCS", "Reliance", "Infosys"])
    base = dict(zip(["Vodafone", "YesBank", "Cred", "TCS", "Reliance", "Infosys"], COMPANY_BASE_VALUES))
    check("day-1 prices are base values", all(rd[n]["old_value"] == v for n, v in base.items()))

    def cards(name):
        return [(c["player_name"], c["value"] if c["positive"] else -c["value"]) for c in rd[name]["cards"]]

    check("Vodafone, Cred, Infosys: no cards", not cards("Vodafone") and not cards("Cred") and not cards("Infosys"))
    yb = rd["YesBank"]
    check("YesBank: Meera -15, Arjun -10 -> $25 to $0",
          cards("YesBank") == [("Meera", -15), ("Arjun", -10)] and yb["old_value"] == 25 and yb["new_value"] == 0)
    tcs = rd["TCS"]
    check("TCS: You +10, Meera -5 -> +5, $55 to $60",
          cards("TCS") == [("You", 10), ("Meera", -5)] and tcs["delta"] == 5 > 0
          and tcs["old_value"] == 55 and tcs["new_value"] == 60)
    rel = rd["Reliance"]
    # Card order pins the hold stage `revealing_cards:Reliance:2` (Arjun's card, the last).
    check("Reliance: You -15, Meera +15, Arjun +10 -> +10, $75 to $85",
          cards("Reliance") == [("You", -15), ("Meera", 15), ("Arjun", 10)] and rel["delta"] == 10 > 0
          and rel["old_value"] == 75 and rel["new_value"] == 85)
    check("bots' Reliance cards >= +25", 15 + 10 >= 25)
    check("no chairman/director queue", b["chairman_director_queue"] == [])
    fx = b["currency_effects"]
    check("only currency effect is your +", len(fx) == 1 and fx[0]["player_id"] == 1 and fx[0]["type"] == "+")
    check("currency: $380 -> $418 (before * 1.1)", fx[0]["before"] == 380
          and abs(fx[0]["after"] - fx[0]["before"] * (1 + CURRENCY_RATE)) < 1e-9 and fx[0]["after"] == 418)

    sc = CHAPTERS["prices"]()
    sc.ack_reveal()
    g = sc.room.game
    yesbank = g.companies[1]
    check("after the bell YesBank is shut at $0", yesbank.value == 0 and yesbank.open is False)
    check("after the bell TCS $60, Reliance $85", g.companies[3].value == 60 and g.companies[4].value == 85)
    mine = next(p for p in g.players if p.id == 1)  # end_day rotates seats
    check("after the bell your cash $418, 4 TCS worth $240", mine.cash == 418 and mine.stocks["TCS"] * 60 == 240)


for t in (test_setup_hands, test_setup_holdings, test_snap_shape, test_act_logs_like_server,
          test_failed_act_raises, test_bell_and_next_day, test_check_detects_drift,
          test_orientation_lesson, test_objective_lesson, test_prices_lesson):
    t()

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
