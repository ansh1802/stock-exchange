from .constants import (
    COMPANY_NAMES,
    COMPANY_BASE_VALUES,
    STARTING_CASH,
    STARTING_SHARES,
    ROUNDS_PER_DAY,
)


class Card:
    def __init__(self, name, value, positive=True, is_power=False):
        self.company_name = name
        self.value = value
        self.positive = positive
        self.is_power = is_power

    def to_dict(self):
        return {
            "company_name": self.company_name,
            "value": self.value,
            "positive": self.positive,
            "is_power": self.is_power,
        }


class Company:
    def __init__(self, name, value):
        self.name = name
        self.value = value
        self.base_value = value
        self.open = True

    def to_dict(self):
        return {
            "name": self.name,
            "value": self.value,
            "base_value": self.base_value,
            "open": self.open,
        }


class Player:
    def __init__(self, player_id):
        self.id = player_id
        self.cash = STARTING_CASH
        self.stocks = {name: 0 for name in COMPANY_NAMES}
        self.hand = []

    def to_dict(self):
        return {
            "id": self.id,
            "cash": self.cash,
            "stocks": dict(self.stocks),
            "hand": [c.to_dict() for c in self.hand],
        }

    def to_public_dict(self):
        return {
            "id": self.id,
            "cash": self.cash,
            "stocks": dict(self.stocks),
            "hand_count": len(self.hand),
        }


class GameState:
    """Single source of truth for all mutable game state.

    Phases: dealing -> player_turn -> fluctuation ->
            currency_settlement -> share_suspend -> day_end -> (loop | game_over)
    Sub-phase: player_turn -> rights_issue -> player_turn
    """

    def __init__(self, num_players):
        if not 2 <= num_players <= 6:
            raise ValueError("num_players must be 2-6")

        self.num_players = num_players
        self.players = [Player(i + 1) for i in range(num_players)]
        self.companies = [
            Company(name, val)
            for name, val in zip(COMPANY_NAMES, COMPANY_BASE_VALUES)
        ]
        self.available_shares = [STARTING_SHARES] * len(COMPANY_NAMES)
        self.previous_values = []

        # Turn / phase tracking
        self.current_day = 1
        self.current_turn = 0  # index into self.players
        self.current_round = 0
        self.rounds_per_day = ROUNDS_PER_DAY
        self.game_phase = "dealing"

        # Rights-issue sub-phase
        self.rights_issue_company = None  # 1-based company number
        self.rights_issue_queue = []      # player IDs in buy order
        self.rights_issue_original_value = None

        # Share-suspend sub-phase
        self.suspend_queue = []           # player IDs (one per card held)

    def to_dict(self):
        return {
            "num_players": self.num_players,
            "players": [p.to_dict() for p in self.players],
            "companies": [c.to_dict() for c in self.companies],
            "available_shares": list(self.available_shares),
            "previous_values": list(self.previous_values),
            "current_day": self.current_day,
            "current_turn": self.current_turn,
            "current_round": self.current_round,
            "rounds_per_day": self.rounds_per_day,
            "game_phase": self.game_phase,
            "rights_issue_company": self.rights_issue_company,
            "rights_issue_queue": list(self.rights_issue_queue),
            "rights_issue_original_value": self.rights_issue_original_value,
            "suspend_queue": list(self.suspend_queue),
        }

    def to_player_dict(self, player_id):
        """State visible to one player — own hand shown, others hidden."""
        players_view = [
            p.to_dict() if p.id == player_id else p.to_public_dict()
            for p in self.players
        ]
        return {
            "your_id": player_id,
            "num_players": self.num_players,
            "players": players_view,
            "companies": [c.to_dict() for c in self.companies],
            "available_shares": list(self.available_shares),
            "current_day": self.current_day,
            "current_turn": self.current_turn,
            "current_round": self.current_round,
            "game_phase": self.game_phase,
            "rights_issue_company": self.rights_issue_company,
            "rights_issue_queue": list(self.rights_issue_queue),
            "suspend_queue": list(self.suspend_queue),
        }
