# Phase 5: Railway Deployment & Production Bug Fixes

## Goal

Deploy the game to Railway so friends can beta test over the internet. Fix production-only bugs discovered during first remote playtest.

## What Changed

### Railway deployment setup

**Strategy:** Single Railway service — build the React frontend, then serve the static files from FastAPI alongside the WebSocket backend. No separate services, no database, no env vars required.

**New files:**
- `Dockerfile` — Multi-stage build. Stage 1 (Node 20) installs deps and runs `npm run build`. Stage 2 (Python 3.12) installs backend deps, copies backend + built frontend `dist/`, runs uvicorn. Respects Railway's `$PORT` env var.
- `railway.toml` — Points Railway to the Dockerfile, sets health check and restart policy.
- `.dockerignore` — Excludes `node_modules`, `__pycache__`, `.git`, `base_logic_old`, `development-history`, `tests`.

**Initial attempt with Nixpacks failed:** `railway.toml` originally used `builder = "nixpacks"` with `providers = ["node", "python"]`, but Nixpacks couldn't auto-detect the project because `requirements.txt` and `package.json` are in subdirectories, not the repo root. Switched to a Dockerfile for full control.

### WebSocket URL: auto-detect ws/wss protocol

**File:** `frontend/src/hooks/useWebSocket.ts`

The WebSocket base URL was hardcoded to `ws://`:
```ts
// BEFORE
const WS_BASE = import.meta.env.VITE_WS_URL || `ws://${window.location.host}`

// AFTER
const WS_BASE = import.meta.env.VITE_WS_URL ||
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
```

This auto-detects the protocol from the page URL. No `VITE_WS_URL` env var needed — works on any host (localhost, Railway, custom domain).

### Serving frontend from FastAPI

**File:** `backend/server.py`

Added a catch-all route at the bottom of the file (after all WebSocket and API routes) to serve the built frontend:

```python
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(frontend_dist):
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
```

Key design decisions:
- **Conditional mount:** Only activates if `frontend/dist/` exists. In dev mode (Vite proxy), the directory doesn't exist and the route isn't registered.
- **Direct file serving:** Checks if the requested path maps to a real file (JS, CSS, favicon, etc.) and serves it directly. Falls back to `index.html` for SPA routing.
- **No `StaticFiles` mount:** Originally used FastAPI's `StaticFiles` for `/assets`, but this caused 301 redirects (trailing-slash normalization). Replaced with direct `FileResponse` to eliminate 3xx responses entirely.

### Bug Fix: 3xx redirects in production

**Problem:** Railway logs showed many 3xx responses. First playtest had WebSocket sync issues between players.

**Root cause:** FastAPI's `StaticFiles` mount for `/assets` was issuing 301 redirects (trailing-slash normalization). These redirects were also disrupting WebSocket connection upgrades in some cases.

**Fix:** Removed `StaticFiles` mount entirely. The catch-all route now serves all static files directly via `FileResponse` with an `os.path.isfile()` check. No redirects.

### Bug Fix: Share suspend showing ghost animations (4 companies instead of 1)

**Problem:** During first remote playtest, one player used share suspend on 1 company, but the other player saw animations for 4 companies.

**Root cause (iteration 1):** `ShareSuspendOverlay` detected company value changes by comparing `prevValues` ref across renders. On mount, `prevValues` was empty (`{}`). The first state update populated it. But the overlay mounted right after card reveal finalization, which changes ALL company values at once. The overlay saw all those changes as suspend animations.

**First fix (insufficient):** Snapshot `prevValues` on mount so the first render initializes the baseline. This worked for same-machine testing but failed in production.

**Root cause (iteration 2):** The frontend `animPhase` transitions to `share_suspend` when the card reveal *animation* finishes (driven by `handleRevealComplete` in GameBoard). But the *backend* may still be in `card_reveal` phase — waiting for the other player's `reveal_complete`. When the other player finally completes, the backend finalizes card reveal (applying all card effects) and broadcasts new values. The overlay had already initialized `prevValues` with pre-finalization values, so the finalization state update triggered ghost animations.

**Why it only appeared remotely:** On the same machine, both tabs complete the card reveal animation near-simultaneously. The backend finalizes before either tab's overlay has a chance to see stale values. With network latency between players, the window between overlay mount and backend finalization widens enough to expose the bug.

**Final fix:** The overlay now checks `gameState.phase` before initializing `prevValues`. It waits until the backend has actually reached `share_suspend` (or later), meaning card effects are already applied and values are stable:

```tsx
useEffect(() => {
  if (!gameState || initialized.current) return
  const phase = gameState.phase
  if (phase !== 'share_suspend' && phase !== 'currency_settlement' && phase !== 'day_end') return
  // Only now snapshot — values are post-finalization
  const curr: Record<string, number> = {}
  for (const co of gameState.companies) curr[co.name] = co.value
  prevValues.current = curr
  initialized.current = true
}, [gameState])
```

## Deployment Architecture

```
Railway (single service)
├── Dockerfile (multi-stage)
│   ├── Stage 1: node:20-slim → npm install + npm run build → frontend/dist/
│   └── Stage 2: python:3.12-slim → pip install → uvicorn server:app
├── railway.toml → builder: dockerfile, healthcheck: /
└── No env vars, no database, no Redis
```

In production, FastAPI serves both:
- WebSocket connections at `/ws/{room_code}/{player_name}`
- Frontend static files at `/*` (catch-all with SPA fallback)

## Files Modified

### Backend
- `server.py` — Added `os` and `FileResponse` imports, frontend static file serving catch-all route

### Frontend
- `hooks/useWebSocket.ts` — Auto-detect `ws://` vs `wss://` from page protocol
- `components/game/ShareSuspendOverlay.tsx` — Wait for backend `share_suspend` phase before tracking value changes

### New Files
- `Dockerfile` — Multi-stage Node + Python build
- `railway.toml` — Railway deployment config
- `.dockerignore` — Exclude unnecessary files from deploy image

## Bugs Encountered and Fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Nixpacks build failed | `package.json` and `requirements.txt` in subdirs, not repo root | Switched to Dockerfile |
| 3xx redirects in Railway | `StaticFiles` mount issuing 301 trailing-slash redirects | Direct `FileResponse` serving, no `StaticFiles` |
| Share suspend 4 ghost animations | Overlay initialized `prevValues` before backend finalized card reveal; latency widened the race window | Wait for `gameState.phase === 'share_suspend'` before snapshotting baseline values |
| `ws://` on HTTPS page | Hardcoded `ws://` protocol in WebSocket URL | Auto-detect from `window.location.protocol` |

## Lessons Learned

- **Local ≠ Production for multiplayer:** Same-machine testing hides timing bugs because both clients share CPU/network. Remote playtesting with real latency is essential for multiplayer games.
- **Frontend animation state vs backend state:** When the frontend drives animations independently from the backend phase machine, any component that reacts to value changes must wait for the backend to confirm the phase transition — not just the frontend animation state.
- **`StaticFiles` in FastAPI:** Convenient but opinionated — it adds trailing-slash redirects and MIME type handling that can interfere with SPA routing. Direct `FileResponse` is simpler for production serving.
