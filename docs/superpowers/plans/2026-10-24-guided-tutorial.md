# Guided Tutorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A locked, step-by-step guided tutorial that runs on the real game UI from engine-generated fixtures, in 11 chapters, on desktop and mobile.

**Architecture:** An offline Python generator plays each chapter's scripted scenario through the real engine and the real `build_client_state`, writing per-chapter JSON snapshots into the frontend. A client-only tutorial player renders the real `GameBoard` with those snapshots loaded into `useGameStore`, swaps the WebSocket `send` for an interceptor, and drives a pure step machine. A `TutorialContext` (absent in live games) lets a few live components lock controls, freeze the timer, and hold the closing-bell animation.

**Tech Stack:** Python 3.12 engine (`backend/venv/bin/python`), React 19, Zustand 5, Framer Motion 12, Tailwind 4, TypeScript 5.9. New dev deps (my call): `vitest` for pure logic, `@playwright/test` for the per-chapter end-to-end walk.

**Spec:** `docs/superpowers/specs/2026-10-24-guided-tutorial-design.md`. Read it before any task. §4 (pedagogy rules) governs every chapter task.

## Global Constraints

- No change to the live-game message protocol, engine rules, or server behaviour. Tutorial = frontend switch + fixtures (spec §6).
- Real components are the UI source of truth; tutorial forks of components only as a last resort, justified in the commit message.
- With no `TutorialContext` provider, every touched live component behaves exactly as before.
- `cd frontend && npx tsc -b` and `npm run build` pass after every task (use `tsc -b`, never `--noEmit`).
- Every chapter is driven end-to-end at **1280×720 and 390×844** (Playwright projects `desktop` and `mobile`).
- Fixtures are lazy-loaded per chapter (dynamic `import()`); the main chunk must not grow by their size.
- Copy: engine truth only (spec §4.8, §9); ≤ 2 short sentences per coachmark; never more than 3 read-only steps in a row; refer to bots by name, they/them if a pronoun is needed.
- All step copy lives in `frontend/src/tutorial/chapters/*.ts` — no user-facing tutorial strings in components except generic chrome ("Next", "Exit tutorial", "Restart this step").
- Fixed cast across all chapters: human seat **id 1, name "You"**; bots **Meera (2), Arjun (3), Kabir (4), Zoya (5), Dev (6)**. Chapters with 2–3 bots use the first ones in that order.
- Human-visible numbers in copy must equal the fixture's numbers (each chapter's Python test pins them).
- After any rule change, re-run the generator (added to CLAUDE.md in Task 15).

## Review Focus

1. **Leaving the tutorial** (Exit button, browser back, closing the tab mid-chapter) — the store is restored, `/game/:code` in the same tab never shows tutorial state, and a live session's persisted identity survives. Test: Task 6 `restoreStore` unit test + e2e "exit restores".
2. **Viewport crosses 768px mid-step** (rotate phone, resize window) — desktop/mobile trees remount, an open trade modal closes, the spotlight target disappears. Expected: no dead end; a centered coachmark offers "Restart this step", rewinding to the last checkpoint. Test: Task 2 `rewindToCheckpoint` + Task 5 missing-target fallback test.
3. **Duplicate or stray sends** (double-tap Confirm, StrictMode double effects sending `reveal_complete` twice, `day_start_ready` arriving on a non-expecting step) — never skip a step. Test: Task 2 `duplicate send advances once`.
4. **Live games untouched** — no provider ⇒ every guard returns "allowed", timer counts down, reveal never holds, RollingUpdates/first-encounter tips still show. Test: Task 3/4 null-context unit tests.
5. **Fixtures drift from the engine** after a rule change — copy quotes numbers the engine no longer produces. Expected: CI-style check fails loudly. Test: Task 1 `build_fixtures.py --check` exits non-zero on drift; each chapter's Python test pins its lesson numbers.

---

## File Structure

