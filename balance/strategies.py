"""Degenerate reference strategies for exploit hunting (sim-only).

  passive     — never trades; holds starting cash.
  random      — random legal trade each turn.
  hoard:<n>   — dumps all cash into company n (1-6) and never sells.
  momentum    — buys whatever rose most yesterday, sells what fell.
"""

from __future__ import annotations

import random

from engine.constants import COMPANY_NAMES


class _Base:
    def __init__(self, pid, seed):
        self.id = pid
        self.rng = random.Random(seed)

    def observe(self, game):
        pass

    def me(self, game):
        return next(p for p in game.players if p.id == self.id)

    def act(self, game):
        ph = game.game_phase
        if ph == "player_turn":
            if game.players[game.current_turn].id == self.id:
                return self.turn(game, self.me(game))
            return None
        if ph == "rights_issue":
            return {"type": "rights_issue_buy", "quantity": 0}
        if ph == "share_suspend":
            return {"type": "share_suspend", "company_num": 0}
        if ph == "card_reveal":
            if game.chairman_director_queue:
                return {"type": "chairman_director", "discard_own_idx": -1}
            return {"type": "reveal_complete"}
        return None

    def turn(self, game, me):
        return {"type": "pass"}

    def buy_max(self, game, me, i):
        c = game.companies[i]
        if not c.open or c.value <= 0:
            return None
        q = min(game.available_shares[i], int(me.cash / c.value))
        return {"type": "buy", "company_num": i + 1, "quantity": q} if q > 0 else None


class Passive(_Base):
    pass


class RandomTrader(_Base):
    def turn(self, game, me):
        r = self.rng.random()
        if r < 0.5:
            i = self.rng.randrange(6)
            return self.buy_max(game, me, i) or {"type": "pass"}
        if r < 0.8:
            held = [i for i, n in enumerate(COMPANY_NAMES) if me.stocks[n] > 0 and game.companies[i].open]
            if held:
                i = self.rng.choice(held)
                return {"type": "sell", "company_num": i + 1, "quantity": me.stocks[COMPANY_NAMES[i]]}
        return {"type": "pass"}


class Hoarder(_Base):
    def __init__(self, pid, seed, company):
        super().__init__(pid, seed)
        self.i = company - 1

    def turn(self, game, me):
        return self.buy_max(game, me, self.i) or {"type": "pass"}


class Momentum(_Base):
    def turn(self, game, me):
        hist = game.price_history
        if not hist:
            return self.buy_max(game, me, self.rng.randrange(6)) or {"type": "pass"}
        prev = hist[-2] if len(hist) >= 2 else [c.base_value for c in game.companies]
        moves = [hist[-1][i] - prev[i] for i in range(6)]
        for i in sorted(range(6), key=lambda j: moves[j]):
            if moves[i] < 0 and me.stocks[COMPANY_NAMES[i]] > 0 and game.companies[i].open:
                return {"type": "sell", "company_num": i + 1, "quantity": me.stocks[COMPANY_NAMES[i]]}
        best = max(range(6), key=lambda j: moves[j])
        return self.buy_max(game, me, best) or {"type": "pass"}


def make_strategy(name, pid, seed, params=None):
    if name == "passive":
        return Passive(pid, seed)
    if name == "random":
        return RandomTrader(pid, seed)
    if name == "momentum":
        return Momentum(pid, seed)
    if name.startswith("hoard:"):
        return Hoarder(pid, seed, int(name.split(":")[1]))
    raise ValueError(f"unknown strategy {name}")
