"""Tune the hard bot's weights by self-play (cross-entropy method).

Each candidate plays a seat-rotated table against copies of the current hard
profile, on the same seeds as every other candidate (common random numbers),
so differences come from the weights, not the deal. No AI model is called —
the output is a static parameter set to paste into backend/bots/params.py.

    python tune.py --gens 8 --pop 12 --games 240
"""

from __future__ import annotations

import argparse
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from evaluate import tournament  # noqa: E402
from sim import BACKEND  # noqa: E402

sys.path.insert(0, BACKEND)
from bots.params import PARAMS  # noqa: E402

BOUNDS = {
    "beta": (0.0, 1.5),
    "risk": (0.0, 0.6),
    "rel": (0.0, 1.0),
    "k_chair": (0.0, 5.0),
    "k_dir": (0.0, 3.0),
    "suspend_rel": (0.0, 1.0),
    "catchup": (0.0, 0.6),
}


def clamp(k, v):
    lo, hi = BOUNDS[k]
    return min(hi, max(lo, v))


def fitness(cand, opponents, games, seed):
    lineup = [("hard", cand, "cand")] + opponents
    res = tournament(lineup, games, seed0=seed)
    t = res["table"]["cand"]
    # Win rate first; average rank breaks ties between similar candidates.
    return t["win"] - 0.02 * (t["rank"] - 1), t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--gens", type=int, default=8)
    ap.add_argument("--pop", type=int, default=12)
    ap.add_argument("--games", type=int, default=240)
    ap.add_argument("--elite", type=float, default=0.25)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "results", "tune_log.json"))
    a = ap.parse_args()

    rng = random.Random(7)
    base = PARAMS["hard"]
    mean = {k: base[k] for k in BOUNDS}
    std = {k: (hi - lo) / 4 for k, (lo, hi) in BOUNDS.items()}
    log = []
    best = (None, -1e9)

    for g in range(a.gens):
        # Opponents: the current mean profile (self-play) + one medium for spread.
        opp = [("hard", dict(mean), "ref"), ("hard", dict(mean), "ref"), "medium"]
        seed = 1000 * (g + 1)
        pop = [dict(mean)]
        while len(pop) < a.pop:
            pop.append({k: clamp(k, rng.gauss(mean[k], std[k])) for k in BOUNDS})
        scored = []
        for cand in pop:
            f, t = fitness(cand, opp, a.games, seed)
            scored.append((f, cand, t))
            print(f"gen {g} fit {f:.3f} win {t['win']:.3f} rank {t['rank']:.2f} "
                  + " ".join(f"{k}={v:.2f}" for k, v in cand.items()), flush=True)
        scored.sort(key=lambda s: -s[0])
        n_el = max(2, int(a.pop * a.elite))
        elite = [c for _, c, _ in scored[:n_el]]
        for k in BOUNDS:
            vals = [e[k] for e in elite]
            m = sum(vals) / len(vals)
            sd = (sum((v - m) ** 2 for v in vals) / len(vals)) ** 0.5
            mean[k] = clamp(k, m)
            std[k] = max(sd, (BOUNDS[k][1] - BOUNDS[k][0]) * 0.03)
        if scored[0][0] > best[1]:
            best = (scored[0][1], scored[0][0])
        log.append({"gen": g, "mean": dict(mean), "std": dict(std),
                    "top": [{"fit": f, "params": c, "stats": t} for f, c, t in scored[:n_el]]})
        print(f"== gen {g} mean " + json.dumps({k: round(v, 3) for k, v in mean.items()}), flush=True)
        os.makedirs(os.path.dirname(a.out), exist_ok=True)
        with open(a.out, "w") as fh:
            json.dump({"log": log, "final_mean": mean}, fh, indent=1)

    print("\nFINAL MEAN:", json.dumps({k: round(v, 3) for k, v in mean.items()}))


if __name__ == "__main__":
    main()
