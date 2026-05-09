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
    """Re-evaluate chairman/director assignments for a company after a trade.

    Triggers a global recheck — not just for the acting player — so that
    when a chairman sells below 100, an existing director with 100+ is
    promoted to chairman, and when a director sells below 50, a waiting
    shareholder with 50+ fills the vacated slot.
    """
    holdings = {p.id: p.stocks[company_name] for p in game_state.players}
    player_order = [p.id for p in game_state.players]

    old_chairman = game_state.chairman[company_name]
    old_directors = list(game_state.directors[company_name])

    # 1. Keep current chairman if still ≥ CHAIRMAN_THRESHOLD; else vacate.
    chairman = old_chairman if (
        old_chairman is not None and holdings[old_chairman] >= CHAIRMAN_THRESHOLD
    ) else None

    # 2. If no chairman, promote the senior eligible holder. Existing
    #    directors with 100+ have priority (they were the natural successor).
    if chairman is None:
        for pid in old_directors:
            if holdings[pid] >= CHAIRMAN_THRESHOLD:
                chairman = pid
                break
        if chairman is None:
            for pid in player_order:
                if pid == old_chairman:
                    continue
                if holdings[pid] >= CHAIRMAN_THRESHOLD:
                    chairman = pid
                    break

    # 3. Build directors: keep existing directors still ≥ DIRECTOR_THRESHOLD
    #    (excluding the new chairman).
    directors = []
    for pid in old_directors:
        if pid == chairman:
            continue
        if holdings[pid] >= DIRECTOR_THRESHOLD and pid not in directors:
            directors.append(pid)

    # 4. A demoted ex-chairman with ≥50 takes a director slot first
    #    (they were the most senior holder before the sell).
    if (old_chairman is not None and old_chairman != chairman
            and holdings[old_chairman] >= DIRECTOR_THRESHOLD
            and old_chairman not in directors and len(directors) < 2):
        directors.append(old_chairman)

    # 5. Fill remaining slots from the rest of the players (turn order),
    #    promoting waiting 50+ shareholders.
    for pid in player_order:
        if len(directors) >= 2:
            break
        if pid == chairman or pid in directors:
            continue
        if holdings[pid] >= DIRECTOR_THRESHOLD:
            directors.append(pid)

    game_state.chairman[company_name] = chairman
    game_state.directors[company_name] = directors


def advance_turn(game_state):
    """Move to next player, or to card_reveal phase when all rounds done."""
    game_state.current_turn += 1
    if game_state.current_turn >= game_state.num_players:
        game_state.current_turn = 0
        game_state.current_round += 1
        if game_state.current_round >= game_state.rounds_per_day:
            game_state.game_phase = "card_reveal"
