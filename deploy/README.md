# Deploying otvori

One Docker Compose stack on a single 1 GB DigitalOcean droplet (Ubuntu 24.04, fra1): Postgres 16, the API image and a
Caddy image that carries the three static apps. **Nothing is built on the droplet** — GitHub Actions builds both images
and pushes them to GHCR; the droplet only pulls (`deploy/deploy.sh`).

| Host | Serves | Image |
| --- | --- | --- |
| `otvori.menu` | marketing site (`apps/web`) | otvori-caddy |
| `www.otvori.menu` | 301 → apex | otvori-caddy |
| `app.otvori.menu` | admin CMS (`apps/cms`), `/api/*` proxied | otvori-caddy → otvori-api |
| `api.otvori.menu` | the API directly (`/uploads/*` too when S3 is off) | otvori-caddy → otvori-api |
| `*.otvori.menu` | public menus (`apps/menu`), `/api/*` proxied, wildcard certificate | otvori-caddy → otvori-api |

Files in this folder:

| File | Purpose |
| --- | --- |
| `docker-compose.yml` | the production stack: memory limits (postgres 256m, api 256m, caddy 128m), Postgres tuned for 1 GB, log rotation, health checks |
| `docker-compose.local.yml` | laptop override: builds the images here, `DOMAIN=localhost`, self-signed TLS (`Caddyfile.local`) |
| `Dockerfile.api`, `Dockerfile.caddy` | the two images (built by `.github/workflows/deploy.yml`) |
| `Caddyfile` / `Caddyfile.local` | routing, TLS (Cloudflare DNS-01 / internal CA), caching, security headers |
| `.env.prod.example` | every runtime variable, commented — copy to `.env.prod` on the droplet |
| `deploy.sh <tag>` | `compose pull && up -d`, waits for the API health check, prunes old images |
| `backup.sh` / `restore.sh` | nightly `pg_dump \| gzip` to the S3 bucket under `backups/`, 14-day retention / restore from a key or file |
| `TODO-manual.md` | the one-time manual steps (DNS, Resend, AWS, droplet, GitHub, secrets, smoke test) in order |

**Feature flags.** `.env.prod` carries `FEATURE_PAYMENTS=false` and `FEATURE_POS=true` (Phase 10). Online payment is
not released: with the flag off no venue can have the module, the payment routes and the bank webhook answer 404 and
no payment UI exists anywhere; `GET /api/health` and `GET /api/config` show the flags, so a probe tells you what a
deployment offers. Flipping a flag is `./deploy/deploy.sh` after editing `.env.prod` (no rebuild) — except the
marketing site's payment copy, which is baked at build time from the GitHub variable `FEATURE_PAYMENTS`. CI refuses a
`main` where the default is anything but off (`npm run check:flags`).

**Migrations** run inside the API container before it listens (`MIGRATE_ON_START=1` in the compose file), so a
release with new migrations needs no extra step: `deploy.sh` waits for the health check, which only turns green after
they applied. Seven migrations exist as of Phase 10 (schema, ordering, thumbnails, modules, payments, POS, fiscal manual).

**One API instance.** The order-expiry job, the payment reconcile job, the POS queue (all `setInterval`s inside
`index.ts`) and the SSE fan-out (`EventEmitter`) assume a single API container, which is what the compose file runs.
`POS` jobs are claimed with `FOR UPDATE SKIP LOCKED`, so even an accidental second instance would not double-send;
the others would double-run harmlessly but noisily. The API's V8 heap is capped at 160 MB (`NODE_OPTIONS`) inside the
256 MB container limit so sharp's native buffers always fit; idle the stack uses ≈ 60 MB (postgres) + 90 MB (api) +
25 MB (caddy) of the 1 GB.

Everything below is the top-to-bottom checklist for a fresh setup. Commands prefixed `droplet$` run on the server.


## Production facts (first deploy 2026-10-23, Phase 10)

