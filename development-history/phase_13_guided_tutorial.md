# Phase 13 — Guided Tutorial

Spec: `docs/superpowers/specs/2026-10-24-guided-tutorial-design.md`. Plan:
`docs/superpowers/plans/2026-10-24-guided-tutorial.md`. Branch `guided-tutorial`.

## Goals

1. A newcomer finishes a guided, **locked** walkthrough and one real game, then plays with
   intent. It replaces the Phase 9 "scripted walkthrough" stub.
2. It runs on the **real game UI** (board, trade popup, closing bell, share-suspend screen,
   chairman/director modal), so what is learned transfers 1:1. It works the same on desktop
   (≥768px) and mobile (<768px).
3. Pedagogy is the quality bar (spec §4): each chapter opens with a hook from the previous one,
   recalls an earlier control by spotlighting it again, asks the player to predict before each
   payoff, quotes the real numbers, never shows more than 3 read-only steps in a row, and ends
   with takeaway chips plus a hook into the next chapter.
4. **No change to the live-game protocol, engine rules or server behaviour.** The tutorial is a
   frontend mode plus pre-generated fixtures.

## Where things live

| Path | What |
|------|------|
| `backend/tutorial/scenario.py` | `Scenario`: seats a fixed cast (You = id 1; bots Meera 2, Arjun 3, Kabir 4, Zoya 5, Dev 6), hand-picked cards, then plays scripted moves through the real `engine/` and server helpers (`act`, `ack_reveal`, `next_day`, `snap`). Snapshots are `build_client_state`-shaped for the human seat. |
| `backend/tutorial/chapters/<id>.py` | One `build() -> Scenario` per chapter, registered in `CHAPTERS`. |
| `backend/tutorial/build_fixtures.py` | Writes `frontend/src/tutorial/fixtures/<id>.json`. `--check` exits non-zero when a fixture has drifted from the engine. |
| `frontend/src/tutorial/runtime/` | `types.ts` (Step / Advance / Chapter), `machine.ts` (pure step reducer: `reduce`, `allows`, `rewindToCheckpoint`, `heldRevealStage`, `holdsSuspendClose`), `TutorialContext.tsx` (guards live components read), `storeSwap.ts` (take over / restore the Zustand store), `revealStage.ts`. |
| `frontend/src/tutorial/components/` | `TutorialLayer` (dim + spotlight hole + input lock + coachmark), `TutorialCoachmark`, `findTarget` / `placement`, `RecapView`. |
| `frontend/src/tutorial/chapters/` | Step copy, one `.ts` per chapter; `ordered.ts` is the play order (Node-importable for Playwright); `index.ts` adds the DEV-only `_smoke` chapter and `loadFixture` (lazy `import()` per chapter). |
| `frontend/src/pages/TutorialPage.tsx` | Hub `/tutorial`: chapter list with per-chapter progress, rulebook, tips toggle. |
| `frontend/src/pages/TutorialPlayerPage.tsx` | `/tutorial/play/:chapterId`: loads the fixture, swaps the store, renders `GameBoard` with an intercepting `send`, plus `TutorialLayer`. Renders `RecapView` for `recap`. |
| `frontend/src/hooks/useBotAutostart.ts` | `/game/:code?autostart=bots3`: as lone host, add 3 Easy bots and start, once. |
| `tests/test_tutorial_fixtures.py` | Generator tests plus each chapter's lesson tests (they pin every number the copy quotes, and assert quoted constants against `engine.constants`). |
| `frontend/e2e/` | Playwright: `walker.ts` drives any chapter from its step list. `tutorial.spec.ts` (every chapter, both viewports, exit, restart across 768px), `recap.spec.ts`. |

## How it runs

- **Client-only.** No socket. Each step names a snapshot (`snap`) and an `advance`: `next`,
  `click` (the spotlit target), `value` (a slider reaches N), `action` (an intercepted send
  must match `expect`), `auto` (bot turn / pause), `predict`, `reveal_wait` (the closing-bell
  overlay reaches a stage key), `reveal_end`, `suspend_end`.
- `TutorialPlayerPage` hands `GameBoard` a `send` that never reaches a socket: every message
  goes to `reduce()` first. `allows()` only greys out commit buttons. `runRef` is the source of
  truth, so a double tap or a StrictMode double effect advances once.
- **Store swap** (`storeSwap.ts`): on mount, save the whole store and pause persistence (no-op
  storage). Restore both on unmount, which covers Exit, browser back and in-app navigation.
  The store's `playerName` is set to the fixture's "You" seat, because live components work out
  "my turn" from `current_player_name === playerName`. A live session's persisted identity
  survives the tutorial.
- **Guards** (`TutorialContext`): `TradeModal`, `ActionBar`, `PowerCardPanel`,
  `RightsIssueModal`, `ShareSuspendOverlay`, `ChairmanDirectorModal` disable commits the step
  doesn't allow. `TurnTimerDisplay` / `useTurnUrgency` show a frozen clock. `CardRevealOverlay`
  holds at `heldRevealStage` and reports stages. `useFirstEncounterTip` is off. **With no
  provider, every guard is a no-op and live games behave exactly as before.**
