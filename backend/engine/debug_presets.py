"""Debug presets for testing specific game scenarios.

Each preset function receives a GameState (already dealt) and mutates it
to set up the desired test conditions.
"""

import random
from .constants import COMPANY_NAMES, STARTING_SHARES
from .models import Card
from .helpers import update_positions


PRESETS = {}


def preset(name, description):
    """Decorator to register a debug preset."""
    def decorator(fn):
        PRESETS[name] = {"fn": fn, "description": description}
        return fn
    return decorator


def apply_preset(game_state, preset_name):
    """Apply a named preset to the game state. Returns (success, message)."""
    if preset_name not in PRESETS:
        available = ", ".join(PRESETS.keys())
        return False, f"Unknown preset '{preset_name}'. Available: {available}"
    PRESETS[preset_name]["fn"](game_state)
    return True, f"Debug preset '{preset_name}' applied."


# ── Presets ─────────────────────────────────────────────────────────────────


@preset("chairman", "Player 1 has 100 shares of Reliance (chairman). "
        "Player 2 has 75 shares (director). Both have Reliance cards in hand. "
        "Game is on last round so card reveal triggers quickly.")
def _chairman(gs):
    p1, p2 = gs.players[0], gs.players[1]
    company = "Reliance"
    idx = COMPANY_NAMES.index(company)

    # Set holdings
    p1.stocks[company] = 100
    p2.stocks[company] = 75
    gs.available_shares[idx] = STARTING_SHARES - 175

    # Set positions
    update_positions(gs, p1, company)
    update_positions(gs, p2, company)

    # Give both players Reliance cards in their hand
    _inject_company_cards(gs, p1, company, [(15, True), (20, True), (10, False)])
    _inject_company_cards(gs, p2, company, [(25, False), (15, True)])

    # Put game near end of round so card reveal happens soon
    _fast_forward_to_last_round(gs)


@preset("chairman_no_own_cards", "Player 1 is chairman of Reliance (100 shares) "
        "but has NO Reliance cards. Player 2 (director, 60 shares) has Reliance cards. "
        "Tests chairman exercising power on other player's cards only.")
def _chairman_no_own(gs):
    p1, p2 = gs.players[0], gs.players[1]
    company = "Reliance"
    idx = COMPANY_NAMES.index(company)

    p1.stocks[company] = 100
    p2.stocks[company] = 60
    gs.available_shares[idx] = STARTING_SHARES - 160

    update_positions(gs, p1, company)
    update_positions(gs, p2, company)

    # P1 has no Reliance cards, P2 has some
    _remove_company_cards(gs, p1, company)
    _inject_company_cards(gs, p2, company, [(20, True), (15, False)])

    _fast_forward_to_last_round(gs)


@preset("double_director", "Player 1 is chairman (100 shares Cred). "
        "Player 2 is double director (100 shares Cred). "
        "Both have multiple Cred cards.")
def _double_director(gs):
    p1, p2 = gs.players[0], gs.players[1]
    company = "Cred"
    idx = COMPANY_NAMES.index(company)

    p1.stocks[company] = 100
    p2.stocks[company] = 100
    gs.available_shares[idx] = STARTING_SHARES - 200

    update_positions(gs, p1, company)
    update_positions(gs, p2, company)

    _inject_company_cards(gs, p1, company, [(10, True), (20, False)])
    _inject_company_cards(gs, p2, company, [(15, True), (25, True), (5, False)])

    _fast_forward_to_last_round(gs)


@preset("share_suspend", "Both players hold ShareSuspend power cards. "
        "Tests multiple suspend actions in sequence.")
def _share_suspend(gs):
    p1, p2 = gs.players[0], gs.players[1]

    _inject_power_card(gs, p1, "ShareSuspend")
    _inject_power_card(gs, p2, "ShareSuspend")

    _fast_forward_to_last_round(gs)


@preset("currency", "Player 1 has Currency+ card, Player 2 has Currency- card.")
def _currency(gs):
    p1, p2 = gs.players[0], gs.players[1]

    _inject_power_card(gs, p1, "Currency + ")
    _inject_power_card(gs, p2, "Currency - ")

    _fast_forward_to_last_round(gs)


@preset("all_powers", "Both players have ShareSuspend, player 1 has Currency+, "
        "player 2 has Currency-. Player 1 is chairman of Reliance with cards. "
        "Comprehensive end-of-day test.")
def _all_powers(gs):
    p1, p2 = gs.players[0], gs.players[1]
    company = "Reliance"
    idx = COMPANY_NAMES.index(company)

    # Chairman setup
    p1.stocks[company] = 100
    p2.stocks[company] = 60
    gs.available_shares[idx] = STARTING_SHARES - 160
    update_positions(gs, p1, company)
    update_positions(gs, p2, company)

    _inject_company_cards(gs, p1, company, [(15, True), (10, False)])
    _inject_company_cards(gs, p2, company, [(20, True), (25, False)])

    # Power cards
    _inject_power_card(gs, p1, "ShareSuspend")
    _inject_power_card(gs, p2, "ShareSuspend")
    _inject_power_card(gs, p1, "Currency + ")
    _inject_power_card(gs, p2, "Currency - ")

    _fast_forward_to_last_round(gs)


# ── Helpers ─────────────────────────────────────────────────────────────────


def _inject_company_cards(gs, player, company_name, cards):
    """Replace some of the player's non-power cards with specific company cards.

    cards: list of (value, positive) tuples.
    """
    # Remove existing cards of this company first
    _remove_company_cards(gs, player, company_name)

    # Remove some random non-power cards to make room
    non_power = [c for c in player.hand if not c.is_power and c.company_name != company_name]
    random.shuffle(non_power)
    for _ in range(min(len(cards), len(non_power))):
        player.hand.remove(non_power.pop())

    # Add the desired cards
    for value, positive in cards:
        player.hand.append(Card(company_name, value, positive))


def _remove_company_cards(gs, player, company_name):
    """Remove all non-power cards of a specific company from player's hand."""
    player.hand = [c for c in player.hand if c.is_power or c.company_name != company_name]


def _inject_power_card(gs, player, power_name):
    """Replace a random non-power card with a power card."""
    non_power = [c for c in player.hand if not c.is_power]
    if non_power:
        player.hand.remove(random.choice(non_power))
    player.hand.append(Card(power_name, 0, True, is_power=True))


def _fast_forward_to_last_round(gs):
    """Set the game to the last round so card reveal triggers after one pass each."""
    gs.current_round = gs.rounds_per_day - 1
    gs.current_turn = 0
