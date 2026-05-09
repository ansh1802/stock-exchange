# Complete Readiness Scan — Stock Exchange Game

## Context

Audit of the multiplayer stock-exchange game (FastAPI + React 19) ahead of a potential iOS/Android launch and full marketing push. No code changes — this is a diagnostic to surface complexities, health risks, compute/scale requirements, and good/bad practices, with a prioritized remediation roadmap.

**Verdict:** Production-ready for a *friends/closed-beta* web launch (≤500 concurrent players). **Not ready** for app stores or a marketing-driven scale launch — significant gaps in persistence, observability, native packaging, legal, and bundle hygiene.

Overall scorecard: Backend **3/10**, Frontend **5/10**, Infra/Launch **2/10** for full-scale launch readiness.

---

## 1. Backend — Health, Complexity, Compute

### Complexity hotspots
- `backend/server.py:383-520` `build_client_state` — 137 LOC state-mapper, acceptable but tightly coupled.
- `backend/server.py:716-763` `auto_advance` — 4-deep nested phase dispatch; concurrency hazard (see below).
- `backend/engine/phases.py:135-189` `_build_chairman_director_queue` and `:330-376` `_finalize_card_reveal` — multi-step settlement, hard to unit test in isolation.
- Duplicated timer cancel/create patterns across `disconnect_timer`, `turn_timer`, `ping_task` (3×). Extract helper.
- God objects: `GameState` (~30 attrs), `Room` (~15 attrs). Workable but brittle.

### Concurrency / race conditions (HIGH)
- **No locks anywhere.** Multiple WS handlers can mutate the same `Room.game` / timer fields concurrently.
- `cancel_disconnect_timer` and `cancel_turn_timer` null shared fields without guarding readers in `broadcast_game_state` (server.py:704).
- `auto_advance` is reentrant: two simultaneous `reveal_complete` ACKs can both pass the `len(reveal_complete_players) < num_players` gate and double-finalize a reveal (phases.py:124-126).
- Reconnect (room_manager.py:79) can race with disconnect (server.py:363), leaving stale WS refs.

### Memory / unbounded growth
- `RoomManager.rooms` — only TTL-bounded (5min lobby / 2hr active). 10k rooms ≈ 1 GB RAM.
- `Room.game_log` — append-only per action, never truncated. ~7.5 KB / game; 10k games ≈ 75 MB.
- `Room.chat_messages` — per-msg 300-char cap but no count cap.
- `GameState.networth_history` rewritten on every share-suspend swap; O(days × players), fine in practice.
- Cancelled `asyncio.Task` retention is negligible.

### Scalability blockers (CRITICAL)
- Single-process, in-memory state. Cannot run multi-worker or horizontally scale. Hard ceiling ~1k–2k concurrent rooms (FD limits) before melt.
- No Redis pub/sub, no DB, no sticky session routing.
- No persistence: server restart = every active game lost.
- No rate limiting on WS messages; no backpressure.
- No message-size cap (FastAPI default 16 MB → DoS surface).

### Input validation / security gaps
- `room_code` and `player_name` route params (server.py:290) accept arbitrary length / charset → memory DoS vector.
- `data["company_num"]`, `data["quantity"]`, `discard_*_idx` accessed with naked subscripts; no type/bounds checks → KeyError or negative-index slicing bugs.
- Reconnection authenticates by **player name only** (room_manager.py:76) → trivial impersonation.
- 4-char room codes (36⁴ ≈ 1.7M) — collision-tolerable for casual, weak for prod.
- CORS `allow_origins=["*"]` (server.py:40) — fine for dev, tighten for prod.

### Testing
- `tests/test_game.py` is a manual integration script covering one happy path.
- `tests/test_mechanics.py` (~500 LOC) covers power cards & chairman/director queue logic — best-tested area.
- **No** WS integration tests, reconnection/timer-collision tests, malformed-input tests, stress tests.

### Logging / errors
- Broad `except Exception` swallows + `traceback.print_exc()`; no structured logger, no severity, no timestamps. Errors invisible in prod.

### Compute estimates (rough)
- ~100 KB / connection (asyncio + state); ~2k actions/sec/core; ~30 KB egress / action × 6 players.
- 1k concurrent players ≈ $7–12/mo Railway. 10k ≈ $50+/mo and **requires Redis + worker fleet**.