- **Targets** are semantic (`data-tutorial="hand"` etc. on both the desktop and mobile trees);
  `targetKey` narrows to a list item (`data-tutorial-key`), `targetMobile` overrides or drops
  the target on mobile, and `mobileTab` forces a mobile tab.
- **Restart this step**: if the target disappears (for example the viewport crosses 768px
  and the trees remount), a centred coachmark offers a rewind to the last `checkpoint` step.
  `GameBoard` and the layer are keyed by `chapter:restartCount`.

## Chapters

orientation · objective · prices · turns · trading · loan-stock · debenture · rights-issue ·
share-suspend · chairman-director · recap. Finishing `recap` (reaching the recap page) marks the
tutorial complete (`tutorialStorage`). The recap lists every chapter's chips. Its buttons are
**Play your first game vs bots** (last-used name, asked inline if empty → fresh 4-char room →
`/game/<code>?autostart=bots3`), Replay a chapter, and Read the rulebook.

`useBotAutostart` fires only when `?autostart=bots3` is present, the socket is connected, you
are host, the lobby holds only you, and no game is running. A ref makes it fire at most once
(StrictMode, reconnects re-sending `lobby`). Bots are always Ready, so the Ready gate doesn't
block `start_game`.

## Rulings and owner decisions

- **Terminology (owner):** a company at $0 is **BANKRUPT** (reveal-overlay tag) and therefore
  **CLOSED**. The v2 ticker label was renamed from SUSPENDED to CLOSED; "suspended" belongs to
  the Share Suspend card. Closed shares can't be bought, and selling them pays $0 (engine truth,
  over the spec's "can't be bought or sold").
- Trading chip reads "Each buy or sell is one company", not the spec's "One move = one company":
  a move can also be a power card or a pass.
- "Prices only move at the bell" was dropped: Debenture, Rights Issue and Share Suspend also move
  prices.
- Share Suspend is taught as undoing tonight's bell before the close sticks. A company closed on
  an earlier day still needs a Debenture.
- Rights Issue states the engine rounding: `max(5, value // 10 * 5)`.
- Turn order rotates every `end_day` (`players.append(players.pop(0))`); scenarios set seat
  order directly.
- Bots are referred to by name (they/them if needed); bot moves never spoil a later chapter's
  predict, so bots don't play power cards before the chapter that teaches them.
- Added `value` advance kind, `targetKey` and `targetMobile` (pre-flight / Task 5); the
  ≤3-read-only rule counts only steps that show text with Next.
- Ch 10 (chairman-director) is 105 steps, about 9 minutes. The owner may cut day 8 or the day-9
  predicts.
- Owner skipped re-review of small text-fix rounds (Tasks 11, 14).

## Known issues (live game, found during this phase, not fixed)

1. `phases.py`: the share-suspend Trigger B networth snapshot runs before `_finalize_suspend`
   reopens a closed company, so halting a just-closed company is understated on the standings
   graph. The share-suspend chapter's copy is written to be true with the engine as it is
   ("tonight's standings don't count it"). If this gets fixed, regenerate the fixture and update
   the pinned 740/640 checks.
2. `phases.py` (~283): the chairman log says "Player N" (the id), not the name.
3. `RightsIssueModal` label "50% of market price" doesn't reflect the rounding.
4. `NetworthGraph` uses ₹ while the rest of the UI uses $.
5. The Dockerfile uses `node:20-slim`, but vitest 5 wants Node ^22.12 (dev-only; probably only an
   EBADENGINE warning).
6. `npx playwright install` garbage-collected older browser builds in
   `~/Library/Caches/ms-playwright`, so other projects may need to reinstall.

Smaller deferred items from review are listed in `.superpowers/sdd/2026-10-24-guided-tutorial/progress.md`.

## Gotchas

- **After any rule change, re-run `backend/tutorial/build_fixtures.py`** (then `--check` and the
  lesson tests). The copy quotes fixture numbers, and the lesson tests pin them.
- Import chapter modules from `tutorial/chapters/index`. The rulebook file `tutorial/chapters.tsx`
  shadows the bare `tutorial/chapters` path.
- Never write an `action` step with an empty `expect`: it matches anything.
- Any number in copy must be on screen at that step (for example `$old → $new` appears only at
  the `final_value:<Company>` stage).
- Fixtures load lazily per chapter, which keeps them out of the main chunk.

## Tests

```bash
backend/venv/bin/python tests/test_tutorial_fixtures.py      # generator + lesson tests
backend/venv/bin/python backend/tutorial/build_fixtures.py --check
cd frontend && npm test                                       # vitest
cd frontend && npx playwright test [-g <chapter-id>]          # Vite on :5199, no backend
backend/venv/bin/python tests/test_bots.py                    # incl. the autostart message flow
```
