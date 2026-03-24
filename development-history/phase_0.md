# Phase 0: Refactor to game_engine.py

## Goal

Refactor the 6-file stock exchange board game into a single `game_engine.py` module with pure functions and serializable state, preparing for WebSocket multiplayer.

## Original Files

| File | Role |
|------|------|
| `stack.py` | Card class, builds 100-card deck (84 company + 16 power cards) |
| `shuffler.py` | Deals 10 cards to each player (hardcoded to 6) |
| `players.py` | Player class (class-level attributes), available shares list |
| `companies.py` | Company class, value fluctuation, 6 companies |
| `turn.py` | Buy/sell/rights issue/debenture/share suspend/currency settlement |
| `main.py` | 10-day game loop with input()/print() |

## Bugs Fixed

1. **Shared class attributes** (`players.py:5-14`) — `hand`, `stocks`, `cash` were class-level, so all Player instances shared state. Moved to `__init__` with instance-level attributes.
2. **Rights issue missing cash/share deduction** (`turn.py:176`) — `rightsbuy()` returned the share count but the calling code never deducted `player.cash` or decremented `available_shares`.
3. **Rights issue wrong recursive args** (`turn.py:170,173`) — `rightsbuy()` called recursively with missing or zero arguments.
4. **Rights issue card check logic** (`turn.py:181-186`) — Loop set `check = False` on every non-matching card, overwriting a previous `True` match.
5. **Shared Card object references** (`stack.py:42-53`) — One Card object per power type appended multiple times; mutating one mutated all.
6. **Hardcoded 6-player distribution** (`shuffler.py`) — Always dealt 6 hands regardless of player count.
7. **prevlist grows unboundedly** (`companies.py:28`) — `fluctuatevalues()` appended to `prevlist` every day without clearing first.

## Architecture

### Constants

```
COMPANY_NAMES = ["Vodafone", "YesBank", "Cred", "TCS", "Reliance", "Infosys"]
COMPANY_BASE_VALUES = [20, 25, 40, 55, 75, 80]
POWER_CARD_NAMES = ["RightsIssue", "ShareSuspend", "LoanStock", "Debenture", "Currency + ", "Currency - "]
STARTING_CASH = 600, STARTING_SHARES = 200, CARDS_PER_HAND = 10
MAX_DAYS = 10, RIGHTS_ISSUE_VALUE = 10, LOAN_STOCK_AMOUNT = 100, CURRENCY_RATE = 0.1
```

### Classes

- **Card** — `company_name`, `value`, `positive`, `is_power`, `to_dict()`
- **Company** — `name`, `value`, `base_value`, `open`, `to_dict()`
- **Player** — `id`, `cash`, `stocks` (dict), `hand` (list), `to_dict()`, `to_public_dict()`
- **GameState** — All mutable state, `to_dict()`, `to_player_dict(player_id)`

### Player.stocks

Changed from 6 separate variables (`vfstock`, `ybstock`, etc.) to a single dict:

```python
stocks = {"Vodafone": 0, "YesBank": 0, "Cred": 0, "TCS": 0, "Reliance": 0, "Infosys": 0}
```

### Deck Composition (100 cards)

**Company cards (84):** For company at index n (0-5), there are n+1 value tiers. Each tier x 2 signs (+/-) x 2 copies.

| Company | Index | Tiers | Cards |
|---------|-------|-------|-------|
| Vodafone | 0 | 1 (5) | 4 |
| YesBank | 1 | 2 (5,10) | 8 |
| Cred | 2 | 3 (5,10,15) | 12 |
| TCS | 3 | 4 (5,10,15,20) | 16 |
| Reliance | 4 | 5 (5,10,15,20,25) | 20 |
| Infosys | 5 | 6 (5,10,15,20,25,30) | 24 |

**Power cards (16):** RightsIssue(2), ShareSuspend(2), LoanStock(2), Debenture(2), Currency+(4), Currency-(4)

### Phase State Machine

```
dealing -> player_turn -> fluctuation -> currency_settlement -> share_suspend -> day_end
                |                                                                   |
                +-- rights_issue (sub-phase) --+                          (loop | game_over)
```

### Action Functions

All return `{"success": bool, "message": str, "new_state": dict}`. None call `input()` or `print()`.

| Function | Phase | Parameters |
|----------|-------|------------|
| `create_game` | — | `num_players` |
| `deal_cards` | dealing | `game_state` |
| `buy_stock` | player_turn | `game_state, player_id, company_num, num_shares` |
| `sell_stock` | player_turn | `game_state, player_id, company_num, num_shares` |
| `pass_turn` | player_turn | `game_state, player_id` |
| `use_loan_stock` | player_turn | `game_state, player_id` |
| `use_debenture` | player_turn | `game_state, player_id, company_num` |
| `use_rights_issue` | player_turn | `game_state, player_id, company_num` |
| `rights_issue_buy` | rights_issue | `game_state, player_id, num_shares` |
| `fluctuate_values` | fluctuation | `game_state` |
| `currency_settlement` | currency_settlement | `game_state` |
| `share_suspend_action` | share_suspend | `game_state, player_id, company_num` (0 to pass) |
| `end_day` | day_end | `game_state` |

### Serialization

- **`to_dict()`** — Full game state as JSON-serializable dict (for server/admin/WebSocket broadcast)
- **`to_player_dict(player_id)`** — Per-player view: own hand visible, other players' hands hidden (only `hand_count` shown)

### Day Flow

1. `deal_cards()` — Shuffle, deal 10 cards to each player (2-6)
2. Player turns — Each player: buy / sell / pass / power card. One action per turn.
3. `fluctuate_values()` — Apply all cards from all hands to company values. Close companies at 0.
4. `currency_settlement()` — Currency+ = +10% cash, Currency- = -10% cash
5. `share_suspend_action()` — Each ShareSuspend card holder can swap a company's value with its pre-fluctuation value (or pass)
6. `end_day()` — Rotate player order (first -> last), advance day counter

### Rights Issue Flow (multi-step)

1. Player calls `use_rights_issue(gs, player_id, company_num)`
2. Company value set to 10 temporarily
3. Queue built: all players holding shares of that company, starting from current player wrapping around
4. Each queued player calls `rights_issue_buy(gs, player_id, num_shares)` (0 to pass)
5. Max shares = holdings / 2, limited by available shares and cash
6. When queue empties: company value restored, phase returns to player_turn

### Key Design Decisions

- **Mutate in place** — Action functions mutate `game_state` and return serialized `new_state` dict. Validation happens before any mutation, so failed actions leave state unchanged.
- **1-based company numbers** — API uses 1-6 for company selection (matching original UI), converted internally to 0-based indices.
- **Three rounds per day** — Each day has 3 rounds (each player acts 3 times before fluctuation). The original `main.py` had `for rounds in range(1)` — a bug limiting it to 1 round. Fixed to `rounds_per_day = 3`.
- **Cards not consumed** — Power cards stay in hand after use (matching original behavior). Cards in hand also affect fluctuation.
- **Suspend queue allows repeats** — If a player holds 2 ShareSuspend cards, they appear twice in the queue (one action per card, matching original).
