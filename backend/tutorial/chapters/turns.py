"""turns — spec Ch 4: day 1 at a 4-seat table; one full round goes round, then you pass.

Round 1: You buy 4 TCS ($220, $600 -> $380), Meera buys 3 Reliance, Arjun
passes, Kabir plays Loan Stock (a power card). Round 2 starts back at You,
and you pass. One snapshot after every move so the turn visibly moves seat
by seat; the round ticks only when the turn wraps back to You.
"""

from tutorial.scenario import Scenario

CAST = ["You", "Meera", "Arjun", "Kabir"]
TCS, RELIANCE = 4, 5


def build():
    s = Scenario("turns", CAST)
    s.setup(
        day=1,
        round=0,
        current_turn=0,
        hands={
            1: ["TCS+10", "Infosys+5", "Vodafone-5"],
            2: ["Reliance+10"],
            3: ["Cred-5"],
            4: ["LoanStock"],
        },
    )
    s.snap("start")
    s.act(1, {"type": "buy", "company_num": TCS, "quantity": 4})
    s.snap("bought")
    s.act(2, {"type": "buy", "company_num": RELIANCE, "quantity": 3})
    s.snap("meera")
    s.act(3, {"type": "pass"})
    s.snap("arjun")
    s.act(4, {"type": "loan_stock"})
    s.snap("round2")
    s.act(1, {"type": "pass"})
    s.snap("passed")
    return s
