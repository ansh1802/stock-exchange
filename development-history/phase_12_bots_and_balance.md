# Phase 12 — Bots (Easy / Medium / Hard) & Balance Testing

## Goals

1. Bot players a host can add to a room and set to Easy / Medium / Hard before starting.
2. **No recurring AI spend.** Bots are static Python policies; AI was used only offline,
   to design the strategies and to drive the tuning/analysis tooling. The tuned weights are
   frozen in `backend/bots/params.py`.
3. Run hundreds of full self-play games, log price paths / win rates / card values, and
   report broken companies or cards with rebalance proposals (`balance/REPORT.md`).

## Where things live

| Path | What |
|------|------|
| `backend/bots/policy.py` | `Bot` — one class, three difficulty profiles. `act(game)` returns a client-format message (same JSON the frontend sends) or `None`. |
| `backend/bots/params.py` | Static per-difficulty parameters (hard = tuned by `balance/tune.py`). |
| `balance/sim.py` | Headless runner: real engine + bots, no server. Swaps the engine's `result()` for a no-`to_dict` version (offline only — never import from the server). ~0.1 s per 4-player game. |
| `balance/evaluate.py` | Seat-rotated parallel tournaments. `python evaluate.py hard medium medium medium -n 400` |
| `balance/tune.py` | Cross-entropy self-play search over the hard bot's weights (common random numbers across candidates). |
| `balance/analyze.py` | Card values, company stats, seat advantage, exploit strategies, difficulty ladder → `balance/results/analysis.json`. |
| `balance/strategies.py` | Degenerate reference strategies (passive, random, momentum, hoard one company). |
| `balance/REPORT.md` | Findings and rebalance proposals. |
| `tests/test_bots.py` | Lobby controls + full human+bot games through `server.py` handlers. |

## How the bots think

Everything a bot reads is information its seat legitimately has: own hand, prices, all
players' cash/holdings/positions (public on the board), and — during `card_reveal`, when
every hand is public — the revealed cards. Opponent trades are inferred from holdings
changes against a snapshot taken at deal time (`observe()`), never from hidden hands.

**Key fact the strategies rest on:** each day uses a fresh 100-card deck whose company
cards sum to zero per company. Holding cards summing to `s` for a company means the
unseen 90 cards sum to `-s`, of which opponents hold `10·(N-1)/90`. So
`E[delta] = s · (1 − 10(N−1)/90)` — e.g. ×⅔ with 4 players. Prices are a zero-drift random
walk apart from chairman/director discards and the 0 floor, so each day is close to an
independent bet on information in your hand.

- **Easy** — reads its own card sums plus Gaussian noise, invests a random 30–100% of
  cash, passes 25% of turns, fires power cards at random-ish times, ignores currency cards.
- **Medium** — exact closed-form expectation above; picks the single action that maximises
  expected end-of-day net worth (cash scaled by its Currency ± cards). Correct but myopic:
  never sells a neutral stock to fund a better one, no chairman/director modelling.
- **Hard** — Monte-Carlo over 96 sampled deals of the unseen cards, reweighted by what
  each opponent bought/sold today (`beta`). For every company it simulates chairman/director
  discards for the current seats *and* for the seat it would hold after a trade (thresholds
  50/100/150/200 are explicit candidate quantities). Values a held Share Suspend as an
  option (`E[max swap gain]`), applies a risk penalty (`risk`) that flips to risk-seeking
  when trailing in the last days (`catchup`), charges Rights Issue / Debenture for what
  they gift opponents (`rel`), values seats it keeps into future days (`k_chair`, `k_dir`)
  and searches two of its own moves ahead. ~1 ms per decision (8 ms worst case).

Sub-phases for all levels: Rights Issue buys up to the eligible max when the end-of-day
value beats the discounted price; Share Suspend picks the swap maximising own net worth
minus `suspend_rel ×` the best opponent's; chairman/director always discard their most
negative own card(s) and the chairman removes the most negative card anyone else holds.

## Server integration

- `PlayerConn.bot_difficulty` marks a bot seat; `BotSocket` is a no-op websocket so all
  existing broadcast code works unchanged. The policy object (`conn.bot`) is built at start.
- Lobby messages (host only, lobby only): `add_bot {difficulty}`, `set_bot_difficulty
  {player_name, difficulty}`; bots are removed with the existing `kick_player`. Bots are
  always Ready. `lobby_update.players[].bot` and `game_state.players[].bot` carry the
  difficulty (null for humans).
- **Driver:** every state change ends in `broadcast_game_state`, which calls
  `schedule_bots(room)`. One `room.bot_task` at a time: observe → pick the first bot with a
  move → sleep 1.2–2.4 s (0.5 s for reveal acks) → re-decide (the table may have moved) →
  `dispatch_action` → `after_action` (the same log/advance/timer/broadcast path humans use,
  factored out of `handle_action`). A rejected move falls back to pass/skip and is printed.
- Bots never count as "connected" for room cleanup or public listing, are excluded from
  the new-day `day_start_pending` hold, can't be impersonated by a joining human with the
  same name, and never become host. The last human leaving a lobby clears its bots; the
  last human leaving a running game ends it.

## Frontend

`PlayerList` shows a bot icon, the difficulty (host gets an Easy/Medium/Hard toggle per
bot, others see a badge), "Remove" instead of "Kick", and an "Add bot: + easy / + medium /
+ hard" row while seats remain. `PlayerBoard` / `MobilePlayerBoard` show a small bot icon
next to bot names.

## Results

Full report: `balance/REPORT.md`. Headlines:
- Ladder (seat-rotated): Hard beats 3× Medium 84.5%, Medium beats 3× Easy 54.8%.
- Hard-bot ablation: two-move lookahead (sell-to-redeploy) and chairman/director modelling
  are where the skill is; opponent inference is minor; the risk term is ~neutral.
- Chairman pump: +16/day drift with a chairman vs +1 without — the game's snowball.
  Recommended fix (not applied): chairman loses "remove another player's card".
- Share Suspend is the strongest card (+2.9pp/day) but also the comeback mechanic —
  restricting it raised "day-5 leader wins" from 58% to 70%. Leave it.
- Debenture is near-dead (+0.3pp); revived by the chairman fix.
- No seat advantage; no degenerate strategy beats even Easy bots.

## Gotchas

- `balance/sim.py` replaces the engine's `result()` to skip `to_dict()` — import it only from
  offline tooling.
- Bots must re-decide after their think delay (`_run_bot` calls `_bot_move` twice): the
  table can move while they wait.
- A bot's "waiting for N more" reveal ack produces no broadcast, so `_run_bot` reschedules
  explicitly.
- `test_bots.py` speeds up `asyncio.sleep`; long timers are only sped up 100x so a loaded
  machine can't make a bot miss its turn timer.
