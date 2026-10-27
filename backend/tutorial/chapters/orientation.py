"""orientation — spec Ch 1: a 6-seat table on day 3, round 2, your turn.

Day 3 (not day 1): a director needs 50 shares, which no one can afford at
day-1 prices with $600, and the ticker's sparkline needs past closes. The
thread through the tour: Kabir just bought 50 YesBank (ticker shows 150
avail, board shows their director icon, log shows the trade).
"""

from tutorial.scenario import Scenario

CAST = ["You", "Meera", "Arjun", "Kabir", "Zoya", "Dev"]
TCS, CRED, INFOSYS, YESBANK, RELIANCE = 4, 3, 6, 2, 5

# Closing prices of days 1 and 2 (today's prices = day 2's close).
CLOSES = [
    [25, 20, 45, 60, 70, 85],
    [25, 10, 50, 70, 65, 90],
]


def table():
    """The floor as you sit down: round 1 of day 3 just played, your turn in round 2."""
    s = Scenario("orientation", CAST)
    s.setup(
        day=3,
        round=0,
        current_turn=0,
        prices=dict(zip(["Vodafone", "YesBank", "Cred", "TCS", "Reliance", "Infosys"], CLOSES[-1])),
        price_history=CLOSES,
        networth_history=[
            {pid: 600 for pid in range(1, 7)},
            {1: 640, 2: 610, 3: 590, 4: 600, 5: 630, 6: 600},
            {1: 715, 2: 630, 3: 560, 4: 620, 5: 670, 6: 605},
        ],
        cash={1: 365, 2: 360, 3: 300, 4: 620, 5: 250, 6: 480},
        stocks={1: {"TCS": 5}, 2: {"Infosys": 3}, 3: {"Reliance": 4}, 5: {"TCS": 6}, 6: {"Vodafone": 5}},
        hands={1: ["TCS+10", "TCS-5", "Cred+10", "Cred-5", "Infosys+20", "Infosys-10",
                   "Reliance-15", "Reliance+5", "YesBank+5", "Vodafone-5"]},
    )
    s.act(1, {"type": "buy", "company_num": CRED, "quantity": 4})
    s.act(2, {"type": "buy", "company_num": INFOSYS, "quantity": 2})
    s.act(3, {"type": "sell", "company_num": RELIANCE, "quantity": 4})
    s.act(4, {"type": "buy", "company_num": YESBANK, "quantity": 50})
    s.act(5, {"type": "pass"})
    s.act(6, {"type": "buy", "company_num": TCS, "quantity": 4})
    return s


def build():
    s = table()
    s.snap("floor")
    s.act(1, {"type": "pass"})
    s.snap("passed")
    return s
