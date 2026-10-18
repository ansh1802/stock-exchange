#!/usr/bin/env bash
# Deploy the stock exchange game to GCP.
#
#   ./deploy.sh            deploy both backend and frontend
#   ./deploy.sh backend    Cloud Run only
#   ./deploy.sh frontend   Firebase Hosting only
#
# See DEPLOYMENT.md for what each Cloud Run flag is for. The flags are not
# cosmetic: game state lives in process memory, so --max-instances 1 and
# --no-cpu-throttling are required for correctness.

set -euo pipefail

PROJECT="stock-exchange-7354"
REGION="asia-south1"
SERVICE="stock-exchange"

# The frontend dials this directly. Firebase Hosting cannot proxy WebSockets,
# so the socket must bypass Firebase and hit Cloud Run.
WS_URL="wss://stock-exchange-116318124618.asia-south1.run.app"

target="${1:-all}"

deploy_backend() {
  echo "==> Cloud Run: $SERVICE ($REGION)"
  gcloud run deploy "$SERVICE" \
    --source . \
    --project "$PROJECT" \
    --region "$REGION" \
    --allow-unauthenticated \
    --max-instances 1 \
    --min-instances 0 \
    --concurrency 250 \
    --timeout 3600 \
    --cpu 1 \
    --memory 512Mi \
    --no-cpu-throttling \
    --quiet
}

deploy_frontend() {
  echo "==> Firebase Hosting (VITE_WS_URL=$WS_URL)"
  ( cd frontend && npm ci && VITE_WS_URL="$WS_URL" npm run build )
  firebase deploy --only hosting --project "$PROJECT"
}

case "$target" in
  backend)  deploy_backend ;;
  frontend) deploy_frontend ;;
  all)      deploy_backend && deploy_frontend ;;
  *) echo "usage: $0 [backend|frontend|all]" >&2; exit 1 ;;
esac
