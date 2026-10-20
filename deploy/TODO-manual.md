# Manual steps for the first production deploy

Everything the code cannot do for you, in order. Each step says what it unblocks. `deploy/README.md` has the longer
explanations and the day-2 commands (logs, rollback, restore).

Keep a scratch note open while you go; you will collect: the droplet IP, `CF_API_TOKEN`, the two Spaces keys, the
Resend key, and two generated secrets.

---

## 1. Create the droplet — unblocks 2 (DNS needs the IP), 5, 6

DigitalOcean → Create → Droplets:

- Region **Frankfurt (fra1)**
- Image **Ubuntu 24.04 (LTS) x64**
- Size **Basic → Regular → 1 GB / 1 vCPU / 25 GB** (the $6 one)
- Authentication **SSH key** → add/select your laptop's public key (`cat ~/.ssh/id_ed25519.pub`)
- Hostname `salveta` → Create

Write down the **IPv4 address** → it is `DROPLET_HOST` and the content of every DNS record.

## 2. Cloudflare DNS records — unblocks 8 (certificates on first deploy)

Cloudflare → salveta.menu → DNS → Records. Create five **A** records, content = the droplet IPv4:

| Name | Proxy status |
| --- | --- |
| `@` | DNS only (grey) for now |
| `www` | DNS only |
| `app` | DNS only |
| `api` | **DNS only** — keep it that way |
| `*` | **DNS only** — keep it that way |

(If you later turn the proxy on for `@`, `www`, `app`: first set SSL/TLS → Overview → **Full (strict)**.)

## 3. Cloudflare API token — unblocks 6 (`CF_API_TOKEN`), 8

Cloudflare → top-right profile → My Profile → **API Tokens** → Create Token → template **Edit zone DNS** → Use template:

- Permissions: `Zone · DNS · Edit` (template default) and add `Zone · Zone · Read`
- Zone Resources: `Include · Specific zone · salveta.menu`
- Continue to summary → Create Token → **copy it now** (shown once) → `CF_API_TOKEN`

## 4. Spaces bucket, CDN and keys — unblocks 6 (`S3_*`), 10 (backups)

DigitalOcean → Spaces Object Storage → **Create Spaces Bucket**:

- Datacenter region **Frankfurt (fra1)**
- Enable CDN: **yes** (leave the default edge cache TTL)
- Restrict File Listing: on (default)
- Name **`salveta`** → Create

Then the keys: left menu **API** → tab **Spaces Keys** → Generate New Key → name `salveta-droplet` → copy
**Access Key** → `S3_ACCESS_KEY_ID` and **Secret** → `S3_SECRET_ACCESS_KEY` (secret shown once).

Values for `.env.prod`: `S3_ENDPOINT=https://fra1.digitaloceanspaces.com`, `S3_REGION=fra1`, `S3_BUCKET=salveta`,
`S3_PUBLIC_URL=https://salveta.fra1.cdn.digitaloceanspaces.com`.

## 5. Resend (transactional mail) — unblocks magic links / password resets; the stack runs without it

Resend → Domains → Add Domain `salveta.menu` → region EU if offered → it lists DNS records (DKIM TXT/CNAME, SPF) →
add each at Cloudflare (DNS only) → back in Resend click Verify. Then API Keys → Create API Key (name `salveta-api`,
permission *Sending access*) → copy → `RESEND_API_KEY`.

Not ready tomorrow? Set `MAIL_PROVIDER=log` in `.env.prod`; links are then printed in the API log
(`sc logs api | grep mail`) and you can switch to `resend` later with `./deploy/deploy.sh` (no rebuild).

## 6. Prepare the server — unblocks 7, 8

```bash
ssh root@<DROPLET_IP>
```

Paste the whole block from README section 4 ("as root, once"): it creates the `deploy` user, opens 22/80/443 in ufw,
adds the 1 GB swap file, installs Docker from Docker's repository, git and the aws CLI, and creates `/opt/salveta`.
Then:

```bash
exit
ssh deploy@<DROPLET_IP>
ssh-keygen -t ed25519 -N '' -f ~/.ssh/id_ed25519 -C 'salveta droplet'
cat ~/.ssh/id_ed25519.pub
```

GitHub → repo `qr-menu` → Settings → **Deploy keys** → Add deploy key → title `salveta droplet`, paste the key,
*Allow write access* **off** → Add. (Skip the key and use the https URL if the repository is public.)

```bash
git clone git@github.com:MihajloZivkovic1/qr-menu.git /opt/salveta
cd /opt/salveta/deploy
cp .env.prod.example .env.prod && chmod 600 .env.prod
openssl rand -hex 32        # → POSTGRES_PASSWORD
openssl rand -base64 48     # → JWT_ACCESS_SECRET
nano .env.prod
```

Fill `.env.prod` (every other line keeps its default):

