"""Player turn actions: buy, sell, pass, and power card usage."""

from .constants import LOAN_STOCK_AMOUNT, RIGHTS_ISSUE_VALUE
from .helpers import result, player_by_id, validate_turn, validate_company, advance_turn, update_positions


def buy_stock(game_state, player_id, company_num, num_shares):
    """Buy shares of a company (1-based company_num)."""
    player, err = validate_turn(game_state, player_id)
    if err:
        return err
    idx, err = validate_company(game_state, company_num)
    if err:
        return err

    company = game_state.companies[idx]
    if not company.open:
        return result(False, f"{company.name} is closed.", game_state)
    if num_shares <= 0:
        return result(False, "Must buy at least 1 share.", game_state)
    if num_shares > game_state.available_shares[idx]:
        return result(False, f"Only {game_state.available_shares[idx]} shares available.", game_state)

    affordable = int(player.cash / company.value) if company.value > 0 else 0
    if num_shares > affordable:
        return result(False, f"You can only afford {affordable} shares.", game_state)

    cost = company.value * num_shares
    player.stocks[company.name] += num_shares
    game_state.available_shares[idx] -= num_shares
    player.cash -= cost

    update_positions(game_state, player, company.name)
    advance_turn(game_state)
    return result(True, f"Bought {num_shares} of {company.name} for {cost}. Balance: {player.cash}.", game_state)


def sell_stock(game_state, player_id, company_num, num_shares):
    """Sell shares of a company (1-based company_num)."""
    player, err = validate_turn(game_state, player_id)
    if err:
        return err
    idx, err = validate_company(game_state, company_num)
    if err:
        return err

    company = game_state.companies[idx]
    holdings = player.stocks[company.name]
    if num_shares <= 0:
        return result(False, "Must sell at least 1 share.", game_state)
    if num_shares > holdings:
        return result(False, f"You only own {holdings} shares of {company.name}.", game_state)

    revenue = company.value * num_shares
    player.stocks[company.name] -= num_shares
    game_state.available_shares[idx] += num_shares
    player.cash += revenue

    update_positions(game_state, player, company.name)
    advance_turn(game_state)
    return result(True, f"Sold {num_shares} of {company.name} for {revenue}. Balance: {player.cash}.", game_state)


def pass_turn(game_state, player_id):
    """Pass without taking an action."""
    player, err = validate_turn(game_state, player_id)
    if err:
        return err
    advance_turn(game_state)
    return result(True, "Turn passed.", game_state)


def use_loan_stock(game_state, player_id):
    """Use a LoanStock power card to gain cash."""
    player, err = validate_turn(game_state, player_id)
    if err:
        return err
    card = next((c for c in player.hand if c.company_name == "LoanStock" and c.is_power), None)
    if not card:
        return result(False, "You don't have a Loan Stock card.", game_state)

    player.hand.remove(card)
    player.cash += LOAN_STOCK_AMOUNT
    advance_turn(game_state)
    return result(True, f"Loan Stock used. Cash: {player.cash}.", game_state)


def use_debenture(game_state, player_id, company_num):
    """Use a Debenture card to reopen a closed company at its base value."""
    player, err = validate_turn(game_state, player_id)
    if err:
        return err
    card = next((c for c in player.hand if c.company_name == "Debenture" and c.is_power), None)
    if not card:
        return result(False, "You don't have a Debenture card.", game_state)

    idx, err = validate_company(game_state, company_num)
    if err:
        return err

    company = game_state.companies[idx]
    if company.open:
        return result(False, f"{company.name} is already open.", game_state)

    player.hand.remove(card)
    company.value = company.base_value
    company.open = True
    advance_turn(game_state)
    return result(True, f"{company.name} reopened at {company.base_value}.", game_state)


def use_rights_issue(game_state, player_id, company_num):
    """Initiate a rights issue — enters the rights_issue sub-phase.

    Company value is temporarily set to RIGHTS_ISSUE_VALUE (10).
    Each player holding shares (starting from current, wrapping around)
    can buy up to holdings/2 shares at the discounted price.
    """
    player, err = validate_turn(game_state, player_id)
    if err:
        return err
    card = next((c for c in player.hand if c.company_name == "RightsIssue" and c.is_power), None)
    if not card:
        return result(False, "You don't have a Rights Issue card.", game_state)

    idx, err = validate_company(game_state, company_num)
    if err:
        return err

    player.hand.remove(card)
    company = game_state.companies[idx]
    game_state.rights_issue_original_value = company.value
    game_state.rights_issue_company = company_num
    company.value = RIGHTS_ISSUE_VALUE

    # Build eligible queue: start from current player, wrap around
    cur = game_state.current_turn
    order = list(range(cur, game_state.num_players)) + list(range(cur))
    game_state.rights_issue_queue = [
        game_state.players[i].id
        for i in order
        if game_state.players[i].stocks[company.name] > 0
    ]

    if not game_state.rights_issue_queue:
        company.value = game_state.rights_issue_original_value
        game_state.rights_issue_company = None
        game_state.rights_issue_original_value = None
        advance_turn(game_state)
        return result(True, "Rights issue: no eligible shareholders.", game_state)

    game_state.game_phase = "rights_issue"
    return result(True, f"Rights issue on {company.name} at {RIGHTS_ISSUE_VALUE}.", game_state)


def rights_issue_buy(game_state, player_id, num_shares):
    """Buy shares during a rights issue (pass with num_shares=0)."""
    if game_state.game_phase != "rights_issue":
        return result(False, "Not in rights issue phase.", game_state)
    if not game_state.rights_issue_queue or game_state.rights_issue_queue[0] != player_id:
        return result(False, "It's not your turn in the rights issue.", game_state)

    player = player_by_id(game_state, player_id)
    idx = game_state.rights_issue_company - 1
    company = game_state.companies[idx]
    holdings = player.stocks[company.name]
    max_eligible = int(holdings / 2)
    available = game_state.available_shares[idx]

    if num_shares < 0:
        return result(False, "Cannot buy negative shares.", game_state)
    if num_shares > max_eligible:
        return result(False, f"Eligible for at most {max_eligible} shares.", game_state)
    if num_shares > available:
        return result(False, f"Only {available} shares available.", game_state)

    if num_shares > 0:
        cost = company.value * num_shares
        if cost > player.cash:
            return result(False, f"Need {cost} cash, have {player.cash}.", game_state)
        player.stocks[company.name] += num_shares
        game_state.available_shares[idx] -= num_shares
        player.cash -= cost

    game_state.rights_issue_queue.pop(0)

    if not game_state.rights_issue_queue:
        company.value = game_state.rights_issue_original_value
        game_state.rights_issue_company = None
        game_state.rights_issue_original_value = None
        game_state.game_phase = "player_turn"
        advance_turn(game_state)

    msg = f"Bought {num_shares} shares in rights issue." if num_shares > 0 else "Passed on rights issue."
    return result(True, msg, game_state)
