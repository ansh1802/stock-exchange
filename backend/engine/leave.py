"""Mid-game leave: a player permanently exits a running game.

The player stays in GameState.players (so indices, ids and num_players never
shift) but is marked `left` and skipped everywhere. Their shares go back to
the market, their cash is burned, and their cards don't count today.
"""

from .constants import COMPANY_NAMES
from .helpers import result, player_by_id, advance_turn, active_players, update_positions
from .phases import _finalize_card_reveal, _finalize_suspend, reveal_acks_missing


def leave_game(game_state, player_id):
    """Remove a player from a running game. Ends the game if ≤1 player remains."""
    player = player_by_id(game_state, player_id)
    if player is None:
        return result(False, "Player not found.", game_state)
    if player.left:
        return result(False, "Player already left.", game_state)
    if game_state.game_phase == "game_over":
        return result(False, "Game is already over.", game_state)

    phase = game_state.game_phase
    was_their_turn = (
        phase == "player_turn"
        and game_state.players[game_state.current_turn].id == player_id
    )

    # Shares back to the market, cash burned.
    for idx, name in enumerate(COMPANY_NAMES):
        game_state.available_shares[idx] += player.stocks[name]
        player.stocks[name] = 0
    player.cash = 0
    player.left = True

    # Cards don't count today — unless the reveal is already on screen
    # (reveal_data computed), in which case revealed cards stand.
    reveal_in_progress = phase == "card_reveal" and bool(game_state.reveal_data)
    if not reveal_in_progress:
        player.hand = []

    for name in COMPANY_NAMES:
        update_positions(game_state, player, name)

    # Drop them from every queue and settle any sub-phase they were blocking.
    if phase == "player_turn" and was_their_turn:
        advance_turn(game_state)

    elif phase == "rights_issue":
        game_state.rights_issue_queue = [
            pid for pid in game_state.rights_issue_queue if pid != player_id
        ]
        if not game_state.rights_issue_queue:
            idx = game_state.rights_issue_company - 1
            game_state.companies[idx].value = game_state.rights_issue_original_value
            game_state.rights_issue_company = None
            game_state.rights_issue_original_value = None
            game_state.game_phase = "player_turn"
            advance_turn(game_state)

    elif reveal_in_progress:
        # Their currency card would otherwise resurrect burned cash.
        game_state.currency_effects = [
            e for e in game_state.currency_effects if e["player_id"] != player_id
        ]
        game_state.reveal_complete_players.discard(player_id)
        had_queue = bool(game_state.chairman_director_queue)
        game_state.chairman_director_queue = [
            e for e in game_state.chairman_director_queue if e[0] != player_id
        ]
        if had_queue:
            if not game_state.chairman_director_queue:
                _finalize_card_reveal(game_state)
        elif reveal_acks_missing(game_state) == 0:
            game_state.reveal_complete_players.clear()
            _finalize_card_reveal(game_state)

    elif phase == "share_suspend":
        game_state.suspend_queue = [
            pid for pid in game_state.suspend_queue if pid != player_id
        ]
        if not game_state.suspend_queue:
            _finalize_suspend(game_state)

    if len(active_players(game_state)) <= 1:
        game_state.game_phase = "game_over"
        return result(True, "Left the game — game over.", game_state)

    return result(True, "Left the game.", game_state)
