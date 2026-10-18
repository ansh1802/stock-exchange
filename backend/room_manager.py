"""room_manager.py — Game room creation, player join/leave, WebSocket routing."""

import string
import random
import time


BOT_NAMES = ["Ada", "Turing", "Hopper", "Lovelace", "Knuth", "Shannon", "Babbage", "Dijkstra"]
BOT_DIFFICULTIES = ("easy", "medium", "hard")


class BotSocket:
    """Stands in for a bot's WebSocket: messages to a bot go nowhere."""

    async def send_json(self, message):
        pass

    async def close(self):
        pass


class PlayerConn:
    """A player's connection state within a room."""

    def __init__(self, player_id, name, websocket, bot_difficulty=None):
        self.id = player_id
        self.name = name
        self.ws = websocket
        self.connected = True
        self.last_pong = time.time()
        # Bots: difficulty is set in the lobby; `bot` (the policy) is built at game start.
        self.bot_difficulty = bot_difficulty
        self.bot = None

    @property
    def is_bot(self):
        return self.bot_difficulty is not None


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
        self.chat_messages = [] # list of {"name": str, "text": str, "ts": float}
        self.last_activity = time.time()
        self.disconnect_timer = None          # asyncio.Task for auto-action
        self.disconnect_timer_player_id = None  # who the timer is for
        self.turn_timer_seconds = 90          # configured length of player_turn (lobby setting)
        self.turn_timer_task = None           # asyncio.Task
        self.turn_timer_deadline = None       # unix timestamp (float) or None
        self.turn_timer_player_id = None      # which player_id the timer is ticking for
        self.day_end_countdown_deadline = None  # unix timestamp; non-null during the pre-reveal "ending day in Ns" pause
        # First turn of a new day: player ids still on the end-of-day overlay.
        # The turn timer holds until this empties (acks) or the fallback fires.
        self.day_start_pending = None
        self.day_start_fallback_task = None
        # Lobby
        self.ready = set()        # non-host player ids who pressed Ready
        self.is_public = False    # listed on the landing page when True
        # Players who left a running game — their seat can never be reclaimed.
        self.left_ids = set()
        self.bot_task = None      # asyncio.Task driving the next bot move

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
        """Add or reconnect a player.

        Returns (player_id, reconnected, error_code). error_code is None on
        success, else one of "name_taken", "left", "started", "full".
        """
        # Reconnection: same name rejoins
        if name in self._name_to_id:
            pid = self._name_to_id[name]
            if self.players[pid].is_bot:
                return None, False, "name_taken"
            if pid in self.left_ids:
                return None, False, "left"
            # Lobby only: a connected player's name can't be taken over.
            # Mid-game, same-name always reclaims (the server can think a dead
            # socket is live for up to 45s; don't lock the owner out).
            if not self.started and self.players[pid].connected:
                return None, False, "name_taken"
            self.players[pid].ws = websocket
            self.players[pid].connected = True
            self.players[pid].last_pong = time.time()
            self.touch()
            return pid, True, None

        if self.started:
            return None, False, "started"
        if len(self.players) >= 6:
            return None, False, "full"

        pid = self._next_id
        self._next_id += 1
        self.players[pid] = PlayerConn(pid, name, websocket)
        self._name_to_id[name] = pid
        self.touch()

        if self.host_id is None:
            self.host_id = pid

        return pid, False, None

    def add_bot(self, difficulty):
        """Lobby only: seat a bot. Returns (player_id, error_code)."""
        if self.started:
            return None, "started"
        if len(self.players) >= 6:
            return None, "full"
        if difficulty not in BOT_DIFFICULTIES:
            difficulty = "medium"
        taken = set(self._name_to_id)
        name = next((f"Bot {n}" for n in BOT_NAMES if f"Bot {n}" not in taken), None)
        if name is None:
            return None, "full"
        pid = self._next_id
        self._next_id += 1
        self.players[pid] = PlayerConn(pid, name, BotSocket(), bot_difficulty=difficulty)
        self._name_to_id[name] = pid
        self.ready.add(pid)  # bots are always ready
        self.touch()
        return pid, None

    def set_bot_difficulty(self, name, difficulty):
        pid = self._name_to_id.get(name)
        if pid is None or difficulty not in BOT_DIFFICULTIES or self.started:
            return False
        conn = self.players[pid]
        if not conn.is_bot:
            return False
        conn.bot_difficulty = difficulty
        self.touch()
        return True

    def human_ids(self):
        return [pid for pid, p in self.players.items() if not p.is_bot]

    def remove_player(self, player_id):
        """Lobby only: drop a player entirely (leave / kick). Passes host on."""
        conn = self.players.pop(player_id, None)
        if conn is None:
            return None
        self._name_to_id.pop(conn.name, None)
        self.ready.discard(player_id)
        if self.host_id == player_id:
            humans = self.human_ids()
            self.host_id = min(humans) if humans else None
            if self.host_id is not None:
                self.ready.discard(self.host_id)
        if not self.human_ids():
            # Nobody left to play with the bots — clear them out too.
            for pid in list(self.players):
                self._name_to_id.pop(self.players.pop(pid).name, None)
                self.ready.discard(pid)
        self.touch()
        return conn

    def disconnect_player(self, player_id):
        if player_id in self.players:
            self.players[player_id].connected = False

    def get_player_names(self):
        return [p.name for pid, p in self.players.items() if pid not in self.left_ids]

    def lobby_view(self, for_player_id):
        """Lobby state for one client (host flag differs per player)."""
        return {
            "type": "lobby_update",
            "players": [
                {
                    "name": p.name,
                    "ready": pid in self.ready,
                    "is_host": pid == self.host_id,
                    "connected": p.connected,
                    "bot": p.bot_difficulty,
                }
                for pid, p in self.players.items()
            ],
            "is_host": for_player_id == self.host_id,
            "is_public": self.is_public,
        }

    def all_ready(self):
        """Every non-host player has pressed Ready."""
        return all(pid in self.ready for pid in self.players if pid != self.host_id)

    def public_summary(self):
        host = self.players.get(self.host_id)
        return {
            "code": self.code,
            "host": host.name if host else "",
            "players": len(self.players),
            "ready": len(self.ready),
            "max_players": 6,
        }

    def connected_count(self):
        """Connected humans (bots don't keep a room alive)."""
        return sum(1 for p in self.players.values() if p.connected and not p.is_bot)

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
            if player.connected and not player.is_bot:
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
            self.rooms.pop(code, None)

    def public_lobbies(self):
        """Public rooms that haven't started and still have someone in them."""
        return [
            room.public_summary()
            for room in self.rooms.values()
            if room.is_public and not room.started and room.connected_count() > 0
        ]

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
