"""prices — spec Ch 3: day 1, round 3; you pass and the closing bell plays.

Your hand is TCS +10, Reliance -15 and Currency +. At the bell:
  YesBank  $25: Meera -15, Arjun -10           -> $0, shuts (seeds Ch 7)
  TCS      $55: You +10, Meera -5              -> $60
  Reliance $75: You -15, Meera +15, Arjun +10  -> $85 (your card is outweighed)
  Currency +: your $380 cash -> $418, applied automatically
Meera and Arjun bought Reliance this morning — the trade hint Ch 5 builds on.
"""

from tutorial.scenario import Scenario

CAST = ["You", "Meera", "Arjun"]
TCS, RELIANCE = 4, 5


def build():
    s = Scenario("prices", CAST)
    s.setup(
        day=1,
        round=0,
        current_turn=0,
        hands={
            1: ["TCS+10", "Reliance-15", "Currency+"],
            2: ["YesBank-15", "TCS-5", "Reliance+15"],
            3: ["YesBank-10", "Reliance+10"],
        },
    )
    # Round 1
    s.act(1, {"type": "buy", "company_num": TCS, "quantity": 4})
    s.act(2, {"type": "buy", "company_num": RELIANCE, "quantity": 3})
    s.act(3, {"type": "buy", "company_num": RELIANCE, "quantity": 2})
    # Round 2
    for pid in (1, 2, 3):
        s.act(pid, {"type": "pass"})
    # Round 3: your last move of the day
    s.snap("table")
    s.act(1, {"type": "pass"})
    s.snap("passed")
    s.act(2, {"type": "pass"})
    s.act(3, {"type": "pass"})
    s.snap("bell")
    return s
