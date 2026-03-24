"""test_game.py — Manual integration test for game_engine.py

Simulates a real game day with 3 players:
  Ansh (ID 1), Rahul (ID 2), Priya (ID 3)
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend"))
import game_engine as ge

# ── Helpers ───────────────────────────────────────────────────────────────────

NAMES = {1: "Ansh", 2: "Rahul", 3: "Priya"}
# Company numbers (1-based, matching engine API)
TCS = 4
RELIANCE = 5


def header(title):
    print(f"\n{'═' * 56}")
    print(f"  {title}")
    print(f"{'═' * 56}")


def section(title):
    print(f"\n  ── {title} ──")


def act(description, result):
    tag = "✓" if result["success"] else "✗"
    print(f"    [{tag}] {description}")
    print(f"        {result['message']}")
    return result


def print_hand(player):
    company_cards = [
        f"{c['company_name']} {'+'if c['positive'] else '-'}{c['value']}"
        for c in player["hand"]
        if not c["is_power"]
    ]
    power_cards = [c["company_name"] for c in player["hand"] if c["is_power"]]
    print(f"    Company: {', '.join(company_cards) or '(none)'}")
    if power_cards:
        print(f"    Power:   {', '.join(power_cards)}")


def print_portfolio(player):
    name = NAMES[player["id"]]
    stocks = {k: v for k, v in player["stocks"].items() if v > 0}
    stock_str = ", ".join(f"{v} {k}" for k, v in stocks.items()) or "(none)"
    print(f"    {name:<8}  cash: {player['cash']:>7.1f}  |  stocks: {stock_str}")


# ── 1. Create game ────────────────────────────────────────────────────────────

header("1. Creating Game — 3 Players")
gs = ge.GameState(3)
assert gs.rounds_per_day == 3   # 3 rounds per day

print(f"  Players : {', '.join(NAMES.values())}")
print(f"  Days    : {ge.MAX_DAYS}")
print(f"  Cash    : {ge.STARTING_CASH} each")
print(f"  Shares  : {ge.STARTING_SHARES} per company")


# ── 2. Deal cards ─────────────────────────────────────────────────────────────

header("2. Day 1 — Dealing Cards")
act("Dealing 10 cards to each player", ge.deal_cards(gs))


# ── 3. Print hands ────────────────────────────────────────────────────────────

header("3. Player Hands & Cash")
for player in gs.to_dict()["players"]:
    name = NAMES[player["id"]]
    print(f"\n  {name}  (cash: {player['cash']})")
    print_hand(player)


# ── 4. Simulate moves ─────────────────────────────────────────────────────────

header("4. Trading")

section("Round 1 of 3")
# TCS base value = 55, so 5 shares = 275. Ansh: 600 - 275 = 325 remaining.
act("Ansh  — buy 5 TCS  @ 55  (cost 275)",  ge.buy_stock(gs, 1, TCS, 5))
# Reliance base value = 75, so 3 shares = 225. Rahul: 600 - 225 = 375 remaining.
act("Rahul — buy 3 Reliance @ 75  (cost 225)", ge.buy_stock(gs, 2, RELIANCE, 3))
act("Priya — pass",                            ge.pass_turn(gs, 3))

section("Round 2 of 3")
# Ansh has 325 cash. Max affordable = int(325/55) = 5. Try 10 → should fail.
act("Ansh  — try to buy 10 TCS (can't afford)", ge.buy_stock(gs, 1, TCS, 10))
act("Ansh  — pass",                              ge.pass_turn(gs, 1))
# Rahul has 3 Reliance; sell 1 back.
act("Rahul — sell 1 Reliance @ 75 (revenue 75)", ge.sell_stock(gs, 2, RELIANCE, 1))
act("Priya — pass",                               ge.pass_turn(gs, 3))

section("Round 3 of 3")
act("Ansh  — pass", ge.pass_turn(gs, 1))
act("Rahul — pass", ge.pass_turn(gs, 2))
act("Priya — pass", ge.pass_turn(gs, 3))

print(f"\n  Phase after trading: {gs.game_phase}")  # should be "fluctuation"


# ── 5 & 6. Fluctuate values ───────────────────────────────────────────────────

header("5 & 6. Value Fluctuation")

before = {c.name: c.value for c in gs.companies}
act("Fluctuating company values based on all hands", ge.fluctuate_values(gs))
after  = {c.name: c.value for c in gs.companies}
closed = {c.name for c in gs.companies if not c.open}

print(f"\n  {'Company':<12} {'Before':>8} {'After':>8} {'Change':>8}  Status")
print(f"  {'─'*52}")
for name in ge.COMPANY_NAMES:
    delta  = after[name] - before[name]
    status = "CLOSED" if name in closed else "open"
    print(f"  {name:<12} {before[name]:>8} {after[name]:>8} {delta:>+8}  {status}")


# ── Currency settlement ───────────────────────────────────────────────────────

section("Currency Settlement")
act("Applying Currency +/- card effects", ge.currency_settlement(gs))

# Handle share suspend: auto-pass everyone (demo purposes)
if gs.game_phase == "share_suspend":
    section("Share Suspend")
    while gs.suspend_queue:
        pid = gs.suspend_queue[0]
        act(f"{NAMES[pid]} passes on share suspend", ge.share_suspend_action(gs, pid, 0))


# ── 7. End-of-day portfolios ──────────────────────────────────────────────────

header("7. End-of-Day Portfolios")
print()
for player in gs.to_dict()["players"]:
    print_portfolio(player)

print(f"\n  Phase: {gs.game_phase}")   # should be "day_end"

# Advance to day 2 to confirm rotation works
act("Ending day 1", ge.end_day(gs))
print(f"  Phase: {gs.game_phase}  |  Day: {gs.current_day}")
print(f"  New turn order: {[NAMES[p.id] for p in gs.players]}")


# ── 8. Full game state JSON ───────────────────────────────────────────────────

header("8. Full Game State — WebSocket Payload (to_dict)")
print(json.dumps(gs.to_dict(), indent=2))

header("8b. Per-Player View — Ansh only sees her own hand (to_player_dict)")
print(json.dumps(gs.to_player_dict(1), indent=2))
