"""trading — spec Ch 5: read the table, buy into the alliance, the bell proves it.

Day 1, seats Meera, Arjun, Kabir, You (You move last, so you watch round 1).
Your hand is TCS +10 and Infosys +10; your $600 buys 10 TCS ($550), leaving
$50 — not one Infosys share ($80).
  Round 1: Meera 6 TCS, Arjun 5 TCS, Kabir 5 Vodafone; you buy 10 TCS.
  Round 2: Meera 3 more TCS, Arjun passes, Kabir 4 Cred; you sell 2 TCS (hedge).
  Round 3: everyone passes; the bell rings.
At the bell:
  TCS     $55: You +10, Meera +10, Arjun +5 -> $80 (the alliance)
  Infosys $80: You +10, Kabir -5            -> $85
Your net worth $600 ($160 + 8 x $55) -> $800 ($160 + 8 x $80).
"""

from tutorial.scenario import Scenario

CAST = ["You", "Meera", "Arjun", "Kabir"]
VODAFONE, CRED, TCS = 1, 3, 4


def build():
    s = Scenario("trading", CAST)
    s.setup(
        day=1,
        round=0,
        order=[2, 3, 4, 1],
        current_turn=0,
        hands={
            1: ["TCS+10", "Infosys+10"],
            2: ["TCS+10", "Reliance+5"],
            3: ["TCS+5", "YesBank-5"],
            4: ["Vodafone+5", "Cred+5", "Infosys-5"],
        },
    )
    s.snap("start")
    # Round 1 — you watch
    s.act(2, {"type": "buy", "company_num": TCS, "quantity": 6})
    s.snap("meera")
    s.act(3, {"type": "buy", "company_num": TCS, "quantity": 5})
    s.snap("arjun")
    s.act(4, {"type": "buy", "company_num": VODAFONE, "quantity": 5})
    s.snap("you1")
    s.act(1, {"type": "buy", "company_num": TCS, "quantity": 10})
    s.snap("bought")
    # Round 2
    s.act(2, {"type": "buy", "company_num": TCS, "quantity": 3})
    s.act(3, {"type": "pass"})
    s.act(4, {"type": "buy", "company_num": CRED, "quantity": 4})
    s.snap("you2")
    s.act(1, {"type": "sell", "company_num": TCS, "quantity": 2})
    s.snap("sold")
    # Round 3
    for pid in (2, 3, 4):
        s.act(pid, {"type": "pass"})
    s.snap("you3")
    s.act(1, {"type": "pass"})
    s.snap("bell")
    s.ack_reveal()
    # Day 2 deal, as the live server does before clients leave the end-of-day overlay.
    s.next_day({
        1: ["Reliance+5", "Vodafone-5"],
        2: ["Cred+10"],
        3: ["YesBank+5"],
        4: ["Reliance-5"],
    })
    s.snap("after")
    return s
