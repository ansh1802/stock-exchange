"""chairman-director — spec Ch 10: positions at the bell, then the 200-share supply.

One game, days 5-10, played through the engine from a seeded day-5 table.
Holdings of 100+ need a few thousand dollars, which no one has early on, so
the chapter opens on day 5 of a strong game (net worths $3.6k-$5.2k; the
balance sims' winners finish near $26k). Your moves that teach nothing (other
rounds' passes, and the day-6/8/9 YesBank top-ups the copy reports) are played
off screen. end_day rotates the seats: day 5 Arjun, You, Meera -> day 10
Meera, Arjun, You.
  Day 5  You buy 5 YesBank ($5) -> 50: director. Bell: your -10 + Meera's +5
         would take YesBank $5 -> $0 (BANKRUPT); you discard the -10 -> $10.
  Day 6  You bought 50 more -> 100: chairman. Bell: your -5, Meera +10,
         Arjun -10 -> $5; you discard your -5 and remove Arjun's -10 -> $20.
  Day 7  Meera has been Cred's chairman (100). You buy the other 100 Cred:
         double director under her chair. Bell: $15 -> $20; Meera discards her
         -5 -> $25; you discard your -10 and -5 -> $40.
  Day 8  150 YesBank: chairman then director. Bell $20 -> $5; chairman (own
         -10 + Arjun's -10) -> $25; director (-5) -> $30.
  Day 9  You bought the last 50: all 200. Bell $30 -> $10; chairman (own -10 +
         Meera's -10) -> $30; double director (-5, -5) -> $40. TCS crashes
         $45 -> $5.
  Day 10 Meera (seated first) buys 100 TCS, Arjun 50. Your $400 buys 80, but
         only 50 remain: Max 50.
"""

from tutorial.scenario import Scenario

CAST = ["You", "Meera", "Arjun"]
VODAFONE, YESBANK, CRED, TCS, RELIANCE, INFOSYS = 1, 2, 3, 4, 5, 6
YOU, MEERA, ARJUN = 1, 2, 3
NAMES = ["Vodafone", "YesBank", "Cred", "TCS", "Reliance", "Infosys"]

# Closing prices of days 1-4 (day 5 opens on day 4's close).
CLOSES = [
    [20, 20, 30, 60, 80, 90],
    [15, 15, 25, 55, 85, 95],
    [15, 10, 20, 50, 90, 105],
    [10, 5, 15, 45, 95, 110],
]
PASS = {"type": "pass"}


def _cd(own, other_pid=None, other_idx=None):
    msg = {"type": "chairman_director", "discard_own_idx": own}
    if other_pid is not None:
        msg.update(discard_other_player_id=other_pid, discard_other_idx=other_idx)
    return msg


def _buy(company, qty):
    return {"type": "buy", "company_num": company, "quantity": qty}


