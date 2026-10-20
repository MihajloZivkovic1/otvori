# Deploying salveta

One Docker Compose stack on a single host: Postgres 16, the API image, and a Caddy image that builds the static apps
(`apps/menu`, `apps/cms`, `apps/web`) at image build time and terminates TLS.

| Host | Serves |
| --- | --- |
| `{$DOMAIN}` | marketing site (`apps/web`, static Astro build) |
| `www.{$DOMAIN}` | redirect → apex |
| `app.{$DOMAIN}` | admin CMS (`apps/cms`), `/api/*` proxied to the API |
| `api.{$DOMAIN}` | API directly (uploads served from `UPLOADS_DIR` when no S3) |
| `*.{$DOMAIN}` | public menus (`apps/menu`), `/api/*` proxied to the API; wildcard certificate via Cloudflare DNS |

## DNS

`A`/`AAAA` records for `@`, `www`, `app`, `api` and `*` pointing at the host. The wildcard certificate needs the
Cloudflare DNS challenge (`CLOUDFLARE_API_TOKEN` with Zone → DNS → Edit). For another DNS provider swap the
`xcaddy --with` module in `Dockerfile.caddy` and the `dns` line in `Caddyfile`.

## First run

```bash
cp deploy/.env.example deploy/.env    # fill DOMAIN, ACME_EMAIL, CLOUDFLARE_API_TOKEN, POSTGRES_PASSWORD, JWT_ACCESS_SECRET
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml exec api node dist/db/seeders/seed.js   # optional demo data
```

The API container runs `migrate up` on every start, then the server. The static apps are built with
`VITE_API_URL=` (same-origin `/api`), the CMS additionally with `VITE_PUBLIC_MENU_BASE_URL=https://{slug}.$DOMAIN`, the
marketing site with `SITE_URL=https://$DOMAIN` and the optional `PUBLIC_ANALYTICS_SRC` / `PUBLIC_ANALYTICS_DOMAIN`.

## Updating

```bash
git pull && docker compose -f deploy/docker-compose.yml up -d --build
```

Changing `DOMAIN` requires rebuilding the Caddy image (the CMS bakes the public menu URL template in, the marketing site its
canonical URLs, at build time).
