"""Scenario — drives the real engine/server code synchronously to record tutorial snapshots."""

import copy
import re

import game_engine as ge
import server
from engine.constants import COMPANY_NAMES
from engine.helpers import active_players, first_active_index, update_positions
from engine.models import Card
from room_manager import BotSocket, PlayerConn, Room

_POWER = {
    "RightsIssue": "RightsIssue",
    "ShareSuspend": "ShareSuspend",
    "LoanStock": "LoanStock",
    "Debenture": "Debenture",
    "Currency+": "Currency + ",
    "Currency-": "Currency - ",
}
_COMPANY_CARD = re.compile(r"^([A-Za-z]+)([+-])(\d+)$")


def parse_card(spec):
    if spec in _POWER:
        return Card(_POWER[spec], 0, True, True)
    m = _COMPANY_CARD.match(spec)
    if not m or m.group(1) not in COMPANY_NAMES:
        raise ValueError(f"Bad card spec: {spec!r}")
    return Card(m.group(1), int(m.group(3)), m.group(2) == "+", False)


class Scenario:
    def __init__(self, chapter_id, seats, human_id=1):
        self.chapter_id = chapter_id
        self.human_id = human_id
        self.snapshots = {}
        room = Room("TUTR")
        for i, name in enumerate(seats, start=1):
            if i == human_id:
                conn = PlayerConn(i, name, None)
            else:
                conn = PlayerConn(i, name, BotSocket(), bot_difficulty="easy")
            room.players[i] = conn
            room._name_to_id[name] = i
        room.host_id = human_id
        room.started = True
        room.turn_timer_seconds = 90
        room.game = ge.GameState(len(seats), player_ids=list(room.players))
        room.game.game_phase = "player_turn"
        self.room = room

    @property
    def game(self):
        return self.room.game

    def setup(self, *, prices=None, closed=None, cash=None, stocks=None, hands=None,
              day=None, price_history=None, networth_history=None,
              current_turn=None, round=None):
        g = self.game
        names = COMPANY_NAMES
        for name, value in (prices or {}).items():
            g.companies[names.index(name)].value = value
        for name in closed or []:
            g.companies[names.index(name)].open = False
        by_id = {p.id: p for p in g.players}
        for pid, amount in (cash or {}).items():
            by_id[pid].cash = amount
        for pid, holdings in (stocks or {}).items():
            for name, qty in holdings.items():
                by_id[pid].stocks[name] = qty
        for pid, specs in (hands or {}).items():
            by_id[pid].hand = [parse_card(s) for s in specs]
        if day is not None:
            g.current_day = day
        if price_history is not None:
            g.price_history = copy.deepcopy(price_history)
        if networth_history is not None:
            g.networth_history = copy.deepcopy(networth_history)
        if current_turn is not None:
            g.current_turn = current_turn
        if round is not None:
            g.current_round = round
        for i, name in enumerate(names):
            g.available_shares[i] = 200 - sum(p.stocks[name] for p in g.players)
            for p in g.players:
                update_positions(g, p, name)

    def act(self, player_id, msg, early_snap=None):
        """Dispatch like server.after_action. `early_snap` records the state before
        auto-advance, mirroring the server's early broadcast after a chairman/director
        action (the last discard ends the day, and dealing clears reveal_data)."""
        result = server.dispatch_action(self.game, player_id, msg)
        assert result is not None, f"Unknown action: {msg!r}"
        assert result["success"], result["message"]
        # Mirror server.after_action's logging (skip idempotent / waiting acks).
        message = result["message"]
        if "already" not in message and not message.startswith("Waiting for"):
            conn = self.room.players.get(player_id)
            actor = conn.name if conn else f"Player {player_id}"
            self.room.game_log.append(f"{actor}: {message}")
        if early_snap is not None:
            self.snap(early_snap)
        self._advance()
        return result

    def _advance(self):
        """Synchronous mirror of server.auto_advance; stops where input/animation is needed."""
        g = self.game
        while True:
            phase = g.game_phase
            if phase == "card_reveal" and not g.reveal_data:
                r = ge.begin_card_reveal(g)
                self.room.game_log.append(r["message"])
            elif phase == "day_end":
                r = ge.end_day(g)
                self.room.game_log.append(r["message"])
                if g.game_phase == "game_over":
                    return
            else:
                # dealing (next_day sets hands), card_reveal w/ data, share_suspend,
                # rights_issue, player_turn, game_over
                return

    def ack_reveal(self):
        for p in active_players(self.game):
            r = ge.complete_card_reveal(self.game, p.id)
            assert r["success"], r["message"]
        self._advance()

    def next_day(self, hands):
        g = self.game
        assert g.game_phase == "dealing", f"next_day requires dealing, got {g.game_phase}"
        by_id = {p.id: p for p in g.players}
        for p in g.players:
            p.hand = []
        for pid, specs in hands.items():
            by_id[pid].hand = [parse_card(s) for s in specs]
        g.reveal_data = []
        g.reveal_complete_players = set()
        g.game_phase = "player_turn"
        g.current_turn = first_active_index(g)
        g.current_round = 0
        self.room.game_log.append(f"Day {g.current_day}: cards dealt.")

    def snap(self, snap_id):
        if snap_id in self.snapshots:
            raise ValueError(f"Duplicate snapshot id: {snap_id}")
        self.room.turn_timer_deadline = None
        self.room.day_end_countdown_deadline = None
        self.room.turn_timer_seconds = 90
        self.snapshots[snap_id] = copy.deepcopy(server.build_client_state(self.room, self.human_id))

    def to_fixture(self):
        return {"chapter": self.chapter_id, "human_id": self.human_id, "snapshots": self.snapshots}
