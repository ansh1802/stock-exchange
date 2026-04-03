"""test_mechanics.py — Targeted tests for chairman/director, power card consumption, and rights issue queue.

Tests exercise the engine directly with controlled state (injected hands/holdings).
"""

import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))

import game_engine as ge
from engine.models import Card
from engine.helpers import update_positions

NAMES = {1: "Ansh", 2: "Rahul", 3: "Priya"}
TCS = 4       # company_num (1-based)
RELIANCE = 5
VODAFONE = 1

passed = 0
failed = 0

def header(title):
    print(f"\n{'═' * 60}")
    print(f"  {title}")
    print(f"{'═' * 60}")

def check(desc, condition):
    global passed, failed
    tag = "✓" if condition else "✗ FAIL"
    print(f"  [{tag}] {desc}")
    if condition:
        passed += 1
    else:
        failed += 1
    return condition

def act(desc, result):
    tag = "✓" if result["success"] else "✗"
    print(f"    [{tag}] {desc}: {result['message']}")
    return result

def make_card(company, value, positive=True):
    return Card(company, value, positive=positive, is_power=False)

def make_power(name):
    return Card(name, 0, positive=True, is_power=True)

def fast_forward_turns(gs, num_turns):
    """Pass turns to advance through player_turn phase."""
    for _ in range(num_turns):
        pid = gs.players[gs.current_turn].id
        ge.pass_turn(gs, pid)
        if gs.game_phase != "player_turn":
            break

def setup_game(num_players=3):
    """Create a game in player_turn phase with clean hands."""
    gs = ge.GameState(num_players)
    ge.deal_cards(gs)
    # Clear all hands for controlled testing
    for p in gs.players:
        p.hand = []
    return gs


# ═══════════════════════════════════════════════════════════════════════════════
#  TEST 1: Power Card Consumption
# ═══════════════════════════════════════════════════════════════════════════════

header("TEST 1: Power Card Consumption — LoanStock")

gs = setup_game()
p1 = gs.players[0]  # Ansh, ID 1

# Give player 1 exactly one LoanStock card
p1.hand = [make_power("LoanStock")]
check("Player 1 has 1 LoanStock card", len([c for c in p1.hand if c.company_name == "LoanStock"]) == 1)

cash_before = p1.cash
r = act("Use LoanStock", ge.use_loan_stock(gs, p1.id))
check("LoanStock succeeded", r["success"])
check(f"Cash increased by {ge.LOAN_STOCK_AMOUNT}", p1.cash == cash_before + ge.LOAN_STOCK_AMOUNT)
check("LoanStock card removed from hand", len([c for c in p1.hand if c.company_name == "LoanStock"]) == 0)
check("Hand is now empty", len(p1.hand) == 0)

# Try to use LoanStock again — should fail
# Need to reset turn to player 1 (pass_turn was called internally by use_loan_stock)
gs.current_turn = 0  # force back to player 1's turn index
gs.game_phase = "player_turn"
r = act("Try LoanStock again (should fail)", ge.use_loan_stock(gs, p1.id))
check("Second use rejected", not r["success"])
check("Error mentions missing card", "don't have" in r["message"])


header("TEST 1b: Power Card Consumption — Debenture")

gs = setup_game()
p1 = gs.players[0]

# Close a company so Debenture has a target
gs.companies[0].open = False  # Vodafone closed
gs.companies[0].value = 0

p1.hand = [make_power("Debenture")]
check("Player 1 has 1 Debenture card", len([c for c in p1.hand if c.company_name == "Debenture"]) == 1)

r = act("Use Debenture on Vodafone", ge.use_debenture(gs, p1.id, VODAFONE))
check("Debenture succeeded", r["success"])
check("Vodafone reopened", gs.companies[0].open)
check(f"Vodafone at base value {gs.companies[0].base_value}", gs.companies[0].value == gs.companies[0].base_value)
check("Debenture card removed from hand", len([c for c in p1.hand if c.company_name == "Debenture"]) == 0)

# Try again — should fail
gs.companies[0].open = False  # close it again
gs.companies[0].value = 0
gs.current_turn = 0
gs.game_phase = "player_turn"
r = act("Try Debenture again (should fail)", ge.use_debenture(gs, p1.id, VODAFONE))
check("Second Debenture rejected", not r["success"])
check("Error mentions missing card", "don't have" in r["message"])


