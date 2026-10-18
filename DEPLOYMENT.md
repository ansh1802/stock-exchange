# Deployment

The game runs on Google Cloud Platform. This replaces the previous Railway
deployment (`railway.toml` has been deleted).

## What is where

| Piece | Service | URL |
|-------|---------|-----|
| Frontend (what you share) | Firebase Hosting | https://stock-exchange.web.app |
| Backend API + WebSocket | Cloud Run | https://stock-exchange-116318124618.asia-south1.run.app |

Both live in the same GCP project.

| Setting | Value |
|---------|-------|
| GCP account | anshshah180220@gmail.com |
| Project ID | `stock-exchange-7354` |
| Project number | 116318124618 |
| Billing account | `013F30-E27597-AA58C1` ("My Billing Account") |
| Region | `asia-south1` (Mumbai) |
| Cloud Run service | `stock-exchange` |

The Hosting site ID is `stock-exchange`, claimed explicitly rather than using the
project-ID default. `firebase.json` names it under `hosting.site`; without that
key the CLI would deploy to the default `stock-exchange-7354` site instead.

Consoles: [Cloud Run](https://console.cloud.google.com/run/detail/asia-south1/stock-exchange?project=stock-exchange-7354)
· [Firebase](https://console.firebase.google.com/project/stock-exchange-7354/overview)
· [Build history](https://console.cloud.google.com/cloud-build/builds?project=stock-exchange-7354)

## Deploying

```bash
./deploy.sh             # both
./deploy.sh backend     # Cloud Run only
./deploy.sh frontend    # Firebase Hosting only
```

Deploys are manual. There is no push-to-deploy trigger.

The Cloud Run image is built from the existing multi-stage `Dockerfile`, so the
container holds a copy of the frontend too. The Cloud Run URL therefore serves a
fully working game on its own, which is useful as a fallback when debugging
whether a problem is in Hosting or in the backend.

## Why the frontend and backend are split

Firebase Hosting cannot proxy WebSocket connections. A rewrite from Hosting to
Cloud Run drops the upgrade handshake, so the page would load and the game would
never connect.

The frontend therefore dials Cloud Run directly. `deploy.sh` bakes the socket
URL into the bundle at build time as `VITE_WS_URL`, read in
`frontend/src/hooks/useWebSocket.ts`. Without that variable the hook falls back
to the page's own origin, which is what keeps local development and the
Cloud Run fallback URL working unchanged.

The root `.gitignore` excludes every `.env*` file, so the URL lives in
`deploy.sh` rather than in `frontend/.env.production`. If the Cloud Run URL ever
changes, edit `WS_URL` in `deploy.sh` and redeploy the frontend.

The backend already sets permissive CORS in `backend/server.py`, so the
cross-origin socket needs no further configuration.

## The Cloud Run flags, and why each one is required

Game state lives in process memory in `RoomManager`. There is no database. Every
flag below follows from that, and changing one can break live games.

| Flag | Reason |
|------|--------|
| `--max-instances 1` | Two instances means two copies of the same room, and players would be split between them. Cloud Run session affinity is best-effort and cannot be relied on for correctness. |
| `--min-instances 0` | Scales to zero when nobody is playing, so idle cost is nil. Safe in practice because an open WebSocket counts as an active request, so the instance stays alive while anyone is connected. |
| `--concurrency 250` | With a single instance, concurrency is the hard ceiling on simultaneous connected players. Each socket holds its slot for the whole session, so the default of 80 is too tight. |
| `--timeout 3600` | The Cloud Run maximum, and it applies to WebSockets. A game past one hour has its socket cut; the frontend's exponential-backoff reconnect then rejoins a room that is still in memory. |
| `--no-cpu-throttling` | Cloud Run throttles CPU between requests by default, which would freeze the turn timers and the background room cleanup loop. Still scales to zero; it only changes billing while an instance is alive. |
| `--cpu 1 --memory 512Mi` | Comfortable for a pure-Python game engine with no database. |
| `--allow-unauthenticated` | Players are anonymous; there is no login. |

## Known consequences of in-memory state

- **Deploying ends games in progress.** A new revision replaces the single
  instance, and its rooms go with it. Ship between sessions.
- **A room dies if everyone leaves at once.** The 2 hour room TTL in
  `room_manager.py` only means anything while the process is alive. If every
  player disconnects and the instance goes idle, the room is gone.

Both are fixable only by moving room state out of process, into Redis or
Firestore. That is a real change to the engine's assumptions and has not
been done.

## First-time setup that was performed

Recorded so it can be reproduced in another project. None of this needs
repeating for normal deploys.

```bash
gcloud config set account anshshah180220@gmail.com
gcloud projects create stock-exchange-7354 --name="Stock Exchange"
gcloud billing projects link stock-exchange-7354 \
  --billing-account=013F30-E27597-AA58C1
gcloud services enable \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com \
  firebase.googleapis.com firebasehosting.googleapis.com \
  --project=stock-exchange-7354
firebase projects:addfirebase stock-exchange-7354
```

Files added for GCP: `deploy.sh`, `firebase.json`, `.firebaserc`,
`.gcloudignore`. `railway.toml` was deleted.

`.gcloudignore` controls what is uploaded to Cloud Build as the Docker build
context. Keep it roughly in sync with `.dockerignore`; when it exists, gcloud
ignores `.gitignore`, so `node_modules` must be listed explicitly.

## Verifying a deploy

```bash
# Page loads and SPA fallback works
curl -s -o /dev/null -w "%{http_code}\n" https://stock-exchange.web.app/
curl -s -o /dev/null -w "%{http_code}\n" https://stock-exchange.web.app/any/route

# The socket URL actually made it into the bundle
curl -s "https://stock-exchange.web.app$(curl -s https://stock-exchange.web.app/ | grep -o '/assets/index-[A-Za-z0-9_-]*\.js')" | grep -o 'wss://[a-z0-9.-]*run.app'
```

`curl` is no good for testing the socket itself: it negotiates HTTP/2 against
Cloud Run, the upgrade headers get ignored, and the catch-all route answers with
`index.html` and a misleading 200. Use a real client instead.

```python
import asyncio, json, websockets

URL = "wss://stock-exchange-116318124618.asia-south1.run.app"

async def main():
    async with websockets.connect(
        f"{URL}/ws/TEST/Alice",
        additional_headers={"Origin": "https://stock-exchange.web.app"},
    ) as ws:
        print(json.loads(await asyncio.wait_for(ws.recv(), 15)))

asyncio.run(main())
```

A full smoke test is two browser tabs on the Hosting URL: start a two-player
game, confirm a trade broadcasts to both tabs, let the turn timer run down to an
auto-pass, and reload one tab to confirm it reconnects into the same room.

## Logs

```bash
gcloud run services logs tail stock-exchange \
  --region asia-south1 --project stock-exchange-7354
```

## Adding a custom domain later

Mapping a domain onto Cloud Run puts the page and the socket back on one origin
and removes the split entirely. After mapping, drop `VITE_WS_URL` from
`deploy.sh` so the hook falls back to the page origin.

```bash
gcloud beta run domain-mappings create --service stock-exchange \
  --domain game.example.com --region asia-south1 --project stock-exchange-7354
```

Do not instead point the domain at Firebase Hosting and rewrite to Cloud Run.
That reintroduces the WebSocket problem described above.
