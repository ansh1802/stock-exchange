"""Registry of tutorial chapters: id -> build() returning a populated Scenario."""

from typing import Callable

from tutorial.chapters import _smoke, objective, orientation, prices, trading, turns

CHAPTERS: dict[str, Callable] = {
    "orientation": orientation.build,
    "objective": objective.build,
    "prices": prices.build,
    "turns": turns.build,
    "trading": trading.build,
    "_smoke": _smoke.build,  # dev-only harness chapter (frontend registers it only in DEV)
}
