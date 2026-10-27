"""trading — spec Ch 5: read the table, buy into the alliance, the bell proves it.

Day 1 is played through the engine so day 2 opens with real history: you
bought 10 Vodafone on your Vodafone +10 (closes $30), and end_day's seat
rotation makes day 2's order Meera, Arjun, Kabir, You — you move last and
watch round 1 first.

Day 2, your hand TCS +10, Infosys +10, Vodafone -5; cash $400 buys 7 TCS
($385), leaving $15 — not one Infosys share ($80).
  Round 1: Meera 4 TCS, Arjun 5 TCS, Kabir 4 Cred; you buy 7 TCS.
  Round 2: Meera 2 more TCS, Arjun passes, Kabir 3 YesBank; you sell 5 of
           your 10 Vodafone on your -5 card.
  Round 3: everyone passes; the bell rings.
At the bell:
  Vodafone $30: You -5                       -> $25 (the 5 you sold dodged it)
  TCS      $55: Meera +10, Arjun +5, You +10 -> $80 (the alliance)
  Infosys  $80: Kabir -5, You +10            -> $85
Your net worth $700 -> $850, ahead of Meera ($770) and Arjun ($775).
"""

from tutorial.scenario import Scenario

CAST = ["You", "Meera", "Arjun", "Kabir"]
VODAFONE, YESBANK, CRED, TCS, RELIANCE = 1, 2, 3, 4, 5


def build():
    s = Scenario("trading", CAST)
    # ── Day 1 (history only, not shown as steps) ──
    s.setup(
        day=1,
        round=0,
        current_turn=0,
        hands={
            1: ["Vodafone+10"],
            2: ["Reliance+5"],
            3: ["Cred+5"],
            4: ["YesBank+5"],
        },
    )
    s.act(1, {"type": "buy", "company_num": VODAFONE, "quantity": 10})
    s.act(2, {"type": "buy", "company_num": RELIANCE, "quantity": 2})
    s.act(3, {"type": "buy", "company_num": CRED, "quantity": 5})
    s.act(4, {"type": "buy", "company_num": YESBANK, "quantity": 8})
    for _ in range(2):
        for pid in (1, 2, 3, 4):
            s.act(pid, {"type": "pass"})
    s.ack_reveal()
    # ── Day 2: seats rotate to Meera, Arjun, Kabir, You ──
    s.next_day({
        1: ["TCS+10", "Infosys+10", "Vodafone-5"],
        2: ["TCS+10", "YesBank-5"],
        3: ["TCS+5", "Reliance+5"],
        4: ["Cred+5", "YesBank+5", "Infosys-5"],
    })
    s.snap("start")
    # Round 1 — you watch
    s.act(2, {"type": "buy", "company_num": TCS, "quantity": 4})
    s.snap("meera")
    s.act(3, {"type": "buy", "company_num": TCS, "quantity": 5})
    s.snap("arjun")
    s.act(4, {"type": "buy", "company_num": CRED, "quantity": 4})
    s.snap("you1")
    s.act(1, {"type": "buy", "company_num": TCS, "quantity": 7})
    s.snap("bought")
    # Round 2
    s.act(2, {"type": "buy", "company_num": TCS, "quantity": 2})
    s.act(3, {"type": "pass"})
    s.act(4, {"type": "buy", "company_num": YESBANK, "quantity": 3})
    s.snap("you2")
    s.act(1, {"type": "sell", "company_num": VODAFONE, "quantity": 5})
    s.snap("sold")
    # Round 3
    for pid in (2, 3, 4):
        s.act(pid, {"type": "pass"})
    s.snap("you3")
    s.act(1, {"type": "pass"})
    s.snap("bell")
    s.ack_reveal()
    # Day 3 deal, as the live server does before clients leave the end-of-day overlay.
    s.next_day({
        1: ["Reliance+5", "Cred-5"],
        2: ["Cred+10"],
        3: ["YesBank+5"],
        4: ["Reliance-5"],
    })
    s.snap("after")
    return s
