"""Registry of tutorial chapters: id -> build() returning a populated Scenario."""

from typing import Callable

from tutorial.chapters import _smoke, debenture, loan_stock, objective, orientation, prices, rights_issue, trading, turns

CHAPTERS: dict[str, Callable] = {
    "orientation": orientation.build,
    "objective": objective.build,
    "prices": prices.build,
    "turns": turns.build,
    "trading": trading.build,
    "loan-stock": loan_stock.build,
    "debenture": debenture.build,
    "rights-issue": rights_issue.build,
    "_smoke": _smoke.build,  # dev-only harness chapter (frontend registers it only in DEV)
}
