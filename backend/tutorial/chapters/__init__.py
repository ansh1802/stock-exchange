"""Registry of tutorial chapters: id -> build() returning a populated Scenario."""

from typing import Callable

CHAPTERS: dict[str, Callable] = {}
