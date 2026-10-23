"""Write tutorial fixtures: backend/venv/bin/python backend/tutorial/build_fixtures.py [--check] [chapter ...]

--check writes nothing and exits 1 if any chapter's output differs from disk.
"""

import json
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(_HERE))  # backend/

from tutorial.chapters import CHAPTERS  # noqa: E402

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(_HERE)), "frontend", "src", "tutorial", "fixtures")


def render(chapter_id):
    return json.dumps(CHAPTERS[chapter_id]().to_fixture(), indent=1, sort_keys=True) + "\n"


def main(argv=None):
    args = list(sys.argv[1:] if argv is None else argv)
    check = "--check" in args
    ids = [a for a in args if a != "--check"] or list(CHAPTERS)
    unknown = [i for i in ids if i not in CHAPTERS]
    if unknown:
        print(f"Unknown chapter(s): {', '.join(unknown)}")
        return 2
    drifted = []
    for cid in ids:
        text = render(cid)
        path = os.path.join(OUT_DIR, f"{cid}.json")
        if check:
            try:
                with open(path) as f:
                    same = f.read() == text
            except FileNotFoundError:
                same = False
            if not same:
                drifted.append(cid)
        else:
            os.makedirs(OUT_DIR, exist_ok=True)
            with open(path, "w") as f:
                f.write(text)
            print(f"wrote {path}")
    if drifted:
        print(f"Fixture drift: {', '.join(drifted)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
