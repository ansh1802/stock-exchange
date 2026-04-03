"""room_manager.py — Game room creation, player join/leave, WebSocket routing."""

import string
import random


class PlayerConn:
    """A player's connection state within a room."""

    def __init__(self, player_id, name, websocket):
        self.id = player_id
        self.name = name
        self.ws = websocket
        self.connected = True


class Room:
    """A single game room with lobby + active game state."""

    def __init__(self, code):
        self.code = code
        self.players = {}       # player_id -> PlayerConn
        self.game = None        # GameState, set on start
        self.host_id = None
        self.started = False
        self._next_id = 1
        self._name_to_id = {}   # for reconnection lookup
        self.game_log = []      # accumulated log entries for frontend

    # ── Player management ────────────────────────────────────────────────

    def add_player(self, name, websocket):
        """Add or reconnect a player. Returns (player_id, reconnected)."""
        # Reconnection: same name rejoins
        if name in self._name_to_id:
            pid = self._name_to_id[name]
            self.players[pid].ws = websocket
            self.players[pid].connected = True
            return pid, True

        if self.started:
            return None, False  # can't join mid-game
        if len(self.players) >= 6:
            return None, False  # room full

        pid = self._next_id
        self._next_id += 1
        self.players[pid] = PlayerConn(pid, name, websocket)
        self._name_to_id[name] = pid

        if self.host_id is None:
            self.host_id = pid

        return pid, False

    def disconnect_player(self, player_id):
        if player_id in self.players:
            self.players[player_id].connected = False

    def get_player_names(self):
        return [p.name for p in self.players.values()]

    def connected_count(self):
        return sum(1 for p in self.players.values() if p.connected)

    # ── Messaging ────────────────────────────────────────────────────────

    async def send_to(self, player_id, message):
        player = self.players.get(player_id)
        if player and player.connected:
            try:
                await player.ws.send_json(message)
            except Exception:
                player.connected = False

    async def broadcast(self, message):
        for player in self.players.values():
            if player.connected:
                try:
                    await player.ws.send_json(message)
                except Exception:
                    player.connected = False

    async def broadcast_game_state(self):
        """Send each player their personalised view (own hand visible, others hidden)."""
        if not self.game:
            return
        for player in self.players.values():
            if player.connected:
                try:
                    state = self.game.to_player_dict(player.id)
                    await player.ws.send_json({"type": "game_state", "state": state})
                except Exception:
                    player.connected = False


class RoomManager:
    """Manages all active game rooms."""

    def __init__(self):
        self.rooms = {}  # code -> Room

    def get_or_create(self, code):
        if code not in self.rooms:
            self.rooms[code] = Room(code)
        return self.rooms[code]

    def get_room(self, code):
        return self.rooms.get(code)

    def remove_room(self, code):
        self.rooms.pop(code, None)

    def create_room(self):
        code = self._generate_code()
        room = Room(code)
        self.rooms[code] = room
        return room

    def _generate_code(self):
        chars = string.ascii_uppercase + string.digits
        while True:
            code = "".join(random.choices(chars, k=4))
            if code not in self.rooms:
                return code
