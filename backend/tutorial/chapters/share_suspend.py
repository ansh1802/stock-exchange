"""share-suspend — spec Ch 9: the after-play card that undoes the bell for one company.

Days 1-2 are engine history; end_day's seat rotation gives day 2 Meera, Arjun,
You and day 3 Arjun, You, Meera.
  Day 1: you spend all $600 — 7 Cred, 4 TCS, 4 YesBank. Meera and Arjun buy 4
         Cred each. Close: Cred $40 -> $60, YesBank $25 -> $15. You $700.
  Day 2: Meera and Arjun sell all their Cred in round 1. Round 3, you hold
         Share Suspend + Cred +5 and pass. Bell 1: their -45 beats your +5,
         Cred $60 -> $20 (you $700 -> $420). You halt Cred: back to $60, its
         price before the bell (you $700, top of the table).
  Day 3: hand Share Suspend, TCS +15, YesBank +5; Meera holds a Share Suspend
         too. Bell 2: TCS $55 -> $80 (+$100 on your 4), YesBank $15 -> $0,
         BANKRUPT -> CLOSED (you $740). Queue You, Meera: you halt YesBank back
         to $15; it reopens when the suspend phase ends (the standings, written
         before the reopen, still count it $0). Meera halts TCS back to $55:
         your $100 is gone (standings $740 -> $640). Day 4 board: $700, with
         YesBank reopened; Arjun $705.
"""

from tutorial.scenario import Scenario

CAST = ["You", "Meera", "Arjun"]
VODAFONE, YESBANK, CRED, TCS, RELIANCE, INFOSYS = 1, 2, 3, 4, 5, 6


def build():
    s = Scenario("share-suspend", CAST)
    # ── Day 1 (history): seats You, Meera, Arjun ──
    s.setup(
        day=1,
        round=0,
        current_turn=0,
        hands={
            1: ["Cred+10"],
            2: ["Cred+5", "Infosys+5"],
            3: ["Cred+5", "YesBank-10"],
        },
    )
    s.act(1, {"type": "buy", "company_num": CRED, "quantity": 7})
    s.act(2, {"type": "buy", "company_num": CRED, "quantity": 4})
    s.act(3, {"type": "buy", "company_num": CRED, "quantity": 4})
    s.act(1, {"type": "buy", "company_num": TCS, "quantity": 4})
    s.act(2, {"type": "pass"})
    s.act(3, {"type": "pass"})
    s.act(1, {"type": "buy", "company_num": YESBANK, "quantity": 4})
    s.act(2, {"type": "pass"})
    s.act(3, {"type": "pass"})
    s.ack_reveal()
    # ── Day 2: seats Meera, Arjun, You ──
    s.next_day({
        1: ["ShareSuspend", "Cred+5"],
        2: ["Cred-15", "Cred-10", "Reliance+5"],
        3: ["Cred-15", "Cred-5", "Vodafone-5"],
    })
    s.act(2, {"type": "sell", "company_num": CRED, "quantity": 4})
    s.act(3, {"type": "sell", "company_num": CRED, "quantity": 4})
    s.act(1, {"type": "pass"})
    s.act(2, {"type": "buy", "company_num": RELIANCE, "quantity": 2})
    s.act(3, {"type": "pass"})
    s.act(1, {"type": "pass"})
    s.act(2, {"type": "pass"})
    s.act(3, {"type": "pass"})
    s.snap("start")
    s.act(1, {"type": "pass"})
    s.snap("bell1")
    s.ack_reveal()
    s.snap("suspend1")
    s.act(1, {"type": "share_suspend", "company_num": CRED})
    # ── Day 3: seats Arjun, You, Meera ──
    s.next_day({
        1: ["ShareSuspend", "TCS+15", "YesBank+5"],
        2: ["ShareSuspend", "YesBank-10", "Infosys+5"],
        3: ["TCS+10", "YesBank-10", "Vodafone+5"],
    })
    s.snap("halted1")
    s.act(3, {"type": "buy", "company_num": VODAFONE, "quantity": 5})
    s.act(1, {"type": "pass"})
    s.act(2, {"type": "buy", "company_num": INFOSYS, "quantity": 1})
    for pid in (3, 1, 2):
        s.act(pid, {"type": "pass"})
    s.act(3, {"type": "pass"})
    s.snap("start2")
    s.act(1, {"type": "pass"})
    s.snap("meera3")
    s.act(2, {"type": "pass"})
    s.snap("bell2")
    s.ack_reveal()
    s.snap("suspend2")
    s.act(1, {"type": "share_suspend", "company_num": YESBANK})
    s.snap("your-halt2")
    s.act(2, {"type": "share_suspend", "company_num": TCS})
    # ── Day 4: seats You, Meera, Arjun ──
    s.next_day({
        1: ["Vodafone+5"],
        2: ["Reliance+5"],
        3: ["Cred+5"],
    })
    s.snap("meera-halt")
    return s