| Variable | Value |
| --- | --- |
| `DOMAIN` | `salveta.menu` |
| `ACME_EMAIL` | your address for Let's Encrypt notices |
| `CF_API_TOKEN` | from step 3 |
| `GHCR_OWNER` | `mihajlozivkovic1` (your GitHub user, lowercase) |
| `IMAGE_TAG` | `latest` |
| `POSTGRES_PASSWORD` | the `openssl rand -hex 32` output |
| `JWT_ACCESS_SECRET` | the `openssl rand -base64 48` output |
| `MAIL_PROVIDER` | `resend` (or `log` for now) |
| `RESEND_API_KEY` | from step 5; with `MAIL_PROVIDER=log` leave it **empty** (delete the `replace-me` text — `deploy.sh` refuses any placeholder) |
| `MAIL_FROM` | `salveta <no-reply@salveta.menu>` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | from step 4 |

Check — must print `OK` and no `replace-me` lines:

```bash
docker compose --env-file .env.prod -f docker-compose.yml config --quiet && echo OK
grep -n replace-me .env.prod
```

## 7. GitHub Actions secrets — unblocks 8 (the Deploy workflow)

On your laptop, make a key pair only for GitHub Actions and authorise it on the droplet:

```bash
ssh-keygen -t ed25519 -N '' -C github-actions -f ~/gha_salveta
cat ~/gha_salveta.pub | ssh deploy@<DROPLET_IP> 'cat >> ~/.ssh/authorized_keys'
cat ~/gha_salveta            # the PRIVATE key → DROPLET_SSH_KEY
```

GitHub → repo → Settings → Secrets and variables → Actions → **New repository secret** ×3:

| Name | What goes in |
| --- | --- |
| `DROPLET_HOST` | the droplet IPv4 from step 1 |
| `DROPLET_USER` | `deploy` |
| `DROPLET_SSH_KEY` | the full contents of `~/gha_salveta` (begins with `-----BEGIN OPENSSH PRIVATE KEY-----`) |

Variables tab (optional, only if different from the defaults): `DOMAIN`, `PUBLIC_ANALYTICS_SRC`, `PUBLIC_ANALYTICS_DOMAIN`.

The workflow declares its own `packages: write` permission, so the default *Workflow permissions* setting can stay as it
is; only if the *Build & push images* job fails with a 403 on push, set Settings → Actions → General → Workflow
permissions → **Read and write**. Afterwards `rm ~/gha_salveta ~/gha_salveta.pub`.

## 8. First deploy — unblocks 9, 10, 11

Push `main` (the Phase 4 commits) — or Actions → **CI** → *Run workflow*. When CI is green, **Deploy** starts by itself,
builds both images (6–10 min the first time), pushes them to GHCR and runs `deploy/deploy.sh <sha>` on the droplet.
Watch Actions → Deploy → the *Deploy to the droplet* job for `deploy: tag … is live`.

Then from your laptop:

```bash
curl -s https://api.salveta.menu/api/health         # {"ok":true,"db":"ok","version":"<sha>"}
curl -sI https://app.salveta.menu/ | head -3         # HTTP/2 200
curl -sI https://test.salveta.menu/ | head -1        # HTTP/2 200 (wildcard certificate works)
```

If the Deploy job fails at the SSH step, fix the secret and re-run it (Actions → Deploy → Re-run jobs); if the images
exist already you can also deploy by hand: `ssh deploy@<IP> 'cd /opt/salveta && ./deploy/deploy.sh'` — for that one
manual pull while the packages are private, run once on the droplet
`echo '<classic PAT with read:packages>' | docker login ghcr.io -u <github-user> --password-stdin`.

## 9. Superadmin — unblocks the CMS `/superadmin` screen (plans, suspensions)

```bash
ssh deploy@<DROPLET_IP>
cd /opt/salveta/deploy
docker compose --env-file .env.prod -f docker-compose.yml exec api npm run create-superadmin -- admin@salveta.menu '<strong password>'
```

Sign in at https://app.salveta.menu/login. Then register the first real venue through https://app.salveta.menu/register
(or the marketing site's "Register" button), publish it in the CMS, and open `https://<slug>.salveta.menu/t/1`.

## 10. Backups — unblocks nothing else; do it the same day

```bash
/opt/salveta/deploy/backup.sh                                     # one now; should print "uploaded s3://salveta/backups/…"
/opt/salveta/deploy/restore.sh --list                             # see it
sudo touch /var/log/salveta-backup.log && sudo chown deploy /var/log/salveta-backup.log
crontab -e      # add:
15 3 * * * /opt/salveta/deploy/backup.sh >> /var/log/salveta-backup.log 2>&1
```

## 11. Optional, later

- Turn the Cloudflare proxy on for `@`, `www`, `app` after setting SSL/TLS to Full (strict). Leave `api` and `*` DNS only.
- Add a Spaces lifecycle rule for `backups/` (README section 2) as a second safety net.
- Set `vars.PUBLIC_ANALYTICS_SRC` / `PUBLIC_ANALYTICS_DOMAIN` and re-run Deploy to enable the cookieless analytics tag.
- Rollback at any time: `./deploy/deploy.sh <previous short sha>` on the droplet, or Actions → Deploy → Run workflow → tag.
