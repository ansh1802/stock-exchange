"""Registry of tutorial chapters: id -> build() returning a populated Scenario."""

from typing import Callable

from tutorial.chapters import _smoke

CHAPTERS: dict[str, Callable] = {
    "_smoke": _smoke.build,  # dev-only harness chapter (frontend registers it only in DEV)
}
