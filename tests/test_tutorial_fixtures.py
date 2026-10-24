"""test_tutorial_fixtures.py — tutorial fixture generator (Scenario + build_fixtures).

Run: backend/venv/bin/python tests/test_tutorial_fixtures.py
"""

import os
import re
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
    # Copy names the cards in this order; the hold is `final_value:Reliance` ($75 -> $85 on screen).
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


def test_turns_lesson():
    header("turns lesson")
    if not check("turns registered", "turns" in CHAPTERS):
        return
    from engine.constants import COMPANY_BASE_VALUES, ROUNDS_PER_DAY, STARTING_CASH
    s = snaps("turns")
    order = ["start", "bought", "meera", "arjun", "round2", "passed"]
    check("snapshots in order", list(s) == order)
    st = s["start"]
    check("4 seats, fixed cast", [p["name"] for p in st["players"]] == ["You", "Meera", "Arjun", "Kabir"])
    check("ROUNDS_PER_DAY is 3 (copy: 'round 1 of 3')", ROUNDS_PER_DAY == 3
          and CHAPTERS["turns"]().room.game.rounds_per_day == ROUNDS_PER_DAY)
    check("day 1, round 1, your turn first", st["day"] == 1 and st["round"] == 0 and st["current_turn"] == 0
          and st["phase"] == "player_turn" and st["current_player_name"] == "You")
    check("your hand: TCS +10 first", st["your_hand"][0] == {"company": "TCS", "value": 10, "positive": True,
                                                            "is_power": False})
    check("everyone starts with $600", all(p["cash"] == STARTING_CASH == 600 for p in st["players"]))
    check("TCS at $55 (base)", st["companies"][3]["value"] == COMPANY_BASE_VALUES[3] == 55)
    check("turn timer 90s", st["turn_timer_duration"] == 90)

    # Who is up, and which round, at each snapshot: round ticks only after all 4 seats moved.
    who = [(s[k]["round"], s[k]["current_player_name"]) for k in order]
    check("turn passes You -> Meera -> Arjun -> Kabir, then round 2 You -> Meera", who == [
        (0, "You"), (0, "Meera"), (0, "Arjun"), (0, "Kabir"), (1, "You"), (1, "Meera")])

    b = s["bought"]
    me = you(b)
    check("your move: 4 TCS for $220, $600 -> $380", me["stocks"]["TCS"] == 4 and me["cash"] == 380
          and 4 * 55 == 220 and b["game_log"][-1].startswith("You: Bought 4 of TCS for 220"))
    check("after your buy the turn is Meera's, still round 1", b["current_player_name"] == "Meera"
          and b["round"] == 0)

    # Every move between snapshots is exactly one log line by the seat that was up.
    moves = {}
    for a, nxt in zip(order, order[1:]):
        before, after = s[a]["game_log"], s[nxt]["game_log"]
        added = after[len(before):]
        actor = s[a]["current_player_name"]
        ok = after[:len(before)] == before and len(added) == 1 and added[0].startswith(f"{actor}: ")
        check(f"{a} -> {nxt}: exactly one move by {actor}", ok)
        moves[actor + str(s[a]["round"])] = added[0] if added else ""
    one_kind = ("Bought ", "Sold ", "Turn passed.")
    check("each move is one buy, sell or pass",
          all(any(m.split(": ", 1)[1].startswith(k) for k in one_kind) for m in moves.values()))
    check("round 1: Meera buys Reliance, Arjun passes, Kabir sells Infosys",
          moves["Meera0"].startswith("Meera: Bought 3 of Reliance")
          and moves["Arjun0"] == "Arjun: Turn passed."
          and moves["Kabir0"].startswith("Kabir: Sold 2 of Infosys"))
    check("round 2: you pass", moves["You1"] == "You: Turn passed.")
    k = next(p for p in s["round2"]["players"] if p["name"] == "Kabir")
    check("Kabir's sell: 4 -> 2 Infosys, $600 -> $760", k["stocks"]["Infosys"] == 2 and k["cash"] == 760)
    check("no power card is played in this chapter", not any("Loan Stock" in l or "Debenture" in l or "Rights" in l
                                                            for l in s["passed"]["game_log"]))

    # Seat order rotates at end_day: tomorrow Meera moves first.
    sc = CHAPTERS["turns"]()
    g = sc.room.game
    while g.game_phase == "player_turn":
        sc.act(g.players[g.current_turn].id, {"type": "pass"})
    sc.ack_reveal()
    check("day 2 order starts with Meera", g.current_day == 2 and [p.id for p in g.players] == [2, 3, 4, 1])


