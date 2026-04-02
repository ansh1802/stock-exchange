"""Phase transition functions: card reveal, share suspend, currency settlement, day end.

Phase order after trading:
    card_reveal (with chairman/director discards) → share_suspend → currency_settlement → day_end
"""

import random

from .constants import CARDS_PER_HAND, CURRENCY_RATE, MAX_DAYS, COMPANY_NAMES, CHAIRMAN_THRESHOLD, DIRECTOR_THRESHOLD
from .deck import build_deck
from .helpers import result, player_by_id, validate_company, advance_turn


def deal_cards(game_state):
    """Shuffle deck and deal CARDS_PER_HAND cards to each player (supports 2-6)."""
    if game_state.game_phase != "dealing":
        return result(False, "Not in dealing phase.", game_state)

    deck = build_deck()
    random.shuffle(deck)

    for player in game_state.players:
        player.hand = deck[:CARDS_PER_HAND]
        deck = deck[CARDS_PER_HAND:]

    # Clear reveal data from previous day
    game_state.reveal_data = []
    game_state.reveal_complete_players = set()

    game_state.game_phase = "player_turn"
    game_state.current_turn = 0
    game_state.current_round = 0
    return result(True, f"Day {game_state.current_day}: cards dealt.", game_state)


# ── Card Reveal Phase ────────────────────────────────────────────────────────


def begin_card_reveal(game_state):
    """Enter card reveal phase: compute per-company card data, build CD queue.

    This replaces the old 'fluctuation' phase. Values are NOT applied yet —
    they're applied in _finalize_card_reveal after all chairman/director
    discards are resolved.
    """
    if game_state.game_phase != "card_reveal":
        return result(False, "Not in card reveal phase.", game_state)

    # Snapshot previous values (needed for share suspend later)
    game_state.previous_values = [c.value for c in game_state.companies]

    # Compute reveal_data: per-company card breakdown
    reveal_data = []
    for idx, company in enumerate(game_state.companies):
        cards = []
        for player in game_state.players:
            for card in player.hand:
                if not card.is_power and card.company_name == company.name:
                    cards.append({
                        "player_id": player.id,
                        "value": card.value,
                        "positive": card.positive,
                    })

        delta = sum(c["value"] if c["positive"] else -c["value"] for c in cards)
        new_value = company.value + delta if company.open else company.value
        if new_value < 0:
            new_value = 0

        reveal_data.append({
            "company_name": company.name,
            "cards": cards,
            "delta": delta,
            "old_value": company.value,
            "new_value": new_value,
        })

    game_state.reveal_data = reveal_data

    # Build chairman/director queue
    _build_chairman_director_queue(game_state)

    if game_state.chairman_director_queue:
        # Stay in card_reveal, waiting for chairman/director actions
        return result(True, "Cards revealed — chairman/director actions pending.", game_state)

    # Stay in card_reveal — frontend drives the animation, then sends reveal_complete
    return result(True, "Cards revealed.", game_state)


def complete_card_reveal(game_state, player_id=None):
    """Called by each player's frontend after card reveal animation finishes.

    Waits for ALL players to send reveal_complete before finalizing.
    When CD queue exists, _finalize_card_reveal is called by chairman_director_action
    after the last CD action resolves.
    """
    if game_state.game_phase != "card_reveal":
        # Already advanced — silently succeed
        return result(True, "Card reveal already complete.", game_state)
    if game_state.chairman_director_queue:
        return result(False, "Chairman/director actions still pending.", game_state)

    if player_id is not None:
        game_state.reveal_complete_players.add(player_id)
        # Only finalize when all players have completed the animation
        if len(game_state.reveal_complete_players) < game_state.num_players:
            waiting = game_state.num_players - len(game_state.reveal_complete_players)
            return result(True, f"Waiting for {waiting} more player(s) to finish reveal.", game_state)

    game_state.reveal_complete_players.clear()
    _finalize_card_reveal(game_state)
    return result(True, "Card reveal complete — values applied.", game_state)


