# Guided Tutorial — Design

Status: draft for review · 2026-10-24 · Replaces the "Surface A — scripted walkthrough" stub from Phase 9.

## 1. Why

The game has a steep learning curve. Today a newcomer needs roughly five games — or the owner sitting next to them explaining — before they play with intent. That is costing players: people try it once, don't get it, and leave.

**Success:** a newcomer finishes a ~15–20 minute guided tutorial and *one* real game, and then plays to win: they know what every control does, why prices moved, what each power card is for, and when chairman/director powers matter.

**Owner's quality bar (the anti-goal):** bad pedagogy. The thing that would make this a failure even if every chapter technically works is a flow that feels like a list of disconnected facts. The learning must *flow*: each idea grows out of the previous one, earlier ideas are recalled and reused in later contexts, and the player keeps having "ahh, that's interesting" moments. Section 4 turns this into concrete rules.

## 2. Goals, non-goals

**Goals**
- A step-by-step, *locked* guided walkthrough that runs on the **real game UI** (real board, trade popup, closing-bell reveal, share-suspend screen, chairman/director modal), so what is learned transfers 1:1 to a real game.
- Covers everything: screen orientation, objective and flow, how prices move, turn structure, trading, every power card, chairman/director in every combination, the 200-share ceiling.
- Works equally well on **desktop (≥768px) and mobile (<768px)** — owner says players arrive on both equally.
- Ends with a one-tap path into a first real game against bots.

