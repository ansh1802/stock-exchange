"""debenture — spec Ch 7: a shut company ignores cards until a Debenture reopens it.

Day 1 (engine history, seats You, Meera, Arjun): you buy 10 YesBank on your
YesBank +5 and 10 Vodafone on your Vodafone +5; Meera's and Arjun's YesBank
-10/-5 pairs outweigh you: YesBank $25 -> $0, BANKRUPT, shut.
Day 2 (seats Meera, Arjun, You), hand YesBank +10. Rounds 1-2 are history
(you sell your 10 Vodafone, then pass); round 3 is shown: YesBank can't be
bought, you pass, and at the bell Arjun's +5 and your +10 land on YesBank but
it stays $0 -> $0.
Day 3 (seats Arjun, You, Meera), hand Debenture and YesBank +5. You play the
Debenture: YesBank reopens at its base value $25 and your 10 shares go
$0 -> $250 (net worth $400 -> $650, top of the table). Next round you buy 16 YesBank (Max).
"""

from tutorial.scenario import Scenario

CAST = ["You", "Meera", "Arjun"]
VODAFONE, YESBANK, CRED, TCS, RELIANCE, INFOSYS = 1, 2, 3, 4, 5, 6


def build():
    s = Scenario("debenture", CAST)
    # ── Day 1 (history) ──
    s.setup(
        day=1,
        round=0,
        current_turn=0,
        hands={
            1: ["YesBank+5", "Vodafone+5"],
            2: ["YesBank-10", "YesBank-5", "Cred+5"],
            3: ["YesBank-10", "YesBank-5", "TCS+5"],
        },
    )
    s.act(1, {"type": "buy", "company_num": YESBANK, "quantity": 10})
    s.act(2, {"type": "buy", "company_num": CRED, "quantity": 5})
    s.act(3, {"type": "buy", "company_num": TCS, "quantity": 4})
    s.act(1, {"type": "buy", "company_num": VODAFONE, "quantity": 10})
    s.act(2, {"type": "pass"})
    s.act(3, {"type": "pass"})
    for pid in (1, 2, 3):
        s.act(pid, {"type": "pass"})
    s.ack_reveal()
    # ── Day 2: seats Meera, Arjun, You ──
    s.next_day({
        1: ["YesBank+10", "Vodafone-5"],
        2: ["Reliance+5"],
        3: ["YesBank+5", "TCS-5"],
    })
    s.act(2, {"type": "buy", "company_num": RELIANCE, "quantity": 2})
    s.act(3, {"type": "sell", "company_num": TCS, "quantity": 4})
    s.act(1, {"type": "sell", "company_num": VODAFONE, "quantity": 10})
    for pid in (2, 3, 1):
        s.act(pid, {"type": "pass"})
    s.act(2, {"type": "pass"})
    s.act(3, {"type": "pass"})
    s.snap("start")
    s.act(1, {"type": "pass"})
    s.snap("bell")
    s.ack_reveal()
    # ── Day 3: seats Arjun, You, Meera ──
    s.next_day({
        1: ["Debenture", "YesBank+5"],
        2: ["Infosys+5"],
        3: ["Cred+5"],
    })
    s.snap("after")
    s.act(3, {"type": "buy", "company_num": CRED, "quantity": 4})
    s.snap("you3")
    s.act(1, {"type": "debenture", "company_num": YESBANK})
    s.snap("reopened")
    s.act(2, {"type": "buy", "company_num": INFOSYS, "quantity": 1})
    s.act(3, {"type": "pass"})
    s.snap("you4")
    s.act(1, {"type": "buy", "company_num": YESBANK, "quantity": 16})
    s.snap("bought")
    return s
