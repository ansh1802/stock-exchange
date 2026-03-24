from .constants import COMPANY_NAMES, POWER_CARD_NAMES
from .models import Card


def build_deck():
    """Build the full 100-card deck.

    Company cards: for company at index n (0-5), there are n+1 value tiers.
    Each tier * each sign (+/-) * 2 copies = 84 cards.
    Power cards: 2 copies each, except Currency +/- which get 4 = 16 cards.
    """
    deck = []

    for n, company in enumerate(COMPANY_NAMES):
        for tier in range(n + 1):
            value = (tier + 1) * 5
            for positive in (True, False):
                for _ in range(2):
                    deck.append(Card(company, value, positive))

    for name in POWER_CARD_NAMES:
        copies = 4 if name in ("Currency + ", "Currency - ") else 2
        for _ in range(copies):
            deck.append(Card(name, 0, True, is_power=True))

    return deck
