"""Static (token-free) bot players.

A bot reads the GameState directly but only uses what its seat could see:
its own hand, prices, everyone's cash/holdings, chairman/director seats, and
(during card_reveal, when every hand is public) the revealed cards.

Difficulties:
  easy   — noisy rules of thumb from its own cards; passes and misplays often.
  medium — exact expected value of each company from its own hand
           (others' cards average out), one-move greedy.
  hard   — samples the hidden hands, reweights them by what opponents traded,
           models chairman/director discards and its own Share Suspend
           protection, adds a risk term and looks two of its own moves ahead.

`Bot.act(game)` returns a client-format message dict (same shape the
frontend sends) or None when the bot has nothing to do right now.
"""

from __future__ import annotations

import math
import random
from collections import Counter

from engine.constants import (
    CARDS_PER_HAND,
    CHAIRMAN_THRESHOLD,
    COMPANY_BASE_VALUES,
    COMPANY_NAMES,
    CURRENCY_RATE,
    DIRECTOR_THRESHOLD,
    MAX_DAYS,
)
from engine.deck import build_deck

from .params import PARAMS

NC = len(COMPANY_NAMES)
IDX = {name: i for i, name in enumerate(COMPANY_NAMES)}
DIFFICULTIES = ("easy", "medium", "hard")


def _signed(card):
    return card.value if card.positive else -card.value


def _player(game, pid):
    for p in game.players:
        if p.id == pid:
            return p
    return None


def _net_worth(p, game, values=None):
    nw = p.cash
    for i, c in enumerate(game.companies):
        v = c.value if values is None else values[i]
        if p.stocks[c.name] > 0 and (c.open or values is not None):
            nw += p.stocks[c.name] * v
    return nw


class _Plan:
    """A hypothetical version of my position after some actions this turn."""

    __slots__ = ("cash", "h", "avail", "price", "open", "power", "penalty")

    def copy(self):
        n = _Plan()
        n.cash = self.cash
        n.h = list(self.h)
        n.avail = list(self.avail)
        n.price = list(self.price)
        n.open = list(self.open)
        n.power = dict(self.power)
        n.penalty = self.penalty
        return n


