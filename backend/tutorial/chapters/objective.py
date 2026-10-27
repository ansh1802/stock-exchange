"""objective — spec Ch 2: the goal in one popup, over the table orientation ends on."""

from tutorial.chapters import orientation


def build():
    s = orientation.table()
    s.chapter_id = "objective"
    s.act(1, {"type": "pass"})
    s.snap("table")
    return s
