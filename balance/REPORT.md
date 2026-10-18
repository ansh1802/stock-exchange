# Balance Report — bot self-play

**Data:** ~12,000 simulated full games (10 days, mostly 4 players). The bots are static
Python policies (`backend/bots/`), so this costs no AI tokens and can be re-run whenever
the rules change.
Raw numbers: `results/analysis.json`, `results/variants_run1.txt`, `results/variants_run2.txt`,
`results/tune.out`.

**Method:** cards are dealt at random every day, so holding a card is a natural randomized
experiment. A card's *effect* is the average change in the holder's share of total table
wealth on days they hold it, minus days they don't. It is measured in percentage points
(pp) per day, with 95% confidence intervals of about ±0.2pp. Seat effects and exploits are
measured with seat-rotated tournaments. Rule changes are tested by patching the engine
inside the simulator only (`variants.py`); the shipped game is unchanged.

---

## TL;DR

| | Verdict |
|---|---|
| Companies | **Balanced.** No company card is worth more than another (all within ±0.3pp ≈ noise). Higher-priced companies swing harder and close more often (Infosys closes in ~30% of games), but that is priced in. |
| **Chairman** | **Too strong — the main balance problem.** A company with a chairman drifts **+16/day**, against **+1/day** without one. This is the game's snowball. |
| **Share Suspend** | **Strongest power card (+2.9pp/day, about 3× any other)** — but it is the game's *comeback* mechanic. Nerfing it alone makes the game more snowbally. Leave it alone. |
| Debenture | **Weakest (+0.3pp, ≈ dead card).** It only works when a company you hold has closed. The chairman fix below revives it as a side effect. |
| Rights Issue / Loan Stock | Fine (+1.0 / +0.9pp). |
| Currency ± | Fine. Near zero for strong players, who hedge by moving into or out of cash; ±0.8pp for medium players. It rewards paying attention, which is good. |
| Turn order / seats | **Fair.** No seat advantage at 3, 4 or 6 players (differences are within noise); daily rotation works. |
| Degenerate strategies | **None dominate.** Passive, random, momentum, and "hoard one company" (each of the 6) all win ≤5% against Easy bots and ≤0.3% against Medium. |
| 2-player games | Decided early: the day-5 leader wins **84%** of the time (55% at 4 players, 39% at 6). |

**Recommendation:** one rule change — **the chairman keeps "discard one of your own cards"
but loses "remove one card from another player."** If you also want a calmer market,
optionally add the flattened deck. Details and numbers are below.

---

## Findings

### 1. Chairman power is the snowball (fix recommended)

| 4× Hard self-play | Price drift / day |
|---|---|
| Companies with a chairman (29% of company-days) | **+16.1** |
| Companies without | +1.0 |

The chairman removes their own worst card *and* the worst card anyone else holds. Directors
also discard. Together this almost guarantees an up-day for any company with a seated
chairman. Once one player owns 100 shares they can keep compounding. Ablation confirms it:
a Hard bot that ignores chairman/director effects drops from a 25% to a 12% win rate
against normal Hard bots. Controlling seats is the single biggest skill lever in the game.

### 2. Share Suspend: strong, but it's the brake (leave as is)

It is worth +2.9pp/day, about 3× any other power card. Two ways to tone it down were tested:

| Variant | Suspend value | Day-5 leader wins |
|---|---|---|
| Current rules | 2.8pp | 58% |
| Only 1 Share Suspend in the deck | 2.9pp | 65% |
| May only suspend companies you hold | 0.7pp | **70%** |

Restricting it to your own holdings kills its *offensive* use: reverting a rise in the
leader's company. That use is what lets trailing players catch up, so the game gets more
decided-early. Its high value is a feature here; it is the counterweight to the chairman.

### 3. Debenture is close to a dead card

It is worth +0.3pp because it needs a company *you hold* to have closed, which happens
roughly once a game. It becomes useful (+0.8–1.0pp) under the chairman fix, because
companies without a guaranteed chairman pump close more often.

### 4. Companies

| Company (4× Hard) | Closed in % of games | Daily move σ | Median final price | Share of winner's wealth |
|---|---|---|---|---|
| Vodafone (20) | 1% | 4.8 | 30 | 3% |
| YesBank (25) | 11% | 10.8 | 55 | 9% |
| Cred (40) | 15% | 18.1 | 90 | 15% |
| TCS (55) | 21% | 26.8 | 110 | 18% |
| Reliance (75) | 20% | 35.4 | 140 | 22% |
| Infosys (80) | 29% | 44.0 | 175 | 27% |

