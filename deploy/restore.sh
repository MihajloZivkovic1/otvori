#!/usr/bin/env bash
# Restore the database from a backup made by backup.sh. Stops the API, replays the dump (its --clean --if-exists
# statements drop and recreate every table), starts the API again (which re-runs migrations, a no-op after a restore).
#
#   ./deploy/restore.sh --list                                   # backups available in the bucket
#   ./deploy/restore.sh backups/otvori-20261029-031500.sql.gz   # object key in the bucket (dumps are named after POSTGRES_DB)
#   ./deploy/restore.sh /path/to/otvori-20261029-031500.sql.gz  # local file
#   ./deploy/restore.sh --yes <key-or-file>                      # skip the confirmation prompt
set -euo pipefail
cd "$(dirname "$0")"
ENV_FILE=".env.prod"
envval() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

BUCKET="$(envval S3_BUCKET)"
# Empty S3_ENDPOINT = AWS S3 (regional endpoint); set only for S3-compatible services (Spaces, MinIO).
ENDPOINT="$(envval S3_ENDPOINT)"
ENDPOINT_ARGS=()
if [[ -n "$ENDPOINT" ]]; then ENDPOINT_ARGS=(--endpoint-url "$ENDPOINT"); fi
PREFIX="$(envval BACKUP_PREFIX)"; PREFIX="${PREFIX:-backups}"
DB_USER="$(envval POSTGRES_USER)"; DB_USER="${DB_USER:-otvori}"
DB_NAME="$(envval POSTGRES_DB)"; DB_NAME="${DB_NAME:-otvori}"
export AWS_ACCESS_KEY_ID="$(envval S3_ACCESS_KEY_ID)"
export AWS_SECRET_ACCESS_KEY="$(envval S3_SECRET_ACCESS_KEY)"
export AWS_DEFAULT_REGION="$(envval S3_REGION)"; AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-eu-central-1}"
compose() { docker compose --env-file "$ENV_FILE" -f docker-compose.yml "$@"; }

YES=0
if [[ "${1:-}" == "--yes" ]]; then YES=1; shift; fi
if [[ "${1:-}" == "--list" ]]; then
  aws s3 ls "s3://$BUCKET/$PREFIX/" "${ENDPOINT_ARGS[@]}"
  exit 0
fi
SRC="${1:-}"
[[ -n "$SRC" ]] || { echo "usage: restore.sh [--yes] <bucket-key | local-file> | --list" >&2; exit 2; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
if [[ -f "$SRC" ]]; then
  FILE="$SRC"
else
  echo "restore: downloading s3://$BUCKET/$SRC"
  aws s3 cp "s3://$BUCKET/$SRC" "$TMP/dump.sql.gz" "${ENDPOINT_ARGS[@]}" --only-show-errors
  FILE="$TMP/dump.sql.gz"
fi
gzip -t "$FILE"

if [[ "$YES" -ne 1 ]]; then
  read -r -p "This REPLACES the live database '$DB_NAME' with $SRC. Type the database name to continue: " confirm
  [[ "$confirm" == "$DB_NAME" ]] || { echo "restore: aborted" >&2; exit 1; }
fi

echo "restore: stopping the API"
compose stop api
echo "restore: replaying the dump"
gunzip -c "$FILE" | compose exec -T postgres psql -v ON_ERROR_STOP=1 --quiet -U "$DB_USER" -d "$DB_NAME" >/dev/null
echo "restore: starting the API"
compose up -d api
echo "restore: done — check: docker compose --env-file $ENV_FILE -f docker-compose.yml logs --tail=50 api"
