#!/usr/bin/env bash
# Deploy — or roll back — salveta on the droplet: pull the images for one tag, restart what changed, prune old images.
#
#   ./deploy/deploy.sh             # tag from IMAGE_TAG in .env.prod (default: latest)
#   ./deploy/deploy.sh a1b2c3d     # a specific git short SHA built by the Deploy workflow; any earlier tag = rollback
#
# Optional environment: GHCR_USER + GHCR_TOKEN log in to ghcr.io first (needed while the packages are private).
# Nothing is built here: a 1 GB droplet cannot build the images, GitHub Actions does (.github/workflows/deploy.yml).
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE=".env.prod"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "deploy: $ENV_FILE is missing — copy .env.prod.example and fill it in" >&2
  exit 1
fi
if grep -Eq '^[A-Z_]+=.*replace-me' "$ENV_FILE"; then
  echo "deploy: $ENV_FILE still contains placeholders:" >&2
  grep -En '^[A-Z_]+=.*replace-me' "$ENV_FILE" >&2
  exit 1
fi

envval() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

TAG="${1:-$(envval IMAGE_TAG)}"
TAG="${TAG:-latest}"
export IMAGE_TAG="$TAG"
compose() { docker compose --env-file "$ENV_FILE" -f docker-compose.yml "$@"; }

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-$USER}" --password-stdin
fi

echo "deploy: pulling images for tag $TAG"
compose pull --quiet
echo "deploy: starting the stack"
compose up -d --remove-orphans

echo -n "deploy: waiting for the API health check "
api_id="$(compose ps -q api)"
for _ in $(seq 1 40); do
  status="$(docker inspect --format '{{.State.Health.Status}}' "$api_id" 2>/dev/null || echo unknown)"
  if [[ "$status" == "healthy" ]]; then echo " healthy"; break; fi
  if [[ "$status" == "unhealthy" ]]; then
    echo " UNHEALTHY"
    compose logs --tail=80 api >&2
    exit 1
  fi
  echo -n "."
  sleep 3
done
if [[ "$(docker inspect --format '{{.State.Health.Status}}' "$api_id" 2>/dev/null)" != "healthy" ]]; then
  echo " timed out" >&2
  compose logs --tail=80 api >&2
  exit 1
fi

echo "$TAG" > .deployed-tag
docker image prune -f >/dev/null
compose ps
domain="$(envval DOMAIN)"
if [[ -n "$domain" ]]; then
  echo "deploy: https://api.$domain/api/health → $(curl -fsS --max-time 10 "https://api.$domain/api/health" || echo 'not reachable from here (DNS/TLS not ready?)')"
fi
echo "deploy: tag $TAG is live"
