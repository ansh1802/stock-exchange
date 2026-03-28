from .constants import COMPANY_NAMES, CHAIRMAN_THRESHOLD, DIRECTOR_THRESHOLD


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


def update_positions(game_state, player, company_name):
    """Recheck chairman/director status for a player after a buy or sell."""
    holdings = player.stocks[company_name]
    chairman = game_state.chairman
    directors = game_state.directors

    # --- Chairman check ---
    if holdings >= CHAIRMAN_THRESHOLD and chairman[company_name] is None:
        # First to reach 100 → chairman
        chairman[company_name] = player.id
        # Remove from directors if they were one
        if player.id in directors[company_name]:
            directors[company_name].remove(player.id)
    elif holdings >= CHAIRMAN_THRESHOLD and chairman[company_name] != player.id:
        # Someone else is already chairman → this player becomes double-director
        if player.id not in directors[company_name]:
            directors[company_name].append(player.id)

    # --- Director check ---
    if holdings >= DIRECTOR_THRESHOLD and holdings < CHAIRMAN_THRESHOLD:
        if chairman[company_name] != player.id and player.id not in directors[company_name]:
            if len(directors[company_name]) < 2:
                directors[company_name].append(player.id)

    # --- Revocation on sell ---
    if holdings < CHAIRMAN_THRESHOLD and chairman[company_name] == player.id:
        chairman[company_name] = None
    if holdings < DIRECTOR_THRESHOLD and player.id in directors[company_name]:
        directors[company_name].remove(player.id)


def advance_turn(game_state):
    """Move to next player, or to card_reveal phase when all rounds done."""
    game_state.current_turn += 1
    if game_state.current_turn >= game_state.num_players:
        game_state.current_turn = 0
        game_state.current_round += 1
        if game_state.current_round >= game_state.rounds_per_day:
            game_state.game_phase = "card_reveal"