| What | Value |
| --- | --- |
| Droplet | DigitalOcean **fra1**, Ubuntu 24.04, Premium Intel 1 vCPU / 1 GB / 35 GB NVMe (Basic-Regular was unavailable in FRA1), hostname `otvori`, IPv4 **46.101.242.76**, 1 GB swap, ufw 22/80/443 |
| Users | `root` (SSH key only) and `deploy` (your laptop key + the GitHub Actions key; no sudo; docker group) |
| Checkout | `/opt/otvori` = clone of `https://github.com/MihajloZivkovic1/salveta.git` (the repo was renamed from `qr-menu`; the old URL redirects), `deploy/.env.prod` chmod 600 |
| DNS | Cloudflare zone `otvori.menu` (registrar: Vercel/Name.com, nameservers `rosemary`/`yoxall.ns.cloudflare.com`): A `@`, `www`, `app`, `api`, `*` → 46.101.242.76, all **DNS only**; Resend records on `send`/`resend._domainkey`; DMARC `_dmarc` TXT `v=DMARC1; p=none;` optional |
| Hosts | `otvori.menu` (marketing), `www` → 301, `app.otvori.menu` (CMS), `api.otvori.menu` (API; `/` is 404 by design), `*.otvori.menu` (menus). Certificates: Let's Encrypt via Cloudflare DNS-01, wildcard included (first issued 2026-10-23, 90-day renewal by Caddy) |
| Images | `ghcr.io/mihajlozivkovic1/otvori-api` and `otvori-caddy`, tags = git short SHA + `latest`; first live tag `d0fe2ba` |
| Flags | `FEATURE_PAYMENTS=false`, `FEATURE_POS=true` — visible at `https://api.otvori.menu/api/config` |
| Storage | AWS S3 `otvori-media` (eu-central-1), IAM user `otvori-api` / policy `otvori-media-rw`, bucket policy public-read on `restaurants/*`; image URLs `https://otvori-media.s3.eu-central-1.amazonaws.com/restaurants/<id>/…` |
| Mail | Resend, domain `otvori.menu` verified (EU, Ireland), API key `otvori-api` (sending only, domain-scoped), sender `otvori <zdravo@otvori.menu>` |
| Backups | cron `15 3 * * *` as `deploy` → `s3://otvori-media/backups/salveta-<stamp>.sql.gz`, 14 days; log `/home/deploy/otvori-backup.log`; restore drill done 2026-10-23 into `salveta_scratch` (1 restaurant, 4 items, 1 order, 2 users, 7 migrations) |
| Monitoring | **to do**: UptimeRobot HTTP monitor on `https://api.otvori.menu/api/health`, 5 min (the endpoint returns 503 when Postgres is down) |
| Accounts | superadmin `admin@otvori.menu` (password in the owner's password manager); first venue `x-caffe` (`https://x-caffe.otvori.menu/t/1`) |
| Memory at idle | api ≈ 130 MB, postgres ≈ 50 MB, caddy ≈ 65 MB of 961 MB; swap barely used |
| Logs | `ssh deploy@46.101.242.76`, then `cd /opt/otvori/deploy && docker compose --env-file .env.prod -f docker-compose.yml logs -f --tail=100 api` (JSON; `"level":50` = errors) |
| Deploy / rollback | push to `main` → CI → Deploy; by hand `./deploy/deploy.sh <tag>`; `cat /opt/otvori/deploy/.deployed-tag` shows what runs |
| GitHub | repo `MihajloZivkovic1/salveta`, secrets `DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KEY` (Actions-only ed25519 key, public half in `/home/deploy/.ssh/authorized_keys`); no variables set |

## 1. Cloudflare DNS (zone `otvori.menu`)

Records, all pointing at the droplet's IPv4 (add AAAA records too if the droplet has IPv6):

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| A | `@` | droplet IP | OFF (DNS only) to start; may be turned ON later |
| A | `www` | droplet IP | same as `@` |
| A | `app` | droplet IP | **OFF** (keep DNS only: the CMS calls `/api` and the SSE stream on this host) |
| A | `api` | droplet IP | **OFF** (keep DNS only) |
| A | `*` | droplet IP | **OFF** (keep DNS only) |

Before turning the proxy ON for `@`/`www`: Cloudflare → SSL/TLS → set the mode to **Full (strict)** (Caddy has real
certificates). Never proxy `app`, `api` or `*`: the API trusts exactly one hop (`TRUST_PROXY=1`), so behind Cloudflare
every admin and guest would share the rate-limit buckets of a few Cloudflare edge IPs (false 429s on login), and the
SSE stream would run through Cloudflare's buffers. Proxying them needs `trusted_proxies` + `CF-Connecting-IP` first.

API token (for the DNS-01 challenge): Cloudflare → My Profile → API Tokens → Create Token → template **Edit zone DNS** →
Zone Resources: *Include → Specific zone → otvori.menu* → Continue → Create → copy it into `CF_API_TOKEN`.
(Permissions: Zone → DNS → Edit, plus Zone → Zone → Read.)

## 2. AWS S3 (images + backups)

One bucket, **`otvori-media`** in **eu-central-1 (Frankfurt)**, and one IAM user that can touch nothing else.

1. **Bucket**: S3 → Create bucket → name `otvori-media`, region `eu-central-1`, *Object Ownership* **ACLs disabled
   (bucket owner enforced)** (default), *Block Public Access*: untick **only** "Block public access to buckets and
   objects granted through new public bucket policies" and "…through any public bucket policies" (keep the two ACL
   boxes ticked), Bucket Versioning off, default encryption SSE-S3 → Create.
