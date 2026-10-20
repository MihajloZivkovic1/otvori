#!/usr/bin/env bash
# Nightly database backup: pg_dump | gzip → the Spaces bucket under BACKUP_PREFIX/, keeping BACKUP_KEEP_DAYS days.
#
#   ./deploy/backup.sh                     # one backup now
#   crontab:  15 3 * * * /opt/salveta/deploy/backup.sh >> /var/log/salveta-backup.log 2>&1
#
# Needs: the compose stack running, the aws CLI (apt install -y awscli) and the Spaces keys in .env.prod
# (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_ENDPOINT). Objects are private (no public-read ACL).
set -euo pipefail
cd "$(dirname "$0")"
ENV_FILE=".env.prod"
envval() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

BUCKET="$(envval S3_BUCKET)"
ENDPOINT="$(envval S3_ENDPOINT)"; ENDPOINT="${ENDPOINT:-https://fra1.digitaloceanspaces.com}"
PREFIX="$(envval BACKUP_PREFIX)"; PREFIX="${PREFIX:-backups}"
KEEP_DAYS="$(envval BACKUP_KEEP_DAYS)"; KEEP_DAYS="${KEEP_DAYS:-14}"
DB_USER="$(envval POSTGRES_USER)"; DB_USER="${DB_USER:-salveta}"
DB_NAME="$(envval POSTGRES_DB)"; DB_NAME="${DB_NAME:-salveta}"
export AWS_ACCESS_KEY_ID="$(envval S3_ACCESS_KEY_ID)"
export AWS_SECRET_ACCESS_KEY="$(envval S3_SECRET_ACCESS_KEY)"
export AWS_DEFAULT_REGION="$(envval S3_REGION)"; AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-fra1}"
[[ -n "$BUCKET" && -n "$AWS_ACCESS_KEY_ID" && -n "$AWS_SECRET_ACCESS_KEY" ]] || { echo "backup: S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY must be set in $ENV_FILE" >&2; exit 1; }
command -v aws >/dev/null || { echo "backup: aws CLI not installed (apt install -y awscli)" >&2; exit 1; }

STAMP="$(date -u +%Y%m%d-%H%M%S)"
FILE="${DB_NAME}-${STAMP}.sql.gz"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --clean --if-exists makes the dump restorable over an existing database (restore.sh); plain SQL stays greppable.
docker compose --env-file "$ENV_FILE" -f docker-compose.yml exec -T postgres \
  pg_dump -U "$DB_USER" --clean --if-exists --no-owner --no-privileges "$DB_NAME" | gzip -9 > "$TMP/$FILE"
aws s3 cp "$TMP/$FILE" "s3://$BUCKET/$PREFIX/$FILE" --endpoint-url "$ENDPOINT" --only-show-errors
echo "backup: uploaded s3://$BUCKET/$PREFIX/$FILE ($(du -h "$TMP/$FILE" | cut -f1))"

# Prune: everything under the prefix whose LastModified is older than KEEP_DAYS.
CUTOFF="$(date -u -d "-${KEEP_DAYS} days" +%Y-%m-%dT%H:%M:%SZ)"
aws s3api list-objects-v2 --bucket "$BUCKET" --prefix "$PREFIX/" --endpoint-url "$ENDPOINT" \
  --query "Contents[?LastModified<'${CUTOFF}'].Key" --output text 2>/dev/null \
  | tr '\t' '\n' | grep -v '^None$' | grep -v '^$' \
  | while read -r key; do
      aws s3 rm "s3://$BUCKET/$key" --endpoint-url "$ENDPOINT" --only-show-errors
      echo "backup: removed $key (older than $KEEP_DAYS days)"
    done
echo "backup: done"