def build():
    s = Scenario("chairman-director", CAST)
    g = s.game
    by_id = {p.id: p for p in g.players}
    g.players = [by_id[ARJUN], by_id[YOU], by_id[MEERA]]  # day-5 seats
    s.setup(
        day=5,
        round=0,
        current_turn=0,
        prices=dict(zip(NAMES, CLOSES[-1])),
        price_history=CLOSES,
        networth_history=[
            {YOU: 600, MEERA: 600, ARJUN: 600},
            {YOU: 1500, MEERA: 1200, ARJUN: 1100},
            {YOU: 2700, MEERA: 2300, ARJUN: 2000},
            {YOU: 4000, MEERA: 3300, ARJUN: 2900},
            {YOU: 5150, MEERA: 4100, ARJUN: 3600},
        ],
        cash={YOU: 4925, MEERA: 2600, ARJUN: 1700},
        stocks={YOU: {"YesBank": 45}, MEERA: {"Cred": 100}, ARJUN: {"Reliance": 20}},
        hands={
            YOU: ["YesBank-10", "Infosys+10"],
            MEERA: ["YesBank+5", "Reliance-5"],
            ARJUN: ["Reliance+10", "Vodafone+5"],
        },
    )

    # ── Day 5: seats Arjun, You, Meera — reach director, discard your own ──
    s.act(ARJUN, _buy(RELIANCE, 4))
    s.snap("d5")
    s.act(YOU, _buy(YESBANK, 5))
    s.snap("d5-bought")
    s.act(MEERA, PASS)
    for _ in range(2):
        for pid in (ARJUN, YOU, MEERA):
            s.act(pid, PASS)
    s.snap("bell5")
    s.act(YOU, _cd(0), early_snap="cd5")

    # ── Day 6: seats You, Meera, Arjun — chairman ──
    s.next_day({
        YOU: ["YesBank-5", "Vodafone-5"],
        MEERA: ["YesBank+10", "Infosys-10"],
        ARJUN: ["YesBank-10", "Reliance+5"],
    })
    s.act(YOU, _buy(YESBANK, 50))
    s.act(MEERA, PASS)
    s.act(ARJUN, _buy(RELIANCE, 2))
    for pid in (YOU, MEERA, ARJUN):
        s.act(pid, PASS)
    s.act(YOU, PASS)
    s.act(MEERA, PASS)
    s.snap("d6")
    s.act(ARJUN, PASS)
    s.snap("bell6")
    s.act(YOU, _cd(0, ARJUN, 0), early_snap="cd6")

    # ── Day 7: seats Meera, Arjun, You — double director under Meera's chair ──
    s.next_day({
        YOU: ["Cred-10", "Cred-5", "Reliance+5"],
        MEERA: ["Cred-5", "Cred+15", "Vodafone+5"],
        ARJUN: ["Cred+10", "Infosys+5"],
    })
    s.act(MEERA, _buy(VODAFONE, 10))
    s.act(ARJUN, _buy(INFOSYS, 2))
    s.snap("d7")
    s.act(YOU, _buy(CRED, 100))
    s.snap("d7-bought")
    for _ in range(2):
        for pid in (MEERA, ARJUN, YOU):
            s.act(pid, PASS)
    s.snap("bell7")
    s.act(MEERA, _cd(0), early_snap="cd7-meera")
    s.act(YOU, _cd([0, 1]), early_snap="cd7")

    # ── Day 8: seats Arjun, You, Meera — 150: chairman, then director ──
    s.next_day({
        YOU: ["YesBank-10", "YesBank-5", "Infosys-5"],
        MEERA: ["YesBank+10", "Reliance+10"],
        ARJUN: ["YesBank-10", "Vodafone-5"],
    })
    s.act(ARJUN, PASS)
    s.act(YOU, _buy(YESBANK, 50))
    s.act(MEERA, _buy(RELIANCE, 3))
    for pid in (ARJUN, YOU, MEERA):
        s.act(pid, PASS)
    s.act(ARJUN, PASS)
    s.act(YOU, PASS)
    s.snap("d8")
    s.act(MEERA, PASS)
    s.snap("bell8")
    s.act(YOU, _cd(0, ARJUN, 0), early_snap="cd8-chair")
    s.act(YOU, _cd(0), early_snap="cd8")

    # ── Day 9: seats You, Meera, Arjun — 200: chairman + double director ──
    s.next_day({
        YOU: ["YesBank-10", "YesBank-5", "YesBank-5", "TCS-5"],
        MEERA: ["YesBank-10", "TCS-20"],
        ARJUN: ["YesBank+10", "TCS-15"],
    })
    s.act(YOU, _buy(YESBANK, 50))
    for _ in range(2):
        s.act(MEERA, PASS)
        s.act(ARJUN, PASS)
        s.act(YOU, PASS)
    s.act(MEERA, PASS)
    s.snap("d9")
    s.act(ARJUN, PASS)
    s.snap("bell9")
    s.act(YOU, _cd(0, MEERA, 0), early_snap="cd9-chair")
    s.act(YOU, _cd([0, 1]), early_snap="cd9")

    # ── Day 10: seats Meera, Arjun, You — TCS at $5, first come first served ──
    s.next_day({
        YOU: ["TCS+10", "Vodafone+5"],
        MEERA: ["TCS+15"],
        ARJUN: ["TCS+5"],
    })
    s.snap("d10-dawn")
    s.act(MEERA, _buy(TCS, 100))
    s.snap("d10-meera")
    s.act(ARJUN, _buy(TCS, 50))
    s.snap("d10")
    s.act(YOU, _buy(TCS, 50))
    s.snap("d10-bought")
    return s
