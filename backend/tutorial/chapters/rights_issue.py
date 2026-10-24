"""rights-issue — spec Ch 8: play a Rights Issue (8a), then enjoy someone else's (8b).

Four seats so the 8b queue can skip a bot *between* Arjun and You and your own
move still follows in the same round. Days 1-2 are engine history; end_day's
seat rotation makes day 3's order Arjun, Kabir, You, Meera.
  Day 1: you buy 6 YesBank on your YesBank +10; Arjun buys 4 on their +5,
         Kabir's -5 nets it out: YesBank $25 -> $35.
  Day 2: you pass all day; nobody touches TCS or YesBank.
Day 3, cash $450, hand Rights Issue + TCS +10.
  8a Round 1: Max TCS is 8 ($10 left); the RI button buys 6 ($330), keeping
              $120 for the full issue (3 x $25 = $75).
     Round 2: you play Rights Issue on TCS: $55 -> $25 (half, rounded down to
              a multiple of $5). Only you hold TCS; you buy 3 for $75. TCS is
              restored to $55: net worth $660 -> $750.
  8b Round 3: Arjun plays Rights Issue on YesBank: $35 -> $15. Queue Arjun,
              You (Kabir and Meera hold none, skipped). Arjun buys 2, you buy
              3 for your last $45; YesBank restored to $35: $750 -> $810.
              Then Kabir's normal move, then yours (you pass), then Meera.
"""

from tutorial.scenario import Scenario

CAST = ["You", "Meera", "Arjun", "Kabir"]
VODAFONE, YESBANK, CRED, TCS, RELIANCE, INFOSYS = 1, 2, 3, 4, 5, 6


def build():
    s = Scenario("rights-issue", CAST)
    # ── Day 1 (history): seats You, Meera, Arjun, Kabir ──
    s.setup(
        day=1,
        round=0,
        current_turn=0,
        hands={
            1: ["YesBank+10"],
            2: ["Cred+5"],
            3: ["YesBank+5", "Reliance+5"],
            4: ["YesBank-5", "Vodafone+5"],
        },
    )
    s.act(1, {"type": "buy", "company_num": YESBANK, "quantity": 6})
    s.act(2, {"type": "buy", "company_num": CRED, "quantity": 5})
    s.act(3, {"type": "buy", "company_num": YESBANK, "quantity": 4})
    s.act(4, {"type": "buy", "company_num": VODAFONE, "quantity": 6})
    for _ in range(2):
        for pid in (1, 2, 3, 4):
            s.act(pid, {"type": "pass"})
    s.ack_reveal()
    # ── Day 2 (history): seats Meera, Arjun, Kabir, You ──
    s.next_day({
        1: ["Cred-5"],
        2: ["Infosys+5"],
        3: ["Reliance+5"],
        4: ["Vodafone-5"],
    })
    s.act(2, {"type": "buy", "company_num": INFOSYS, "quantity": 2})
    s.act(3, {"type": "buy", "company_num": RELIANCE, "quantity": 2})
    s.act(4, {"type": "sell", "company_num": VODAFONE, "quantity": 6})
    s.act(1, {"type": "pass"})
    for _ in range(2):
        for pid in (2, 3, 4, 1):
            s.act(pid, {"type": "pass"})
    s.ack_reveal()
    # ── Day 3: seats Arjun, Kabir, You, Meera ──
    s.next_day({
        1: ["RightsIssue", "TCS+10"],
        2: ["Infosys+5"],
        3: ["RightsIssue", "Cred+5"],
        4: ["Reliance+5"],
    })
    # Round 1
    s.act(3, {"type": "buy", "company_num": CRED, "quantity": 3})
    s.act(4, {"type": "buy", "company_num": RELIANCE, "quantity": 2})
    s.snap("you1")
    s.act(1, {"type": "buy", "company_num": TCS, "quantity": 6})
    s.snap("bought")
    s.act(2, {"type": "buy", "company_num": INFOSYS, "quantity": 2})
    # Round 2
    s.act(3, {"type": "buy", "company_num": CRED, "quantity": 2})
    s.act(4, {"type": "pass"})
    s.snap("you2")
    s.act(1, {"type": "rights_issue", "company_num": TCS})
    s.snap("ri")
    s.act(1, {"type": "rights_issue_buy", "quantity": 3})
    s.snap("ri-done")
    s.act(2, {"type": "pass"})
    # Round 3 — Arjun's Rights Issue is your free move
    s.act(3, {"type": "rights_issue", "company_num": YESBANK})
    s.snap("arjun-ri")
    s.act(3, {"type": "rights_issue_buy", "quantity": 2})
    s.snap("your-issue")
    s.act(1, {"type": "rights_issue_buy", "quantity": 3})
    s.snap("issue-done")
    s.act(4, {"type": "pass"})
    s.snap("you3")
    s.act(1, {"type": "pass"})
    s.snap("passed")
    return s
