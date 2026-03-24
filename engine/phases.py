"""Phase transition functions: dealing, fluctuation, settlement, suspend, day end."""

import random

from .constants import CARDS_PER_HAND, CURRENCY_RATE, MAX_DAYS
from .deck import build_deck
from .helpers import result, validate_company, advance_turn


def deal_cards(game_state):
    """Shuffle deck and deal CARDS_PER_HAND cards to each player (supports 2-6)."""
    if game_state.game_phase != "dealing":
        return result(False, "Not in dealing phase.", game_state)

    deck = build_deck()
    random.shuffle(deck)

    for player in game_state.players:
        player.hand = deck[:CARDS_PER_HAND]
        deck = deck[CARDS_PER_HAND:]

    game_state.game_phase = "player_turn"
    game_state.current_turn = 0
    game_state.current_round = 0
    return result(True, f"Day {game_state.current_day}: cards dealt.", game_state)


def fluctuate_values(game_state):
    """Apply all player-held cards to company values."""
    if game_state.game_phase != "fluctuation":
        return result(False, "Not in fluctuation phase.", game_state)

    # Snapshot previous values for share suspend
    game_state.previous_values = [c.value for c in game_state.companies]

    for player in game_state.players:
        for card in player.hand:
            if card.is_power:
                continue
            for company in game_state.companies:
                if company.open and card.company_name == company.name:
                    if card.positive:
                        company.value += card.value
                    else:
                        company.value -= card.value

    for company in game_state.companies:
        if company.value <= 0:
            company.value = 0
            company.open = False

    game_state.game_phase = "currency_settlement"
    summary = ", ".join(f"{c.name}: {c.value}" for c in game_state.companies)
    return result(True, f"Values fluctuated. {summary}", game_state)


def currency_settlement(game_state):
    """Apply Currency +/- card effects, then build the share-suspend queue."""
    if game_state.game_phase != "currency_settlement":
        return result(False, "Not in currency settlement phase.", game_state)

    messages = []
    for player in game_state.players:
        for card in player.hand:
            if not card.is_power:
                continue
            if card.company_name == "Currency + ":
                before = player.cash
                player.cash += CURRENCY_RATE * player.cash
                messages.append(f"Player {player.id}: {before} -> {player.cash}")
            elif card.company_name == "Currency - ":
                before = player.cash
                player.cash -= CURRENCY_RATE * player.cash
                messages.append(f"Player {player.id}: {before} -> {player.cash}")

    # One queue entry per ShareSuspend card held (player may hold multiple)
    game_state.suspend_queue = [
        player.id
        for player in game_state.players
        for card in player.hand
        if card.is_power and card.company_name == "ShareSuspend"
    ]

    game_state.game_phase = "share_suspend"
    if not game_state.suspend_queue:
        _finalize_suspend(game_state)

    return result(True, "; ".join(messages) or "No currency effects.", game_state)


def share_suspend_action(game_state, player_id, company_num):
    """Use a ShareSuspend card (company_num=0 to pass).

    Swaps the company's current value with its pre-fluctuation value.
    """
    if game_state.game_phase != "share_suspend":
        return result(False, "Not in share suspend phase.", game_state)
    if not game_state.suspend_queue or game_state.suspend_queue[0] != player_id:
        return result(False, "It's not your turn for share suspend.", game_state)

    if company_num == 0:
        game_state.suspend_queue.pop(0)
        if not game_state.suspend_queue:
            _finalize_suspend(game_state)
        return result(True, "Passed on share suspend.", game_state)

    idx, err = validate_company(game_state, company_num)
    if err:
        return err
    if not game_state.previous_values:
        return result(False, "No previous values recorded.", game_state)

    current = game_state.companies[idx].value
    game_state.companies[idx].value = game_state.previous_values[idx]
    game_state.previous_values[idx] = current

    game_state.suspend_queue.pop(0)
    if not game_state.suspend_queue:
        _finalize_suspend(game_state)

    return result(
        True,
        f"Share suspend on {game_state.companies[idx].name}: value -> {game_state.companies[idx].value}.",
        game_state,
    )


def end_day(game_state):
    """End the current day: rotate player order, advance or end game."""
    if game_state.game_phase != "day_end":
        return result(False, "Not in day end phase.", game_state)

    # Rotate: first player moves to end (changes who goes first next day)
    game_state.players.append(game_state.players.pop(0))

    game_state.current_day += 1
    if game_state.current_day > MAX_DAYS:
        game_state.game_phase = "game_over"
        return result(True, "Game over!", game_state)

    game_state.game_phase = "dealing"
    return result(True, f"Day {game_state.current_day} begins.", game_state)


def _finalize_suspend(game_state):
    """Re-open companies with positive value, clear snapshots, advance to day_end."""
    for company in game_state.companies:
        if company.value > 0:
            company.open = True
    game_state.previous_values.clear()
    game_state.game_phase = "day_end"