def test_trading_lesson():
    header("trading lesson")
    if not check("trading registered", "trading" in CHAPTERS):
        return
    from engine.constants import COMPANY_BASE_VALUES, STARTING_CASH, STARTING_SHARES
    s = snaps("trading")
    order = ["start", "meera", "arjun", "you1", "bought", "you2", "sold", "you3", "bell", "after"]
    check("snapshots in order", list(s) == order)

    def by(snap, name):
        return next(p for p in snap["players"] if p["name"] == name)

    def price(snap, name):
        return next(c["value"] for c in snap["companies"] if c["name"] == name)

    def worth(snap, name):
        p = by(snap, name)
        return p["cash"] + sum(q * price(snap, n) for n, q in p["stocks"].items())

    st = s["start"]
    # Day 1 was played through the engine: its history is real, and end_day rotated the seats.
    check("day 2, round 1, Meera first; seats Meera, Arjun, Kabir, You",
          st["day"] == 2 and st["round"] == 0 and st["phase"] == "player_turn"
          and st["current_player_name"] == "Meera"
          and [p["name"] for p in st["players"]] == ["Meera", "Arjun", "Kabir", "You"])
    check("day 1 log: you bought 10 Vodafone for $200", "You: Bought 10 of Vodafone for 200. Balance: 400."
          in st["game_log"] and STARTING_CASH - 10 * COMPANY_BASE_VALUES[0] == 400)
    check("price_history = day-1 close; Vodafone $20 -> $30, TCS $55, Infosys $80 unchanged",
          st["price_history"] == [[30, 30, 45, 55, 80, 80]]
          and [c["value"] for c in st["companies"]] == st["price_history"][-1]
          and COMPANY_BASE_VALUES[0] == 20 and COMPANY_BASE_VALUES[3] == 55 and COMPANY_BASE_VALUES[5] == 80)
    nh = st["networth_history"]
    check("networth_history consistent with holdings: day 1 You 700, Meera 610, Arjun 625, Kabir 640",
          len(nh) == 2 and nh[1] == {1: 700, 2: 610, 3: 625, 4: 640}
          and all(nh[1][p["id"]] == worth(st, p["name"]) for p in st["players"]))
    me = you(st)
    check("you start day 2 with $400 and 10 Vodafone", me["cash"] == 400 and me["stocks"] == {"Vodafone": 10})
    check("your hand: TCS +10, Infosys +10, Vodafone -5", st["your_hand"] == [
        {"company": "TCS", "value": 10, "positive": True, "is_power": False},
        {"company": "Infosys", "value": 10, "positive": True, "is_power": False},
        {"company": "Vodafone", "value": 5, "positive": False, "is_power": False},
    ])

    # Round 1 (watched): one log line per bot move.
    y1 = s["you1"]
    added = y1["game_log"][len(st["game_log"]):]
    check("round 1: Meera 4 TCS, Arjun 5 TCS, Kabir 4 Cred", [l.split(". Balance")[0] for l in added] == [
        "Meera: Bought 4 of TCS for 220", "Arjun: Bought 5 of TCS for 275", "Kabir: Bought 4 of Cred for 180"])
    check("then it's your turn, still round 1", y1["current_player_name"] == "You" and y1["round"] == 0)

    # Your buy: Max is cash-bound (7), and what's left can't buy a real Infosys stake.
    tcs_p, inf_p = 55, 80
    avail = y1["available_shares"][3]
    check("TCS available 191 = 200 - 9", avail == STARTING_SHARES - 9 == 191)
    check("TCS Max 7 ($400 // $55), cost $385", min(400 // tcs_p, avail) == 7 and 7 * tcs_p == 385)
    left = 400 - 7 * tcs_p
    check("$15 left: under one Infosys share ($80)", left == 15 < inf_p
          and (left // inf_p) * inf_p < (7 * tcs_p) / 2)
    b = s["bought"]
    check("bought: 7 TCS, cash $15", you(b)["stocks"] == {"Vodafone": 10, "TCS": 7} and you(b)["cash"] == 15
          and b["game_log"][-1].startswith("You: Bought 7 of TCS for 385"))

    y2 = s["you2"]
    added = y2["game_log"][len(b["game_log"]):]
    check("round 2: Meera +2 TCS, Arjun passes, Kabir 3 YesBank", [l.split(". Balance")[0] for l in added] == [
        "Meera: Bought 2 of TCS for 110", "Arjun: Turn passed.", "Kabir: Bought 3 of YesBank for 90"])
    check("sell max = Vodafone holdings = 10; nobody else holds Vodafone",
          you(y2)["stocks"]["Vodafone"] == 10 and y2["available_shares"][0] == STARTING_SHARES - 10)
    so = s["sold"]
    check("sold 5 Vodafone at $30: $150 back, cash $15 -> $165", you(so)["stocks"] == {"Vodafone": 5, "TCS": 7}
          and you(so)["cash"] == 165 and so["game_log"][-1].startswith("You: Sold 5 of Vodafone for 150"))

    y3 = s["you3"]
    added = y3["game_log"][len(so["game_log"]):]
    check("round 3: the bots pass", added == ["Meera: Turn passed.", "Arjun: Turn passed.", "Kabir: Turn passed."])
    check("net worth before the bell $700", y3["round"] == 2 and worth(y3, "You") == 700)

    bl = s["bell"]
    check("bell: card_reveal on day 2", bl["phase"] == "card_reveal" and bl["day"] == 2)
    rd = {r["company_name"]: r for r in bl["reveal_data"]}

    def cards(name):
        return [(c["player_name"], c["value"] if c["positive"] else -c["value"]) for c in rd[name]["cards"]]

    v, t, i = rd["Vodafone"], rd["TCS"], rd["Infosys"]
    check("Vodafone: You -5 only, $30 to $25; the 5 sold dodged $25",
          cards("Vodafone") == [("You", -5)] and v["old_value"] == 30 and v["new_value"] == 25
          and 5 * (v["old_value"] - v["new_value"]) == 25)
    # Cards land in seat order; the copy names them in this order.
    check("TCS: Meera +10, Arjun +5, You +10 -> +25, $55 to $80",
          cards("TCS") == [("Meera", 10), ("Arjun", 5), ("You", 10)] and t["delta"] == 25
          and t["old_value"] == 55 and t["new_value"] == 80)
    check("TCS delta >= your +10 + bots' TCS cards", t["delta"] >= 10 + 10 + 5)
    check("Infosys: Kabir -5, You +10 -> +5, $80 to $85",
          cards("Infosys") == [("Kabir", -5), ("You", 10)] and i["delta"] == 5
          and i["old_value"] == 80 and i["new_value"] == 85)
    check("TCS rises more than Infosys", t["delta"] > i["delta"])
    check("Kabir held Infosys -, no TCS card", not any(n == "Kabir" for n, _ in cards("TCS")))
    check("no chairman/director queue, no currency", bl["chairman_director_queue"] == []
          and not bl["currency_effects"])

    af = s["after"]
    check("after: day 3 dealt, no reveal data (no re-animation)", af["phase"] == "player_turn"
          and not af["reveal_data"] and af["day"] == 3)
    check("after: You $700 -> $850 = $165 + 7 x $80 + 5 x $25 (+$175 TCS, -$25 Vodafone)",
          worth(af, "You") == 850 == 165 + 7 * 80 + 5 * 25 and 7 * 25 == 175)
    check("selling 5 Vodafone helped: keeping 10 would end at $825", 15 + 7 * 80 + 10 * 25 == 825 < 850)
    hist = af["networth_history"]
    check("standings: You $850 ahead of Meera $770, Arjun $775 (and Kabir $660)",
          hist[2] == {1: 850, 2: 770, 3: 775, 4: 660}
          and all(hist[2][p["id"]] == worth(af, p["name"]) for p in af["players"])
          and hist[2][1] > max(hist[2][2], hist[2][3], hist[2][4]))
    check("no power card is played", not any("Loan Stock" in l or "Debenture" in l or "Rights" in l
                                             for l in af["game_log"]))


def _price(snap, name):
    return next(c["value"] for c in snap["companies"] if c["name"] == name)


def _open(snap, name):
    return next(c["is_open"] for c in snap["companies"] if c["name"] == name)


def _board_worth(snap, name):
    """Net worth as the board shows it (and the engine counts it): shut companies count $0."""
    p = next(pl for pl in snap["players"] if pl["name"] == name)
    return p["cash"] + sum(q * _price(snap, n) for n, q in p["stocks"].items() if _open(snap, n))


def _added(prev, cur):
    return cur["game_log"][len(prev["game_log"]):]


def _no_bot_power_cards(snap):
    return not any(l.split(":")[0] in ("Meera", "Arjun", "Kabir")
                   and any(w in l for w in ("Loan Stock", "reopened", "Rights", "suspend"))
                   for l in snap["game_log"])


def test_loan_stock_lesson():
    header("loan-stock lesson")
    if not check("loan-stock registered", "loan-stock" in CHAPTERS):
        return
    from engine.constants import COMPANY_BASE_VALUES, LOAN_STOCK_AMOUNT, STARTING_CASH, STARTING_SHARES
    s = snaps("loan-stock")
    check("snapshots in order", list(s) == ["start", "meera", "you1", "loaned", "you2", "bought"])

    st = s["start"]
    check("day 2, round 1, seats Meera, Arjun, You (end_day rotated them)",
          st["day"] == 2 and st["round"] == 0 and st["current_player_name"] == "Meera"
          and [p["name"] for p in st["players"]] == ["Meera", "Arjun", "You"])
    check("day 1 log: you bought 14 Cred for $560, $40 left",
          "You: Bought 14 of Cred for 560. Balance: 40." in st["game_log"]
          and STARTING_CASH - 14 * COMPANY_BASE_VALUES[2] == 40)
    check("day-1 close: Cred $40 -> $60, Reliance $75 -> $35",
          st["price_history"][-1][2] == 60 and st["price_history"][-1][4] == 35
          and COMPANY_BASE_VALUES[4] == 75 and _price(st, "Reliance") == 35)
    nh = st["networth_history"]
    check("networth_history[1] matches the board for every seat",
          all(nh[1][p["id"]] == _board_worth(st, p["name"]) for p in st["players"]))
    me = you(st)
    check("you: $40 cash, 14 Cred", me["cash"] == 40 and me["stocks"] == {"Cred": 14})
    check("your hand: Reliance +20, Loan Stock", st["your_hand"] == [
        {"company": "Reliance", "value": 20, "positive": True, "is_power": False},
        {"company": "LoanStock", "value": 0, "positive": True, "is_power": True},
    ])

    y1 = s["you1"]
    check("round 1: Meera 2 Infosys, Arjun 5 Vodafone, then you",
          [l.split(". Balance")[0] for l in _added(st, y1)] == [
              "Meera: Bought 2 of Infosys for 160", "Arjun: Bought 5 of Vodafone for 100"]
          and y1["current_player_name"] == "You" and y1["round"] == 0)
    rel_avail = y1["available_shares"][4]
    max_before = min(you(y1)["cash"] // _price(y1, "Reliance"), rel_avail)
    check("Reliance Max before the loan = 1 ($40 // $35)", rel_avail == STARTING_SHARES and max_before == 1)

    nw = _board_worth(y1, "You")
    loan = max(5, int(nw * 0.1) // 5 * 5)
    check("net worth $880 = $40 + 14 x $60", nw == 880 == 40 + 14 * 60)
    check("loan = max(5, int(nw*0.1)//5*5) = $85 (the predict's right answer)", loan == 85)
    check("predict distractors: $4 = 10% of cash, $100 = rulebook's flat amount",
          int(you(y1)["cash"] * 0.1) == 4 and LOAN_STOCK_AMOUNT == 100 and loan not in (4, 100))

    lo = s["loaned"]
    check("loaned: engine paid $85, cash $40 -> $125, card consumed",
          lo["game_log"][-1] == "You: Loan Stock used. Received $85 (10% of net worth)."
          and you(lo)["cash"] == 40 + loan == 125
          and not any(c["company"] == "LoanStock" for c in lo["your_hand"]))
    check("playing the card was the move: Meera's turn, round 2",
          lo["current_player_name"] == "Meera" and lo["round"] == 1)

    y2 = s["you2"]
    check("round 2: Meera and Arjun pass", _added(lo, y2) == ["Meera: Turn passed.", "Arjun: Turn passed."]
          and y2["current_player_name"] == "You" and y2["round"] == 1)
    max_after = min(you(y2)["cash"] // _price(y2, "Reliance"), y2["available_shares"][4])
    check("Reliance Max after the loan = 3 ($125 // $35) > 1", max_after == 3 > max_before)

    b = s["bought"]
    check("bought 3 Reliance for $105, cash $20",
          b["game_log"][-1] == "You: Bought 3 of Reliance for 105. Balance: 20."
          and you(b)["stocks"] == {"Cred": 14, "Reliance": 3} and you(b)["cash"] == 20)
    check("no bot plays a power card", _no_bot_power_cards(b))


def test_debenture_lesson():
    header("debenture lesson")
    if not check("debenture registered", "debenture" in CHAPTERS):
        return
    import re
    import game_engine as ge
    from engine.constants import COMPANY_BASE_VALUES, STARTING_SHARES
    s = snaps("debenture")
    check("snapshots in order", list(s) == ["start", "bell", "after", "you3", "reopened", "you4", "bought"])

    st = s["start"]
    check("day 2, round 3, your turn; seats Meera, Arjun, You",
          st["day"] == 2 and st["round"] == 2 and st["current_player_name"] == "You"
          and [p["name"] for p in st["players"]] == ["Meera", "Arjun", "You"])
    check("day-1 bell took YesBank $25 -> $0: shut",
          COMPANY_BASE_VALUES[1] == 25 and st["price_history"][-1][1] == 0
          and _price(st, "YesBank") == 0 and _open(st, "YesBank") is False)
    check("only YesBank is shut", [c["name"] for c in st["companies"] if not c["is_open"]] == ["YesBank"])
    me = you(st)
    check("you hold 10 YesBank (bought day 1 for $250) and $400 cash",
          "You: Bought 10 of YesBank for 250. Balance: 350." in st["game_log"]
          and me["stocks"] == {"YesBank": 10} and me["cash"] == 400)
    check("board net worth $400: the 10 YesBank count $0", _board_worth(st, "You") == 400)
    check("networth_history matches the board (shut = $0)",
          all(st["networth_history"][1][p["id"]] == _board_worth(st, p["name"]) for p in st["players"]))
    check("your hand: YesBank +10, Vodafone -5 (why you sold 10 Vodafone this morning)", st["your_hand"] == [
        {"company": "YesBank", "value": 10, "positive": True, "is_power": False},
        {"company": "Vodafone", "value": 5, "positive": False, "is_power": False},
    ] and "You: Sold 10 of Vodafone for 250. Balance: 400." in st["game_log"])

    # Engine truth behind the copy: a shut company can't be bought; selling pays $0.
    g = ge.GameState(2, player_ids=[1, 2])
    g.game_phase = "player_turn"
    g.companies[1].value, g.companies[1].open = 0, False
    g.players[0].stocks["YesBank"] = 10
    r = ge.buy_stock(g, 1, 2, 1)
    check("engine: buying a shut company fails", not r["success"] and "closed" in r["message"])
    cash0 = g.players[0].cash
    r = ge.sell_stock(g, 1, 2, 10)
    check("engine: selling a shut company pays $0", r["success"] and g.players[0].cash == cash0)

    bl = s["bell"]
    check("bell: card_reveal day 2", bl["phase"] == "card_reveal" and bl["day"] == 2
          and bl["game_log"][len(st["game_log"])] == "You: Turn passed.")
    rd = {r["company_name"]: r for r in bl["reveal_data"]}
    yb = rd["YesBank"]
    cards = [(c["player_name"], c["value"] if c["positive"] else -c["value"]) for c in yb["cards"]]
    check("YesBank cards land: Arjun +5, You +10 -> delta +15", cards == [("Arjun", 5), ("You", 10)]
          and yb["delta"] == 15)
    check("...but its price stays $0 -> $0", yb["old_value"] == 0 and yb["new_value"] == 0)
    check("no chairman/director queue, no currency", bl["chairman_director_queue"] == []
          and not bl["currency_effects"])

    af = s["after"]
    check("after: day 3 dealt, YesBank still shut at $0", af["day"] == 3 and af["phase"] == "player_turn"
          and not af["reveal_data"] and _price(af, "YesBank") == 0 and _open(af, "YesBank") is False)
    check("after: seats Arjun, You, Meera; Arjun first",
          [p["name"] for p in af["players"]] == ["Arjun", "You", "Meera"] and af["current_player_name"] == "Arjun")
    check("networth_history[2]: You $400", af["networth_history"][2][1] == 400 == _board_worth(af, "You"))

    y3 = s["you3"]
    check("Arjun moved, then your turn round 1", len(_added(af, y3)) == 1 and _added(af, y3)[0].startswith("Arjun: ")
          and y3["current_player_name"] == "You" and y3["round"] == 0)
    check("your hand: Debenture, YesBank +5", y3["your_hand"] == [
        {"company": "Debenture", "value": 0, "positive": True, "is_power": True},
        {"company": "YesBank", "value": 5, "positive": True, "is_power": False},
    ])

    ro = s["reopened"]
    last = ro["game_log"][-1]
    check("debenture: 'You: YesBank reopened at 25.'", last == "You: YesBank reopened at 25.")
    m = re.search(r"(\w+) reopened", last)
    check("DebentureOverlay's log regex fires on the latest line", "reopened at" in last
          and m is not None and m.group(1) == "YesBank")
    check("YesBank reopens at its base value $25 (the predict's right answer)",
          _price(ro, "YesBank") == COMPANY_BASE_VALUES[1] == 25 and _open(ro, "YesBank") is True)
    check("card consumed; playing it was the move (Meera's turn)",
          not any(c["company"] == "Debenture" for c in ro["your_hand"]) and ro["current_player_name"] == "Meera")
    nw_before, nw_after = _board_worth(y3, "You"), _board_worth(ro, "You")
    check("net worth $400 -> $650 (10 YesBank $0 -> $250)", nw_before == 400 and nw_after == 650
          and 10 * 25 == nw_after - nw_before)
    check("you're top of the table after reopening",
          all(nw_after > _board_worth(ro, p["name"]) for p in ro["players"] if not p["is_you"]))

    y4 = s["you4"]
    check("Meera and Arjun moved, your turn round 2", len(_added(ro, y4)) == 2 and y4["current_player_name"] == "You"
          and y4["round"] == 1)
    avail = y4["available_shares"][1]
    check("YesBank tradeable: Max 16 ($400 // $25), 190 available", avail == STARTING_SHARES - 10 == 190
          and min(you(y4)["cash"] // 25, avail) == 16)
    bo = s["bought"]
    check("bought 16 YesBank for $400", bo["game_log"][-1] == "You: Bought 16 of YesBank for 400. Balance: 0."
          and you(bo)["stocks"] == {"YesBank": 26})
    check("no bot plays a power card", _no_bot_power_cards(bo))


def _ri_price(value):
    """The engine's rights-issue price: half, rounded down to a multiple of $5, never below $5."""
    return max(5, (value // 10) * 5)


def _ri_button_buy(cash, holding, price, avail):
    """TradeModal's RI smart-fill (buy): largest q that still leaves cash for the full issue after."""
    r = _ri_price(price)
    for q in range(min(cash // price, avail), 0, -1):
        if cash - q * price >= ((holding + q) // 2) * r:
            return q
    return None


def test_rights_issue_lesson():
    header("rights-issue lesson")
    if not check("rights-issue registered", "rights-issue" in CHAPTERS):
        return
    import game_engine as ge
    s = snaps("rights-issue")
    check("snapshots in order", list(s) == ["you1", "bought", "you2", "ri", "ri-done",
                                            "arjun-ri", "your-issue", "issue-done", "you3", "passed"])
    TCS_I, YB_I = 3, 1

    # ── 8a: buy with the RI button, then play the Rights Issue ──
    y1 = s["you1"]
    check("day 3, round 1, your turn; seats Arjun, Kabir, You, Meera",
          y1["day"] == 3 and y1["round"] == 0 and y1["current_player_name"] == "You"
          and [p["name"] for p in y1["players"]] == ["Arjun", "Kabir", "You", "Meera"])
    me = you(y1)
    check("you: $450 cash, 6 YesBank (bought day 1), no TCS",
          me["cash"] == 450 and me["stocks"] == {"YesBank": 6}
          and "You: Bought 6 of YesBank for 150. Balance: 450." in y1["game_log"])
    check("your hand: Rights Issue, TCS +10", y1["your_hand"] == [
        {"company": "RightsIssue", "value": 0, "positive": True, "is_power": True},
        {"company": "TCS", "value": 10, "positive": True, "is_power": False},
    ])
    check("TCS $55 (base, never moved), 200 available, nobody holds it",
          _price(y1, "TCS") == 55 and y1["available_shares"][TCS_I] == 200
          and not any("TCS" in p["stocks"] for p in y1["players"]))
    check("YesBank $35 after the day-1 bell (+10), prev_value $35", _price(y1, "YesBank") == 35
          and y1["companies"][YB_I]["prev_value"] == 35)
    tcs, cash, avail = _price(y1, "TCS"), me["cash"], y1["available_shares"][TCS_I]
    mx = min(cash // tcs, avail)
    check("Max 8 TCS; Max would leave $10", mx == 8 and cash - mx * tcs == 10)
    rip = _ri_price(tcs)
    check("RI price for TCS $55 is $25 (rounded down, not $27.50)", rip == 25 and tcs / 2 == 27.5)
    q = _ri_button_buy(cash, 0, tcs, avail)
    check("RI button: buy 6 — leaves $120 for the full issue (3 x $25 = $75)",
          q == 6 and cash - q * tcs == 120 and (q // 2) * rip == 75)
    check("Max 8 leaves too little: Balance after $10, issue 4 x $25 = $100",
          cash - mx * tcs == 10 and (mx // 2) * rip == 100 and cash - mx * tcs < (mx // 2) * rip)
    check("no bot plays a power card before your Rights Issue", _no_bot_power_cards(y1))

    bo = s["bought"]
    check("bought 6 TCS (the RI-button quantity) for $330", bo["game_log"][-1] == "You: Bought 6 of TCS for 330. Balance: 120."
          and you(bo)["stocks"] == {"YesBank": 6, "TCS": q})
    check("RI-button buy leaves cash >= allowance x RI price",
          you(bo)["cash"] >= (you(bo)["stocks"]["TCS"] // 2) * rip)

    y2 = s["you2"]
    check("Meera, Arjun, Kabir moved; your turn round 2", y2["round"] == 1 and y2["current_player_name"] == "You"
          and [l.split(":")[0] for l in _added(bo, y2)] == ["Meera", "Arjun", "Kabir"])
    check("still only you hold TCS", [p["name"] for p in y2["players"] if "TCS" in p["stocks"]] == ["You"])
    check("net worth $660 before the issue ($120 + 6x$55 + 6x$35)", _board_worth(y2, "You") == 660)
    allowance = you(y2)["stocks"]["TCS"] // 2
    check("allowance = half your holdings = 3 (not the 4 your $120 covers)",
          allowance == 3 and you(y2)["cash"] // rip == 4)

    ri = s["ri"]
    check("rights_issue phase on TCS (company 4), queue = [You]",
          ri["phase"] == "rights_issue" and ri["rights_issue_company"] == 4 and ri["rights_issue_queue"] == [1]
          and ri["current_player_name"] == "You")
    check("TCS $55 -> $25 during the issue; ticker prev $55",
          _price(ri, "TCS") == rip and ri["companies"][TCS_I]["prev_value"] == tcs)
    check("log: 'You: Rights issue on TCS at 25 (50% of market price).'",
          ri["game_log"][-1] == "You: Rights issue on TCS at 25 (50% of market price).")
    check("card consumed", not any(c["company"] == "RightsIssue" for c in ri["your_hand"]))

    rd = s["ri-done"]
    check("bought the full allowance 3 at $25 = $75; cash $45; 9 TCS",
          rd["game_log"][-1] == f"You: Bought {allowance} shares in rights issue."
          and you(rd)["cash"] == you(y2)["cash"] - allowance * rip == 45 and you(rd)["stocks"]["TCS"] == 9)
    check("price restored to $55, back to player_turn, Meera's move (after you)",
          _price(rd, "TCS") == tcs and rd["phase"] == "player_turn" and rd["rights_issue_company"] is None
          and rd["current_player_name"] == "Meera" and rd["round"] == 1)
    check("net worth $660 -> $750 (+$90 = 3 x ($55 - $25))",
          _board_worth(rd, "You") == 750
          and _board_worth(rd, "You") - _board_worth(y2, "You") == allowance * (_price(rd, "TCS") - _price(ri, "TCS")))

    # ── 8b: Arjun plays a Rights Issue on YesBank — your free move ──
    ar = s["arjun-ri"]
    check("round 3: Arjun plays Rights Issue on YesBank (company 2)",
          ar["round"] == 2 and ar["phase"] == "rights_issue" and ar["rights_issue_company"] == 2
          and ar["game_log"][-1] == "Arjun: Rights issue on YesBank at 15 (50% of market price).")
    check("YesBank $35 -> $15 (half of 35 rounded down to a multiple of 5)",
          _price(ar, "YesBank") == _ri_price(_price(rd, "YesBank")) == 15 and _price(rd, "YesBank") == 35
          and ar["companies"][YB_I]["prev_value"] == 35)
    check("queue: Arjun (holds YesBank) then You; Kabir and Meera hold none -> skipped",
          ar["rights_issue_queue"] == [3, 1] and ar["current_player_name"] == "Arjun"
          and all("YesBank" not in p["stocks"] for p in ar["players"] if p["name"] in ("Kabir", "Meera")))
    yi = s["your-issue"]
    arjun_yb = next(p for p in ar["players"] if p["name"] == "Arjun")["stocks"]["YesBank"]
    check("Arjun buys their half (4 -> 2 more); now your turn in the issue",
          arjun_yb == 4 and yi["game_log"][-1] == "Arjun: Bought 2 shares in rights issue."
          and yi["rights_issue_queue"] == [1] and yi["current_player_name"] == "You")
    my = you(yi)
    check("you: 6 YesBank -> allowance 3; $45 covers 3 x $15", my["stocks"]["YesBank"] == 6
          and my["cash"] == 45 and min(6 // 2, my["cash"] // _price(yi, "YesBank"), yi["available_shares"][YB_I]) == 3)

    idn = s["issue-done"]
    check("you bought 3 YesBank for $45; cash $0", idn["game_log"][-1] == "You: Bought 3 shares in rights issue."
          and you(idn)["cash"] == 0 and you(idn)["stocks"]["YesBank"] == 9)
    check("YesBank restored to $35; normal order resumes after Arjun: Kabir's move",
          _price(idn, "YesBank") == 35 and idn["phase"] == "player_turn" and idn["round"] == 2
          and idn["current_player_name"] == "Kabir")
    check("net worth $750 -> $810 (+$60 = 3 x ($35 - $15))",
          _board_worth(idn, "You") == 810
          and _board_worth(idn, "You") - _board_worth(rd, "You") == 3 * (_price(idn, "YesBank") - _price(yi, "YesBank")))

    y3 = s["you3"]
    check("Kabir moved; your normal round-3 move is still yours",
          y3["round"] == 2 and y3["current_player_name"] == "You" and y3["phase"] == "player_turn"
          and [l.split(":")[0] for l in _added(idn, y3)] == ["Kabir"])
    pa = s["passed"]
    check("you pass; Meera to move (no bell yet)", pa["game_log"][-1] == "You: Turn passed."
          and pa["current_player_name"] == "Meera" and pa["phase"] == "player_turn")

    # Engine truth: no holders -> card consumed, turn ends, price untouched.
    g = ge.GameState(2, player_ids=[1, 2])
    g.game_phase = "player_turn"
    from engine.models import Card
    g.players[0].hand = [Card("RightsIssue", 0, True, True)]
    r = ge.use_rights_issue(g, 1, 4)
    check("engine: Rights Issue with no holders ends the turn, price unchanged",
          r["success"] and g.game_phase == "player_turn" and g.companies[3].value == 55
          and g.current_turn == 1 and not g.players[0].hand)


def _co(snap, name):
    return next(c for c in snap["companies"] if c["name"] == name)


def _signed(reveal, name):
    rd = next(r for r in reveal["reveal_data"] if r["company_name"] == name)
    return rd, [(c["player_name"], c["value"] if c["positive"] else -c["value"]) for c in rd["cards"]]


def test_share_suspend_lesson():
    header("share-suspend lesson")
    if not check("share-suspend registered", "share-suspend" in CHAPTERS):
        return
    import game_engine as ge
    from engine.constants import COMPANY_BASE_VALUES
    s = snaps("share-suspend")
    check("snapshots in order", list(s) == [
        "start", "bell1", "suspend1", "halted1", "start2", "meera3", "bell2", "suspend2", "your-halt2", "meera-halt"])

    # ── Bell 1: the shield ──
    st = s["start"]
    check("day 2, round 3, your turn; seats Meera, Arjun, You",
          st["day"] == 2 and st["round"] == 2 and st["current_player_name"] == "You"
          and [p["name"] for p in st["players"]] == ["Meera", "Arjun", "You"])
    me = you(st)
    check("you: $0 cash, 7 Cred, 4 TCS, 4 YesBank",
          me["cash"] == 0 and me["stocks"] == {"Cred": 7, "TCS": 4, "YesBank": 4})
    check("your hand: Share Suspend, Cred +5", st["your_hand"] == [
        {"company": "ShareSuspend", "value": 0, "positive": True, "is_power": True},
        {"company": "Cred", "value": 5, "positive": True, "is_power": False},
    ])
    check("prices: Cred $60, TCS $55, YesBank $15",
          _price(st, "Cred") == 60 and _price(st, "TCS") == 55 and _price(st, "YesBank") == 15)
    check("predict distractor: Cred's starting price is $40, not its pre-bell $60",
          COMPANY_BASE_VALUES[2] == 40 != _price(st, "Cred"))
    day2 = st["game_log"][st["game_log"].index("Day 2: cards dealt."):]
    check("this morning Meera and Arjun sold all their Cred (4 each)",
          "Meera: Sold 4 of Cred for 240. Balance: 680." in day2
          and "Arjun: Sold 4 of Cred for 240. Balance: 680." in day2
          and all("Cred" not in p["stocks"] for p in st["players"] if not p["is_you"]))
    check("networth_history[1]: You $700 (= board before the bell)",
          st["networth_history"][1][1] == 700 == _board_worth(st, "You"))
    b1 = s["bell1"]
    check("only you hold a Share Suspend on day 2",
          [pid for pid, h in b1["all_hands"].items() if any(c["company"] == "ShareSuspend" for c in h)] == [1])
    check("bell 1: card_reveal day 2, after your pass", b1["phase"] == "card_reveal" and b1["day"] == 2
          and b1["game_log"][len(st["game_log"])] == "You: Turn passed.")
    rd, cards = _signed(b1, "Cred")
    check("Cred: Meera -15 -10, Arjun -15 -5, your +5 -> delta -40",
          sorted(cards) == sorted([("Meera", -15), ("Meera", -10), ("Arjun", -15), ("Arjun", -5), ("You", 5)])
          and rd["delta"] == -40)
    check("Cred $60 -> $20: your 7 shares lose $280", rd["old_value"] == 60 and rd["new_value"] == 20
          and you(b1)["stocks"]["Cred"] * (rd["old_value"] - rd["new_value"]) == 280)
    check("bell 1: no chairman/director, no currency", b1["chairman_director_queue"] == [] and not b1["currency_effects"])

    s1 = s["suspend1"]
    cred = _co(s1, "Cred")
    check("share_suspend: queue [You], your decision", s1["phase"] == "share_suspend"
          and s1["suspend_queue"] == [1] and s1["current_player_name"] == "You")
    check("overlay row: Cred $60 (before the bell) -> $20", cred["pre_fluct_value"] == 60 and cred["value"] == 20)
    check("standings after the bell: You $420, last",
          s1["networth_history"][2][1] == 420 == _board_worth(s1, "You")
          and all(s1["networth_history"][2][p["id"]] > 420 for p in s1["players"] if not p["is_you"]))

    h1 = s["halted1"]
    check("halt: 'You: Share suspend on Cred: value -> 60.'",
          "You: Share suspend on Cred: value -> 60." in h1["game_log"])
    check("after your halt Cred == its pre-bell value ($60)", _price(h1, "Cred") == cred["pre_fluct_value"] == 60)
    check("Trigger B: your networth_history row rises $420 -> $700, top of the table",
          h1["networth_history"][2][1] == 700 > s1["networth_history"][2][1]
          and all(h1["networth_history"][2][1] > h1["networth_history"][2][p["id"]]
                  for p in h1["players"] if not p["is_you"]))
    check("halted1: day 3 dealt, seats Arjun, You, Meera", h1["day"] == 3 and h1["phase"] == "player_turn"
          and not h1["reveal_data"] and [p["name"] for p in h1["players"]] == ["Arjun", "You", "Meera"])

    # ── Bell 2: the weapon, and a company the bell just CLOSED ──
    s2 = s["start2"]
    check("start2: day 3, round 3, your turn", s2["day"] == 3 and s2["round"] == 2
          and s2["current_player_name"] == "You")
    check("your day-3 hand: Share Suspend, TCS +15, YesBank +5", s2["your_hand"] == [
        {"company": "ShareSuspend", "value": 0, "positive": True, "is_power": True},
        {"company": "TCS", "value": 15, "positive": True, "is_power": False},
        {"company": "YesBank", "value": 5, "positive": True, "is_power": False},
    ])
    check("Cred opens day 3 at $60", _price(s2, "Cred") == 60)
    m3 = s["meera3"]
    check("you passed; Meera moves last", m3["game_log"][-1] == "You: Turn passed."
          and m3["current_player_name"] == "Meera" and m3["phase"] == "player_turn")

    b2 = s["bell2"]
    check("day numbers strictly increase across bells", b1["day"] < b2["day"] == 3)
    rd, cards = _signed(b2, "TCS")
    check("TCS: your +15, Arjun +10 -> $55 -> $80 (+$100 on your 4)",
          sorted(cards) == sorted([("You", 15), ("Arjun", 10)]) and rd["old_value"] == 55
          and rd["new_value"] == 80 and you(b2)["stocks"]["TCS"] * (rd["new_value"] - rd["old_value"]) == 100)
    rd, cards = _signed(b2, "YesBank")
    check("YesBank: your +5, Meera -10, Arjun -10 -> $15 -> $0",
          sorted(cards) == sorted([("You", 5), ("Meera", -10), ("Arjun", -10)])
          and rd["old_value"] == 15 and rd["new_value"] == 0)

    q2 = s["suspend2"]
    yb, tcs = _co(q2, "YesBank"), _co(q2, "TCS")
    check("queue [You, Meera] (seat order), you first", q2["suspend_queue"] == [1, 2]
          and q2["current_player_name"] == "You")
    check("YesBank BANKRUPT -> CLOSED at $0; row $15 -> $0",
          yb["value"] == 0 and yb["is_open"] is False and yb["pre_fluct_value"] == 15)
    check("TCS row $55 -> $80", tcs["pre_fluct_value"] == 55 and tcs["value"] == 80)
    check("standings after bell 2: You $740", q2["networth_history"][3][1] == 740 == _board_worth(q2, "You"))

    y2 = s["your-halt2"]
    check("your halt: YesBank back to its pre-bell $15", _price(y2, "YesBank") == 15
          and "You: Share suspend on YesBank: value -> 15." in y2["game_log"])
    check("...still CLOSED until the suspend phase ends", _open(y2, "YesBank") is False)
    check("Meera's decision next", y2["suspend_queue"] == [2] and y2["current_player_name"] == "Meera")
    check("standings still count CLOSED YesBank $0: You stays $740 (engine snapshots before the reopen)",
          y2["networth_history"][3][1] == 740 == _board_worth(y2, "You"))

    mh = s["meera-halt"]
    check("Meera halts TCS: 'Meera: Share suspend on TCS: value -> 55.'",
          "Meera: Share suspend on TCS: value -> 55." in mh["game_log"])
    check("bell 2 TCS reverts to $55", _price(mh, "TCS") == 55 == tcs["pre_fluct_value"])
    check("YesBank reopens at day end: is_open again at $15",
          _open(mh, "YesBank") is True and _price(mh, "YesBank") == 15)
    nh = mh["networth_history"][3]
    check("standings: You $740 -> $640 (your $100 TCS gain undone); Arjun $705 passes you",
          nh[1] == 640 == q2["networth_history"][3][1] - you(mh)["stocks"]["TCS"] * (tcs["value"] - _price(mh, "TCS"))
          and nh[3] == 705 > nh[1])
    check("board after YesBank reopens: You $700 = $640 + 4 x $15, still behind Arjun",
          _board_worth(mh, "You") == 700 == nh[1] + you(mh)["stocks"]["YesBank"] * _price(mh, "YesBank")
          and _board_worth(mh, "Arjun") == 705)
    check("day 4 dealt, seats You, Meera, Arjun", mh["day"] == 4 and mh["phase"] == "player_turn"
          and [p["name"] for p in mh["players"]] == ["You", "Meera", "Arjun"])

    # Engine truth behind the Debenture reconciliation: a company CLOSED on an
    # earlier day has a pre-bell price of $0, so a halt swaps $0 for $0.
    g = ge.GameState(2, player_ids=[1, 2])
    g.companies[1].value, g.companies[1].open = 0, False
    g.game_phase = "card_reveal"
    ge.begin_card_reveal(g)
    g.game_phase = "share_suspend"
    g.suspend_queue = [1]
    r = ge.share_suspend_action(g, 1, 2)
    check("engine: halting a company CLOSED on an earlier day leaves it $0 and CLOSED",
          r["success"] and g.companies[1].value == 0 and g.companies[1].open is False)



def test_act_early_snap():
    header("act(early_snap) mirrors the server's pre-auto_advance chairman/director broadcast")
    s = Scenario("t", ["You", "Ada"])
    s.setup(stocks={1: {"TCS": 50}}, hands={1: ["TCS-10"], 2: ["TCS+5"]}, round=2, current_turn=0)
    s.act(1, {"type": "pass"})
    s.act(2, {"type": "pass"})
    check("bell: You queued as TCS director", s.game.chairman_director_queue == [(1, "TCS", "director")])
    s.act(1, {"type": "chairman_director", "discard_own_idx": 0}, early_snap="cd")
    early = s.to_fixture()["snapshots"]["cd"]
    rd = next(r for r in early["reveal_data"] if r["company_name"] == "TCS")
    check("early snap keeps the day's recomputed reveal (before the day ends)",
          early["day"] == 1 and early["phase"] == "day_end" and rd["new_value"] == 60
          and [c["player_name"] for c in rd["cards"]] == ["Ada"])
    check("...then the scenario advances as usual", s.game.game_phase == "dealing" and s.game.current_day == 2)


def _cd_roles(snap, pid=1):
    return [(c, r) for p, c, r in snap["chairman_director_queue"] if p == pid]


def _reveal(snap, name):
    return next(r for r in snap["reveal_data"] if r["company_name"] == name)


def _queue(snap):
    return [list(e) for e in snap["chairman_director_queue"]]


def _logged(snap, prefix):
    return any(line.startswith(prefix) for line in snap["game_log"])


def _seats(snap):
    return [p["name"] for p in snap["players"]]


def test_chairman_director_lesson():
    header("chairman-director lesson")
    if not check("chairman-director registered", "chairman-director" in CHAPTERS):
        return
    from engine.constants import CHAIRMAN_THRESHOLD, DIRECTOR_THRESHOLD, STARTING_SHARES
    check("quoted constants: director 50, chairman 100, 200 shares a company",
          (DIRECTOR_THRESHOLD, CHAIRMAN_THRESHOLD, STARTING_SHARES) == (50, 100, 200))
    s = snaps("chairman-director")
    check("snapshots in order", list(s) == [
        "d5", "d5-bought", "bell5", "cd5", "d6", "bell6", "cd6", "d7", "d7-bought", "bell7", "cd7-meera", "cd7",
        "d8", "bell8", "cd8-chair", "cd8", "d9", "bell9", "cd9-chair", "cd9", "d10-dawn", "d10-meera", "d10",
        "d10-bought"])
    bells = ["bell5", "bell6", "bell7", "bell8", "bell9"]
    check("one bell per day, days 5..9 strictly increasing", [s[b]["day"] for b in bells] == [5, 6, 7, 8, 9]
          and all(s[b]["phase"] == "card_reveal" for b in bells))
    check("histories match the day (price closes = day - 1, standings through day - 1)",
          all(len(s[b]["price_history"]) == s[b]["day"] - 1 and len(s[b]["networth_history"]) == s[b]["day"]
              for b in bells))
    check("no power cards, no currency effects anywhere",
          all(not any(c["is_power"] for c in snap["your_hand"]) and not snap["currency_effects"] for snap in s.values()))
    check("every bell's queue is chairman/director work only on the taught company",
          {b: sorted({c for _, c, _ in s[b]["chairman_director_queue"]}) for b in bells}
          == {"bell5": ["YesBank"], "bell6": ["YesBank"], "bell7": ["Cred"], "bell8": ["YesBank"], "bell9": ["YesBank"]})

    # ── Day 5: buy 5 to reach director; discard your own -10 ──
    d5 = s["d5"]
    check("day 5, your turn in round 1; seats Arjun, You, Meera",
          d5["day"] == 5 and d5["round"] == 0 and d5["current_player_name"] == "You"
          and _seats(d5) == ["Arjun", "You", "Meera"])
    check("you: 45 YesBank at $5, no positions; hand YesBank -10",
          you(d5)["stocks"] == {"YesBank": 45} and _price(d5, "YesBank") == 5
          and {"company": "YesBank", "value": 10, "positive": False, "is_power": False} in d5["your_hand"]
          and d5["directors"]["YesBank"] == [] and d5["chairman"]["YesBank"] is None)
    check("Meera already Cred's chairman with 100", d5["chairman"]["Cred"] == 2
          and next(p for p in d5["players"] if p["name"] == "Meera")["stocks"]["Cred"] == 100)
    b5 = s["d5-bought"]
    check("buy 5 for $25 -> 50 YesBank: director at once",
          _logged(b5, "You: Bought 5 of YesBank for 25") and you(b5)["stocks"]["YesBank"] == DIRECTOR_THRESHOLD
          and b5["directors"]["YesBank"] == [1])
    bell = s["bell5"]
    rd, cards = _signed(bell, "YesBank")
    check("bell 5: queue = You as YesBank director", _cd_roles(bell) == [("YesBank", "director")]
          and _queue(bell) == [[1, "YesBank", "director"]] and bell["current_player_name"] == "You")
    check("YesBank: your -10, Meera +5 -> $5 -> $0 (BANKRUPT) before the discard",
          cards == [("You", -10), ("Meera", 5)] and rd["old_value"] == 5 and rd["new_value"] == 0)
    cd = s["cd5"]
    rd = _reveal(cd, "YesBank")
    check("discard your -10: $5 -> $10 (up, not $0)", rd["new_value"] == 10 > rd["old_value"]
          and [c["player_name"] for c in rd["cards"]] == ["Meera"] and cd["day"] == 5)
    check("your 50 shares are worth $500", you(cd)["stocks"]["YesBank"] * rd["new_value"] == 500)

    # ── Day 6: 100 -> chairman; discard own -5, remove Arjun's -10 ──
    d6 = s["d6"]
    check("day 6, seats You, Meera, Arjun; Arjun moves last", d6["day"] == 6 and _seats(d6) == ["You", "Meera", "Arjun"]
          and d6["round"] == 2 and d6["current_player_name"] == "Arjun")
    check("you bought 50 more at $10 -> 100: chairman",
          _logged(d6, "You: Bought 50 of YesBank for 500") and you(d6)["stocks"]["YesBank"] == CHAIRMAN_THRESHOLD
          and d6["chairman"]["YesBank"] == 1 and _price(d6, "YesBank") == 10)
    bell = s["bell6"]
    rd, cards = _signed(bell, "YesBank")
    check("bell 6: You are YesBank chairman", _cd_roles(bell) == [("YesBank", "chairman")])
    check("YesBank: your -5, Meera +10, Arjun -10 -> $10 -> $5",
          cards == [("You", -5), ("Meera", 10), ("Arjun", -10)] and rd["old_value"] == 10 and rd["new_value"] == 5)
    check("Arjun's -10 is Arjun's first YesBank card (other:3:0)",
          [c for c in bell["all_hands"][3] if c["company"] == "YesBank"][0] == {
              "company": "YesBank", "value": 10, "positive": False, "is_power": False})
    rd = _reveal(s["cd6"], "YesBank")
    check("chairman: both gone -> $10 -> $20; +$1,000 on your 100",
          rd["new_value"] == 20 and [c["player_name"] for c in rd["cards"]] == ["Meera"]
          and 100 * (rd["new_value"] - rd["old_value"]) == 1000)

    # ── Day 7: double director under Meera's chair (Cred) ──
    d7 = s["d7"]
    check("day 7, seats Meera, Arjun, You; your turn in round 1",
          d7["day"] == 7 and _seats(d7) == ["Meera", "Arjun", "You"] and d7["round"] == 0
          and d7["current_player_name"] == "You")
    check("Cred $15, 100 left in the bank; your hand Cred -10, Cred -5",
          _price(d7, "Cred") == 15 and d7["available_shares"][2] == 100
          and [(c["value"], c["positive"]) for c in d7["your_hand"] if c["company"] == "Cred"] == [(10, False), (5, False)])
    b7 = s["d7-bought"]
    check("buy 100 Cred for $1,500: Meera keeps the chair, you're a director with 100 (double)",
          _logged(b7, "You: Bought 100 of Cred for 1500") and you(b7)["stocks"]["Cred"] == 100
          and b7["chairman"]["Cred"] == 2 and b7["directors"]["Cred"] == [1])
    bell = s["bell7"]
    rd, cards = _signed(bell, "Cred")
    check("bell 7 queue: Meera chairman first, then You double director",
          _queue(bell) == [[2, "Cred", "chairman"], [1, "Cred", "double_director"]]
          and bell["current_player_name"] == "Meera")
    check("Cred: Meera -5 +15, Arjun +10, your -10 -5 -> $15 -> $20",
          cards == [("Meera", -5), ("Meera", 15), ("Arjun", 10), ("You", -10), ("You", -5)]
          and rd["old_value"] == 15 and rd["new_value"] == 20)
    m7 = s["cd7-meera"]
    rd = _reveal(m7, "Cred")
    check("Meera discards their own -5: Cred -> $25; your turn", rd["new_value"] == 25
          and _queue(m7) == [[1, "Cred", "double_director"]] and m7["current_player_name"] == "You"
          and "Meera: Chairman discarded a Cred card." in m7["game_log"])
    rd = _reveal(s["cd7"], "Cred")
    check("double director drops -10 and -5: Cred $15 -> $40; +$2,500 on your 100",
          rd["new_value"] == 40 and 100 * (rd["new_value"] - rd["old_value"]) == 2500)

    # ── Day 8: 150 -> chairman then director ──
    d8 = s["d8"]
    check("day 8, seats Arjun, You, Meera; Meera last; you hold 150 YesBank at $20",
          d8["day"] == 8 and _seats(d8) == ["Arjun", "You", "Meera"] and d8["current_player_name"] == "Meera"
          and you(d8)["stocks"]["YesBank"] == 150 and _price(d8, "YesBank") == 20
          and _logged(d8, "You: Bought 50 of YesBank for 1000"))
    bell = s["bell8"]
    rd, cards = _signed(bell, "YesBank")
    check("bell 8: chairman, then director — both You", _cd_roles(bell) == [("YesBank", "chairman"), ("YesBank", "director")])
    check("YesBank: Arjun -10, your -10 -5, Meera +10 -> $20 -> $5",
          cards == [("Arjun", -10), ("You", -10), ("You", -5), ("Meera", 10)] and rd["new_value"] == 5)
    c8 = s["cd8-chair"]
    check("chairman (own -10 + Arjun's -10): -> $25, director still queued",
          _reveal(c8, "YesBank")["new_value"] == 25 and _cd_roles(c8) == [("YesBank", "director")])
    rd = _reveal(s["cd8"], "YesBank")
    check("director drops -5: $20 -> $30; +$1,500 on your 150",
          rd["new_value"] == 30 and 150 * (rd["new_value"] - rd["old_value"]) == 1500)

    # ── Day 9: 200 = the whole company -> chairman + double director; TCS crashes ──
    d9 = s["d9"]
    check("day 9, seats You, Meera, Arjun; Arjun last; you hold all 200 YesBank, bank has 0",
          d9["day"] == 9 and _seats(d9) == ["You", "Meera", "Arjun"] and d9["current_player_name"] == "Arjun"
          and you(d9)["stocks"]["YesBank"] == STARTING_SHARES and d9["available_shares"][1] == 0
          and _logged(d9, "You: Bought 50 of YesBank for 1500"))
    bell = s["bell9"]
    rd, cards = _signed(bell, "YesBank")
    check("bell 9: chairman + double director — both You",
          _cd_roles(bell) == [("YesBank", "chairman"), ("YesBank", "double_director")])
    check("YesBank: your -10 -5 -5, Meera -10, Arjun +10 -> $30 -> $10",
          cards == [("You", -10), ("You", -5), ("You", -5), ("Meera", -10), ("Arjun", 10)]
          and rd["old_value"] == 30 and rd["new_value"] == 10)
    check("Meera's -10 is Meera's first YesBank card (other:2:0)",
          [c for c in bell["all_hands"][2] if c["company"] == "YesBank"][0]["value"] == 10)
    c9 = s["cd9-chair"]
    check("chairman (own -10 + Meera's -10): back to $30; double director next",
          _reveal(c9, "YesBank")["new_value"] == 30 and _cd_roles(c9) == [("YesBank", "double_director")])
    rd = _reveal(s["cd9"], "YesBank")
    check("double director drops both -5s: $30 -> $40; +$2,000 on your 200",
          rd["new_value"] == 40 and 200 * (rd["new_value"] - rd["old_value"]) == 2000)
    rd, cards = _signed(s["cd9"], "TCS")
    check("TCS crashes $45 -> $5 (your -5, Meera -20, Arjun -15); nobody holds it",
          sorted(cards) == sorted([("You", -5), ("Meera", -20), ("Arjun", -15)])
          and rd["old_value"] == 45 and rd["new_value"] == 5
          and all("TCS" not in p["stocks"] for p in s["cd9"]["players"]))

    # ── Day 10: the 200 supply, liquidity and seat order ──
    dawn = s["d10-dawn"]
    check("day 10: seats rotated to Meera, Arjun, You; TCS $5, all 200 in the bank",
          dawn["day"] == 10 and _seats(dawn) == ["Meera", "Arjun", "You"] and dawn["current_player_name"] == "Meera"
          and _price(dawn, "TCS") == 5 and dawn["available_shares"][3] == STARTING_SHARES)
    check("you have the most cash at the table, yet move last",
          you(dawn)["cash"] == 600 > max(p["cash"] for p in dawn["players"] if not p["is_you"])
          and _seats(dawn)[-1] == "You")
    check("Meera buys 100 TCS first", _logged(s["d10-meera"], "Meera: Bought 100 of TCS for 500"))
    d10 = s["d10"]
    me = you(d10)
    check("Arjun buys 50 next; your turn with 50 left", _logged(d10, "Arjun: Bought 50 of TCS for 250")
          and d10["current_player_name"] == "You" and d10["available_shares"][3] == 50)
    check("bots hold 100 and 50", sorted(p["stocks"].get("TCS", 0) for p in d10["players"] if not p["is_you"]) == [50, 100])
    check("your $600 buys 120 (>= 70), but only 50 remain: slider max 50",
          me["cash"] == 600 and me["cash"] // _price(d10, "TCS") == 120 >= 70
          and min(me["cash"] // _price(d10, "TCS"), d10["available_shares"][3]) == 50)
    log = d10["game_log"]
    check("both bot buys precede your move; Arjun's is the last entry",
          log[-2].startswith("Meera: Bought 100 of TCS for 500") and log[-1].startswith("Arjun: Bought 50 of TCS for 250"))
    bt = s["d10-bought"]
    check("you buy the last 50 for $250; the bank is out", _logged(bt, "You: Bought 50 of TCS for 250")
          and you(bt)["stocks"]["TCS"] == 50 and bt["available_shares"][3] == 0 and you(bt)["cash"] == 350)
    check("moving first won Meera TCS's chair (100); Arjun and You are its directors",
          bt["chairman"]["TCS"] == 2 and sorted(bt["directors"]["TCS"]) == [1, 3])
    check("bots never play power cards", _no_bot_power_cards(bt))

def test_copy_constants():
    """Constants quoted in chapter copy still match the engine/server."""
    header("Tutorial copy quotes engine constants")
    from engine import constants as K
    from room_manager import Room
    d = os.path.join(ROOT, "frontend", "src", "tutorial", "chapters")
    src = lambda n: open(os.path.join(d, n)).read()
    ori, obj = src("orientation.ts"), src("objective.ts")
    timer = Room("TEST").turn_timer_seconds
    check("'200 shares' in copy == STARTING_SHARES", "200 shares" in ori and K.STARTING_SHARES == 200)
    check("'3 rounds' in copy == ROUNDS_PER_DAY", "3 rounds" in obj and K.ROUNDS_PER_DAY == 3)
    check("'ten days' in copy == MAX_DAYS", "ten days" in obj and K.MAX_DAYS == 10)
    check("'director (50+ shares)' in copy == DIRECTOR_THRESHOLD", "(50+ shares)" in ori and K.DIRECTOR_THRESHOLD == 50)
    quoted = {int(m) for m in re.findall(r"\*\*(\d+)s\*\*", ori)}
    check("'**90s**' turn clock in copy == default turn_timer_seconds", quoted == {timer} == {90})


for t in (test_setup_hands, test_setup_holdings, test_snap_shape, test_act_logs_like_server,
          test_failed_act_raises, test_bell_and_next_day, test_check_detects_drift,
          test_orientation_lesson, test_objective_lesson, test_prices_lesson, test_turns_lesson, test_trading_lesson,
          test_loan_stock_lesson, test_debenture_lesson, test_rights_issue_lesson, test_share_suspend_lesson,
          test_act_early_snap, test_chairman_director_lesson, test_copy_constants):
    t()

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
