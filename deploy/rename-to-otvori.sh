#!/usr/bin/env bash
# One-time move of the production stack from the historical compose project "salveta" to "otvori" (2026-10-29).
#
#   ssh deploy@<droplet>; cd /opt/otvori; git fetch origin && git checkout <branch with this file>; ./deploy/rename-to-otvori.sh
#
# What it does, in order (about 2–3 minutes of downtime):
#   1. a fresh backup with backup.sh (the dump lands in the bucket under its old name, salveta-<stamp>)
#   2. stops the old "salveta" stack (volumes are kept)
#   3. copies the four volumes salveta_<name> → otvori_<name> (pgdata, uploads, caddy_data, caddy_config; the
#      certificates travel with caddy_data, so nothing is re-issued)
#   4. sets POSTGRES_USER / POSTGRES_DB to "otvori" in .env.prod (a copy is kept as .env.prod.bak-rename)
#   5. starts only Postgres under the new project and renames the database and the role (the password is kept)
#   6. updates the git remote to the renamed GitHub repo and runs deploy.sh with the currently deployed tag
# The old volumes stay until you remove them by hand (printed at the end). Re-running after success is a no-op.
set -euo pipefail
cd "$(dirname "$0")"

OLD=salveta
NEW=otvori
ENV_FILE=".env.prod"
[[ -f "$ENV_FILE" ]] || { echo "rename: $ENV_FILE is missing" >&2; exit 1; }
envval() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
PASSWORD="$(envval POSTGRES_PASSWORD)"
[[ -n "$PASSWORD" ]] || { echo "rename: POSTGRES_PASSWORD is not set in $ENV_FILE" >&2; exit 1; }
[[ "$PASSWORD" =~ ^[A-Za-z0-9_-]+$ ]] || { echo "rename: POSTGRES_PASSWORD must be plain (hex/base64url) for this script" >&2; exit 1; }

old() { docker compose -p "$OLD" --env-file "$ENV_FILE" -f docker-compose.yml "$@"; }
new() { docker compose --env-file "$ENV_FILE" -f docker-compose.yml "$@"; }
# psql over the container's local socket (trust auth inside the postgres image): psql_as <role> <db> <sql>
psql_as() { new exec -T postgres psql -v ON_ERROR_STOP=1 --quiet -U "$1" -d "$2" -c "$3"; }

if ! docker volume inspect "${OLD}_pgdata" >/dev/null 2>&1; then
  echo "rename: no ${OLD}_pgdata volume on this host — nothing to migrate" >&2
  exit 1
fi
if docker volume inspect "${NEW}_pgdata" >/dev/null 2>&1; then
  echo "rename: ${NEW}_pgdata already exists — the stack was migrated before; refusing to overwrite it" >&2
  exit 1
fi
TAG="$(cat .deployed-tag 2>/dev/null || envval IMAGE_TAG)"; TAG="${TAG:-latest}"

echo "rename: 1/6 backup"
# backup.sh talks to the stack through the compose file, whose project is already "otvori"; point it at the old one.
COMPOSE_PROJECT_NAME="$OLD" ./backup.sh

echo "rename: 2/6 stopping the $OLD stack (volumes are kept)"
old down --remove-orphans

echo "rename: 3/6 copying volumes"
for v in pgdata uploads caddy_data caddy_config; do
  if ! docker volume inspect "${OLD}_$v" >/dev/null 2>&1; then echo "  ${OLD}_$v does not exist, skipped"; continue; fi
  # The compose labels make the new volumes "ours", so compose does not warn that it did not create them.
  docker volume create --label "com.docker.compose.project=$NEW" --label "com.docker.compose.volume=$v" "${NEW}_$v" >/dev/null
  docker run --rm -v "${OLD}_$v:/from:ro" -v "${NEW}_$v:/to" alpine:3.20 sh -c 'cp -a /from/. /to/'
  echo "  ${OLD}_$v → ${NEW}_$v"
done

echo "rename: 4/6 updating $ENV_FILE"
cp -p "$ENV_FILE" "$ENV_FILE.bak-rename"
for key in POSTGRES_USER POSTGRES_DB; do
  if grep -Eq "^$key=" "$ENV_FILE"; then sed -i "s/^$key=.*/$key=$NEW/" "$ENV_FILE"; else printf '%s=%s\n' "$key" "$NEW" >> "$ENV_FILE"; fi
done

echo "rename: 5/6 renaming the database and the role"
new up -d postgres
for _ in $(seq 1 30); do
  if new exec -T postgres pg_isready -q 2>/dev/null; then break; fi
  sleep 2
done
# The role that owns the cluster cannot rename itself, so a temporary superuser does it. Renaming keeps every
# object's ownership; the password is set again because a rename clears an MD5 one (SCRAM is unaffected, set anyway).
if psql_as "$OLD" postgres "SELECT 1" >/dev/null 2>&1; then
  psql_as "$OLD" postgres "CREATE ROLE rename_tmp SUPERUSER LOGIN"
  psql_as rename_tmp postgres "ALTER DATABASE $OLD RENAME TO $NEW"
  psql_as rename_tmp postgres "ALTER ROLE $OLD RENAME TO $NEW"
  psql_as rename_tmp postgres "ALTER ROLE $NEW PASSWORD '$PASSWORD'"
  psql_as "$NEW" postgres "DROP ROLE rename_tmp"
  echo "  database and role are now \"$NEW\""
else
  echo "  role $OLD not found — assuming the database was renamed already"
fi
psql_as "$NEW" "$NEW" "SELECT count(*) AS restaurants FROM restaurants"

echo "rename: 6/6 git remote + full stack"
remote="$(git -C .. remote get-url origin)"
if [[ "$remote" == *"/$OLD"* ]]; then
  git -C .. remote set-url origin "${remote//\/$OLD/\/$NEW}"
  echo "  origin → $(git -C .. remote get-url origin)"
fi
./deploy.sh "$TAG"

cat <<EOF

rename: done. The stack now runs as compose project "$NEW" (containers ${NEW}-api-1, ${NEW}-postgres-1, ${NEW}-caddy-1).
Check https://api.$(envval DOMAIN)/api/health and the CMS, then remove the old volumes:
  docker volume rm ${OLD}_pgdata ${OLD}_uploads ${OLD}_caddy_data ${OLD}_caddy_config
$ENV_FILE.bak-rename holds the previous .env.prod.
EOF