---

## 2. Frontend — Health, Mobile, Performance

### Bundle (CRITICAL for mobile)
- ~526 KB JS (157 KB gz) + 84 KB CSS in a **single chunk**. No `React.lazy` / `Suspense`, no route splitting, no dynamic overlay imports. Slow LCP on 4G.

### Component complexity / re-renders
- Largest: `CardRevealOverlay` (502 L, ~138 motion nodes), `NetworthGraph` (503 L), `ShareSuspendOverlay` (467 L), `GameBoard` (244 L, 15+ `useState`), `StockTicker` (364 L).
- Heavy prop-drilling of `send` from GameBoard. `PlayerBoard`, `MobilePlayerBoard`, `CardComponent`, `TradeModal` not `React.memo`-wrapped despite stable props.

### Animation
- ~138 Framer Motion instances, layout-animating widths (CardRevealOverlay:240), staggered cascades (CURRENCY_STAGGER 600 ms), 3 `AnimatePresence` in GameBoard, simultaneous ticker scroll + pulse — real **30 FPS risk on iPhone SE / budget Android**.
- No `prefers-reduced-motion` honored.

### Mobile readiness
- ✅ `useIsMobile` at 768 px, `pb-safe` safe-area, `viewport-fit=cover`, 44 px touch targets in ActionBar.
- ❌ No virtual-keyboard handling (`visualViewport`), no pinch-zoom lock, MobileTabBar can occlude content (no bottom inset on main).

### iOS / Android packaging — NOT READY
- Pure web SPA. No Capacitor / Expo / RN, no `capacitor.config.ts`, no `manifest.json`, no service worker, no Apple touch icon, no splash. WebSocket relies on dev proxy + `VITE_WS_URL`.
- Path of least resistance: **Capacitor wrap** → splash/icon assets → TestFlight/Play Internal Testing.

### Accessibility — minimal
- 4 aria/role attrs across 55 files. No focus management on overlays, no Escape handling, no `<main>` / `<nav>` landmarks, ticker has no `aria-live`. `Coachmark` has `role="dialog"` but missing `aria-modal`.

### State / WS
- Zustand store is lean and correctly partialized. WS hook does exponential backoff + offline queue + reconnect toast. Solid.

### SEO / marketing — POOR
- `<title>` is "frontend". No description, no OG/Twitter cards, no robots.txt, no sitemap, no JSON-LD, no analytics, no Sentry, no favicon set, no landing page (drops users straight into lobby).

### TS / lint — STRONG
- `strict`, `noUnusedLocals/Parameters` on. ESLint flat config. Zero `console.log`. Build = `tsc -b && vite build`.

---

## 3. Infra, Deploy, Legal, Marketing

### What exists
- Railway single-process Docker (multi-stage Node→Python), health checks, restart-on-failure, ws/wss auto-detect, TTL room cleanup.

### What's missing
- **No DB / Redis / persistence.** Crash = active games gone. No replays, no rankings, no accounts.
- **No observability.** Zero structured logs, no Sentry, no metrics, no alerting, no uptime monitor, no analytics.
- **No CI/CD.** No GitHub Actions, no PR type-check, no lint gate, tests not run on merge.
- **No auth.** Anonymous-by-name; no JWT, no accounts, no progression.
- **Legal blockers for app stores:** no Privacy Policy, no ToS, no age rating, no IARC questionnaire.
  - ⚠️ **Gambling/securities flag:** "Stock Exchange" with real company names + cash trading mechanics. Some jurisdictions (UK/DE/SG) may classify as gambling — needs legal review **before monetization or store submission**.
- **No monetization hooks.** No IAP, no ads, no cosmetics, no auth to attach them to.
- **No marketing site / SEO.** Domain on Railway subdomain, no landing page, no screenshots/video/testimonials.

### Scaling capacity (single process)
| Concurrent players | Verdict |
|---|---|
| 100 | Trivial. |
| 1 000 | Fine. Watch CPU/memory. |
| 10 000 | **Breaks.** Hits FD limits → needs Redis + sticky LB + worker fleet. |

