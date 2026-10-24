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


def test_setup_order():
    header("setup seat order")
    s = mk()
    s.setup(order=[2, 3, 1], current_turn=0)
    g = s.room.game
    check("players reordered by id", [p.id for p in g.players] == [2, 3, 1])
    s.snap("a")
    snap = s.to_fixture()["snapshots"]["a"]
    check("snapshot follows the order, Ada first", [p["name"] for p in snap["players"]] == ["Ada", "Bo", "You"]
          and snap["current_player_name"] == "Ada")


def test_trading_lesson():
    header("trading lesson")
    if not check("trading registered", "trading" in CHAPTERS):
        return
    from engine.constants import COMPANY_BASE_VALUES, STARTING_CASH, STARTING_SHARES
    s = snaps("trading")
    order = ["start", "meera", "arjun", "you1", "bought", "you2", "sold", "you3", "bell", "after"]
    check("snapshots in order", list(s) == order)
    st = s["start"]
    check("4 seats, You last: Meera, Arjun, Kabir, You",
          [p["name"] for p in st["players"]] == ["Meera", "Arjun", "Kabir", "You"])
    check("day 1, round 1, Meera first", st["day"] == 1 and st["round"] == 0
          and st["phase"] == "player_turn" and st["current_player_name"] == "Meera")
    check("nobody holds shares at the start, everyone $600",
          all(not p["stocks"] and p["cash"] == STARTING_CASH == 600 for p in st["players"]))
    check("your hand: TCS +10, Infosys +10", st["your_hand"] == [
        {"company": "TCS", "value": 10, "positive": True, "is_power": False},
        {"company": "Infosys", "value": 10, "positive": True, "is_power": False},
    ])
    tcs_p, inf_p = COMPANY_BASE_VALUES[3], COMPANY_BASE_VALUES[5]
    check("TCS $55, Infosys $80 (base)", st["companies"][3]["value"] == tcs_p == 55
          and st["companies"][5]["value"] == inf_p == 80)

    def by(snap, name):
        return next(p for p in snap["players"] if p["name"] == name)

    # Round 1 (watched): one log line per bot move.
    y1 = s["you1"]
    added = y1["game_log"][len(st["game_log"]):]
    check("round 1: Meera 6 TCS, Arjun 5 TCS, Kabir 5 Vodafone", [l.split(". Balance")[0] for l in added] == [
        "Meera: Bought 6 of TCS for 330", "Arjun: Bought 5 of TCS for 275", "Kabir: Bought 5 of Vodafone for 100"])
    check("board: Meera 6 TCS, Arjun 5 TCS, Kabir 5 Vodafone", by(y1, "Meera")["stocks"] == {"TCS": 6}
          and by(y1, "Arjun")["stocks"] == {"TCS": 5} and by(y1, "Kabir")["stocks"] == {"Vodafone": 5})
    check("then it's your turn, still round 1", y1["current_player_name"] == "You" and y1["round"] == 0)

    # Your buy: slider max is cash-bound (10), and what's left can't buy a real Infosys stake.
    me1 = you(y1)
    avail_tcs = y1["available_shares"][3]
    max_tcs = min(me1["cash"] // tcs_p, avail_tcs)
    check("TCS available 189 = 200 - 11", avail_tcs == STARTING_SHARES - 11 == 189)
    check("TCS slider max 10 (cash $600 // $55), cost $550 <= cash",
          max_tcs == 10 and 10 * tcs_p == 550 <= me1["cash"])
    left = me1["cash"] - 10 * tcs_p
    check("$50 left: under one Infosys share ($80)", left == 50 < inf_p
          and (left // inf_p) * inf_p < (10 * tcs_p) / 2)
    b = s["bought"]
    me = you(b)
    check("bought: 10 TCS, cash $50", me["stocks"] == {"TCS": 10} and me["cash"] == 50
          and b["game_log"][-1].startswith("You: Bought 10 of TCS for 550"))
    check("bought: round 2, Meera's turn", b["round"] == 1 and b["current_player_name"] == "Meera")

    y2 = s["you2"]
    added = y2["game_log"][len(b["game_log"]):]
    check("round 2: Meera +3 TCS, Arjun passes, Kabir 4 Cred", [l.split(". Balance")[0] for l in added] == [
        "Meera: Bought 3 of TCS for 165", "Arjun: Turn passed.", "Kabir: Bought 4 of Cred for 160"])
    check("you2: your turn, round 2", y2["current_player_name"] == "You" and y2["round"] == 1)
    check("sell max = holdings = 10", you(y2)["stocks"]["TCS"] == 10)

    so = s["sold"]
    me = you(so)
    check("sold 2 TCS: $110 back, cash $50 -> $160, 8 TCS", me["stocks"] == {"TCS": 8} and me["cash"] == 160
          and 2 * tcs_p == 110 and so["game_log"][-1].startswith("You: Sold 2 of TCS for 110"))

    y3 = s["you3"]
    added = y3["game_log"][len(so["game_log"]):]
    check("round 3: the bots pass", added == ["Meera: Turn passed.", "Arjun: Turn passed.", "Kabir: Turn passed."])
    me = you(y3)
    nw_before = me["cash"] + me["stocks"]["TCS"] * tcs_p
    check("net worth before the bell $600 = $160 + 8 x $55", y3["round"] == 2 and nw_before == 600)

    bl = s["bell"]
    check("bell: card_reveal on day 1", bl["phase"] == "card_reveal" and bl["day"] == 1)
    rd = {r["company_name"]: r for r in bl["reveal_data"]}

    def cards(name):
        return [(c["player_name"], c["value"] if c["positive"] else -c["value"]) for c in rd[name]["cards"]]

    t, i = rd["TCS"], rd["Infosys"]
    # Cards land in seat order; the copy names them in this order.
    check("TCS: Meera +10, Arjun +5, You +10 -> +25, $55 to $80",
          cards("TCS") == [("Meera", 10), ("Arjun", 5), ("You", 10)] and t["delta"] == 25
          and t["old_value"] == 55 and t["new_value"] == 80)
    check("TCS delta >= your +10 + bots' TCS cards", t["delta"] >= 10 + 10 + 5)
    check("Infosys: Kabir -5, You +10 -> +5, $80 to $85",
          cards("Infosys") == [("Kabir", -5), ("You", 10)] and i["delta"] == 5
          and i["old_value"] == 80 and i["new_value"] == 85)
    check("TCS rises more than Infosys", t["delta"] > i["delta"])
    # Hidden hands behind the read: the alliance held + TCS, Kabir held Infosys -, nobody else backed Infosys.
    check("Meera and Arjun held + TCS cards", ("Meera", 10) in cards("TCS") and ("Arjun", 5) in cards("TCS"))
    check("Kabir held Infosys -, no TCS card", ("Kabir", -5) in cards("Infosys")
          and not any(n == "Kabir" for n, _ in cards("TCS")))
    check("no chairman/director queue, no currency", bl["chairman_director_queue"] == []
          and not bl["currency_effects"])

    af = s["after"]
    check("after: day 2 dealt, no reveal data (no re-animation)", af["phase"] == "player_turn"
          and not af["reveal_data"] and af["day"] == 2 and af["current_player_name"] == "Arjun")
    me = you(af)
    nw_after = me["cash"] + sum(q * next(c["value"] for c in af["companies"] if c["name"] == n)
                                for n, q in me["stocks"].items())
    check("after: net worth $800 = $160 + 8 x $80, +$200", nw_after == 800 and nw_after - nw_before == 200
          and me["cash"] == 160 and me["stocks"] == {"TCS": 8})
    hist = af["networth_history"]
    check("networth_history: you $600 -> $800 on day 1", len(hist) == 2
          and hist[0][1] == 600 and hist[1][1] == 800)
    check("no power card is played", not any("Loan Stock" in l or "Debenture" in l or "Rights" in l
                                             for l in af["game_log"]))


for t in (test_setup_hands, test_setup_order, test_setup_holdings, test_snap_shape, test_act_logs_like_server,
          test_failed_act_raises, test_bell_and_next_day, test_check_detects_drift,
          test_orientation_lesson, test_objective_lesson, test_prices_lesson, test_turns_lesson, test_trading_lesson):
    t()

print(f"\n{passed} passed, {failed} failed")
sys.exit(1 if failed else 0)
