"""Balance analysis from bot self-play.

Cards are dealt at random every day, so holding a card is a randomized
experiment: the average change in a player's share of table wealth on days
they hold card X, minus days they don't, is an unbiased estimate of what X
is worth. Same idea for seats. Exploits are checked by pitting degenerate
strategies against the real bots.

    python analyze.py --games 600 --out results/analysis.json
"""

from __future__ import annotations

import argparse
import json
import os
import statistics as st
import sys
from collections import defaultdict
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import sim  # noqa: E402
from evaluate import tournament  # noqa: E402
from engine.constants import COMPANY_NAMES, POWER_CARD_NAMES  # noqa: E402


def _play(args):
    lineup, seed = args
    k = seed % len(lineup)
    rotated = lineup[k:] + lineup[:k]
    return sim.play_game(rotated, seed, record=True)


def collect(lineup, games, seed0, procs):
    with Pool(procs) as pool:
        return pool.map(_play, [(list(lineup), seed0 + i) for i in range(games)], chunksize=4)


def mean_ci(xs):
    if len(xs) < 2:
        return (xs[0] if xs else 0.0), 0.0
    return st.mean(xs), 1.96 * st.stdev(xs) / len(xs) ** 0.5


def card_effects(outs):
    """Effect of holding each card on the day's change in share of table wealth (pp)."""
    power_with = defaultdict(list)
    power_without = defaultdict(list)
    comp_card = defaultdict(list)
    all_gain = []
    for o in outs:
        for d in o["trace"]["days"]:
            start, end = d["start_nw"], d["end_nw"]
            ts, te = sum(start.values()), sum(end.values())
            if ts <= 0 or te <= 0:
                continue
            for pid, hand in d["hands"].items():
                gain = 100 * (end[pid] / te - start[pid] / ts)
                all_gain.append(gain)
                names = [n for n, _, p in hand if p]
                for pc in POWER_CARD_NAMES:
                    (power_with if pc in names else power_without)[pc].append(gain)
                for n, v, p in hand:
                    if not p:
                        comp_card[(n, v)].append(gain)
    base = st.mean(all_gain)
    power = {}
    for pc in POWER_CARD_NAMES:
        m1, ci = mean_ci(power_with[pc])
        m0 = st.mean(power_without[pc])
        power[pc.strip()] = {"effect_pp": m1 - m0, "ci95": ci, "n": len(power_with[pc])}
    company = {}
    for (n, v), gains in sorted(comp_card.items(), key=lambda kv: (COMPANY_NAMES.index(kv[0][0]), kv[0][1])):
        m, ci = mean_ci(gains)
        company[f"{n} {v:+d}"] = {"effect_pp": m - base, "ci95": ci, "n": len(gains)}
    return power, company


def company_stats(outs):
    stats = {}
    for i, name in enumerate(COMPANY_NAMES):
        closed_games, days_closed, deltas, finals, winner_share = 0, 0, [], [], []
        for o in outs:
            closed_any = False
            for d in o["trace"]["days"]:
                if not d["open"][i]:
                    closed_any = True
                    days_closed += 1
                deltas.append(d["end_prices"][i] - d["start_prices"][i])
            closed_games += closed_any
            finals.append(o["final_prices"][i] if o["final_open"][i] else 0)
            w = o["results"][0]
            port = sum(w["stocks"][n] * (o["final_prices"][j] if o["final_open"][j] else 0)
                       for j, n in enumerate(COMPANY_NAMES))
            mine = w["stocks"][name] * (o["final_prices"][i] if o["final_open"][i] else 0)
            winner_share.append(mine / w["nw"] if w["nw"] else 0)
        stats[name] = {
            "closed_in_games_pct": 100 * closed_games / len(outs),
            "days_closed_per_game": days_closed / len(outs),
            "mean_daily_move": st.mean(deltas),
            "stdev_daily_move": st.pstdev(deltas),
            "median_final_price": st.median(finals),
            "winner_wealth_share_pct": 100 * st.mean(winner_share),
        }
    return stats


