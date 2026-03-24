from .constants import COMPANY_NAMES


def result(success, message, game_state):
    return {"success": success, "message": message, "new_state": game_state.to_dict()}


def player_by_id(game_state, player_id):
    for p in game_state.players:
        if p.id == player_id:
            return p
    return None


def validate_turn(game_state, player_id):
    """Return (player, error_result). error_result is None when valid."""
    if game_state.game_phase != "player_turn":
        return None, result(False, "Not in player turn phase.", game_state)
    player = player_by_id(game_state, player_id)
    if player is None:
        return None, result(False, "Player not found.", game_state)
    if game_state.players[game_state.current_turn].id != player_id:
        return None, result(False, "It's not your turn.", game_state)
    return player, None


def validate_company(game_state, company_num):
    """Return (0-based index, error_result)."""
    idx = company_num - 1
    if idx < 0 or idx >= len(COMPANY_NAMES):
        return None, result(False, "Invalid company number (1-6).", game_state)
    return idx, None


def advance_turn(game_state):
    """Move to next player, or to fluctuation phase when all rounds done."""
    game_state.current_turn += 1
    if game_state.current_turn >= game_state.num_players:
        game_state.current_turn = 0
        game_state.current_round += 1
        if game_state.current_round >= game_state.rounds_per_day:
            game_state.game_phase = "fluctuation"