header("TEST 1c: Power Card Consumption — RightsIssue")

gs = setup_game()
p1, p2 = gs.players[0], gs.players[1]

# Player 1 needs to hold shares for rights issue to have eligible buyers
p1.stocks["TCS"] = 10
p2.stocks["TCS"] = 5

p1.hand = [make_power("RightsIssue")]
check("Player 1 has 1 RightsIssue card", len([c for c in p1.hand if c.company_name == "RightsIssue"]) == 1)

tcs_value_before = gs.companies[3].value  # TCS is index 3
r = act("Use RightsIssue on TCS", ge.use_rights_issue(gs, p1.id, TCS))
check("RightsIssue succeeded", r["success"])
check("Phase changed to rights_issue", gs.game_phase == "rights_issue")
check("RightsIssue card removed from hand", len([c for c in p1.hand if c.company_name == "RightsIssue"]) == 0)
check(f"TCS value temporarily set to {ge.RIGHTS_ISSUE_VALUE}", gs.companies[3].value == ge.RIGHTS_ISSUE_VALUE)

# Clean up: drain the rights issue queue
while gs.rights_issue_queue:
    pid = gs.rights_issue_queue[0]
    ge.rights_issue_buy(gs, pid, 0)  # pass

check("Back to player_turn after queue drained", gs.game_phase == "player_turn")
check(f"TCS value restored to {tcs_value_before}", gs.companies[3].value == tcs_value_before)

# Try RightsIssue again — should fail
gs.current_turn = 0
gs.game_phase = "player_turn"
r = act("Try RightsIssue again (should fail)", ge.use_rights_issue(gs, p1.id, TCS))
check("Second RightsIssue rejected", not r["success"])
check("Error mentions missing card", "don't have" in r["message"])


# ═══════════════════════════════════════════════════════════════════════════════
#  TEST 2: Rights Issue Queue with Multiple Stockholders
# ═══════════════════════════════════════════════════════════════════════════════

header("TEST 2: Rights Issue Queue — Multiple Stockholders")

gs = setup_game()
p1, p2, p3 = gs.players[0], gs.players[1], gs.players[2]

# Setup: player 1 and 2 hold TCS, player 3 does not
p1.stocks["TCS"] = 20
p2.stocks["TCS"] = 10
p3.stocks["TCS"] = 0
p1.hand = [make_power("RightsIssue")]

r = act("Player 1 triggers rights issue on TCS", ge.use_rights_issue(gs, p1.id, TCS))
check("Succeeded", r["success"])
check("Phase is rights_issue", gs.game_phase == "rights_issue")
check("Queue has 2 entries (players 1 and 2)", len(gs.rights_issue_queue) == 2)
check("Player 3 NOT in queue (no TCS shares)", p3.id not in gs.rights_issue_queue)
check("Player 1 is first in queue", gs.rights_issue_queue[0] == p1.id)
check("Player 2 is second in queue", gs.rights_issue_queue[1] == p2.id)

# Player 1 buys (max = 20/2 = 10, at $10 each = $100)
p1_cash_before = p1.cash
p1_shares_before = p1.stocks["TCS"]
r = act("Player 1 buys 5 shares in rights issue", ge.rights_issue_buy(gs, p1.id, 5))
check("Player 1 buy succeeded", r["success"])
check("Player 1 gained 5 TCS shares", p1.stocks["TCS"] == p1_shares_before + 5)
check(f"Player 1 paid 5×{ge.RIGHTS_ISSUE_VALUE} = {5 * ge.RIGHTS_ISSUE_VALUE}", p1.cash == p1_cash_before - 5 * ge.RIGHTS_ISSUE_VALUE)
check("Queue now has 1 entry", len(gs.rights_issue_queue) == 1)
check("Player 2 is now first in queue", gs.rights_issue_queue[0] == p2.id)
check("Still in rights_issue phase", gs.game_phase == "rights_issue")

# Player 2 passes
p2_shares_before = p2.stocks["TCS"]
r = act("Player 2 passes on rights issue", ge.rights_issue_buy(gs, p2.id, 0))
check("Player 2 pass succeeded", r["success"])
check("Player 2 shares unchanged", p2.stocks["TCS"] == p2_shares_before)
check("Queue is empty", len(gs.rights_issue_queue) == 0)
check("Back to player_turn", gs.game_phase == "player_turn")
check("TCS value restored (not 10 anymore)", gs.companies[3].value != ge.RIGHTS_ISSUE_VALUE)