2. **Bucket policy** (bucket → Permissions → Bucket policy): public read for images only.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadImages",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::otvori-media/restaurants/*"
       }
     ]
   }
   ```

   `backups/*` is not mentioned, so it stays private. The API never sets per-object ACLs on AWS (the bucket refuses
   them); it writes `restaurants/<restaurantId>/…` and the policy makes them readable.
3. **IAM user** `otvori-api` (IAM → Users → Create user, no console access) → *Attach policies directly* → *Create
   policy* → JSON:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Sid": "ListBucket", "Effect": "Allow", "Action": ["s3:ListBucket", "s3:GetBucketLocation"], "Resource": "arn:aws:s3:::otvori-media" },
       { "Sid": "Objects", "Effect": "Allow", "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"], "Resource": "arn:aws:s3:::otvori-media/*" }
     ]
   }
   ```

   Name it `otvori-media-rw`, attach it, create the user → Security credentials → **Create access key** (use case
   "Application running outside AWS") → copy both into `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` (shown once).
4. `.env.prod`: `S3_ENDPOINT=` (empty = AWS), `S3_REGION=eu-central-1`, `S3_BUCKET=otvori-media`,
   `S3_PUBLIC_BASE_URL=https://otvori-media.s3.eu-central-1.amazonaws.com`.
5. Check from your laptop with the same keys (`aws configure --profile otvori`):

   ```bash
   aws --profile otvori s3 ls s3://otvori-media
   echo hello > /tmp/t.txt && aws --profile otvori s3 cp /tmp/t.txt s3://otvori-media/restaurants/_test/t.txt
   curl -s https://otvori-media.s3.eu-central-1.amazonaws.com/restaurants/_test/t.txt      # hello (public)
   aws --profile otvori s3 cp /tmp/t.txt s3://otvori-media/backups/_test.txt
   curl -sI https://otvori-media.s3.eu-central-1.amazonaws.com/backups/_test.txt | head -1 # 403 (private)
   aws --profile otvori s3 rm s3://otvori-media/restaurants/_test/t.txt && aws --profile otvori s3 rm s3://otvori-media/backups/_test.txt
   ```

Optional: a lifecycle rule on the bucket (Management → Lifecycle rules, prefix `backups/`, expire after 14 days) as a
second safety net next to `backup.sh`'s own pruning. A CloudFront distribution in front of the bucket is not needed at
this size; if you add one later, point `S3_PUBLIC_BASE_URL` at it (existing image URLs keep the old host and keep working).

**Alternative: DigitalOcean Spaces** (or any S3-compatible service). Set `S3_ENDPOINT=https://fra1.digitaloceanspaces.com`,
`S3_REGION=fra1`, `S3_BUCKET=<space>`, `S3_PUBLIC_BASE_URL=https://<space>.fra1.cdn.digitaloceanspaces.com` and the
Spaces keys; with an endpoint set the API uploads with `ACL: public-read` per object (Spaces has no bucket policy),
and `backup.sh`/`restore.sh` pass `--endpoint-url` automatically.

## 3. Mail (Resend)

Resend → Domains → Add `otvori.menu` → add the DKIM/SPF records it shows at Cloudflare (DNS only) → Verify.
API Keys → Create (sending access) → `RESEND_API_KEY`. `MAIL_FROM` must use the verified domain.
Until then run with `MAIL_PROVIDER=log`: magic links and reset links are printed in the API log
(`docker compose … logs api | grep mail`).

## 4. Droplet

Create Droplet → **Frankfurt** → **Ubuntu 24.04 (LTS) x64** → Basic, Regular, **1 GB / 1 vCPU** → Authentication: your
SSH key → hostname `otvori` → Create. Note the IPv4; create the DNS records above with it.

```bash
# as root, once
ssh root@<IP>
apt-get update && apt-get -y upgrade
adduser --disabled-password --gecos '' deploy
mkdir -p /home/deploy/.ssh && cp /root/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
usermod -aG sudo deploy && echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy

# firewall
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable

# 1 GB swap as a safety net (the containers are limited to 640 MB in total; swap covers image pulls and spikes)
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf && sysctl -p /etc/sysctl.d/99-swappiness.conf

# Docker (official repository), git, and the AWS CLI v2 for backups (Ubuntu 24.04 ships no `awscli` package)
apt-get install -y ca-certificates curl git unzip
curl -fsSL https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip -o /tmp/awscliv2.zip && (cd /tmp && unzip -q awscliv2.zip && ./aws/install && rm -rf aws awscliv2.zip)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc && chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update && apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
usermod -aG docker deploy
mkdir -p /opt/otvori && chown deploy:deploy /opt/otvori
```

From here on work as `deploy` (`ssh deploy@<IP>`).

## 5. Clone the repository on the droplet

Only `deploy/` is used at runtime (compose file, scripts, `.env.prod`), but `deploy.sh` is updated with `git pull`.

```bash
droplet$ ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519 -C 'otvori droplet'   # if the GitHub repo is private
droplet$ cat ~/.ssh/id_ed25519.pub        # → GitHub repo → Settings → Deploy keys → Add (read-only)
droplet$ git clone git@github.com:MihajloZivkovic1/salveta.git /opt/otvori      # or the https URL for a public repo
```

## 6. `.env.prod`

```bash
droplet$ cd /opt/otvori/deploy && cp .env.prod.example .env.prod && chmod 600 .env.prod
droplet$ openssl rand -hex 32        # → POSTGRES_PASSWORD (hex: it is embedded in a URL)
droplet$ openssl rand -base64 48     # → JWT_ACCESS_SECRET
droplet$ openssl rand -base64 32     # → PAYMENTS_ENCRYPTION_KEY
droplet$ nano .env.prod              # DOMAIN, ACME_EMAIL, CF_API_TOKEN, GHCR_OWNER, the three secrets, Resend, S3_*, FEATURE_*
```

`deploy.sh` refuses to run while any value still contains `replace-me`. Validate:

```bash
droplet$ docker compose --env-file .env.prod -f docker-compose.yml config --quiet && echo OK
```

## 7. GitHub: secrets, variables, packages

Repository → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `DROPLET_HOST` | the droplet IPv4 |
| `DROPLET_USER` | `deploy` |
| `DROPLET_SSH_KEY` | a private key whose public half is in `/home/deploy/.ssh/authorized_keys` — generate one just for Actions: `ssh-keygen -t ed25519 -N '' -C github-actions -f gha_otvori`, paste the *private* file, append `gha_otvori.pub` to the droplet |

Variables (optional): `DOMAIN` (default `otvori.menu`), `PUBLIC_ANALYTICS_SRC`, `PUBLIC_ANALYTICS_DOMAIN`,
`FEATURE_PAYMENTS` (default `false`; only affects the marketing site's payment copy — the API reads its own flag from `.env.prod`).

Images land in `ghcr.io/<owner>/otvori-api` and `otvori-caddy` (owner = the lowercase GitHub user/org, set `GHCR_OWNER`
in `.env.prod` accordingly). The workflow logs the droplet in with its job token for the pull. For **manual** pulls and
rollbacks while the packages are private, log in once on the droplet with a classic PAT that has `read:packages`:

```bash
droplet$ echo '<PAT>' | docker login ghcr.io -u <github-user> --password-stdin
```

(or make both packages public: GitHub → Packages → package → Settings → Change visibility).

## 8. First deploy

Push to `main` (or Actions → **CI** → run) — when CI passes, **Deploy** builds both images (≈ 6–10 min the first time:
the Caddy image compiles Caddy with the Cloudflare module) and SSHes to the droplet to run `deploy/deploy.sh <short-sha>`.

Manually, after the images exist:

```bash
droplet$ cd /opt/otvori && ./deploy/deploy.sh            # latest
droplet$ ./deploy/deploy.sh a1b2c3d                        # a specific build
```

Check:

```bash
curl -s https://api.otvori.menu/api/health      # {"ok":true,"db":"ok","version":"a1b2c3d","features":{"payments":false,"pos":true}}
curl -s https://api.otvori.menu/api/config      # {"version":"a1b2c3d","features":{"payments":false,"pos":true}}
curl -sI https://app.otvori.menu/ | head -5     # 200 + security headers
curl -sI https://anything.otvori.menu/ | head -1  # 200 (wildcard certificate)
```

The first certificates take ~30–60 s after Caddy starts (DNS-01 propagation). `docker compose … logs caddy` shows it.

## 9. Superadmin

```bash
droplet$ cd /opt/otvori/deploy
droplet$ docker compose --env-file .env.prod -f docker-compose.yml exec api npm run create-superadmin -- admin@otvori.menu '<password>'
```

Sign in at `https://app.otvori.menu/login` → the superadmin lands on `/superadmin` (every venue, plan/status edits).
Running it again for an existing email promotes that user and replaces their password.

## 10. Backups

```bash
droplet$ /opt/otvori/deploy/backup.sh                    # try one now → "uploaded s3://otvori-media/backups/…"; lists at ./restore.sh --list
droplet$ crontab -e
15 3 * * * /opt/otvori/deploy/backup.sh >> /home/deploy/otvori-backup.log 2>&1
```

(`deploy` has no sudo, so the log lives in its home: `/home/deploy/otvori-backup.log`. The entry above is what runs in
production; `crontab -l` as `deploy` shows it.)

Restore (stops the API for the duration):

```bash
droplet$ ./deploy/restore.sh --list
droplet$ ./deploy/restore.sh backups/salveta-20261021-031500.sql.gz   # dumps are named after POSTGRES_DB, which stays "salveta"
```

## 11. Rollback

Every deploy is an image tag (git short SHA); `.deployed-tag` holds the current one.

```bash
droplet$ cat /opt/otvori/deploy/.deployed-tag
droplet$ docker images 'ghcr.io/*/otvori-api' --format '{{.Tag}}  {{.CreatedAt}}'   # tags still on the host
droplet$ ./deploy/deploy.sh <previous-tag>
```

Or GitHub → Actions → Deploy → *Run workflow* → `tag` = the earlier short SHA (deploys without rebuilding).
Migrations are not rolled back automatically; if a release added one, run
`docker compose … exec api node dist/db/migrate.js down` before deploying the older tag.

## 12. Logs, status, upkeep

```bash
alias sc='docker compose --env-file /opt/otvori/deploy/.env.prod -f /opt/otvori/deploy/docker-compose.yml'
sc ps                               # health of the three containers
sc logs -f --tail=100 api           # JSON lines (pino); grep '"level":50' for errors, '"mail"' for mails
sc logs -f --tail=100 caddy         # access + certificate log
sc exec postgres psql -U salveta   # SQL shell (POSTGRES_USER keeps the historical name)
docker stats --no-stream            # memory per container (limits: 256m / 256m / 128m)
free -m                             # host memory + swap
sc exec api node dist/db/migrate.js pending   # migrations not yet applied (should be none)
```

Container logs are capped at 3 × 10 MB per service. `docker image prune -f` runs after every deploy; a monthly
`docker system prune -f` keeps build leftovers away. Ubuntu's `unattended-upgrades` is on by default; reboot when
`/var/run/reboot-required` appears (the stack has `restart: unless-stopped`).

## Live orders (Server-Sent Events)

The waiter screen keeps `GET /api/admin/restaurants/<id>/events?token=…` open. The Caddyfile proxies that path with
`flush_interval -1` and the API answers with `Cache-Control: no-cache, no-transform`, which Caddy's `encode` honours, so
the stream is never compressed or buffered. Events are fanned out in-process (one `EventEmitter` per API process) and
the order-expiry job runs inside the API too: the stack is **one API container**. Scaling to several would need Redis
pub/sub behind `modules/ordering/events.ts` and a single job runner. `docker compose logs api | grep -i expired` shows the
job's work; an open stream shows up in Caddy's access log as a very long request.

## Laptop full-stack check

```bash
cp deploy/.env.local.example deploy/.env.local
docker compose --env-file deploy/.env.local -f deploy/docker-compose.yml -f deploy/docker-compose.local.yml up -d --build
curl -k https://api.localhost/api/health
curl -k --resolve kafeterija.localhost:443:127.0.0.1 https://kafeterija.localhost/t/1 | head -3
```

The laptop stack runs with production parity: `FEATURE_PAYMENTS=false`, `FEATURE_POS=true`, `MAIL_PROVIDER=log`
(allowed by `ALLOW_LOG_MAIL=1` in `.env.local`). Smoke test used before Phase 10: health + config flags, the five
hosts, a seeded venue (`docker compose … exec api npm run seed` needs `ALLOW_SEED=1`), an order placed from
`kafeterija.localhost/t/1` and accepted on `app.localhost`, the SSE stream through Caddy
(`curl -N https://app.localhost/api/admin/restaurants/<id>/events?token=…` shows `retry: 3000` and a `ping`), module
gating (payment routes 404) and no payment UI.

Caddy issues self-signed certificates from its internal CA (`Caddyfile.local`), so use `-k` / accept the warning. For a
browser, add `127.0.0.1 localhost app.localhost api.localhost kafeterija.localhost` to `/etc/hosts` (macOS does not resolve
`*.localhost` by itself). Changing `DOMAIN` means rebuilding the Caddy image: the marketing site bakes in its canonical
URLs (`SITE_URL`); the CMS and the menu take every URL from the API at runtime.

`Caddyfile.local` is `Caddyfile` with the global block replaced by `local_certs`; regenerate it after editing routes:

```bash
{ printf '{\n\tlocal_certs\n\tadmin off\n}\n'; sed -n '/^(security)/,$p' deploy/Caddyfile; } > deploy/Caddyfile.local
```
