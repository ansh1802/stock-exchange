# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A stock exchange board game engine (2-6 players, 10 days, 3 rounds/day) refactored for WebSocket multiplayer. Pure Python, no external dependencies. All game logic is I/O-free — no `input()` or `print()` in the engine.

## Running Tests

```bash
python tests/test_game.py
```

There is no test framework — `tests/test_game.py` is a manual integration test that simulates a full game day and prints results. Verify correctness by reading the output.

## Architecture

**Entry point:** `game_engine.py` — thin wrapper that re-exports everything from `engine/` and adds `create_game()`.

**`engine/` package** (import via `import game_engine as ge`):

- `constants.py` — All game config (company names/values, card counts, cash/share defaults)
- `models.py` — `Card`, `Company`, `Player`, `GameState` classes with `to_dict()` serialization
- `deck.py` — `build_deck()` generates the 100-card deck (84 company + 16 power)
- `helpers.py` — Shared validation (`validate_turn`, `validate_company`, `advance_turn`) and the `result()` response builder
- `actions.py` — Player turn actions: `buy_stock`, `sell_stock`, `pass_turn`, `use_loan_stock`, `use_debenture`, `use_rights_issue`, `rights_issue_buy`
- `phases.py` — Phase transitions: `deal_cards`, `fluctuate_values`, `currency_settlement`, `share_suspend_action`, `end_day`

**Dependency flow:** `constants` ← `models` ← `deck`, `helpers` ← `actions`, `phases`. No circular imports.

## Key Design Contracts

**Every action/phase function** returns `{"success": bool, "message": str, "new_state": dict}`. Failed actions return early without mutating state.

**Phase state machine:** `dealing → player_turn → fluctuation → currency_settlement → share_suspend → day_end → (dealing | game_over)`. The `rights_issue` sub-phase interrupts `player_turn` and returns to it when complete.

**Company numbers are 1-based** in the public API (matching the original game UI), converted to 0-based internally.

**`GameState.to_player_dict(player_id)`** hides other players' hands (shows only `hand_count`). `to_dict()` exposes everything (for server/admin use).

## Other Directories

- `base_logic_old/` — Original 6-file implementation kept for reference. Do not modify.
- `development-history/` — Design documents. `phase_0.md` details the refactoring, bugs fixed, and game mechanics.
