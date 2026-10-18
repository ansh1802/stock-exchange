"""Compare rule variants on the balance metrics that flagged problems.

    python compare_variants.py --games 400 baseline chairman_own_only suspend_1 ...

Each variant runs in its own subprocess (BALANCE_VARIANT is read at import).
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

CHILD = r"""
import json, sys, statistics as st
sys.path.insert(0, %(here)r)
import analyze
from evaluate import tournament
games = %(games)d
outs = analyze.collect(["hard"] * 4, games, 123_000, %(procs)d)
power, _ = analyze.card_effects(outs)
comp = analyze.company_stats(outs)
roles = analyze.role_stats(outs)
gap = tournament(["hard", "medium", "medium", "medium"], games // 2, seed0=124_000, procs=%(procs)d)
print(json.dumps({
    "ShareSuspend_pp": power["ShareSuspend"]["effect_pp"],
    "LoanStock_pp": power["LoanStock"]["effect_pp"],
    "Debenture_pp": power["Debenture"]["effect_pp"],
    "RightsIssue_pp": power["RightsIssue"]["effect_pp"],
    "chairman_drift": roles["drift_with_chairman"],
    "no_chairman_drift": roles["drift_without_chairman"],
    "chairman_days_pct": roles["chairman_days_pct"],
    "day5_leader_wins_pct": analyze.lead_stability(outs),
    "infosys_closed_games_pct": comp["Infosys"]["closed_in_games_pct"],
    "winner_nw_median": st.median(o["results"][0]["nw"] for o in outs),
    "hard_vs_3medium_win_pct": 100 * gap["table"]["hard"]["win"],
    "engine_errors": sum(o["errors"] for o in outs),
}))
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("variants", nargs="+")
    ap.add_argument("--games", type=int, default=400)
    ap.add_argument("--procs", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    a = ap.parse_args()
    out = {}
    for v in a.variants:
        env = dict(os.environ, BALANCE_VARIANT="" if v == "baseline" else v)
        code = CHILD % {"here": HERE, "games": a.games, "procs": a.procs}
        r = subprocess.run([sys.executable, "-c", code], env=env, cwd=HERE,
                           capture_output=True, text=True)
        if r.returncode:
            print(r.stderr)
            raise SystemExit(1)
        out[v] = json.loads(r.stdout.strip().splitlines()[-1])
        print(v, json.dumps({k: round(x, 2) for k, x in out[v].items()}), flush=True)
    with open(os.path.join(HERE, "results", "variants.json"), "w") as fh:
        json.dump(out, fh, indent=1)


if __name__ == "__main__":
    main()