header("TEST 2b: Rights Issue — Wrong player can't act")

gs = setup_game()
p1, p2 = gs.players[0], gs.players[1]
p1.stocks["TCS"] = 20
p2.stocks["TCS"] = 10
p1.hand = [make_power("RightsIssue")]

ge.use_rights_issue(gs, p1.id, TCS)
check("Player 1 is first in queue", gs.rights_issue_queue[0] == p1.id)

r = act("Player 2 tries to buy (not their turn)", ge.rights_issue_buy(gs, p2.id, 3))
check("Rejected — not their turn", not r["success"])
check("Error mentions turn", "not your turn" in r["message"].lower())

# Player with no shares tries
r = act("Player 3 tries to buy (not in queue)", ge.rights_issue_buy(gs, gs.players[2].id, 1))
check("Rejected — not in queue", not r["success"])


header("TEST 2c: Rights Issue — Over-buy rejected")

# Still in the same game, player 1 tries to buy more than eligible
max_eligible = p1.stocks["TCS"] // 2  # 20/2 = 10
r = act(f"Player 1 tries to buy {max_eligible + 1} (over limit)", ge.rights_issue_buy(gs, p1.id, max_eligible + 1))
check("Over-buy rejected", not r["success"])
check("Error mentions eligible limit", "eligible" in r["message"].lower() or "at most" in r["message"].lower())


# ═══════════════════════════════════════════════════════════════════════════════
#  TEST 3: Chairman/Director Discard Flow
# ═══════════════════════════════════════════════════════════════════════════════

header("TEST 3a: Director (50 shares) — Discard 1 Own Card")

gs = setup_game()
p1, p2, p3 = gs.players[0], gs.players[1], gs.players[2]

# Player 2 has 50 TCS shares → Director
p2.stocks["TCS"] = 50
update_positions(gs, p2, "TCS")
check("Player 2 is TCS director", p2.id in gs.directors["TCS"])
check("No TCS chairman", gs.chairman["TCS"] is None)

# Give player 2 some TCS company cards (these are what can be discarded)
p2.hand = [
    make_card("TCS", 10, positive=True),
    make_card("TCS", 5, positive=False),
    make_card("Reliance", 15, positive=True),  # not TCS — can't discard this
]

# Advance to card_reveal phase
gs.game_phase = "card_reveal"
r = act("Begin card reveal", ge.begin_card_reveal(gs))
check("Card reveal started", r["success"])
check("CD queue has 1 entry", len(gs.chairman_director_queue) == 1)

entry = gs.chairman_director_queue[0]
check(f"Queue entry is Player 2 as director", entry[0] == p2.id and entry[2] == "director")

# Player 2 (director) discards their first TCS card (index 0)
hand_size_before = len(p2.hand)
r = act("Player 2 (director) discards TCS card index 0", ge.chairman_director_action(gs, p2.id, 0))
check("Director discard succeeded", r["success"])
check("Hand shrunk by 1", len(p2.hand) == hand_size_before - 1)
check("CD queue empty after action", len(gs.chairman_director_queue) == 0)

# The discarded card was TCS +10 — verify it's gone, TCS -5 still there
remaining_tcs = [c for c in p2.hand if c.company_name == "TCS"]
check("1 TCS card remains (the -5 one)", len(remaining_tcs) == 1 and remaining_tcs[0].value == 5)


header("TEST 3b: Chairman (100 shares) — Discard Own + Other Player's Card")

gs = setup_game()
p1, p2, p3 = gs.players[0], gs.players[1], gs.players[2]

# Player 1 has 100 TCS shares → Chairman
p1.stocks["TCS"] = 100
update_positions(gs, p1, "TCS")
check("Player 1 is TCS chairman", gs.chairman["TCS"] == p1.id)

# Give player 1 TCS cards
p1.hand = [
    make_card("TCS", 20, positive=True),
    make_card("TCS", 10, positive=False),
]

# Give player 3 some TCS cards (chairman will discard one from them)
p3.hand = [
    make_card("TCS", 15, positive=True),
    make_card("TCS", 5, positive=False),
    make_card("Reliance", 10, positive=True),
]

# Advance to card_reveal
gs.game_phase = "card_reveal"
r = act("Begin card reveal", ge.begin_card_reveal(gs))
check("CD queue has chairman entry", len(gs.chairman_director_queue) >= 1)