---

## 4. Prioritized Remediation Roadmap

### P0 — Pre-launch hygiene (1 week)
1. **Backend input validation**: wrap `data[...]` lookups in try/except + type/bounds checks for `company_num`, `quantity`, `discard_*_idx`, `room_code`, `player_name`. (`backend/server.py:526-650`, `backend/engine/helpers.py`)
2. **Structured logging**: `import logging; logging.basicConfig(...)` in `server.py`; replace `traceback.print_exc()` calls.
3. **Frontend SEO basics**: real `<title>`, `<meta description>`, OG/Twitter tags, favicon set, apple-touch-icon, robots.txt. (`frontend/index.html`, `frontend/public/`)
4. **React error boundary** at root.
5. **`prefers-reduced-motion`** guard around Framer Motion variants.
6. **GitHub Actions CI**: lint + `tsc -b` + `vite build` + `python tests/test_game.py` on PR.

### P1 — Scale & UX hardening (2-3 weeks)
7. **Code splitting**: `React.lazy` for Tutorial / Rulebook / Lobby / Game routes; dynamic import overlays (`CardReveal`, `ShareSuspend`, `ChairmanDirector`).
8. **Memoize hot children**: `React.memo` on `PlayerBoard`, `MobilePlayerBoard`, `CardComponent`, `TradeModal`, `HoldingPill`.
9. **Reconnection auth**: signed token (HMAC of name+room+secret) replacing name-only trust (`backend/room_manager.py:76`).
10. **Rate limiting**: per-WS token bucket on `handle_action` (e.g. 10 actions/sec).
11. **Message size cap**: enforce small frame limit on WS.
12. **Sentry** (frontend + backend), basic uptime monitor, Railway alert rules.
13. **Game log truncation**: cap `Room.game_log` at e.g. 500 entries.

### P2 — App store + marketing launch (4-6 weeks)
14. **Capacitor wrap** → iOS + Android builds; splash, icon set (1024²), bundle IDs, App Transport Security config, status bar, deep-link scheme.
15. **PWA**: `manifest.json` + service worker (offline = "connection required" screen; cache shell).
16. **Landing page** route `/`: pitch, screenshots, "Play now" CTA, public rulebook (SEO-indexed).
17. **Privacy Policy + ToS** (lawyer-reviewed; gambling/securities clearance for the trading-themed mechanics).
18. **IARC age-rating questionnaire**, store assets, screenshots, promo video.
19. **Analytics** (PostHog / Plausible) — DAU, game-length, drop-off, feature usage.

### P3 — Horizontal scale & monetization (post-traction)
20. **Externalize state to Redis**: rooms, queues, pub/sub for fanout — unlocks multi-worker.
21. **Postgres** for accounts, rankings, replay history.
22. **Auth**: email/OAuth, JWT sessions; tie cosmetics/IAP to account.
23. **Concurrency locks** on `Room` mutations (asyncio.Lock per room) once multi-worker is live.
24. **Stress test**: 1k concurrent rooms, 100 actions/sec — verify before any paid acquisition.

---

## 5. Critical files referenced
- `backend/server.py` — WS dispatch, auto-advance, timers, `build_client_state`
- `backend/room_manager.py` — room lifecycle, reconnection auth gap
- `backend/engine/phases.py` — finalize_card_reveal, chairman/director queue
- `backend/engine/helpers.py` — validation entry points
- `frontend/index.html` — meta tags / SEO
- `frontend/src/components/game/GameBoard.tsx` — central re-render hub
- `frontend/src/components/game/CardRevealOverlay.tsx` — animation hotspot
- `frontend/src/hooks/useWebSocket.ts` — reconnect/queue logic
- `Dockerfile`, `railway.toml` — single-process deploy
- *(missing)* `.github/workflows/*`, `manifest.json`, `capacitor.config.ts`, `PRIVACY.md`, `TERMS.md`

## 6. Verification (no code changes proposed in this scan)
This deliverable is a **diagnostic report**, not an implementation. To act on it: pick a P-tier above and request a follow-up plan; each item maps to a discrete PR. Recommend starting with P0 #1 (input validation) and #6 (CI) — they have the biggest return-per-hour and unblock everything else.