**Non-goals**
- Free play / sandbox. The player does exactly the action the tutorial asks; everything else is locked. (Owner's explicit choice — keeps build complexity sane.)
- Branching storylines. The only "choices" are prediction prompts whose answers change one line of feedback, never the game state (see §4).
- Teaching strategy beyond what falls naturally out of each mechanic. This is about understanding, not optimal play.
- Fixing the rulebook (see §9) — separate task.
- Hitting the 15–20 min target in v1. Owner: build all sections; they will cut later. Every chapter must therefore be independently removable.

## 3. How it runs (architecture — builder's call where not stated)

### 3.1 Client-only, scripted snapshots
- **No server room.** The tutorial runs entirely in the browser.
- Each chapter is a sequence of **steps**. Each step carries (a) the game state to show and (b) what the player must do to advance.
- The tutorial loads the step's state into the *same* Zustand store the live game uses (`useGameStore`), so the real components render unmodified wherever possible.
- When the player performs the one allowed action, the tutorial intercepts the outbound message (instead of sending it over the WebSocket), checks it matches the expected action, and loads the next step's state. Wrong-but-possible inputs are prevented by the lock (§3.3), not by error messages.
- "Bot" turns are just steps with no player action: they auto-advance after a short pause (~1.2–2s, matching real bot pacing) with a log entry, so it feels like a live table.

### 3.2 Snapshots come from the real engine
- An offline generator script (Python, run with `backend/venv/bin/python`) defines each chapter's scenario: seat names, cash, holdings, **hand-picked cards** (no random deal), prices, day/round, and the scripted move sequence.
- It plays those moves through the actual `engine/` functions and writes the resulting states as JSON fixtures into the frontend (e.g. `frontend/src/tutorial/fixtures/<chapter>.json`), in the same per-player client shape the server broadcasts (`to_player_dict` for the human seat **plus** the fields the server adds in `build_client_state` — the builder must check which fields components rely on).
- Result: every price, reveal sum, rights-issue price, loan amount, chairman queue and net-worth history is guaranteed correct. After a rule change, re-run the generator (add this to the existing "after any rule change" note in CLAUDE.md).
- Step copy (coachmark text, which control is spotlit, expected action) lives in TypeScript chapter files next to the fixtures — **one editable place for all words** so the owner can edit copy without touching components.

### 3.3 Locking and spotlighting
- Reuse the existing `Spotlight` and `Coachmark` components (`frontend/src/components/tutorial/`) — extend as needed.
- During an action step: everything except the spotlit control is dimmed **and non-interactive**. Inside multi-control surfaces (e.g. trade popup) the lock applies per control — e.g. "drag the slider to 40" locks Confirm until the quantity is 40.
- Read-only steps advance with a "Next" button on the coachmark.
- An always-visible **Exit tutorial** control.

### 3.4 Desktop and mobile
- Steps name **semantic targets** (`hand`, `ticker`, `player-board`, `timer`, `log`, `action-bar`, `trade-slider`, …), never layout-specific elements. Both layouts tag their equivalent element (e.g. `data-tutorial="hand"` on the desktop fan *and* the mobile `MobileCardStrip`).
- Where a target lives behind a tab or drawer on mobile (log/chat in `MobileTabBar`, `ViewAllDrawer`), the step opens it first.
- Copy may have per-layout variants ("click"/"tap", "your hand"/"the strip below") but defaults to shared text.

### 3.5 Server-coupled behaviour to neutralise
Real components assume a socket. A **tutorial mode flag** must make these behave locally (the builder should audit for more):
- `reveal_complete` ack after the closing bell → tutorial advances instead.
- Share-suspend countdown / auto-close, chairman-director modal submit, rights-issue buy/pass → intercepted.
- Turn timer: **shown but frozen** (never expires). The orientation step explains it.
- `day_start_ready`, heartbeat, reconnect banner, first-encounter tips (`useFirstEncounterTip`) → off during the tutorial.
- **Closing-bell pause (owner decision):** `CardRevealOverlay` advances itself on timers. Add a tutorial-only **step gate** so the tutorial can hold the reveal at any stage (e.g. after a company's cards land, before its final value) while a coachmark explains, then release it. In live games the gate is absent and behaviour is unchanged. Ch 3, 5, 7 and 10 depend on this.
- Animation decoupling (`animPhase` in `GameBoard`, `lastRevealDay` guard against re-animating) must still trigger correctly when a fixture jumps into `card_reveal` — fixtures must carry consistent day numbers so the reveal plays exactly once per scripted bell.

### 3.6 Entry, progress, ending
- **Entry:** a "Tutorial" option on the home screen opens the tutorial (the existing `/tutorial` hub becomes the chapter list). First-timers get a prominent "Start from the beginning"; the chapter list allows replaying any chapter.
- **Progress:** saved per chapter in `tutorialStorage` (completed flags + "resume at chapter N"). Quitting mid-chapter resumes at that chapter's start.
- **Ending:** a recap screen (§4 rule 6) and a **"Play your first game vs bots"** button that creates a room with the player + 3 Easy bots and starts it.

## 4. Pedagogy rules (non-negotiable — this is the owner's bar)

1. **Every chapter opens with a hook that the previous chapter raised.** No chapter starts with "Now let's learn X." It starts with a tension: "You just saw prices move because of cards. But you could only see *your* cards. That's your edge — so how do you act on it?" → Trading.
2. **Predict, then reveal.** Before every scripted closing bell and every power-card payoff, the player is asked one prediction ("Will Reliance close higher or lower?" / "How much cash will Loan Stock give you?" with 2–3 choices). Whatever they pick, the reveal plays the same; only the feedback line differs ("Exactly." vs "Look again — your −15 was outweighed by the bots' +20"). Being wrong and seeing *why* is the aha.
3. **Recall in context.** Every chapter after the first calls back at least one earlier idea, *using the same word and briefly re-spotlighting the same control* where it appeared before. Examples are in §5 ("↩" lines).
4. **Numbers, not adjectives.** Every payoff shows the concrete delta (price $55 → $70, net worth +$300, cash +$64). The net-worth graph in the share-suspend screen and the player board are the scoreboard for every aha.
5. **Pacing.** Never more than three read-only steps in a row before the player *does* something. Text per coachmark: aim ≤ 2 short sentences; anything longer becomes two steps.
6. **Takeaway chips.** Each chapter ends by awarding one-line takeaway "chips" (e.g. "Your cards are private info — trade on them before the bell"). Chips accumulate and are shown together on the final recap, and the next chapter's hook may quote one.
7. **One cast.** The same named bots appear across chapters with consistent seats/colours, so the table feels like the same trading floor over a story, even though each chapter's state is independent. (Names are builder's/owner's choice; the tutorial refers to bots by name, and to everyone with they/them where a pronoun is needed.)
8. **Engine truth only.** Copy must describe what `backend/engine/` does, not what the rulebook says (§9).

## 5. Chapters

Order is fixed by the owner: orientation → objective popup → **how prices move (before trading)** → your turn → trading → power cards → chairman/director (incl. 200 cap). Scenarios below are the design intent; exact numbers are produced by the generator and can be tuned. "↩" marks a deliberate recall of an earlier chapter.

### Ch 1 — Orientation (6 seats)
A real-looking 6-seat table mid-day-1. Spotlight tour, one element per step, each with one sentence of meaning:
ticker (price, change from yesterday, sparkline, **available** shares in the bank) · your hand · player board (cash, net worth, holdings, chairman/director icons, who's online) · day/round indicator (10 days × 3 rounds) · turn timer (and that it auto-passes you) · log/chat · action bar · exit.
Hook out: "That's the floor. Now — what are you actually trying to do here?"

### Ch 2 — The game in one popup
A single modal (2–3 panes max): goal = highest **net worth** after day 10, `net worth = cash + Σ(shares × price)`; a day = 3 rounds of moves, then the **closing bell** moves prices; shares are worth whatever the bell makes them. Hook out: "So what moves prices?"

### Ch 3 — How prices move
Day 1, player holds e.g. TCS +10, Reliance −15, a Currency + card. Bots hold cards the player can't see.
- Spotlight hand: "Each card says a company and an amount. At the bell, *everyone's* cards for a company are added to its price."
- "You can see only your cards. The bots can see only theirs." → the edge.
- **Predict:** "TCS: higher or lower at the bell?" Then the real `CardRevealOverlay` plays: player's +10 and bots' cards appear per company, sum → new price.
- A second company where bots' cards outweigh the player's (Reliance: player −15, bots +25 → up): aha — your cards are only part of the story.
- Bankruptcy: a company pushed to ≤ 0 closes (sets up Debenture ↩ later).
- **Auto-applied cards:** the Currency + card in their hand adds 10% to their cash at the bell — nothing to play, it just happens; Currency − is its mirror. Aha line: "So holding Currency + rewards keeping cash; holding Currency − is a reason to spend it before the bell."
- Takeaways: "Prices move only at the bell", "You see your cards, not theirs".

### Ch 4 — Your turn (3 moves a day)
Hook: ↩ "You know TCS will rise. You get exactly three chances a day to act on that."
- Each day has 3 rounds; in each round you get **one move**.
- One move = **exactly one of**: buy *one* company · sell *one* company · play *one* power card · pass. You can't buy two companies, or buy and sell, in the same move.
- Show the turn indicator passing round the table through bot turns.
- Teaser: "There's exactly one way to get an extra, free move — when someone *else* plays a Rights Issue on a company you own. You'll see it later." (↩ paid off in Ch 8.)
- Timer ↩: your move must happen before the clock runs out or you pass.

### Ch 5 — Trading
Hook: ↩ Ch 3: "You can't see their cards — but you can see what they *buy*."
- **Setup:** the player holds **+10 in two companies** (e.g. TCS +10 and Infosys +10) but has one move this round (↩ Ch 4) and cash for a real position in only one.
- **Read the table first.** Round 1 has already happened and the player watches it play: **two bots both buy TCS**; the third bot's buys are scattered across other companies. Spotlight the log and the player board holdings (↩ Ch 1) where those trades show up.
- **Reason it out (coachmark):** "Two players piling into TCS probably hold + TCS cards too — that's an alliance. Their cards will push TCS up alongside yours. Infosys has no such support." This is the core skill: using others' trades as information about their hidden cards.
- **Predict:** "Which will rise more at the bell — TCS or Infosys?"
- **Buy TCS** through the trade popup: company selector, buy/sell toggle, price, cash, **available** shares (↩ ticker), the **slider** (0 → max, ticks, Max button, ± buttons) — max is limited by *both* cash and available shares. Action: drag the slider / Max to the scripted quantity, confirm.
- Round 2 (after bot turns): sell part of a holding to show sell max = holdings.
- Mention the RI button exists in one line, payoff in Ch 8.
- **Bell** (with pauses, §3.5): TCS gets the player's +10 *plus* the two bots' + cards → big rise; Infosys gets the player's +10 but the scattered bot's − card → small move. Net worth delta on the player board. Aha: "You read the alliance and rode it."
- A caution line (one sentence): the same signal can mislead — someone might buy to bluff or to reach director (↩ teased for Ch 10).
- Takeaways: "One move = one company", "Watch what others buy — it hints at their cards."

### Ch 6 — Loan Stock
Hook: ↩ Ch 5: "Your slider max is limited by cash."
- Scenario: player wants to buy Reliance (they hold a big + card) but max is small. Play Loan Stock: cash += **10% of net worth** (rounded down to a multiple of 5, min $5). **Predict** the amount. Playing it uses the move (↩ Ch 4: one move = one power card); after the bot turns, next round, reopen the trade popup: slider max visibly grows (↩ slider). Buy.
- Takeaway: "Loan Stock: 10% of your net worth in cash, now."

### Ch 7 — Debenture
Hook: ↩ Ch 3: "Remember the company that hit 0 at the bell?"
- **How a company gets shut:** if the bell takes its price to 0 or below, it closes at $0.
- **What shut means:** its shares can't be bought or sold, and **no cards affect it** at later bells — its cards are revealed but its price stays at 0 (engine: closed companies skip fluctuation). Show this with a scripted bell where cards for the closed company land and its price doesn't move (closing-bell pause, §3.5). Shares the player holds in it count $0 on the player board.
- It stays shut **until someone plays a Debenture** on it.
- Scenario: YesBank closed at the last bell; the player still holds YesBank shares. **Predict** the reopen price, then the player plays Debenture → YesBank reopens at its **base value** ($25). Aha: net worth jumps from dead shares. Playing the card *is* the move (↩ Ch 4) — YesBank is tradeable again from the next round, and its cards count again at the next bell.
- Takeaway: "A shut company is frozen — no trading, no cards — until a Debenture reopens it at its starting price."

### Ch 8 — Rights Issue (two parts)
**8a — You play it.** Hook: ↩ "Trading only happens at today's price. A Rights Issue gets you shares at *half* price."
- Rules (engine truth): pick a company; its price temporarily drops to ~50% (rounded down to a multiple of 5, min 5); **every holder of that company**, starting with you, may buy up to **half their current holdings** at that price, limited by cash and available shares. Then the price restores.
- So you need two things **beforehand**: shares of that company *and* cash. Round 1: player buys Infosys using the **RI button** in the trade popup (↩ Ch 5) — it picks the biggest buy that still leaves cash to take the full rights issue. Aha: the RI button exists precisely for this.
- Round 2: play Rights Issue on Infosys; buy the full allowance. **Predict:** "How many shares can you buy?" (half your holdings). Payoff: net worth jump on the player board when the price restores (no cost-basis display exists; *my call:* don't add one).
**8b — Someone else plays it.** A bot plays Rights Issue on a company the player holds. ↩ Ch 4 teaser pays off: "This is the free move." The player gets the rights-issue prompt out of turn, buys, and their next normal move is still theirs. Show the contrast: a bot who holds nothing in that company gets nothing.
- Takeaways: "Rights Issue: own it, keep cash, then play it", "Someone else's Rights Issue = your free move".

### Ch 9 — Share Suspend
Hook: ↩ "Prices only move at the bell — but there's one card that lets you *undo* the bell for a company."
- Played **after** the bell, not on your turn (contrast with Ch 6–8, all played on your turn: "in-play" vs "after-play" cards).
- Scenario: player holds lots of Cred; bots' cards crash it at the bell (**predict** the crash from what bots have been buying/selling — or just watch). Real `ShareSuspendOverlay` opens; player selects Cred and confirms Halt → price swaps back to its pre-bell value. The net-worth graph re-animates: aha.
- The other side: a second bell where a bot halts a company the player just profited from (TCS rise undone). Aha: "it's a weapon as well as a shield."
- Edge: halting a company that the bell just shut brings it back, since the swap restores its pre-bell price (↩ Ch 7: the other way out of a shutdown besides Debenture).
- Copy must say "its price before the bell" (engine swaps with the pre-bell snapshot, `phases.py` `previous_values`), not "yesterday's price". Takeaway: "Share Suspend: undo today's bell for one company."

(Power-card order is the owner's: Loan Stock → Debenture → Rights Issue → Share Suspend. Share Suspend comes last as the one card that acts *after* the bell, contrasting with the three played on your turn.)

### Ch 10 — Chairman & Director
Hook: ↩ Ch 3: "At the bell, every card for a company counts. What if you could throw some away?"
Positions come from shares held in one company and act at the bell, before prices apply (real `ChairmanDirectorModal`):
- **Director (50+)**: discard one of your own cards of that company. Scenario: player has 50 TCS and a TCS −10 → discard it, TCS rises instead. **Predict** the new price.
- **Chairman (100+, one per company)**: discard one own card **and** remove one card of that company from another player's hand. Both optional. Scenario: a bot's big negative card is what's dragging your company down — remove it. Aha: you're now shaping the bell, not just reading it (↩ "you see your cards, not theirs" — but the chairman acts on others' too).
- **Double Director (100+ when someone else is chairman)**: discard 1–2 own cards.
- **150+**: chairman **and** director — chairman power first, then director.
- **200+**: chairman **and** double director — up to 4 discards.
- **The 200 supply (owner decision — no per-player cap exists; it's bank supply):** each company has only 200 shares in total (↩ "available" on the ticker, Ch 1 / Ch 5).
  - Scenario 1: bots hold 100 and 50 of a company, so 50 remain. The player has cash for 70 — the slider max (↩ Ch 5) stops at **50**. **Predict** the max first. Aha: money isn't the only limit.
  - Scenario 2: a company crashes to $5 at a bell. Next day, everyone wants it — and whoever moves first with the cash buys the supply. A bot earlier in turn order takes most of it before the player's move. Aha: **liquidity and turn order decide who capitalises.** Mention that turn order rotates each day (engine `end_day` rotates seats), so who goes first changes.
  - Close the chapter by tying back: 200 is also the most anyone can hold — the chairman + double director tier is the whole company.
- Positions change as soon as holdings cross thresholds (buy/sell), visible on the player board icons (↩ Ch 1).
- One scripted bell per combination is fine; combine where the modal flow allows (e.g. 150+ demonstrates both chairman and director steps).
- Takeaway: "Hold 50 / 100 / 150 / 200 of one company and you get a say in its bell."

### Ch 11 — Recap & first game
All takeaway chips on one screen, grouped by chapter. Buttons: **Play your first game vs bots** (creates room: player + 3 Easy bots, starts it) · Replay a chapter · Read the rulebook.

## 6. Constraints
- Must not change the live-game message protocol, engine rules, or server behaviour. Tutorial mode is a frontend switch plus fixtures.
- The real components stay the source of UI truth; tutorial-specific forks of components are a last resort and must be justified.
- `tsc -b` and `npm run build` must pass. Each chapter must be driven end-to-end at **1280×720 and 390×844** before it counts as done.
- Bundle size: fixtures should be lazy-loaded per chapter (the main chunk already triggers a >500 kB warning).

## 7. Left to the builder
- Exact fixture schema and how the store is fed (direct `setGameState`, a fake transport behind `useWebSocket`'s `send`, etc.).
- How locking is enforced (overlay with a hole, `pointer-events` on a tutorial root, per-control guard props).
- Bot names, scenario numbers, coachmark visuals (extend existing Coachmark/Spotlight; match the v2 editorial theme).
- Fine ordering inside chapters.
- How the "Play vs bots" button creates the room (existing lobby `add_bot` path).

## 8. Open questions for the owner
None outstanding. Resolved: closing-bell pause → add it (§3.5); "200 limit" → bank supply + liquidity/turn-order lesson (Ch 10).

## 9. Out of scope but found
The rulebook (`frontend/src/tutorial/chapters.tsx`) contradicts the engine:
- Loan Stock: says flat $100; engine gives 10% of net worth.
- Debenture: says it burns cards; engine reopens a closed company at base value.
- Rights Issue: says fixed $10 to anyone in turn order; engine halves the price, only holders, up to half their holdings.
- Share Suspend description is loosely right but frames it as "played silently"; engine resolves it in a post-bell phase where the holder picks any company.
Fix separately; the tutorial follows the engine.