entry = gs.chairman_director_queue[0]
check(f"Queue entry is Player 1 as chairman", entry[0] == p1.id and entry[2] == "chairman")

p1_hand_before = len(p1.hand)
p3_hand_before = len(p3.hand)

# Chairman discards own card index 0 (TCS +20) AND player 3's TCS card index 1 (TCS -5)
r = act(
    "Player 1 (chairman) discards own TCS[0] + Player 3's TCS[1]",
    ge.chairman_director_action(gs, p1.id, 0, discard_other_player_id=p3.id, discard_other_idx=1),
)
check("Chairman discard succeeded", r["success"])
check("Player 1 hand shrunk by 1", len(p1.hand) == p1_hand_before - 1)
check("Player 3 hand shrunk by 1", len(p3.hand) == p3_hand_before - 1)

# Verify which cards remain
p1_tcs = [c for c in p1.hand if c.company_name == "TCS"]
check("Player 1 has TCS -10 remaining", len(p1_tcs) == 1 and p1_tcs[0].value == 10 and not p1_tcs[0].positive)

p3_tcs = [c for c in p3.hand if c.company_name == "TCS"]
check("Player 3 has TCS +15 remaining (the -5 was discarded)", len(p3_tcs) == 1 and p3_tcs[0].value == 15)


header("TEST 3c: Chairman must provide target — validation")

gs = setup_game()
p1 = gs.players[0]
p1.stocks["TCS"] = 100
update_positions(gs, p1, "TCS")

p1.hand = [make_card("TCS", 10, positive=True)]
gs.players[2].hand = [make_card("TCS", 5, positive=True)]

gs.game_phase = "card_reveal"
ge.begin_card_reveal(gs)

# Chairman tries to discard without specifying a target
r = act("Chairman discards own but no target specified", ge.chairman_director_action(gs, p1.id, 0))
check("Rejected — must choose target", not r["success"])
check("Error mentions other player", "another player" in r["message"].lower() or "must choose" in r["message"].lower())

# Chairman can't target themselves
r = act(
    "Chairman targets self (invalid)",
    ge.chairman_director_action(gs, p1.id, 0, discard_other_player_id=p1.id, discard_other_idx=0),
)
check("Rejected — can't target self", not r["success"])


header("TEST 3d: Double Director (100 shares, not chairman) — Discard 2 Cards")

gs = setup_game()
p1, p2 = gs.players[0], gs.players[1]

# Player 1 gets chairman first (100 shares), then Player 2 also reaches 100 → double director
p1.stocks["TCS"] = 100
update_positions(gs, p1, "TCS")
check("Player 1 is TCS chairman", gs.chairman["TCS"] == p1.id)

p2.stocks["TCS"] = 100
update_positions(gs, p2, "TCS")
check("Player 2 is TCS director (double)", p2.id in gs.directors["TCS"])
check("Player 2 is NOT chairman", gs.chairman["TCS"] != p2.id)

# Give hands
p1.hand = [make_card("TCS", 20, positive=True)]
p2.hand = [
    make_card("TCS", 10, positive=True),
    make_card("TCS", 15, positive=False),
    make_card("TCS", 5, positive=True),
]
# Player 3 needs a TCS card for chairman to target
gs.players[2].hand = [make_card("TCS", 5, positive=False)]

gs.game_phase = "card_reveal"
r = act("Begin card reveal", ge.begin_card_reveal(gs))
check("Card reveal started", r["success"])

# Find the entries
roles = {entry[2]: entry for entry in gs.chairman_director_queue}
check("Chairman entry in queue", "chairman" in roles)
check("Double director entry in queue", "double_director" in roles)

# Process chairman first (queue is ordered: chairman before directors)
chairman_entry = gs.chairman_director_queue[0]
check("Chairman is first in queue", chairman_entry[2] == "chairman")
r = act(
    "Chairman (Player 1) discards own[0] + Player 3's TCS[0]",
    ge.chairman_director_action(gs, p1.id, 0, discard_other_player_id=gs.players[2].id, discard_other_idx=0),
)
check("Chairman action succeeded", r["success"])

# Now double director's turn
check("Double director is next in queue", gs.chairman_director_queue[0][2] == "double_director")
p2_hand_before = len(p2.hand)

