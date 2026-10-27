"""loan-stock — spec Ch 6: cash-limited on a big + card; Loan Stock raises the cash.

Day 1 is played through the engine: you put $560 into 14 Cred on your Cred +15
(Meera's +5 helps: $40 -> $60) and keep $40; Meera's and Arjun's Reliance
cards drop it $75 -> $35. end_day rotates the seats, so day 2 runs Meera,
Arjun, You.

Day 2, your hand Reliance +20 and Loan Stock; net worth $880 ($40 + 14 x $60).
  Round 1: Meera 2 Infosys, Arjun 5 Vodafone. Your Reliance Max is 1
           ($40 // $35); you close the popup and play Loan Stock instead:
           10% of $880 = $88, rounded down to a multiple of 5 = $85 -> $125.
  Round 2: Meera and Arjun pass; your Max is now 3 ($125 // $35). You buy 3.
"""

from tutorial.scenario import Scenario

CAST = ["You", "Meera", "Arjun"]
VODAFONE, CRED, TCS, RELIANCE, INFOSYS = 1, 3, 4, 5, 6


def build():
    s = Scenario("loan-stock", CAST)
    # ── Day 1 (history only, not shown as steps) ──
    s.setup(
        day=1,
        round=0,
        current_turn=0,
        hands={
            1: ["Cred+15"],
            2: ["Cred+5", "Reliance-25"],
            3: ["Reliance-15", "TCS+5"],
        },
    )
    s.act(1, {"type": "buy", "company_num": CRED, "quantity": 14})
    s.act(2, {"type": "buy", "company_num": CRED, "quantity": 6})
    s.act(3, {"type": "buy", "company_num": TCS, "quantity": 4})
    for _ in range(2):
        for pid in (1, 2, 3):
            s.act(pid, {"type": "pass"})
    s.ack_reveal()
    # ── Day 2: seats rotate to Meera, Arjun, You ──
    s.next_day({
        1: ["Reliance+20", "LoanStock"],
        2: ["Infosys+10"],
        3: ["Vodafone+5"],
    })
    s.snap("start")
    s.act(2, {"type": "buy", "company_num": INFOSYS, "quantity": 2})
    s.snap("meera")
    s.act(3, {"type": "buy", "company_num": VODAFONE, "quantity": 5})
    s.snap("you1")
    s.act(1, {"type": "loan_stock"})
    s.snap("loaned")
    s.act(2, {"type": "pass"})
    s.act(3, {"type": "pass"})
    s.snap("you2")
    s.act(1, {"type": "buy", "company_num": RELIANCE, "quantity": 3})
    s.snap("bought")
    return s