def action_stats(outs):
    counts = defaultdict(int)
    turns = 0
    for o in outs:
        for d in o["trace"]["days"]:
            for _, msg in d["actions"]:
                counts[msg["type"]] += 1
                if msg["type"] in ("buy", "sell", "pass", "loan_stock", "rights_issue", "debenture"):
                    turns += 1
    return {k: round(100 * v / turns, 1) for k, v in sorted(counts.items(), key=lambda kv: -kv[1])}, turns


def role_stats(outs):
    """How often companies have a chairman, and the price drift with/without one."""
    with_chair, without = [], []
    for o in outs:
        for d in o["trace"]["days"]:
            for i, n in enumerate(COMPANY_NAMES):
                if not d["open"][i] and d["start_prices"][i] == 0:
                    continue
                mv = d["end_prices"][i] - d["start_prices"][i]
                (with_chair if d["roles"]["chairman"][n] is not None else without).append(mv)
    return {
        "chairman_days_pct": 100 * len(with_chair) / max(1, len(with_chair) + len(without)),
        "drift_with_chairman": st.mean(with_chair) if with_chair else None,
        "drift_without_chairman": st.mean(without) if without else None,
    }


def seat_stats(outs, n):
    wins = [0.0] * n
    for o in outs:
        # seat = original turn position (player id - 1); turn order rotates daily.
        for r in o["results"]:
            wins[r["id"] - 1] += r["win"]
    return [round(100 * w / len(outs), 1) for w in wins]


def lead_stability(outs):
    """How often the day-5 leader wins — high means the game is decided early."""
    hits = 0
    for o in outs:
        days = o["trace"]["days"]
        if len(days) < 5:
            continue
        d5 = days[4]["end_nw"]
        leader = max(d5, key=d5.get)
        hits += o["results"][0]["id"] == leader
    return 100 * hits / len(outs)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--games", type=int, default=600)
    ap.add_argument("--procs", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "results", "analysis.json"))
    a = ap.parse_args()
    report = {}

    for label, lineup in (("4x hard", ["hard"] * 4), ("4x medium", ["medium"] * 4)):
        outs = collect(lineup, a.games, 50_000, a.procs)
        power, comp = card_effects(outs)
        acts, turns = action_stats(outs)
        report[label] = {
            "power_cards": power,
            "company_cards": comp,
            "companies": company_stats(outs),
            "actions_pct_of_turns": acts,
            "roles": role_stats(outs),
            "seat_win_pct": seat_stats(outs, len(lineup)),
            "day5_leader_wins_pct": lead_stability(outs),
            "final_nw_median": st.median(r["nw"] for o in outs for r in o["results"]),
            "winner_nw_median": st.median(o["results"][0]["nw"] for o in outs),
        }
        print(f"[{label}] done", flush=True)

    for n in (2, 3, 6):
        outs = collect(["hard"] * n, a.games // 2, 60_000 + n, a.procs)
        report[f"{n}x hard seats"] = {"seat_win_pct": seat_stats(outs, n),
                                      "day5_leader_wins_pct": lead_stability(outs)}

    exploits = {}
    for strat in ("passive", "random", "momentum", "hoard:1", "hoard:2", "hoard:3",
                  "hoard:4", "hoard:5", "hoard:6"):
        for field in ("easy", "medium"):
            res = tournament([strat, field, field, field], a.games // 2, seed0=70_000, procs=a.procs)
            exploits[f"{strat} vs 3x {field}"] = round(100 * res["table"][strat]["win"], 1)
    report["exploits_win_pct"] = exploits

    ladder = {}
    for lu in (["hard", "medium", "medium", "medium"], ["hard", "easy", "easy", "easy"],
               ["medium", "easy", "easy", "easy"], ["easy", "medium", "hard", "hard"]):
        res = tournament(lu, a.games, seed0=80_000, procs=a.procs)
        ladder[" vs ".join(lu)] = {k: round(100 * v["win"], 1) for k, v in res["table"].items()}
    report["ladder_win_pct"] = ladder

    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w") as fh:
        json.dump(report, fh, indent=1, default=float)
    print(json.dumps(report, indent=1, default=float))


if __name__ == "__main__":
    main()