Swing grows with company number by design: more and larger cards. Vodafone barely matters
in strong play (3% of winners' wealth): it is too calm to profit from and only ever moves ±5.
That is a flavour issue, not a balance bug. The `deck_flat` variant below fixes it if
you want every company to matter.

### 5. What actually wins (for rulebook / tutorial hints)

From the Hard bot ablations (win rate against three normal Hard bots, fair share 25%):

| Hard bot with… | Win % |
|---|---|
| Everything on | 25% |
| Only one move of lookahead (never sells a decent stock to fund a better one) | **7%** |
| No chairman/director modelling | 12% |
| No inference from opponents' trades | 22% |
| No risk management | 26% |

Rotating capital every day — selling what your cards don't like and buying what they do —
is the core skill. With 3 actions a day, wasting one is expensive. Your own hand predicts
a company's move as `own card sum × (1 − 10·(players−1)/90)`, i.e. ×⅔ at 4 players.

---

## Rule variants tested (4× Hard, 400 games each)

| Variant | Suspend pp | Debenture pp | Chairman drift | Day-5 leader wins | Infosys closes | Winner NW | Hard vs 3 Medium |
|---|---|---|---|---|---|---|---|
| **Current rules** | 2.8 | 0.1 | 16.1 | 58% | 33% | 26.0k | 84% |
| **Chairman own-card only** | 2.7 | 1.0 | 8.6 | 53% | 39% | 15.7k | 71% |
| **Chairman own-card only + flat deck** | 2.8 | 0.8 | 7.1 | **46%** | 18% | 13.9k | 74% |
| Chairman own-card only + suspend own only | 1.3 | 0.7 | 11.8 | 57% | 34% | 22.5k | 68% |
| Suspend only on held companies | 0.7 | 0.1 | 21.1 | 70% | 28% | 39.8k | 79% |
| 1 Share Suspend in deck | 2.9 | 0.7 | 19.3 | 65% | 30% | 34.6k | 83% |
| Loan Stock capped at 500 | 2.9 | 0.1 | 16.0 | 59% | 34% | 25.9k | 83% |
| Flat deck alone | 2.8 | 0.2 | 13.7 | 52% | 11% | 22.3k | 84% |

*Flat deck:* Vodafone/YesBank ±5,10; Cred/TCS ±5–15; Reliance/Infosys ±5–20 (2 copies
each, as now). This makes card swing roughly proportional to share price.

### Proposed changes, in priority order

1. **Chairman: drop "remove another player's card"** (keep "discard your own"). Halves the
   chairman pump, revives Debenture, and makes comebacks likelier. Skill still dominates:
   Hard beats Medium 71% of the time. It's a one-line engine change in
   `chairman_director_action` plus UI copy in `ChairmanDirectorModal` and the rulebook.
2. *(Optional)* **Flat deck.** Gives the most open games (day-5 leader wins only 46%), Infosys
   closes half as often, and Vodafone matters. It changes the feel more (calmer market), so
   playtest it first.
3. **Leave Share Suspend, Loan Stock, Rights Issue and Currency alone.**
4. *(Optional)* For **2-player** games, consider a catch-up rule, e.g. the trailing player
   acts first each day. 2-player games are decided by day 5 in 84% of games.

None of these are applied — the shipped rules are unchanged. If you adopt one, change the
engine, re-run `tune.py` so the Hard bot re-learns its weights, then re-run `analyze.py`.

---

## Bot difficulty ladder (seat-rotated, 600 games each)

| Table | Win % |
|---|---|
| Hard vs 3× Medium | Hard **84.5%**, Medium 5.2% each |
| Hard vs 3× Easy | Hard **93.8%**, Easy 2.1% each |
| Medium vs 3× Easy | Medium **54.8%**, Easy 15.1% each |
| Easy, Medium, Hard, Hard | Hard 47.9% each, Medium 3.8%, Easy 0.3% |

The Hard bot's weights were tuned by self-play search (8 generations × 12 candidates × 240
games). The tuned version wins 26.0% against 24.0% for the hand-set version in an 800-game
head-to-head.

## Re-running

```bash
cd balance
../backend/venv/bin/python evaluate.py                      # difficulty ladder
../backend/venv/bin/python evaluate.py hard medium easy -n 400
../backend/venv/bin/python analyze.py --games 600           # full report → results/analysis.json
../backend/venv/bin/python compare_variants.py baseline chairman_own_only chairman_own_only,deck_flat
../backend/venv/bin/python tune.py --gens 8 --pop 12 --games 240   # retune Hard after a rule change
```

On a 10-core Mac: ~0.1 s per game, ~15 min for `analyze.py`, ~40 min for `tune.py`.