```
backend/tutorial/__init__.py
backend/tutorial/scenario.py          # Scenario: set state, act, bell, ack, next_day, snap
backend/tutorial/chapters/<id>.py      # one build(s: Scenario) per chapter
backend/tutorial/build_fixtures.py     # CLI: writes / --check fixtures
tests/test_tutorial_fixtures.py        # generator core + per-chapter lesson pins

frontend/src/tutorial/runtime/types.ts         # Chapter, Step, Advance, TargetId
frontend/src/tutorial/runtime/machine.ts       # pure step machine
frontend/src/tutorial/runtime/TutorialContext.tsx
frontend/src/tutorial/runtime/storeSwap.ts     # save/load/restore useGameStore
frontend/src/tutorial/runtime/revealStage.ts   # stageKey()
frontend/src/tutorial/components/TutorialLayer.tsx   # lock + spotlight + coachmark
frontend/src/tutorial/components/TutorialCoachmark.tsx
frontend/src/tutorial/chapters/index.ts        # registry (ordered)
frontend/src/tutorial/chapters/<id>.ts         # steps + chips (all copy)
frontend/src/tutorial/fixtures/<id>.json       # generated — do not edit
frontend/src/pages/TutorialPlayerPage.tsx      # /tutorial/play/:chapterId
frontend/src/pages/TutorialPage.tsx            # hub → chapter list (rewrite)
frontend/e2e/tutorial.spec.ts + frontend/playwright.config.ts
```

Chapter ids (fixed, ordered): `orientation`, `objective`, `prices`, `turns`, `trading`, `loan-stock`, `debenture`, `rights-issue`, `share-suspend`, `chairman-director`, `recap`.

---

### Task 1: Fixture generator core

**Files:**
- Create: `backend/tutorial/__init__.py`, `backend/tutorial/scenario.py`, `backend/tutorial/build_fixtures.py`, `backend/tutorial/chapters/__init__.py`
- Test: `tests/test_tutorial_fixtures.py` (same plain-script style as `tests/test_bots.py`: `check(desc, cond)`, exit 1 on failure)