r = act(
    "Double director (Player 2) discards 2 TCS cards [0, 1]",
    ge.chairman_director_action(gs, p2.id, [0, 1]),
)
check("Double director discard succeeded", r["success"])
check("Player 2 hand shrunk by 2", len(p2.hand) == p2_hand_before - 2)
check("CD queue now empty", len(gs.chairman_director_queue) == 0)

# Only 1 TCS card should remain for player 2 (the third one, value=5 positive)
p2_tcs = [c for c in p2.hand if c.company_name == "TCS"]
check("Player 2 has 1 TCS card remaining", len(p2_tcs) == 1)
check("Remaining card is TCS +5", p2_tcs[0].value == 5 and p2_tcs[0].positive)


header("TEST 3e: Position Revocation on Sell")

gs = setup_game()
p1 = gs.players[0]

# Player 1 buys to chairman level
p1.stocks["TCS"] = 100
update_positions(gs, p1, "TCS")
check("Player 1 is TCS chairman at 100 shares", gs.chairman["TCS"] == p1.id)

# Sell below threshold
p1.stocks["TCS"] = 90
update_positions(gs, p1, "TCS")
check("Chairman revoked after dropping below 100", gs.chairman["TCS"] is None)

# Director level
p1.stocks["TCS"] = 60
update_positions(gs, p1, "TCS")
check("Player 1 is TCS director at 60 shares", p1.id in gs.directors["TCS"])

p1.stocks["TCS"] = 40
update_positions(gs, p1, "TCS")
check("Director revoked after dropping below 50", p1.id not in gs.directors["TCS"])


header("TEST 3f: Chairman/Director Queue Skips Players Without Company Cards")

gs = setup_game()
p1, p2 = gs.players[0], gs.players[1]

# Both are directors of TCS
p1.stocks["TCS"] = 60
p2.stocks["TCS"] = 60
update_positions(gs, p1, "TCS")
update_positions(gs, p2, "TCS")
check("Player 1 is TCS director", p1.id in gs.directors["TCS"])
check("Player 2 is TCS director", p2.id in gs.directors["TCS"])

# Player 1 has TCS cards, player 2 does NOT
p1.hand = [make_card("TCS", 10, positive=True)]
p2.hand = [make_card("Reliance", 15, positive=True)]  # no TCS cards

gs.game_phase = "card_reveal"
r = act("Begin card reveal", ge.begin_card_reveal(gs))

# Player 2 should NOT be in the queue (no TCS cards to discard)
queue_pids = [entry[0] for entry in gs.chairman_director_queue]
check("Player 1 in CD queue", p1.id in queue_pids)
check("Player 2 NOT in CD queue (no TCS cards)", p2.id not in queue_pids)


header("TEST 3g: Reveal Data Recomputed After Discard")

gs = setup_game()
p1, p2 = gs.players[0], gs.players[1]

p1.stocks["TCS"] = 100
update_positions(gs, p1, "TCS")

# Player 1 has a big positive TCS card they'll discard
p1.hand = [make_card("TCS", 20, positive=True)]
# Player 2 has a TCS card the chairman will target
p2.hand = [make_card("TCS", 10, positive=True)]

gs.game_phase = "card_reveal"
ge.begin_card_reveal(gs)

# Check reveal_data for TCS before discard
tcs_reveal = next(r for r in gs.reveal_data if r["company_name"] == "TCS")
delta_before = tcs_reveal["delta"]
check(f"TCS delta before discard: {delta_before} (+20 +10 = +30)", delta_before == 30)

# Chairman discards own TCS +20 and Player 2's TCS +10
ge.chairman_director_action(gs, p1.id, 0, discard_other_player_id=p2.id, discard_other_idx=0)

# Reveal data should be recomputed — both cards gone, delta should be 0
tcs_reveal = next(r for r in gs.reveal_data if r["company_name"] == "TCS")
check(f"TCS delta after discard: {tcs_reveal['delta']} (should be 0)", tcs_reveal["delta"] == 0)
check(f"TCS new_value equals old_value (no change)", tcs_reveal["new_value"] == tcs_reveal["old_value"])


# ═══════════════════════════════════════════════════════════════════════════════
#  SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

print(f"\n{'═' * 60}")
print(f"  RESULTS: {passed} passed, {failed} failed")
print(f"{'═' * 60}")

if failed > 0:
    sys.exit(1)
else:
    print("\n  All tests passed!\n")