class Bot:
    def __init__(self, player_id, difficulty="medium", params=None, seed=None):
        if difficulty not in PARAMS:
            raise ValueError(f"unknown difficulty {difficulty}")
        self.id = player_id
        self.difficulty = difficulty
        self.p = dict(PARAMS[difficulty])
        if params:
            self.p.update(params)
        self.rng = random.Random(seed)
        self._day = None
        self._day_start_stocks = {}
        self._particles = None   # list of {opp_id: [[signed values] per company]}
        self._opps = []
        self._noise = [0.0] * NC
        self._cache = {}

    # ── Observation ──────────────────────────────────────────────────────

    def observe(self, game):
        """Call after every state change; snapshots the start of each day."""
        if game.game_phase not in ("player_turn", "rights_issue"):
            return
        if self._day == game.current_day:
            return
        me = _player(game, self.id)
        if me is None or me.left:
            return
        self._day = game.current_day
        self._day_start_stocks = {p.id: dict(p.stocks) for p in game.players}
        self._opps = [p.id for p in game.players if p.id != self.id and not p.left]
        self._noise = [self.rng.gauss(0, self.p.get("noise", 0.0)) for _ in range(NC)]
        self._cache = {}
        self._particles = None
        if self.p.get("particles"):
            self._build_particles(me)

    def _build_particles(self, me):
        mine = Counter((c.company_name, c.value, c.positive, c.is_power) for c in me.hand)
        remaining = []
        for c in build_deck():
            key = (c.company_name, c.value, c.positive, c.is_power)
            if mine[key] > 0:
                mine[key] -= 1
            else:
                remaining.append(key)
        parts = []
        for _ in range(self.p["particles"]):
            self.rng.shuffle(remaining)
            hands = {}
            pos = 0
            for oid in self._opps:
                per = [[] for _ in range(NC)]
                for name, val, positive, is_power in remaining[pos:pos + CARDS_PER_HAND]:
                    if not is_power:
                        per[IDX[name]].append(val if positive else -val)
                hands[oid] = per
                pos += CARDS_PER_HAND
            parts.append(hands)
        self._particles = parts

    # ── Entry point ──────────────────────────────────────────────────────

    def act(self, game):
        self.observe(game)
        me = _player(game, self.id)
        if me is None or me.left:
            return None
        phase = game.game_phase

        if phase == "player_turn":
            if game.players[game.current_turn].id != self.id:
                return None
            if self.p["mode"] == "easy":
                return self._easy_turn(game, me)
            return self._ev_turn(game, me)

        if phase == "rights_issue":
            if game.rights_issue_queue and game.rights_issue_queue[0] == self.id:
                return self._rights_issue_buy(game, me)
            return None

        if phase == "share_suspend":
            if game.suspend_queue and game.suspend_queue[0] == self.id:
                return self._share_suspend(game, me)
            return None

        if phase == "card_reveal" and game.reveal_data:
            if game.chairman_director_queue:
                if game.chairman_director_queue[0][0] == self.id:
                    return self._chairman_director(game, me)
                return None
            if self.id not in game.reveal_complete_players:
                return {"type": "reveal_complete"}
        return None

    # ── Shared helpers ───────────────────────────────────────────────────

    def _own_cards(self, me, c):
        name = COMPANY_NAMES[c]
        return [_signed(card) for card in me.hand if not card.is_power and card.company_name == name]

    def _power(self, me):
        cnt = Counter(c.company_name for c in me.hand if c.is_power)
        return {
            "LoanStock": cnt["LoanStock"],
            "RightsIssue": cnt["RightsIssue"],
            "Debenture": cnt["Debenture"],
            "ShareSuspend": cnt["ShareSuspend"],
            "Currency + ": cnt["Currency + "],
            "Currency - ": cnt["Currency - "],
        }

    def _cash_mult(self, me):
        power = self._power(me)
        return (1 + CURRENCY_RATE) ** power["Currency + "] * (1 - CURRENCY_RATE) ** power["Currency - "]

    def _mean_delta(self, game, me, c):
        """Closed-form E[company delta] from my hand: the rest of the deck sums
        to -own, and opponents hold a known fraction of it."""
        own = sum(self._own_cards(me, c))
        n_opp = len(self._opps) or sum(1 for p in game.players if p.id != self.id and not p.left)
        unseen = 100 - CARDS_PER_HAND
        return own * (1 - n_opp * CARDS_PER_HAND / unseen)

    # ── Easy ─────────────────────────────────────────────────────────────

    def _easy_turn(self, game, me):
        rng, p = self.rng, self.p
        power = self._power(me)
        if rng.random() < p["pass_prob"]:
            return {"type": "pass"}
        if power["LoanStock"] and rng.random() < p["loan_prob"]:
            return {"type": "loan_stock"}
        if power["Debenture"] and rng.random() < p["power_prob"]:
            held_closed = [i for i, c in enumerate(game.companies) if not c.open and me.stocks[c.name] > 0]
            if held_closed:
                return {"type": "debenture", "company_num": rng.choice(held_closed) + 1}
        if power["RightsIssue"] and rng.random() < p["power_prob"]:
            held = [i for i, c in enumerate(game.companies) if c.open and me.stocks[c.name] > 1]
            if held:
                return {"type": "rights_issue", "company_num": rng.choice(held) + 1}

        reads = [sum(self._own_cards(me, i)) + self._noise[i] for i in range(NC)]
        # Dump something that looks bad.
        bad = [i for i in range(NC)
               if reads[i] < 0 and me.stocks[COMPANY_NAMES[i]] > 0 and game.companies[i].open]
        if bad and rng.random() < p["sell_prob"]:
            i = min(bad, key=lambda j: reads[j])
            return {"type": "sell", "company_num": i + 1, "quantity": me.stocks[COMPANY_NAMES[i]]}

        options = [i for i, c in enumerate(game.companies)
                   if c.open and c.value > 0 and game.available_shares[i] > 0
                   and int(me.cash / c.value) > 0]
        if not options:
            return {"type": "pass"}
        best = max(options, key=lambda j: reads[j])
        if reads[best] <= 0:
            if rng.random() < 0.6:
                return {"type": "pass"}
            best = rng.choice(options)
        c = game.companies[best]
        qmax = min(game.available_shares[best], int(me.cash / c.value))
        q = max(1, int(qmax * rng.uniform(p["buy_frac_min"], 1.0)))
        return {"type": "buy", "company_num": best + 1, "quantity": q}

    # ── EV model (medium / hard) ─────────────────────────────────────────

    def _role_of(self, game, c, h):
        """(is_chairman, own_discards) I'd have in company c holding h shares."""
        if not self.p["roles"]:
            return (False, 0)
        name = COMPANY_NAMES[c]
        chair = game.chairman[name]
        dirs = game.directors[name]
        if h >= CHAIRMAN_THRESHOLD and chair in (None, self.id):
            extra = 2 if h >= 2 * CHAIRMAN_THRESHOLD else (1 if h >= CHAIRMAN_THRESHOLD + DIRECTOR_THRESHOLD else 0)
            return (True, extra)
        if h >= DIRECTOR_THRESHOLD and (self.id in dirs or len([d for d in dirs if d != self.id]) < 2):
            return (False, 2 if h >= CHAIRMAN_THRESHOLD else 1)
        return (False, 0)

    def _opp_roles(self, game, c):
        """[(opp_id, is_chairman, own_discards)] for opponents in company c."""
        if not self.p["roles"]:
            return ()
        name = COMPANY_NAMES[c]
        roles = []
        chair = game.chairman[name]
        if chair is not None and chair != self.id:
            hp = _player(game, chair)
            if hp and not hp.left:
                h = hp.stocks[name]
                extra = 2 if h >= 2 * CHAIRMAN_THRESHOLD else (1 if h >= CHAIRMAN_THRESHOLD + DIRECTOR_THRESHOLD else 0)
                roles.append((chair, True, 1 + extra))
        for d in game.directors[name]:
            if d == self.id:
                continue
            hp = _player(game, d)
            if hp and not hp.left:
                roles.append((d, False, 2 if hp.stocks[name] >= CHAIRMAN_THRESHOLD else 1))
        return tuple(roles)

    def _particle_deltas(self, game, me, c, my_role):
        """Per-particle company delta after everyone's chairman/director discards."""
        opp_roles = self._opp_roles(game, c)
        key = ("d", c, my_role, opp_roles)
        if key in self._cache:
            return self._cache[key]
        my_cards = self._own_cards(me, c)
        my_chair, my_disc = my_role
        out = []
        for hands in self._particles:
            if not my_chair and not my_disc and not opp_roles:
                out.append(sum(my_cards) + sum(sum(hands[o][c]) for o in hands))
                continue
            cards = {self.id: sorted(my_cards)}
            for o in hands:
                cards[o] = sorted(hands[o][c])
            # Chairman acts first: own worst card, then the worst card anyone else holds.
            chair_id = self.id if my_chair else next((o for o, ch, _ in opp_roles if ch), None)
            if chair_id is not None:
                own = cards[chair_id]
                if own and own[0] < 0:
                    own.pop(0)
                worst_pid, worst = None, 0
                for pid, cl in cards.items():
                    if pid != chair_id and cl and cl[0] < worst:
                        worst_pid, worst = pid, cl[0]
                if worst_pid is not None:
                    cards[worst_pid].pop(0)
            # Directors (incl. a chairman's extra director power) drop their worst cards.
            discs = [(self.id, my_disc)] if my_disc else []
            for o, ch, n in opp_roles:
                discs.append((o, n - 1 if ch else n))
            for pid, n in discs:
                cl = cards[pid]
                for _ in range(n):
                    if cl and cl[0] < 0:
                        cl.pop(0)
            out.append(sum(sum(cl) for cl in cards.values()))
        self._cache[key] = out
        return out

    def _weights(self, game):
        key = ("w", tuple((p.id, tuple(p.stocks.values())) for p in game.players))
        if key in self._cache:
            return self._cache[key]
        k = len(self._particles)
        beta = self.p.get("beta", 0.0) if self.p["infer"] else 0.0
        if beta == 0:
            w = [1.0 / k] * k
        else:
            dirs = {}
            for o in self._opps:
                p = _player(game, o)
                start = self._day_start_stocks.get(o, {})
                if p is None:
                    continue
                d = []
                for c, name in enumerate(COMPANY_NAMES):
                    diff = p.stocks[name] - start.get(name, 0)
                    d.append((1 if diff > 0 else -1 if diff < 0 else 0))
                dirs[o] = d
            logs = []
            for hands in self._particles:
                s = 0.0
                for o, d in dirs.items():
                    hc = hands.get(o)
                    if hc is None:
                        continue
                    for c in range(NC):
                        if d[c]:
                            s += d[c] * sum(hc[c]) / 10.0
                logs.append(beta * s)
            m = max(logs)
            w = [math.exp(x - m) for x in logs]
            tot = sum(w)
            w = [x / tot for x in w]
        self._cache[key] = w
        return w

    def _values(self, game, me, c, role, price, is_open, w):
        """(mean, var, per-particle values or None) of company c at day end."""
        key = ("v", c, role, price, is_open, id(w))
        if key in self._cache:
            return self._cache[key]
        if not is_open:
            res = (0.0, 0.0, None)
        elif self._particles is None:
            if self.p["mode"] == "easy":
                d = sum(self._own_cards(me, c)) + self._noise[c]
            else:
                d = self._mean_delta(game, me, c)
            res = (max(0.0, price + d), 0.0, None)
        else:
            deltas = self._particle_deltas(game, me, c, role)
            vals = [max(0, price + d) for d in deltas]
            mean = sum(wi * v for wi, v in zip(w, vals))
            var = sum(wi * (v - mean) ** 2 for wi, v in zip(w, vals))
            res = (mean, var, vals)
        self._cache[key] = res
        return res

    def _plan_from(self, game, me):
        pl = _Plan()
        pl.cash = me.cash
        pl.h = [me.stocks[n] for n in COMPANY_NAMES]
        pl.avail = list(game.available_shares)
        pl.price = [c.value for c in game.companies]
        pl.open = [c.open for c in game.companies]
        pl.power = self._power(me)
        pl.penalty = 0.0
        return pl

    def _utility(self, game, me, pl, ctx):
        w = ctx["w"]
        total = pl.cash * ctx["mult"] - pl.penalty
        var = 0.0
        days_after = MAX_DAYS - game.current_day
        held_vals = []
        for c in range(NC):
            h = pl.h[c]
            if h <= 0:
                continue
            role = self._role_of(game, c, h)
            mean, v, vals = self._values(game, me, c, role, pl.price[c], pl.open[c], w)
            total += h * mean
            var += h * h * v
            if role[0] or role[1]:
                total += days_after * h * (self.p["k_chair"] * role[0] + self.p["k_dir"] * role[1])
            if vals is not None and pl.open[c]:
                held_vals.append((h, pl.price[c], vals))
        if ctx["suspend"] and held_vals:
            # I can undo one company's move after the reveal: expected best swap.
            opt = 0.0
            for k, wk in enumerate(w):
                best = 0.0
                for h, price, vals in held_vals:
                    g = h * (price - vals[k])
                    if g > best:
                        best = g
                opt += wk * best
            total += opt
        if var > 0:
            total -= ctx["risk"] * math.sqrt(var)
        return total

    def _candidates(self, pl):
        yield ("pass",)
        for c in range(NC):
            price = pl.price[c]
            if pl.open[c] and pl.avail[c] > 0 and price > 0:
                qmax = min(pl.avail[c], int(pl.cash / price))
                if qmax > 0:
                    qs = {qmax}
                    if self.p["half"] and qmax > 1:
                        qs.add(qmax // 2)
                    if self.p["roles"]:
                        for t in (DIRECTOR_THRESHOLD, CHAIRMAN_THRESHOLD,
                                  CHAIRMAN_THRESHOLD + DIRECTOR_THRESHOLD, 2 * CHAIRMAN_THRESHOLD):
                            need = t - pl.h[c]
                            if 0 < need < qmax:
                                qs.add(need)
                    for q in qs:
                        yield ("buy", c, q)
        for c in range(NC):
            h = pl.h[c]
            if h > 0 and pl.open[c] and pl.price[c] > 0:
                qs = {h}
                if self.p["half"] and h > 1:
                    qs.add(h // 2)
                if self.p["roles"]:
                    for t in (DIRECTOR_THRESHOLD, CHAIRMAN_THRESHOLD):
                        if h > t:
                            qs.add(h - t)
                for q in qs:
                    yield ("sell", c, q)
        if pl.power["LoanStock"] > 0:
            yield ("loan",)
        if pl.power["RightsIssue"] > 0:
            for c in range(NC):
                if pl.open[c] and pl.h[c] > 1:
                    yield ("ri", c)
        if pl.power["Debenture"] > 0:
            for c in range(NC):
                if not pl.open[c]:
                    yield ("deb", c)

    def _apply(self, game, me, pl, a, ctx):
        n = pl.copy()
        kind = a[0]
        if kind == "buy":
            _, c, q = a
            n.cash -= q * n.price[c]
            n.h[c] += q
            n.avail[c] -= q
        elif kind == "sell":
            _, c, q = a
            n.cash += q * n.price[c]
            n.h[c] -= q
            n.avail[c] += q
        elif kind == "loan":
            nw = n.cash + sum(n.h[c] * n.price[c] for c in range(NC) if n.open[c])
            n.cash += max(5, (int(nw * 0.1) // 5) * 5)
            n.power["LoanStock"] -= 1
        elif kind == "ri":
            c = a[1]
            n.power["RightsIssue"] -= 1
            ri = max(5, (n.price[c] // 10) * 5)
            q = min(int(n.h[c] / 2), n.avail[c], int(n.cash / ri))
            n.cash -= q * ri
            n.h[c] += q
            n.avail[c] -= q
            # Everyone else holding it buys at the discount too.
            mean = self._values(game, me, c, (False, 0), n.price[c], True, ctx["w"])[0]
            gift = 0.0
            for o in self._opps:
                op = _player(game, o)
                oh = op.stocks[COMPANY_NAMES[c]] if op else 0
                if oh > 1:
                    oq = min(int(oh / 2), n.avail[c], int(op.cash / ri))
                    n.avail[c] -= oq
                    gift += oq * (mean - ri)
            n.penalty += self.p["rel"] * gift / max(1, len(self._opps))
        elif kind == "deb":
            c = a[1]
            n.power["Debenture"] -= 1
            n.open[c] = True
            n.price[c] = COMPANY_BASE_VALUES[c]
            mean = self._values(game, me, c, (False, 0), n.price[c], True, ctx["w"])[0]
            gift = sum(
                _player(game, o).stocks[COMPANY_NAMES[c]] * mean
                for o in self._opps if _player(game, o)
            )
            n.penalty += self.p["rel"] * gift / max(1, len(self._opps))
        return n

    def _ev_turn(self, game, me):
        power = self._power(me)
        risk = self.p["risk"]
        if self.p["catchup"] and game.current_day >= MAX_DAYS - 2:
            mine = _net_worth(me, game)
            best_opp = max((_net_worth(_player(game, o), game) for o in self._opps if _player(game, o)), default=0)
            if mine < best_opp:
                risk -= self.p["catchup"]
        ctx = {
            "w": self._weights(game) if self._particles else None,
            "mult": self._cash_mult(me),
            "suspend": power["ShareSuspend"] > 0 and self._particles is not None,
            "risk": risk,
        }
        base = self._plan_from(game, me)
        turns_left = game.rounds_per_day - game.current_round
        two_ply = self.p["ply"] >= 2 and turns_left >= 2

        best_a, best_score = ("pass",), None
        for a in self._candidates(base):
            p1 = self._apply(game, me, base, a, ctx)
            u1 = self._utility(game, me, p1, ctx)
            score = u1
            if two_ply and a[0] != "pass":
                for a2 in self._candidates(p1):
                    if a2[0] == "pass":
                        continue
                    u2 = self._utility(game, me, self._apply(game, me, p1, a2, ctx), ctx)
                    if u2 > score:
                        score = u2
            score += 1e-6 * u1  # among equal plans, do the better move first
            if best_score is None or score > best_score + 1e-9:
                best_a, best_score = a, score
        return self._to_msg(best_a)

    @staticmethod
    def _to_msg(a):
        kind = a[0]
        if kind == "buy":
            return {"type": "buy", "company_num": a[1] + 1, "quantity": a[2]}
        if kind == "sell":
            return {"type": "sell", "company_num": a[1] + 1, "quantity": a[2]}
        if kind == "loan":
            return {"type": "loan_stock"}
        if kind == "ri":
            return {"type": "rights_issue", "company_num": a[1] + 1}
        if kind == "deb":
            return {"type": "debenture", "company_num": a[1] + 1}
        return {"type": "pass"}

    # ── Sub-phase decisions ──────────────────────────────────────────────

    def _rights_issue_buy(self, game, me):
        c = game.rights_issue_company - 1
        name = COMPANY_NAMES[c]
        price = game.companies[c].value
        q = min(int(me.stocks[name] / 2), game.available_shares[c], int(me.cash / price) if price else 0)
        if q <= 0:
            return {"type": "rights_issue_buy", "quantity": 0}
        if self.p["mode"] == "easy":
            return {"type": "rights_issue_buy", "quantity": max(1, q // 2)}
        orig = game.rights_issue_original_value
        w = self._weights(game) if self._particles else None
        role = self._role_of(game, c, me.stocks[name] + q)
        mean = self._values(game, me, c, role, orig, True, w)[0]
        if mean > price * self._cash_mult(me):
            return {"type": "rights_issue_buy", "quantity": q}
        return {"type": "rights_issue_buy", "quantity": 0}

    def _share_suspend(self, game, me):
        prev = game.previous_values
        if not prev:
            return {"type": "share_suspend", "company_num": 0}
        cur = [c.value for c in game.companies]
        players = [p for p in game.players if not p.left]
        rel = self.p.get("suspend_rel", 0.0) if self.p["mode"] != "easy" else 0.0

        def score(values):
            nws = {p.id: p.cash + sum(p.stocks[n] * values[i] for i, n in enumerate(COMPANY_NAMES))
                   for p in players}
            others = [v for pid, v in nws.items() if pid != self.id]
            return nws[self.id] - rel * (max(others) if others else 0)

        def effective(values):
            # Closed companies are worth 0 unless the swap gives them a value.
            return [v if (game.companies[i].open or v > 0) else 0 for i, v in enumerate(values)]

        base = score(effective(cur))
        best_c, best_s = 0, base
        for i in range(NC):
            if prev[i] == cur[i]:
                continue
            vals = list(cur)
            vals[i] = prev[i]
            s = score(effective(vals))
            if self.p["mode"] == "easy":
                s += self.rng.gauss(0, 20)
            if s > best_s + 1e-9:
                best_c, best_s = i + 1, s
        return {"type": "share_suspend", "company_num": best_c}

    def _chairman_director(self, game, me):
        _, name, role = game.chairman_director_queue[0]
        own = [_signed(c) for c in me.hand if not c.is_power and c.company_name == name]
        neg = sorted((v, i) for i, v in enumerate(own) if v < 0)
        msg = {"type": "chairman_director", "discard_own_idx": -1}

        if role == "director":
            if neg:
                msg["discard_own_idx"] = neg[0][1]
            return msg
        if role == "double_director":
            if neg:
                msg["discard_own_idx"] = [i for _, i in neg[:2]]
            return msg

        # chairman: own worst card + the worst card anyone else holds
        if neg:
            msg["discard_own_idx"] = neg[0][1]
        worst = None
        for p in game.players:
            if p.id == self.id or p.left:
                continue
            theirs = [_signed(c) for c in p.hand if not c.is_power and c.company_name == name]
            for i, v in enumerate(theirs):
                if v < 0 and (worst is None or v < worst[0]):
                    worst = (v, p.id, i)
        if worst is not None:
            msg["discard_other_player_id"] = worst[1]
            msg["discard_other_idx"] = worst[2]
        return msg


def make_bot(player_id, difficulty, seed=None, params=None):
    return Bot(player_id, difficulty, params=params, seed=seed)
