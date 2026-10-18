"""Parallel tournaments with seat rotation.

    python evaluate.py                       # default difficulty ladder
    python evaluate.py hard medium medium medium -n 400
"""

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from multiprocessing import Pool

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import sim  # noqa: E402


def _label(spec):
    if isinstance(spec, (list, tuple)):
        return spec[2] if len(spec) > 2 else spec[0] + "*"
    return spec


def _run(args):
    lineup, seed = args
    # Rotate seats so every entrant sees every seat equally often.
    k = seed % len(lineup)
    rotated = lineup[k:] + lineup[:k]
    specs = [s[:2] if isinstance(s, (list, tuple)) else s for s in rotated]
    out = sim.play_game(specs, seed)
    for r in out["results"]:
        r["label"] = _label(rotated[r["id"] - 1])
    return out


def tournament(lineup, n_games=200, seed0=0, procs=None, keep=False):
    """Returns {label: {win, rank, nw, games}} (win/rank averaged per entrant seat)."""
    procs = procs or max(1, (os.cpu_count() or 2) - 1)
    jobs = [(list(lineup), seed0 + i) for i in range(n_games)]
    if procs > 1:
        with Pool(procs) as pool:
            outs = pool.map(_run, jobs, chunksize=max(1, n_games // (procs * 4)))
    else:
        outs = [_run(j) for j in jobs]
    agg = defaultdict(lambda: {"win": 0.0, "rank": 0.0, "nw": 0.0, "n": 0})
    errors = 0
    for o in outs:
        errors += o["errors"]
        for r in o["results"]:
            a = agg[r["label"]]
            a["win"] += r["win"]
            a["rank"] += r["rank"]
            a["nw"] += r["nw"]
            a["n"] += 1
    table = {}
    for lab, a in agg.items():
        table[lab] = {"win": a["win"] / a["n"], "rank": a["rank"] / a["n"] + 1,
                      "nw": a["nw"] / a["n"], "n": a["n"]}
    res = {"table": table, "errors": errors, "games": n_games}
    if keep:
        res["outs"] = outs
    return res


def print_table(title, res):
    print(f"\n{title}  ({res['games']} games, engine errors: {res['errors']})")
    print(f"  {'entrant':<16}{'win%':>8}{'avg rank':>10}{'avg NW':>12}")
    for lab, t in sorted(res["table"].items(), key=lambda kv: -kv[1]["win"]):
        print(f"  {lab:<16}{100 * t['win']:>7.1f}%{t['rank']:>10.2f}{t['nw']:>12.0f}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("lineup", nargs="*")
    ap.add_argument("-n", type=int, default=200)
    ap.add_argument("--seed", type=int, default=0)
    a = ap.parse_args()
    if a.lineup:
        print_table(" vs ".join(a.lineup), tournament(a.lineup, a.n, a.seed))
    else:
        for lu in (["easy", "medium", "hard", "hard"],
                   ["hard", "medium", "medium", "medium"],
                   ["medium", "easy", "easy", "easy"],
                   ["hard", "easy", "easy", "easy"]):
            print_table(" vs ".join(lu), tournament(lu, a.n, a.seed))