**Interfaces:**
- Produces (Python):
  - `class Scenario(chapter_id: str, seats: list[str], human_id: int = 1)` — builds a real `room_manager.Room` with `PlayerConn`s (bots: `BotSocket`, `bot_difficulty="easy"`, `connected=True`), and `GameState(num_players, player_ids)`. Phase starts at `player_turn`, day 1, round 0.
  - `Scenario.setup(*, prices: dict[str,int] | None, closed: list[str] | None, cash: dict[int,int] | None, stocks: dict[int, dict[str,int]] | None, hands: dict[int, list[str]] | None, day: int | None, price_history: list[list[int]] | None, networth_history: list | None, current_turn: int | None, round: int | None) -> None` — sets fields directly and recomputes `available_shares` (200 − Σ holdings) and `update_positions` for every company. Card spec strings: `"TCS+10"`, `"YesBank-15"`, `"RightsIssue"`, `"ShareSuspend"`, `"LoanStock"`, `"Debenture"`, `"Currency+"`, `"Currency-"` (map to the engine's `"Currency + "`/`"Currency - "`).
  - `Scenario.act(player_id: int, msg: dict) -> dict` — `server.dispatch_action`; raises `AssertionError` with the engine message on `success == False`; appends `f"{name}: {message}"` to `room.game_log` exactly like `server.after_action`; then runs `_advance()` — a synchronous mirror of `server.auto_advance` (no sleeps, no broadcasts) that stops at `card_reveal` (after `begin_card_reveal`), `share_suspend` with a queue, `rights_issue`, or `player_turn`. On reaching `dealing` it does **not** deal; it stops so `next_day` can set hands.
  - `Scenario.ack_reveal() -> None` — `complete_card_reveal` for every active player, then `_advance()`.
  - `Scenario.next_day(hands: dict[int, list[str]]) -> None` — requires phase `dealing`; sets hands, `game_phase="player_turn"`, `current_turn=first_active_index`, `current_round=0` (mirrors `deal_cards` minus shuffle).
  - `Scenario.snap(snap_id: str) -> None` — stores `server.build_client_state(room, human_id)` deep-copied; duplicate id raises. Sets `turn_timer_deadline=None`, `day_end_countdown_deadline=None`, `turn_timer_duration=90`.
  - `Scenario.to_fixture() -> dict` → `{"chapter": str, "human_id": int, "snapshots": {snap_id: GameState}}`.
  - Each `backend/tutorial/chapters/<id>.py` exposes `def build() -> Scenario`; `chapters/__init__.py` exposes `CHAPTERS: dict[str, Callable[[], Scenario]]` (empty in this task).
  - `build_fixtures.py [--check] [chapter_id ...]` writes `frontend/src/tutorial/fixtures/<id>.json` (`json.dumps(indent=1, sort_keys=True)`); `--check` writes nothing and exits 1 listing any chapter whose output differs from disk.

- [ ] **Step 1: Write failing tests** in `tests/test_tutorial_fixtures.py`:
  - `test_setup_hands`: a 3-seat Scenario with `hands={1:["TCS+10","LoanStock"]}`; snap; `snap["your_hand"] == [{"company":"TCS","value":10,"positive":True,"is_power":False},{"company":"LoanStock","value":0,"positive":True,"is_power":True}]`.
  - `test_snap_shape`: snapshot keys == keys of `server.build_client_state` on a started game; `players[0]["name"] == "You"`, `players[0]["is_you"] is True`, `turn_timer_deadline is None`.
  - `test_act_logs_like_server`: `act(1, {"type":"buy","company_num":4,"quantity":2})` → last log entry starts with `"You: Bought 2 of TCS"`; `available_shares[3] == 198`.
  - `test_failed_act_raises`: buying more than affordable raises `AssertionError` containing `"afford"`.
  - `test_bell_and_next_day`: all 3 seats pass ×3 rounds → phase `card_reveal`, `reveal_data` non-empty; `ack_reveal()` → phase `dealing`; `next_day(...)` → `day == 2`, phase `player_turn`.
  - `test_check_detects_drift`: write a fixture for a registered throwaway chapter, mutate the file, run `build_fixtures.main(["--check", id])` → returns 1; unmutated → 0.
- [ ] **Step 2:** Run `backend/venv/bin/python tests/test_tutorial_fixtures.py` — expect failures (module missing).
- [ ] **Step 3:** Implement `scenario.py` and `build_fixtures.py` per Interfaces. Import `server` with the same `sys.path` setup as `tests/test_bots.py`; never start the app or event loop.
- [ ] **Step 4:** Re-run the test file — all pass. Also run `backend/venv/bin/python tests/test_room_features.py` — still 71 passing.
- [ ] **Step 5:** Commit `feat(tutorial): engine-driven fixture generator`.

---

### Task 2: Step machine (pure TS) + vitest

**Files:**
- Create: `frontend/src/tutorial/runtime/types.ts`, `frontend/src/tutorial/runtime/machine.ts`
- Modify: `frontend/package.json` (devDep `vitest`, script `"test": "vitest run"`)
- Test: `frontend/src/tutorial/runtime/machine.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  ```ts
  export type TargetId = 'ticker' | 'ticker-available' | 'hand' | 'player-board' | 'player-self'
    | 'day-round' | 'timer' | 'log' | 'action-bar' | 'buy-button' | 'sell-button' | 'power-panel'
    | 'trade-company' | 'trade-mode' | 'trade-slider' | 'trade-max' | 'trade-ri' | 'trade-confirm'
    | 'reveal-overlay' | 'suspend-list' | 'suspend-confirm' | 'cd-modal' | 'rights-modal' | 'exit'
  export type Advance =
    | { kind: 'next' }
    | { kind: 'click' }                                  // click on the spotlit target
    | { kind: 'action'; expect: Partial<ClientMessage> } // intercepted send must match
    | { kind: 'auto'; delayMs: number }                  // bot turn / pause, input fully blocked
    | { kind: 'predict'; options: { label: string; correct: boolean }[]; right: string; wrong: string }
    | { kind: 'reveal_wait'; at: string }                // wait until CardRevealOverlay reaches stage key
    | { kind: 'reveal_end' }                             // wait for intercepted reveal_complete
    | { kind: 'suspend_end' }                            // wait for intercepted day_start_ready
  export interface Step {
    id: string; snap: string; text?: string; textMobile?: string; target?: TargetId
    advance: Advance; holdRevealAt?: string; mobileTab?: MobileTab; checkpoint?: boolean
  }
  export interface Chapter { id: string; title: string; subtitle: string; minutes: number
    steps: Step[]; chips: string[]; hookFrom?: string }
  ```
- Produces (`machine.ts`):
  - `interface RunState { idx: number; picked: number | null; done: boolean }`
  - `type MachineEvent = { type: 'next' } | { type: 'click' } | { type: 'send'; msg: ClientMessage } | { type: 'auto_elapsed' } | { type: 'predict'; option: number } | { type: 'reveal_stage'; key: string }`
  - `initialRun(): RunState`
  - `reduce(ch: Chapter, s: RunState, e: MachineEvent): RunState` — advances only when the event satisfies the current step's `advance`. `predict`: first pick sets `picked`; a following `next` advances. Past the last step → `done: true`.
  - `matchesExpected(expect: Partial<ClientMessage>, msg: ClientMessage): boolean` — every key in `expect` deep-equals `msg`'s.
  - `allows(step: Step, msg: ClientMessage): boolean` — true iff current advance is `action` and `matchesExpected`, or msg is `pong`/`chat`.
  - `heldRevealStage(step: Step): string | null` — `step.holdRevealAt ?? (advance.kind === 'reveal_wait' ? advance.at : null)`.
  - `snapChanged(ch: Chapter, fromIdx: number, toIdx: number): boolean`.
  - `rewindToCheckpoint(ch: Chapter, idx: number): number` — index of nearest step ≤ idx with `checkpoint: true`, else 0.

- [ ] **Step 1: Write failing tests** (`machine.test.ts`, fixture chapter inline):
  - `next advances only on next steps`; `click advances only on click`.
  - `action matches by listed fields`: expect `{type:'buy', company_num:4, quantity:10}`; send quantity 9 → same idx; quantity 10 → idx+1.
  - `duplicate send advances once`: two identical matching sends → idx+1 only (next step expects something else).
  - `stray reveal_complete ignored` on a `next` step.
  - `predict requires pick then next`; `picked` reset to null on advance.
  - `reveal_wait advances on matching stage key only`; `heldRevealStage` returns `at` for reveal_wait and `holdRevealAt` otherwise.
  - `snapChanged false for consecutive steps on same snap`.
  - `rewindToCheckpoint` returns 3 for idx 5 when step 3 is the last checkpoint; 0 when none.
- [ ] **Step 2:** `cd frontend && npm test` — fails.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` passes; `npx tsc -b` passes.
- [ ] **Step 5:** Commit `feat(tutorial): step machine`.

---

### Task 3: TutorialContext + guards in live components

**Files:**
- Create: `frontend/src/tutorial/runtime/TutorialContext.tsx`
- Modify: `TradeModal.tsx`, `ActionBar.tsx`, `PowerCardPanel.tsx`, `RightsIssueModal.tsx`, `ShareSuspendOverlay.tsx`, `ChairmanDirectorModal.tsx` (disable commit buttons via guard); `hooks/useTurnUrgency.ts`, `TurnTimerDisplay.tsx` (frozen timer); `hooks/useFirstEncounterTip.ts` (off); `GameBoard.tsx` (skip `RollingUpdatesModal`, honour `forcedMobileTab`)
- Test: `frontend/src/tutorial/runtime/TutorialContext.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface TutorialApi {
    allows(msg: ClientMessage): boolean
    frozenTimerSecs: number          // shown remaining seconds, never ticks
    heldRevealStage: string | null
    reportRevealStage(key: string): void
    forcedMobileTab: MobileTab | null
  }
  export const TutorialContext: React.Context<TutorialApi | null>
  export function useTutorial(): TutorialApi | null
  export function tutorialAllows(api: TutorialApi | null, msg: ClientMessage | null): boolean  // null api → true; null msg → false
  export function useTutorialAllows(msg: ClientMessage | null): boolean
  ```
- Guard rule: each commit button (Confirm buy/sell, power-card play, rights buy/pass, Halt/Pass, chairman/director submit) computes the exact `ClientMessage` it would send and adds `!useTutorialAllows(msg)` to its `disabled`. Controls that only change local UI (slider, company select, buy/sell toggle) are never disabled by the guard.

- [ ] **Step 1: Write failing tests:** `tutorialAllows(null, buyMsg) === true`; with api whose `allows` returns false → false; `tutorialAllows(api, null) === false`.
- [ ] **Step 2:** `npm test` — fails.
- [ ] **Step 3:** Implement context; wire the guards and the four behaviour switches. With `useTutorial()` null, every touched code path is byte-for-byte the old behaviour.
- [ ] **Step 4:** `npm test`, `npx tsc -b`, `npm run build` pass. Manual: start a local bot game (backend `--port 8010`, Vite `--port 5180` with `VITE_WS_URL`) — buy, timer countdown, rolling-updates modal unchanged.
- [ ] **Step 5:** Commit `feat(tutorial): context + guards (no-op in live games)`.

---

### Task 4: Closing-bell hold gate

**Files:**
- Create: `frontend/src/tutorial/runtime/revealStage.ts`
- Modify: `frontend/src/components/game/CardRevealOverlay.tsx` (export `Stage` type; report and hold)
- Test: `frontend/src/tutorial/runtime/revealStage.test.ts`

**Interfaces:**
- Produces: `stageKey(stage: Stage, revealData: RevealCompanyData[]): string` → `company_intro:<Company>`, `revealing_cards:<Company>:<cardIdx>`, `final_value:<Company>`, `chairman_director:<Company>`, `currency_settlement:<visibleIdx>`, `complete` (company = `revealData[companyIdx].company_name`, e.g. `final_value:TCS`).
- Overlay behaviour: on every stage change call `tutorial?.reportRevealStage(key)`. In the auto-advance effect, if `tutorial?.heldRevealStage === key`, schedule nothing; the effect depends on `heldRevealStage` so releasing (value changes) resumes from the held stage with its normal delay.

- [ ] **Step 1: Write failing tests** for each `stageKey` form with a 2-company `revealData`.
- [ ] **Step 2:** `npm test` fails.
- [ ] **Step 3:** Implement; no change when context is null.
- [ ] **Step 4:** Tests + `tsc -b` pass; live bot game reveal plays at normal pace.
- [ ] **Step 5:** Commit `feat(tutorial): hold gate for closing bell`.

---

### Task 5: Tutorial layer (lock, spotlight, coachmark) + target tags

**Files:**
- Create: `frontend/src/tutorial/components/TutorialLayer.tsx`, `frontend/src/tutorial/components/TutorialCoachmark.tsx`
- Modify: add `data-tutorial="<TargetId>"` to the matching element in **both** desktop and mobile trees: `StockTicker`, `PlayerHand`, `MobileCardStrip`, `PlayerBoard`, `MobilePlayerBoard`, `DayRoundIndicator`, `TurnTimerDisplay`, `GameLog`, `MobileLogChat`, `ActionBar`, `PowerCardPanel`, `TradeModal`, `CardRevealOverlay`, `ShareSuspendOverlay`, `ChairmanDirectorModal`, `RightsIssueModal`. Reuse/extend `components/tutorial/Spotlight.tsx` and `Coachmark.tsx` positioning.
- Test: `frontend/src/tutorial/components/findTarget.test.ts`

**Interfaces:**
- Consumes: `Step`, `TargetId` (Task 2).
- Produces:
  - `findTarget(id: TargetId, root?: ParentNode): HTMLElement | null` — first `[data-tutorial=id]` with non-zero client rect.
  - `<TutorialLayer step={Step} picked={number|null} isMobile={boolean} onNext() onClick() onPredict(i) onRestartStep() onExit() />` — z-index above every game overlay/modal. Blocks pointer input everywhere except a hole over the target, built from four absolutely-positioned blocking rects; a separate non-interactive SVG draws the dim + ring. `click` advance: capture-phase listener on the target fires `onClick` after the native click. `auto` / `reveal_wait` / `reveal_end` / `suspend_end`: block everything, no hole, no coachmark text (`reveal_*`) or a small status chip (`auto`). Coachmark renders `text` (`textMobile` when `isMobile`), `**bold**` only; `next` → Next button; `predict` → options, then feedback (`right`/`wrong`) + Next. Always shows "Exit tutorial".
  - Missing target for > 1000 ms → centered coachmark with the step text and a "Restart this step" button (`onRestartStep`).
  - Test ids: `tutorial-next`, `tutorial-predict-<i>`, `tutorial-restart`, `tutorial-exit`.

- [ ] **Step 1: Write failing test:** `findTarget` returns the visible element and skips a zero-size one (vitest `environment: 'happy-dom'` for this file only — add `happy-dom` devDep; stub `getBoundingClientRect`).
- [ ] **Step 2:** fails. **Step 3:** implement. **Step 4:** tests + `tsc -b` + build pass.
- [ ] **Step 5:** Commit `feat(tutorial): lock layer, coachmark, target tags`.

---

### Task 6: Tutorial player page, hub, entry, progress, e2e harness

**Files:**
- Create: `frontend/src/pages/TutorialPlayerPage.tsx`, `frontend/src/tutorial/runtime/storeSwap.ts`, `frontend/src/tutorial/chapters/index.ts`, `frontend/src/tutorial/chapters/_smoke.ts` + `backend/tutorial/chapters/_smoke.py` (2 bots: one `next`, one `click` on `buy-button`, one `action` buy, one `auto`, one bell `reveal_end`; registered only when `import.meta.env.DEV`), `frontend/playwright.config.ts`, `frontend/e2e/tutorial.spec.ts`
- Modify: `App.tsx` (route `/tutorial/play/:chapterId`), `pages/TutorialPage.tsx` (rewrite: chapter list from registry with title/subtitle/minutes/completed tick, "Start from the beginning" → first incomplete chapter, link to rulebook, keep tips toggle), `pages/LobbyPage.tsx` (Tutorial entry in **both** v1 and v2 themes), `lib/tutorialStorage.ts` (add per-chapter progress), `frontend/package.json` (`@playwright/test`, script `"e2e": "playwright test"`)
- Test: `frontend/src/tutorial/runtime/storeSwap.test.ts`, e2e smoke

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `chapters/index.ts`: `CHAPTERS: Chapter[]` (ordered) and `loadFixture(id: string): Promise<Fixture>` via `import(\`../fixtures/${id}.json\`)`; `type Fixture = { chapter: string; human_id: number; snapshots: Record<string, GameState> }`.
  - `storeSwap.ts`: `enterTutorialStore(): SavedStore` (captures full current store state), `loadSnapshot(state: GameState): void` (`setGameState`, `isConnected: true`, `gameStarted: true`, `gameOver: null`, `chatMessages: []`), `restoreStore(saved: SavedStore): void`. Never writes `roomCode`/`playerName`.
  - `tutorialStorage`: `isChapterDone(id)`, `markChapterDone(id)`, `firstIncompleteChapter(ids: string[]): string`; `markCompleted()` when `recap` is done.
  - Player page: loads fixture, `enterTutorialStore` on mount / `restoreStore` on unmount; renders `<TutorialContext.Provider><GameBoard send={intercept} /><TutorialLayer …/></…>`. `intercept(msg)`: `leave_room` → exit to `/tutorial`; else `reduce(…, {type:'send', msg})`. On every idx change: `loadSnapshot` only if `snapChanged`; `auto` steps schedule `auto_elapsed`; `restart` → `rewindToCheckpoint` and reload that step's snap. On `done`: `markChapterDone`, show chapter-done card (`data-testid="tutorial-chapter-done"`) with the chapter's chips and "Next chapter" / "All chapters". Reload mid-chapter starts the chapter at step 0.
  - e2e walker `walkChapter(page, chapter)`: per step — `next` → click `tutorial-next`; `click`/`action` → click target (for `trade-slider` set the range input to `expect.quantity` via `fill`/`evaluate` + dispatch `input`), then for `action` steps click the commit button the step targets; `predict` → click option 0 then `tutorial-next`; `auto`/`reveal_*`/`suspend_end` → wait for the next step (timeout 30 s); ends on `tutorial-chapter-done`. Projects `desktop` 1280×720 and `mobile` 390×844; `webServer` runs Vite on 5199 (no backend needed).

- [ ] **Step 1: Write failing tests:** `storeSwap`: enter → load → restore returns the exact prior state including a non-null `roomCode`; `loadSnapshot` never changes `roomCode`. e2e: smoke chapter completes on both projects; "exit restores" — Exit mid-chapter lands on `/tutorial` and `useGameStore.getState().gameState === null` (expose via `window.__store` in DEV only).
- [ ] **Step 2:** `npm test` / `npx playwright test` fail.
- [ ] **Step 3:** Implement; run `backend/venv/bin/python backend/tutorial/build_fixtures.py _smoke`.
- [ ] **Step 4:** All pass; `tsc -b`, `build` pass; `npm run build` output contains no `_smoke`.
- [ ] **Step 5:** Commit `feat(tutorial): player page, hub, progress, e2e harness`.

---

### Chapter tasks (7–14) — common shape

Each chapter task creates `backend/tutorial/chapters/<id>.py` (`build() -> Scenario`, registered in `CHAPTERS`), the generated `frontend/src/tutorial/fixtures/<id>.json`, and `frontend/src/tutorial/chapters/<id>.ts` (registered in `CHAPTERS` in order), and appends lesson tests to `tests/test_tutorial_fixtures.py`. Steps for every chapter task:

- [ ] **Step 1:** Write the chapter's lesson tests (listed per task) against `build()` snapshots — they fail.
- [ ] **Step 2:** Write the scenario; run `build_fixtures.py <id>`; Python tests pass.
- [ ] **Step 3:** Write the steps + copy, following spec §4 and the chapter's beats in spec §5: open with the hook (`hookFrom` = previous chapter id), at least one ↩ recall that re-spotlights the earlier control, a predict before each payoff, numbers in every payoff, ≤ 3 read-only steps in a row, `checkpoint: true` on the step before any modal is opened.
- [ ] **Step 4:** `npx playwright test -g <id>` passes on both projects; `tsc -b` passes. Read the chapter through once on each viewport and fix any step where text and fixture numbers disagree.
- [ ] **Step 5:** Commit `feat(tutorial): <id> chapter`.

### Task 7: `orientation` + `objective` (spec Ch 1–2)
- 6 seats (You + all 5 bots), mid day 1, a few bot trades in the log, one bot a director somewhere so a position icon shows.
- Lesson tests: 6 players; `available_shares` < 200 for at least one company; log has ≥ 3 entries; one position icon present (`directors` non-empty).
- Steps: one spotlight per target in spec Ch 1 order (ticker, ticker-available, hand, player-board, day-round, timer, log — `mobileTab: 'log'` on mobile —, action-bar, exit). `objective` is 2–3 untargeted `next` steps (net worth formula, days/rounds, the bell); its last step's text is the "So what moves prices?" hook.

### Task 8: `prices` (spec Ch 3)
- You hold `TCS+10`, `Reliance-15`, `Currency+`; Meera/Arjun hold cards giving Reliance ≥ +25 total; YesBank receives ≥ −25 total so it closes.
- Lesson tests: `final reveal_data` TCS delta > 0; Reliance delta > 0 despite your −15; YesBank `new_value == 0` and after ack `is_open is False`; `currency_effects` has your `+` row with `after == before * 1.1`.
- Steps: predict TCS → `reveal_wait final_value:TCS` → explain; `reveal_wait revealing_cards:Reliance:<bots' card>` → "outweighed" explanation; YesBank closes (seeds Ch 7); currency tail with the spend-before-bell aha; `reveal_end`.

### Task 9: `turns` (spec Ch 4)
- 3 bots; show one full round passing round the table (`auto` steps), the day/round indicator advancing, You pass once to show pass.
- Lesson tests: after scripted moves `round` increments only after all 4 seats moved; each bot move is exactly one buy/sell/pass.
- Steps cover: one move per round, the four move types, can't mix, the Rights Issue free-move teaser line, timer recall (re-spotlight `timer`).

### Task 10: `trading` (spec Ch 5)
- You: `TCS+10`, `Infosys+10`, cash enough for a real position in only one. Round 1: Meera and Arjun buy TCS; Kabir buys two other companies. Kabir holds an `Infosys-` card; Meera/Arjun hold `TCS+` cards.
- Lesson tests: TCS delta ≥ your +10 + bots' TCS cards and > Infosys delta; your affordable TCS qty × TCS price ≤ cash and affordable Infosys qty < meaningful (< ½ of TCS position value); your net worth after bell > before by the number the copy quotes.
- Steps: watch round 1 (`auto`, log + `player-self` board spotlights), alliance reasoning, predict, buy TCS (`buy-button` click → `trade-company` → `trade-slider` action → `trade-confirm`), round 2 partial sell, RI button one-liner, bell with holds on TCS and Infosys, bluff caution, chips.

### Task 11: `loan-stock` + `debenture` (spec Ch 6–7)
- Loan Stock: You want Reliance (hold big `Reliance+`), cash-limited. Lesson tests: loan amount == `max(5, int(nw*0.1)//5*5)` and equals the copy's predicted-correct option; slider max next round > max before.
- Debenture: YesBank closed, You hold YesBank; a scripted bell where YesBank cards land but `new_value == 0`; then You play Debenture → YesBank `value == 25`, `is_open`; next round You can buy YesBank.
- Steps per spec; playing the card is the move, buy happens next round after `auto` bot turns.

### Task 12: `rights-issue` (spec Ch 8a/8b)
- 8a lesson tests: RI price == `max(5, (v//10)*5)`; your allowance == `holdings//2`; the RI-button quantity bought in round 1 leaves `cash >= allowance * ri_price`; price restored after queue.
- 8b lesson tests: bot plays RI on a company You hold → snapshot with `phase == 'rights_issue'` and `rights_issue_queue[0] == 1` (or after the bot if the bot holds); a bot holding none of it is not in the queue; your next normal turn still occurs that round.
- Steps: `trade-ri` spotlight in round 1 (↩ trading), `power-panel` play, `rights-modal` buy full allowance, predict allowance; 8b free-move payoff of the `turns` teaser.

### Task 13: `share-suspend` (spec Ch 9)
- Bell 1: Cred crashes; You hold Cred + `ShareSuspend` → halt Cred. Bell 2: a bot halts TCS after your gain. Edge: a company shut by bell 3 restored by a halt.
- Lesson tests: after your halt Cred value == pre-bell value; `networth_history` last row for You increases vs. pre-halt; bell 2 TCS reverts; bell 3 shut company `is_open` again after suspend finalizes. Day numbers strictly increase across bells.
- Steps: `suspend-list` click Cred → `suspend-confirm` action `{type:'share_suspend', company_num:3}` → `suspend_end`; copy says "price before the bell"; in-play vs after-play contrast.

### Task 14: `chairman-director` (spec Ch 10)
- One bell per position: director (50, discard own −), chairman (100, discard own + remove a bot's card), double director (100 while a bot is chairman, 2 own cards), 150+ (chairman then director), 200 (chairman + double director). Then supply: bots hold 100 + 50 → 50 available while You can afford ≥ 70; then a company at $5 where an earlier-seat bot buys most supply first (note `end_day` seat rotation).
- Lesson tests: `chairman_director_queue` entries for You have the expected roles per bell; post-discard `new_value` moves in the direction the copy predicts; supply: `available_shares == 50` and `cash // price >= 70`; at-$5 day, bot's buy precedes yours and leaves less than you could afford.
- Steps: `cd-modal` actions per combination, predicts before each recomputed value, supply slider-max predict (↩ trading slider), turn-order aha, tie-back "200 is the whole company".

### Task 15: `recap` + first game + docs

**Files:**
- Create: `frontend/src/tutorial/chapters/recap.ts` (no fixture; a single `next`-only chapter rendered by a recap view), `frontend/src/tutorial/components/RecapView.tsx`
- Modify: `TutorialPlayerPage.tsx` (render `RecapView` for `recap`), `pages/GamePage.tsx` (`?autostart=bots3`: when the `lobby` message arrives and you are host, send `add_bot` ×3 with `difficulty:'easy'`, then `start_game`), `CLAUDE.md` (tutorial architecture + "after any rule change, re-run `backend/tutorial/build_fixtures.py`"), `development-history/phase_13_guided_tutorial.md`

**Interfaces:**
- `RecapView` lists every chapter's `chips` grouped by chapter title; buttons: "Play your first game vs bots" (uses the last-used name from `stock-exchange-last-name`, asking inline if empty; generates a 4-char room code exactly like `LobbyPage.createRoom`; `setConnection`; navigates to `/game/<code>?autostart=bots3`), "Replay a chapter", "Read the rulebook".

- [ ] **Step 1: Write failing tests:** e2e — recap shows ≥ 1 chip per chapter and the button navigates to `/game/XXXX?autostart=bots3` (stub navigation check only). Python: `tests/test_bots.py` style check that `add_bot`×3 + `start_game` from a host yields a started 4-seat game (existing handlers — should already pass; guards the flow).
- [ ] **Step 2:** fail. **Step 3:** implement. **Step 4:** full `npm test`, `npx playwright test` (all chapters, both projects), `build_fixtures.py --check`, `tsc -b`, `npm run build` pass; manual: real backend on 8010 — the button lands in a running game with 3 Easy bots.
- [ ] **Step 5:** Commit `feat(tutorial): recap + first game; docs`.