def _build_chairman_director_queue(game_state):
    """Build queue of (player_id, company_name, role) for end-of-day discards.

    A player with 150+ shares is both chairman AND director (queued sequentially).
    A player with 200+ shares is both chairman AND double director.
    Within each company, chairman acts first, then directors, ordered by turn priority.
    """
    player_order = {p.id: i for i, p in enumerate(game_state.players)}
    queue = []

    for name in COMPANY_NAMES:
        chairman_entries = []
        director_entries = []

        # Count total company cards across all players (to check if chairman has targets)
        total_cards = sum(
            1 for p in game_state.players for c in p.hand
            if c.company_name == name and not c.is_power
        )

        chair_id = game_state.chairman[name]
        if chair_id is not None:
            player = player_by_id(game_state, chair_id)
            own_cards = [c for c in player.hand if c.company_name == name and not c.is_power]
            other_cards_exist = total_cards > len(own_cards)
            # Chairman is queued if they have own cards to discard OR other players have cards to remove
            if own_cards or other_cards_exist:
                chairman_entries.append((chair_id, name, "chairman"))

            # Chairman with 150+ shares also gets director power (played after chairman)
            holdings = player.stocks[name]
            if holdings >= CHAIRMAN_THRESHOLD + DIRECTOR_THRESHOLD:
                if holdings >= CHAIRMAN_THRESHOLD * 2 and len(own_cards) >= 2:
                    director_entries.append((chair_id, name, "double_director"))
                elif own_cards:
                    director_entries.append((chair_id, name, "director"))

        for dir_id in game_state.directors[name]:
            player = player_by_id(game_state, dir_id)
            own_cards = [c for c in player.hand if c.company_name == name and not c.is_power]
            is_double = player.stocks[name] >= CHAIRMAN_THRESHOLD
            if is_double and len(own_cards) >= 2:
                director_entries.append((dir_id, name, "double_director"))
            elif own_cards:
                director_entries.append((dir_id, name, "director"))

        # Chairman first, then directors — each group sorted by turn order
        chairman_entries.sort(key=lambda e: player_order.get(e[0], 999))
        director_entries.sort(key=lambda e: player_order.get(e[0], 999))
        queue.extend(chairman_entries)
        queue.extend(director_entries)

    game_state.chairman_director_queue = queue


def chairman_director_action(game_state, player_id, discard_own_idx, discard_other_player_id=None, discard_other_idx=None):
    """Process a chairman/director discard action during card_reveal phase."""
    if game_state.game_phase != "card_reveal":
        return result(False, "Not in card reveal phase.", game_state)
    if not game_state.chairman_director_queue:
        return result(False, "No pending chairman/director actions.", game_state)

    entry = game_state.chairman_director_queue[0]
    queue_pid, company_name, role = entry

    if queue_pid != player_id:
        return result(False, "It's not your turn for chairman/director action.", game_state)

    player = player_by_id(game_state, player_id)

    # Pass — skip discard (only a true pass if no other-card selection either)
    if discard_own_idx == -1 and discard_other_player_id is None:
        game_state.chairman_director_queue.pop(0)
        if not game_state.chairman_director_queue:
            _finalize_card_reveal(game_state)
        return result(True, f"{role.replace('_', ' ').title()} passed on {company_name} discard.", game_state)

    own_cards = [c for c in player.hand if c.company_name == company_name and not c.is_power]

    if role == "double_director":
        if not isinstance(discard_own_idx, list) or len(discard_own_idx) not in (1, 2):
            return result(False, "Double director must select 1 or 2 cards to discard.", game_state)
        for idx in discard_own_idx:
            if not isinstance(idx, int) or idx < 0 or idx >= len(own_cards):
                return result(False, f"Invalid card index: {idx}.", game_state)
        if len(discard_own_idx) == 2 and discard_own_idx[0] == discard_own_idx[1]:
            return result(False, "Must select two different cards.", game_state)
        to_remove = sorted(discard_own_idx, reverse=True)
        for idx in to_remove:
            player.hand.remove(own_cards[idx])
        msg = f"Double director discarded {len(discard_own_idx)} {company_name} card(s)."

    elif role == "director":
        if not isinstance(discard_own_idx, int) or discard_own_idx < 0 or discard_own_idx >= len(own_cards):
            return result(False, "Invalid card index.", game_state)
        player.hand.remove(own_cards[discard_own_idx])
        msg = f"Director discarded a {company_name} card."

    elif role == "chairman":
        # Chairman can partially exercise: own card only, other card only, or both.
        # discard_own_idx == -1 means skip own discard.
        discarded_own = False
        discarded_other = False

        if isinstance(discard_own_idx, int) and discard_own_idx >= 0:
            if discard_own_idx >= len(own_cards):
                return result(False, "Invalid own card index.", game_state)
            player.hand.remove(own_cards[discard_own_idx])
            discarded_own = True

        if discard_other_player_id is not None and discard_other_idx is not None:
            target = player_by_id(game_state, discard_other_player_id)
            if target is None or target.id == player_id:
                return result(False, "Invalid target player.", game_state)
            target_cards = [c for c in target.hand if c.company_name == company_name and not c.is_power]
            if not isinstance(discard_other_idx, int) or discard_other_idx < 0 or discard_other_idx >= len(target_cards):
                return result(False, "Invalid target card index.", game_state)
            target.hand.remove(target_cards[discard_other_idx])
            discarded_other = True

        if not discarded_own and not discarded_other:
            # Neither selected — treat as pass
            game_state.chairman_director_queue.pop(0)
            if not game_state.chairman_director_queue:
                _finalize_card_reveal(game_state)
            return result(True, f"Chairman passed on {company_name} discard.", game_state)

        parts = []
        if discarded_own:
            parts.append(f"discarded a {company_name} card")
        if discarded_other:
            target_conn_name = f"Player {discard_other_player_id}"
            parts.append(f"removed one from {target_conn_name}")
        msg = f"Chairman {' and '.join(parts)}."
    else:
        return result(False, "Unknown role.", game_state)

    game_state.chairman_director_queue.pop(0)

    # Recompute reveal_data for affected company (cards changed due to discard)
    _recompute_reveal_for_company(game_state, company_name)

    if not game_state.chairman_director_queue:
        _finalize_card_reveal(game_state)

    return result(True, msg, game_state)


