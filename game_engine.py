"""game_engine.py — Stock Exchange Board Game Engine

Public API — import this module to use the game engine.
All internals live in the engine/ package.

All game actions return:
    {"success": bool, "message": str, "new_state": dict}
No function calls input() or print().
"""

from engine import *  # re-export full public API
from engine.helpers import result


def create_game(num_players):
    """Create a new GameState with 2-6 players."""
    gs = GameState(num_players)
    return result(True, f"Game created with {num_players} players.", gs)
