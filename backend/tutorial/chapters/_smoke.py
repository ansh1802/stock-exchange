"""_smoke — dev-only harness chapter: one buy, two bot passes, one closing bell."""

from tutorial.scenario import Scenario


def build():
    s = Scenario("_smoke", ["You", "Meera", "Arjun"])
    s.setup(
        round=2,
        current_turn=0,
        hands={
            1: ["TCS+10", "YesBank-5"],
            2: ["TCS+5", "Reliance-10"],
            3: ["Infosys+15", "TCS-5"],
        },
    )
    s.snap("start")
    s.act(1, {"type": "buy", "company_num": 4, "quantity": 1})
    s.snap("bought")
    s.act(2, {"type": "pass"})
    s.act(3, {"type": "pass"})
    s.snap("bell")
    return s
