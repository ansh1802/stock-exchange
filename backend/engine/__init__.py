"""engine — Stock Exchange game engine package.

Import from here for the full public API:
    from engine import GameState, buy_stock, sell_stock, ...
"""

from .constants import (
    COMPANY_NAMES,
    COMPANY_BASE_VALUES,
    POWER_CARD_NAMES,
    STARTING_CASH,
    STARTING_SHARES,
    CARDS_PER_HAND,
    MAX_DAYS,
    ROUNDS_PER_DAY,
    RIGHTS_ISSUE_VALUE,
    LOAN_STOCK_AMOUNT,
    CURRENCY_RATE,
)

from .models import Card, Company, Player, GameState
from .deck import build_deck

from .actions import (
    buy_stock,
    sell_stock,
    pass_turn,
    use_loan_stock,
    use_debenture,
    use_rights_issue,
    rights_issue_buy,
)

from .phases import (
    deal_cards,
    fluctuate_values,
    currency_settlement,
    share_suspend_action,
    end_day,
)

__all__ = [
    # Constants
    "COMPANY_NAMES", "COMPANY_BASE_VALUES", "POWER_CARD_NAMES",
    "STARTING_CASH", "STARTING_SHARES", "CARDS_PER_HAND",
    "MAX_DAYS", "ROUNDS_PER_DAY", "RIGHTS_ISSUE_VALUE",
    "LOAN_STOCK_AMOUNT", "CURRENCY_RATE",
    # Models
    "Card", "Company", "Player", "GameState",
    # Deck
    "build_deck",
    # Actions
    "buy_stock", "sell_stock", "pass_turn",
    "use_loan_stock", "use_debenture", "use_rights_issue", "rights_issue_buy",
    # Phases
    "deal_cards", "fluctuate_values", "currency_settlement",
    "share_suspend_action", "end_day",
]
