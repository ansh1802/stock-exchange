"""room_manager.py — Game room creation, player join/leave, WebSocket routing."""

import string
import random
import time

MAX_PLAYERS = 6
MIN_PLAYERS = 2
KICK_COOLDOWN_SECONDS = 120
HOST_MIGRATION_GRACE_SECONDS = 45
READY_AUTOREADY_COUNTDOWN_SECONDS = 25


class PlayerConn:
    """A player's connection state within a room."""

    def __init__(self, player_id, name, websocket):
        self.id = player_id
        self.name = name
        self.ws = websocket
        self.connected = True
        self.ready = False
        self.last_pong = time.time()


class Room:
    """A single game room with lobby + active game state."""

    def __init__(self, code):
        self.code = code
        self.players = {}       # player_id -> PlayerConn
        self.game = None        # GameState, set on start
        self.host_id = None
        self.started = False
        self.is_public = False
        self._next_id = 1
        self._name_to_id = {}   # for reconnection lookup
        self.kicked_until = {}  # name -> unix timestamp cooldown expiry
        self.game_log = []      # accumulated log entries for frontend
        self.chat_messages = [] # list of {"name": str, "text": str, "ts": float}
        self.last_activity = time.time()
        self.disconnect_timer = None          # asyncio.Task for auto-action
        self.disconnect_timer_player_id = None  # who the timer is for
        self.turn_timer_seconds = 90          # configured length of player_turn (lobby setting)
        self.turn_timer_task = None           # asyncio.Task
        self.turn_timer_deadline = None       # unix timestamp (float) or None
        self.turn_timer_player_id = None      # which player_id the timer is ticking for
        self.day_end_countdown_deadline = None  # unix timestamp; non-null during the pre-reveal "ending day in Ns" pause
        self.autoready_task = None            # asyncio.Task — lobby-only auto-ready countdown
        self.autoready_deadline = None        # unix timestamp or None
        self.autoready_player_id = None       # which straggler the countdown is for
        self.host_migration_task = None       # asyncio.Task — lobby-only host failover
        self.host_migration_deadline = None   # unix timestamp or None

    def touch(self):
        """Update last activity timestamp."""
        self.last_activity = time.time()

    @property
    def has_active_game(self):
        return self.started and self.game is not None and self.game.game_phase != "game_over"

    def get_active_player_id(self):
        """Resolve who currently needs to act, based on phase and queues."""
        if not self.game:
            return None
        game = self.game
        phase = game.game_phase

        if phase == "rights_issue" and game.rights_issue_queue:
            return game.rights_issue_queue[0]
        if phase == "share_suspend" and game.suspend_queue:
            return game.suspend_queue[0]
        if phase == "card_reveal":
            if game.chairman_director_queue:
                return game.chairman_director_queue[0][0]
            # During card_reveal without CD queue, all players need to send
            # reveal_complete — return None (handled separately)
            return None
        if phase == "player_turn":
            idx = game.current_turn
            if idx < len(game.players):
                return game.players[idx].id
        return None

    # ── Player management ────────────────────────────────────────────────

    def add_player(self, name, websocket):
        """Add or reconnect a player. Returns (player_id, reconnected, error).

        error is None on success, otherwise one of "name_taken" (name belongs
        to a still-connected player), "started" (game running, unknown name),
        or "full" (room at capacity).
        """
        if name in self._name_to_id:
            pid = self._name_to_id[name]
            existing = self.players.get(pid)
            if existing is None:
                # Name was reserved (e.g. kicked) but the slot is gone — treat
                # as a fresh join below.
                del self._name_to_id[name]
            elif existing.connected:
                return None, False, "name_taken"
            else:
                existing.ws = websocket
                existing.connected = True
                existing.last_pong = time.time()
                self.touch()
                return pid, True, None

        if self.started:
            return None, False, "started"  # can't join mid-game
        if len(self.players) >= MAX_PLAYERS:
            return None, False, "full"

        pid = self._next_id
        self._next_id += 1
        self.players[pid] = PlayerConn(pid, name, websocket)
        self._name_to_id[name] = pid
        self.touch()

        if self.host_id is None:
            self.host_id = pid

        return pid, False, None

    def remove_player(self, player_id):
        """Fully remove a player (lobby-only leave/kick) — frees their name."""
        player = self.players.pop(player_id, None)
        if player:
            self._name_to_id.pop(player.name, None)
        return player

    def disconnect_player(self, player_id):
        if player_id in self.players:
            self.players[player_id].connected = False

    def get_player_names(self):
        return [p.name for p in self.players.values()]

    def connected_count(self):
        return sum(1 for p in self.players.values() if p.connected)

    def to_lobby_players(self, requesting_id=None):
        """Build the personalised player list for a `lobby_state` message."""
        return [
            {
                "id": p.id,
                "name": p.name,
                "ready": p.ready,
                "connected": p.connected,
                "is_host": p.id == self.host_id,
                "is_you": p.id == requesting_id,
            }
            for p in self.players.values()
        ]

    def cancel_all_timers(self):
        """Cancel every background asyncio.Task owned by this room."""
        for task in (self.disconnect_timer, self.turn_timer_task,
                     self.autoready_task, self.host_migration_task):
            if task:
                task.cancel()
        self.disconnect_timer = None
        self.disconnect_timer_player_id = None
        self.turn_timer_task = None
        self.turn_timer_deadline = None
        self.turn_timer_player_id = None
        self.autoready_task = None
        self.autoready_deadline = None
        self.autoready_player_id = None
        self.host_migration_task = None
        self.host_migration_deadline = None

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
        room = self.rooms.pop(code, None)
        if room:
            room.cancel_all_timers()

    def cleanup_stale_rooms(self):
        """Remove rooms where all players disconnected and TTL expired."""
        now = time.time()
        to_remove = []
        for code, room in self.rooms.items():
            if room.connected_count() > 0:
                continue
            age = now - room.last_activity
            if room.has_active_game:
                if age > 7200:  # 2 hours for active games
                    to_remove.append(code)
            else:
                if age > 300:   # 5 minutes for lobbies / finished games
                    to_remove.append(code)
        for code in to_remove:
            self.remove_room(code)

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
