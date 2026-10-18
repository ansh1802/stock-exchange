"""Rule variants for what-if balance tests (sim-only monkeypatches).

Select with the BALANCE_VARIANT env var (comma-separated) before running
evaluate.py / analyze.py; worker processes inherit it. The bots' deck model is
patched too, so their reasoning matches the rules they're playing.
"""

from __future__ import annotations

import os

import engine.actions as A
import engine.deck as D
import engine.phases as P
import bots.policy as BP
from engine.constants import COMPANY_NAMES, POWER_CARD_NAMES
from engine.helpers import advance_turn, validate_turn
from engine.models import Card


def _deck_builder(tiers=None, power_copies=None, values=None):
    """tiers: per-company list of card magnitudes; power_copies: name -> copies."""
    def build_deck():
        deck = []
        for n, company in enumerate(COMPANY_NAMES):
            mags = values[n] if values else [(t + 1) * 5 for t in range((tiers or {}).get(n, n + 1))]
            for value in mags:
                for positive in (True, False):
                    for _ in range(2):
                        deck.append(Card(company, value, positive))
        for name in POWER_CARD_NAMES:
            default = 4 if name in ("Currency + ", "Currency - ") else 2
            copies = (power_copies or {}).get(name, default)
            for _ in range(copies):
                deck.append(Card(name, 0, True, is_power=True))
        return deck
    return build_deck


def _set_deck(builder):
    D.build_deck = builder
    P.build_deck = builder
    BP.build_deck = builder


def _loan(fn_amount):
    def use_loan_stock(game_state, player_id):
        player, err = validate_turn(game_state, player_id)
        if err:
            return err
        card = next((c for c in player.hand if c.company_name == "LoanStock" and c.is_power), None)
        if not card:
            return A.result(False, "You don't have a Loan Stock card.", game_state)
        nw = player.cash + sum(player.stocks[c.name] * c.value for c in game_state.companies if c.open)
        player.hand.remove(card)
        player.cash += fn_amount(nw)
        advance_turn(game_state)
        return A.result(True, "Loan Stock used.", game_state)
    A.use_loan_stock = use_loan_stock
    import engine
    engine.use_loan_stock = use_loan_stock
    import sim
    sim.ge.use_loan_stock = use_loan_stock


def _chairman_own_only():
    """Chairman loses the 'remove another player's card' power."""
    orig = P.chairman_director_action

    def chairman_director_action(gs, pid, own_idx, other_pid=None, other_idx=None):
        if own_idx == -1 and other_pid is not None:
            return orig(gs, pid, -1)  # becomes a pass
        return orig(gs, pid, own_idx)
    P.chairman_director_action = chairman_director_action
    import engine
    import sim
    engine.chairman_director_action = chairman_director_action
    sim.ge.chairman_director_action = chairman_director_action


def _suspend_own_only():
    """Share Suspend may only target a company you hold shares in."""
    orig = P.share_suspend_action

    def share_suspend_action(gs, pid, company_num):
        if company_num:
            p = next(x for x in gs.players if x.id == pid)
            if p.stocks[COMPANY_NAMES[company_num - 1]] <= 0:
                return P.result(False, "Must hold shares to suspend.", gs)
        return orig(gs, pid, company_num)
    P.share_suspend_action = share_suspend_action
    import engine
    import sim
    engine.share_suspend_action = share_suspend_action
    sim.ge.share_suspend_action = share_suspend_action

    # Teach the bots the rule: hide swaps on companies they don't hold.
    bot_orig = BP.Bot._share_suspend

    def bot_share_suspend(self, game, me):
        saved = list(game.previous_values)
        for i, name in enumerate(COMPANY_NAMES):
            if me.stocks[name] <= 0 and saved:
                game.previous_values[i] = game.companies[i].value
        try:
            return bot_orig(self, game, me)
        finally:
            game.previous_values[:] = saved
    BP.Bot._share_suspend = bot_share_suspend


VARIANTS = {
    "chairman_own_only": _chairman_own_only,
    "suspend_own_only": _suspend_own_only,
    # One Share Suspend in the deck instead of two.
    "suspend_1": lambda: _set_deck(_deck_builder(power_copies={"ShareSuspend": 1})),
    # Loan Stock: flat 100 (the unused LOAN_STOCK_AMOUNT constant) instead of 10% of net worth.
    "loan_flat": lambda: _loan(lambda nw: 100),
    # Loan Stock capped: 10% of net worth, max 500.
    "loan_cap": lambda: _loan(lambda nw: min(500, max(5, (int(nw * 0.1) // 5) * 5))),
    # Card swing proportional to price: Vodafone gets 5/10, Infosys stops at 20.
    "deck_flat": lambda: _set_deck(_deck_builder(values=[
        [5, 10], [5, 10], [5, 10, 15], [5, 10, 15], [5, 10, 15, 20], [5, 10, 15, 20]])),
    # Fewer currency cards (2 each, like the other powers).
    "currency_2": lambda: _set_deck(_deck_builder(power_copies={"Currency + ": 2, "Currency - ": 2})),
    # Currency at 20%.
    "currency_20": lambda: setattr(P, "CURRENCY_RATE", 0.2),
}


def apply_from_env():
    names = [n for n in os.environ.get("BALANCE_VARIANT", "").split(",") if n]
    for n in names:
        VARIANTS[n]()
    return names