def _recompute_reveal_for_company(game_state, company_name):
    """Recompute reveal_data delta for a specific company after a card discard."""
    for entry in game_state.reveal_data:
        if entry["company_name"] == company_name:
            # Rebuild cards list from current hands
            cards = []
            for player in game_state.players:
                for card in player.hand:
                    if not card.is_power and card.company_name == company_name:
                        cards.append({
                            "player_id": player.id,
                            "value": card.value,
                            "positive": card.positive,
                        })
            delta = sum(c["value"] if c["positive"] else -c["value"] for c in cards)
            new_value = entry["old_value"] + delta
            if new_value < 0:
                new_value = 0
            entry["cards"] = cards
            entry["delta"] = delta
            entry["new_value"] = new_value
            break


def _finalize_card_reveal(game_state):
    """Apply fluctuations from remaining cards, build suspend queue, advance."""
    # Apply card effects to company values
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

    # Close bankrupt companies
    for company in game_state.companies:
        if company.value <= 0:
            company.value = 0
            company.open = False

    # Build suspend queue from ShareSuspend power cards
    game_state.suspend_queue = [
        player.id
        for player in game_state.players
        for card in player.hand
        if card.is_power and card.company_name == "ShareSuspend"
    ]

    game_state.game_phase = "share_suspend"
    if not game_state.suspend_queue:
        _finalize_suspend(game_state)


# ── Share Suspend Phase ──────────────────────────────────────────────────────


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


def _finalize_suspend(game_state):
    """Re-open companies with positive value, advance to currency_settlement."""
    for company in game_state.companies:
        if company.value > 0:
            company.open = True
    game_state.game_phase = "currency_settlement"


# ── Currency Settlement Phase ────────────────────────────────────────────────


def currency_settlement(game_state):
    """Apply Currency +/- card effects, then advance to day_end."""
    if game_state.game_phase != "currency_settlement":
        return result(False, "Not in currency settlement phase.", game_state)

    effects = []
    for player in game_state.players:
        for card in player.hand:
            if not card.is_power:
                continue
            if card.company_name == "Currency + ":
                before = player.cash
                player.cash += CURRENCY_RATE * player.cash
                effects.append({"player_id": player.id, "before": before, "after": player.cash, "type": "+"})
            elif card.company_name == "Currency - ":
                before = player.cash
                player.cash -= CURRENCY_RATE * player.cash
                effects.append({"player_id": player.id, "before": before, "after": player.cash, "type": "-"})

    game_state.previous_values.clear()
    game_state.game_phase = "day_end"

    messages = [f"Player {e['player_id']}: {e['before']:.0f} -> {e['after']:.0f}" for e in effects]
    return result(True, "; ".join(messages) or "No currency effects.", game_state)


def complete_currency_settlement(game_state):
    """Called by frontend after currency settlement animation finishes."""
    if game_state.game_phase != "currency_settlement":
        # Already advanced (another player sent this first) — silently succeed
        return result(True, "Currency settlement already complete.", game_state)
    return currency_settlement(game_state)


# ── Day End Phase ────────────────────────────────────────────────────────────


def end_day(game_state):
    """End the current day: rotate player order, advance or end game."""
    if game_state.game_phase != "day_end":
        return result(False, "Not in day end phase.", game_state)

    # Snapshot end-of-day prices for sparkline history
    game_state.price_history.append([c.value for c in game_state.companies])

    # Rotate: first player moves to end (changes who goes first next day)
    game_state.players.append(game_state.players.pop(0))

    game_state.current_day += 1
    if game_state.current_day > MAX_DAYS:
        game_state.game_phase = "game_over"
        return result(True, "Game over!", game_state)

    game_state.game_phase = "dealing"
    return result(True, f"Day {game_state.current_day} begins.", game_state)
