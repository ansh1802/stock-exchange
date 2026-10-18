"""Headless game runner for bot self-play and balance analysis.

Drives the real engine with bots, no server, no network. Importing this
module swaps the engine's result() builder for a cheap one (no to_dict()
per action) — only import it from offline tooling, never from the server.
"""

from __future__ import annotations

import os
import random
import sys

BACKEND = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if BACKEND not in sys.path:
    sys.path.insert(0, BACKEND)

import engine.actions as _A  # noqa: E402
import engine.helpers as _H  # noqa: E402
import engine.leave as _L  # noqa: E402
import engine.phases as _P  # noqa: E402


def _fast_result(success, message, game_state):
    return {"success": success, "message": message}


for _m in (_A, _H, _L, _P):
    _m.result = _fast_result

import engine as ge  # noqa: E402
from engine.constants import COMPANY_NAMES, POWER_CARD_NAMES  # noqa: E402
from bots.policy import Bot  # noqa: E402
from strategies import make_strategy  # noqa: E402
import variants  # noqa: E402

ACTIVE_VARIANTS = variants.apply_from_env()


def dispatch(game, pid, msg):
    t = msg["type"]
    if t == "buy":
        return ge.buy_stock(game, pid, msg["company_num"], msg["quantity"])
    if t == "sell":
        return ge.sell_stock(game, pid, msg["company_num"], msg["quantity"])
    if t == "pass":
        return ge.pass_turn(game, pid)
    if t == "loan_stock":
        return ge.use_loan_stock(game, pid)
    if t == "debenture":
        return ge.use_debenture(game, pid, msg["company_num"])
    if t == "rights_issue":
        return ge.use_rights_issue(game, pid, msg["company_num"])
    if t == "rights_issue_buy":
        return ge.rights_issue_buy(game, pid, msg["quantity"])
    if t == "share_suspend":
        return ge.share_suspend_action(game, pid, msg.get("company_num", 0))
    if t == "chairman_director":
        return ge.chairman_director_action(
            game, pid, msg["discard_own_idx"],
            msg.get("discard_other_player_id"), msg.get("discard_other_idx"))
    if t == "reveal_complete":
        return ge.complete_card_reveal(game, pid)
    raise ValueError(t)


FALLBACK = {
    "player_turn": {"type": "pass"},
    "rights_issue": {"type": "rights_issue_buy", "quantity": 0},
    "share_suspend": {"type": "share_suspend", "company_num": 0},
    "card_reveal": {"type": "chairman_director", "discard_own_idx": -1},
}


def active_pid(game):
    ph = game.game_phase
    if ph == "rights_issue" and game.rights_issue_queue:
        return game.rights_issue_queue[0]
    if ph == "share_suspend" and game.suspend_queue:
        return game.suspend_queue[0]
    if ph == "card_reveal" and game.chairman_director_queue:
        return game.chairman_director_queue[0][0]
    if ph == "player_turn":
        return game.players[game.current_turn].id
    return None


def net_worth(p, game):
    return p.cash + sum(p.stocks[c.name] * c.value for c in game.companies if c.open)


def make_agent(pid, spec, seed):
    """spec: "easy" | "medium" | "hard" | ("hard", {param overrides}) | strategy name."""
    params = None
    if isinstance(spec, (tuple, list)):
        spec, params = spec
    if spec in ("easy", "medium", "hard"):
        return Bot(pid, spec, params=params, seed=seed)
    return make_strategy(spec, pid, seed, params)


def play_game(specs, seed, record=False):
    """Play one full game. Returns per-player results (+ a trace if record)."""
    random.seed(seed)
    n = len(specs)
    game = ge.GameState(n)
    agents = {i + 1: make_agent(i + 1, s, seed * 31 + i) for i, s in enumerate(specs)}
    errors = 0
    trace = {"days": []} if record else None
    day_rec = None

    def observe_all():
        for a in agents.values():
            a.observe(game)

    steps = 0
    while game.game_phase != "game_over":
        steps += 1
        if steps > 20000:
            raise RuntimeError("game did not terminate")
        ph = game.game_phase
        if ph == "dealing":
            ge.deal_cards(game)
            if record:
                day_rec = {
                    "day": game.current_day,
                    "start_prices": [c.value for c in game.companies],
                    "start_nw": {p.id: net_worth(p, game) for p in game.players},
                    "hands": {p.id: [(c.company_name, (c.value if c.positive else -c.value), c.is_power)
                                     for c in p.hand] for p in game.players},
                    "actions": [],
                    "roles": None,
                }
            observe_all()
            continue
        if ph == "card_reveal" and not game.reveal_data:
            if record:
                day_rec["pre_reveal_holdings"] = {p.id: dict(p.stocks) for p in game.players}
                day_rec["roles"] = {
                    "chairman": dict(game.chairman),
                    "directors": {k: list(v) for k, v in game.directors.items()},
                }
            ge.begin_card_reveal(game)
            continue
        if ph == "day_end":
            if record:
                day_rec["end_prices"] = [c.value for c in game.companies]
                day_rec["open"] = [c.open for c in game.companies]
                day_rec["end_nw"] = {p.id: net_worth(p, game) for p in game.players}
                day_rec["reveal"] = [
                    {"company": r["company_name"], "delta": r["delta"]} for r in game.reveal_data
                ]
                trace["days"].append(day_rec)
            ge.end_day(game)
            continue

        pid = active_pid(game)
        if pid is None and ph == "card_reveal":
            # Everyone acks; bots return reveal_complete.
            for p in game.players:
                if not p.left and p.id not in game.reveal_complete_players:
                    ge.complete_card_reveal(game, p.id)
                    if game.game_phase != "card_reveal":
                        break
            observe_all()
            continue

        msg = agents[pid].act(game)
        if msg is None:
            msg = FALLBACK[ph]
        if record:
            day_rec["actions"].append((pid, msg))
        r = dispatch(game, pid, msg)
        if not r["success"]:
            errors += 1
            if record:
                day_rec["actions"].append((pid, {"type": "ERROR", "msg": msg, "err": r["message"]}))
            dispatch(game, pid, FALLBACK[ph])
        observe_all()

    results = []
    for p in game.players:
        results.append({
            "id": p.id,
            "spec": specs[p.id - 1] if isinstance(specs[p.id - 1], str) else specs[p.id - 1][0],
            "seat": p.id - 1,
            "nw": net_worth(p, game),
            "cash": p.cash,
            "stocks": dict(p.stocks),
        })
    results.sort(key=lambda r: -r["nw"])
    best = results[0]["nw"]
    winners = [r for r in results if r["nw"] == best]
    for rank, r in enumerate(results):
        r["rank"] = rank
        r["win"] = (1.0 / len(winners)) if r["nw"] == best else 0.0
    out = {"results": results, "errors": errors,
           "final_prices": [c.value for c in game.companies],
           "final_open": [c.open for c in game.companies],
           "price_history": [list(d) for d in game.price_history]}
    if record:
        out["trace"] = trace
    return out


if __name__ == "__main__":
    import json
    import time
    t = time.time()
    res = play_game(["easy", "medium", "hard", "hard"], seed=1)
    print(json.dumps({k: v for k, v in res.items() if k != "trace"}, indent=1, default=str))
    print("elapsed", round(time.time() - t, 2), "s")
    _ = (COMPANY_NAMES, POWER_CARD_NAMES)
