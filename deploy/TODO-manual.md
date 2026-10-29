# Manual steps for the first production deploy (Phase 10)

> **Status: done on 2026-10-23.** Every step below was executed; the resulting facts (IP, hosts, bucket, cron, accounts) are
> in `deploy/README.md` → "Production facts". Keep this file as the recipe for a rebuild. Deviations met on the way are
> marked **(as built)**.

Everything the code cannot do for you, in the order we run it. Each step says what it unblocks; `deploy/README.md`
has the longer explanations and the day-2 commands (logs, rollback, restore). Online payment stays **off**
(`FEATURE_PAYMENTS=false`); POS is offered (`FEATURE_POS=true`).

You will collect on the way: the droplet IP, `CF_API_TOKEN`, the Resend key, the two AWS access keys, and three
generated secrets (`POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `PAYMENTS_ENCRYPTION_KEY`).

| # | Step | Where | Unblocks |
| --- | --- | --- | --- |
| 1 | Droplet (1 GB, fra1, Ubuntu 24.04, your SSH key) → note the IPv4 | DigitalOcean | 2, 7 |
| 2 | DNS: A `@`, `www`, `app`, `api`, `*` → the IP; proxy **OFF** for `api` and `*` (and for `app`, `@`, `www` to start) | Cloudflare | 9 |
| 3 | API token *Edit zone DNS* for the otvori.menu zone → `CF_API_TOKEN` | Cloudflare | 8 |
| 4 | Resend domain `otvori.menu` (EU) → DKIM/SPF records into Cloudflare (DNS only) → Verify → API key → `RESEND_API_KEY` | Resend + Cloudflare | magic links / resets |
| 5 | Bucket `otvori-media` (eu-central-1), bucket policy public-read on `restaurants/*`, IAM user `otvori-api` with the bucket-only policy, access keys → `S3_*` | AWS | images, backups |
| 6 | Server prep as root (user `deploy`, ufw, 1 GB swap, Docker, git, aws CLI, `/opt/otvori`) | terminal (ssh root@IP) | 7 |
| 7 | Clone the repo as `deploy`, create `.env.prod` from the example, fill it (table below) | terminal | 9 |
| 8 | GitHub Actions secrets `DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KEY`; packages on GHCR | GitHub | 9 |
| 9 | Push `main` → CI → Deploy builds the images and runs `deploy.sh` on the droplet | GitHub | 10 |
| 10 | TLS + health on all five hosts, `/api/config` shows `payments:false` | terminal (curl) | 11 |
| 11 | `create-superadmin`, register the first venue, publish | terminal + browser | 12 |
| 12 | Smoke test from a real phone over mobile data (scan the printed QR, order, accept, call waiter, photo from S3, publish/unpublish) | phone + CMS | 13 |
| 13 | `backup.sh` once, restore into a scratch database, cron | terminal | 14 |
| 14 | UptimeRobot monitor on `https://api.otvori.menu/api/health` | UptimeRobot | — |

The exact values, commands and checks for each step are in `deploy/README.md` sections 1–12; the walkthrough below
is the short form.

---

## 1. Droplet

DigitalOcean → Create → Droplets: region **Frankfurt (fra1)**, image **Ubuntu 24.04 (LTS) x64**, size **Basic →
Regular → 1 GB / 1 vCPU / 25 GB**, authentication **SSH key** (your laptop's public key), hostname `otvori`.
**(as built)** Basic-Regular was unavailable in FRA1; Premium Intel 1 GB / 35 GB NVMe (≈ 8 $) was used instead. Make
sure the SSH key you tick is the one whose private half is on your laptop (`ssh-keygen -lf ~/.ssh/id_ed25519.pub`).
Write down the **IPv4 address**.

## 2. Cloudflare DNS

**(as built)** The domain was bought at Vercel: add the site to Cloudflare first, then replace Vercel's nameservers
(`ns1/ns2.vercel-dns.com`) with Cloudflare's in Vercel → Domains → Nameservers, and delete every record Cloudflare
imports from Vercel (A/CAA/CNAME) before continuing. Delegation took about a minute.

Zone `otvori.menu` → DNS → Records → five **A** records with the droplet IPv4: `@`, `www`, `app`, `api`, `*`.
Proxy status **DNS only (grey)** for all of them; `api` and `*` stay that way forever, `@`/`www`/`app` may be proxied
later after SSL/TLS → **Full (strict)** (README section 1 explains why `app` is better left alone).

Check from the laptop: `dig +short api.otvori.menu` and `dig +short anything.otvori.menu` print the IP.

## 3. Cloudflare API token

My Profile → API Tokens → Create Token → template **Edit zone DNS**: permissions `Zone · DNS · Edit` + `Zone · Zone · Read`,
zone resources `Include · Specific zone · otvori.menu` → Create → copy (shown once) → `CF_API_TOKEN`.

## 4. Resend

Resend → Domains → Add Domain `otvori.menu`, region **EU (Ireland)** → it lists the records (DKIM TXT `resend._domainkey`,
SPF TXT on `send`, MX on `send`) → add each at Cloudflare, **DNS only** → back in Resend: Verify. Then API Keys →
Create API Key `otvori-api`, permission *Sending access*, domain `otvori.menu` → `RESEND_API_KEY`.

Check: `dig +short TXT resend._domainkey.otvori.menu` returns the key; Resend shows the domain as Verified.
**(as built)** Resend's "Forge" setup uses a CNAME on `send` instead of TXT+MX; accept whatever Resend lists. Several
domains can share one Resend account; give otvori its own domain-scoped API key.

## 5. AWS

README section 2 has the two JSON policies. In short: S3 bucket `otvori-media` in `eu-central-1` (ACLs disabled,
public access allowed *through bucket policies only*), bucket policy `s3:GetObject` on `arn:aws:s3:::otvori-media/restaurants/*`,
IAM user `otvori-api` with policy `otvori-media-rw` (List/GetBucketLocation on the bucket, Put/Get/DeleteObject on
`otvori-media/*`), access key → `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY`.

Check from the laptop: `aws s3 ls s3://otvori-media`, a public read of a test object under `restaurants/` and a 403
on one under `backups/` (commands in README section 2.5).

## 6. Prepare the server

`ssh root@<IP>` and paste the block from README section 4 ("as root, once"). It creates the `deploy` user, opens
22/80/443, adds the 1 GB swap file, installs Docker (Docker's repository), git and the AWS CLI v2, creates `/opt/otvori`.
**(as built)** Ubuntu 24.04 has no `awscli` apt package; the README block installs AWS CLI v2 from the official zip.

## 7. Clone and `.env.prod`

```bash
ssh deploy@<IP>
git clone https://github.com/MihajloZivkovic1/otvori.git /opt/otvori     # public repo; a read-only deploy key only for a private one (README § 5)
cd /opt/otvori/deploy && cp .env.prod.example .env.prod && chmod 600 .env.prod
openssl rand -hex 32        # → POSTGRES_PASSWORD
openssl rand -base64 48     # → JWT_ACCESS_SECRET
openssl rand -base64 32     # → PAYMENTS_ENCRYPTION_KEY
nano .env.prod
```

| Variable | Value |
| --- | --- |
| `DOMAIN` | `otvori.menu` |
| `ACME_EMAIL` | your address for Let's Encrypt notices |
| `CF_API_TOKEN` | step 3 |
| `GHCR_OWNER` | `mihajlozivkovic1` (GitHub user, lowercase) |
| `IMAGE_TAG` | `latest` |
| `POSTGRES_PASSWORD` | `openssl rand -hex 32` |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` |
| `PAYMENTS_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `MAIL_PROVIDER` / `RESEND_API_KEY` / `MAIL_FROM` | `resend` / step 4 / `otvori <zdravo@otvori.menu>` |
| `S3_ENDPOINT` | **empty** (AWS) |
| `S3_REGION` / `S3_BUCKET` | `eu-central-1` / `otvori-media` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | step 5 |
| `S3_PUBLIC_BASE_URL` | `https://otvori-media.s3.eu-central-1.amazonaws.com` |
| `FEATURE_PAYMENTS` / `FEATURE_POS` | `false` / `true` |
| `OTP_ECOM_BASE_URL` | empty |

Check — must print `OK` and no `replace-me` lines:

```bash
docker compose --env-file .env.prod -f docker-compose.yml config --quiet && echo OK
grep -n replace-me .env.prod
```

## 8. GitHub

Key pair only for Actions, authorised on the droplet (README section 7), then repo → Settings → Secrets and variables
→ Actions → secrets `DROPLET_HOST` (IP), `DROPLET_USER` (`deploy`), `DROPLET_SSH_KEY` (the private key). Variables:
none needed (`DOMAIN` defaults to `otvori.menu`, `FEATURE_PAYMENTS` to `false`).

## 9. First deploy

Push `main`. Actions → **CI** (typecheck, lint, `check:flags`, tests, builds) → **Deploy** (builds + pushes
`ghcr.io/mihajlozivkovic1/otvori-api` and `otvori-caddy` tagged with the short SHA, then `deploy/deploy.sh <sha>`
over SSH). First run ≈ 10 min (xcaddy compiles Caddy with the Cloudflare module). Watch for `deploy: tag … is live`.

If the packages are private and you ever pull by hand: `echo '<PAT read:packages>' | docker login ghcr.io -u <user> --password-stdin` once on the droplet.

## 10. Verify

```bash
curl -s https://api.otvori.menu/api/health     # {"ok":true,"db":"ok","version":"<sha>","features":{"payments":false,"pos":true}}
curl -s https://api.otvori.menu/api/config     # {"version":"<sha>","features":{"payments":false,"pos":true}}
for h in otvori.menu www.otvori.menu app.otvori.menu api.otvori.menu test.otvori.menu; do echo "== $h"; curl -sI "https://$h/" | head -1; done
curl -sI https://app.otvori.menu/ | grep -i "strict-transport\|content-security"
```

## 11. Superadmin and the first venue

```bash
ssh deploy@<IP> 'cd /opt/otvori/deploy && docker compose --env-file .env.prod -f docker-compose.yml exec api npm run create-superadmin -- admin@otvori.menu "<strong password>"'
```

Sign in at https://app.otvori.menu/login (lands on `/superadmin`). Register the first real venue through
https://app.otvori.menu/register, add a category and an item, a table, **Publish**, open `https://<slug>.otvori.menu/t/1`.
Settings → Modules → switch **Ordering** on, mode *order*.

## 12. Smoke test from a phone (mobile data, Wi-Fi off)

1. Tables → download the QR PDF, print (or open on a laptop screen) → scan with the phone camera → the menu opens on
   `https://<slug>.otvori.menu/t/<n>` with the right table.
2. Add an item, send the order → the waiter screen (`app.otvori.menu/r/<id>/orders`, another device) shows it live
   (sound/badge) → Accept → the phone shows "accepted" within seconds.
3. Phone: "Pozovi konobara" → the call shows up on the waiter screen → Done.
4. CMS: upload an item photo → the menu shows it; the image URL starts with `https://otvori-media.s3.eu-central-1.amazonaws.com/restaurants/`.
5. Unpublish in Settings → the phone shows "menu not published"; publish again → it is back (allow ~30 s of cache).
6. Nothing says "Plati" / "Pay" anywhere; Settings → Modules → Online payment reads **Not available yet**.

## 13. Backups

```bash
/opt/otvori/deploy/backup.sh                     # → "uploaded s3://otvori-media/backups/otvori-<stamp>.sql.gz"
/opt/otvori/deploy/restore.sh --list
# restore test into a scratch database (does not touch the live one):
docker compose --env-file .env.prod -f docker-compose.yml exec -T postgres psql -U otvori -c 'CREATE DATABASE otvori_scratch'
aws s3 cp s3://otvori-media/backups/<file> - | gunzip | docker compose --env-file .env.prod -f docker-compose.yml exec -T postgres psql -U otvori -d otvori_scratch -q
docker compose --env-file .env.prod -f docker-compose.yml exec -T postgres psql -U otvori -d otvori_scratch -c 'SELECT count(*) FROM restaurants'
docker compose --env-file .env.prod -f docker-compose.yml exec -T postgres psql -U otvori -c 'DROP DATABASE otvori_scratch'
crontab -e     # 15 3 * * * /opt/otvori/deploy/backup.sh >> /home/deploy/otvori-backup.log 2>&1   (deploy has no sudo → log in $HOME)
```

## 14. UptimeRobot

New monitor → HTTP(s) → `https://api.otvori.menu/api/health`, interval 5 min, keyword alert optional
(`"ok":true`). The endpoint returns 503 when Postgres does not answer, so a plain status monitor is enough.

## Later (optional)

- Cloudflare proxy on for `@` and `www` after SSL/TLS → Full (strict). Leave `app`, `api`, `*` DNS only.
- S3 lifecycle rule for `backups/` (14 days) as a second safety net.
- `vars.PUBLIC_ANALYTICS_SRC` / `PUBLIC_ANALYTICS_DOMAIN` → cookieless analytics on the marketing site.
- Releasing online payment: merge `feature/payments`, set `FEATURE_PAYMENTS=true` in `.env.prod` + GitHub variable
  `FEATURE_PAYMENTS=true` (marketing copy), redeploy, then switch the module on per venue from `/superadmin`.
- Rollback at any time: `./deploy/deploy.sh <previous short sha>` on the droplet, or Actions → Deploy → Run workflow → tag.
