# Pre-deploy audit (Phase 9a) — 2026-10-22

**Is the app ready to deploy? Yes**, after this commit, with four things left for the owner that no code change can
replace: write the terms and privacy pages (the footer hides the links until `config.ts` has real URLs), set the
production secrets (`deploy/.env.prod` from `.env.prod.example`, `MAIL_PROVIDER=resend` + a verified Resend domain),
keep `app`, `api` and `*` DNS-only in Cloudflare, and run the first `deploy.sh` + `create-superadmin` by hand
(`deploy/README.md`). Everything marked **fixed** below is in the Phase 9a commit; the TODO section at the end lists
what was consciously left, none of it blocking.

Method: three read-only passes (API + data layer, deploy/CI/env/PWA, both SPAs + marketing site) over every file, then
`npm audit`, typecheck, lint, every test suite, local Docker build of the API image, `caddy validate`, Lighthouse
(mobile) on the public menu and the CMS. File references are relative to the repo root.

## Blockers

| # | Finding | Where | Fix |
| --- | --- | --- | --- |
| B1 | **Reflected XSS on the apex domain**: the print card page interpolated the `?qr=` parameter into `innerHTML` (`aria-label="QR: ${qrUrl}"`), so `/print/qr-card/?qr=x"><img src=x onerror=…>` ran script on otvori.menu. | `apps/web/src/pages/print/qr-card.astro` | **Fixed**: the page logic moved to `src/scripts/qr-card.ts`; the SVG is built with `createElementNS`/`setAttribute`, `logo`/`qrImage` only accept `http(s):`, the print button uses `addEventListener`; regression test `test/qr-card.test.ts`. |

## Should-fix

### API, auth, data

| # | Finding | Where | Fix |
| --- | --- | --- | --- |
| S1 | The refresh token was written to the logs: pino-http's default `res` serializer logs `Set-Cookie`; `redact` only covered request headers. | `apps/api/src/app.ts` | **Fixed**: custom `req`/`res` serializers (method, url, remoteAddress / statusCode only) + `set-cookie` in `redact`. |
| S2 | Secrets in logged URLs: `GET …/events?token=<sse jwt>` and `GET /auth/magic-link/<token>`. | `apps/api/src/app.ts` | **Fixed**: `stripTokenParam()` redacts both; unit test in `test/auth.test.ts`. |
| S3 | Account enumeration by timing: `/forgot-password` and `/magic-link` awaited the Resend round-trip (up to 10 s, 500 on failure) only for existing accounts. | `apps/api/src/modules/auth/service.ts` | **Fixed**: the mail is sent detached with error logging; the response is identical and immediate either way. |
| S4 | The seed had no production guard: it deletes venues with the demo slugs and creates `admin@otvori.menu / admin1234`; `dist/db/seeders/seed.js` ships in the image. | `apps/api/src/db/seeders/seed.ts` | **Fixed**: refuses in production unless `ALLOW_SEED=1`. |
| S5 | A forgotten `MAIL_PROVIDER` silently fell back to `log` in production: magic links and reset links in `docker logs`, nothing delivered. | `apps/api/src/config/env.ts`, `deploy/docker-compose.yml` | **Fixed**: production fails fast on `log` unless `ALLOW_LOG_MAIL=1`; compose default is `resend`; `.env.prod.example` documents it. Same `superRefine` now rejects a `JWT_ACCESS_SECRET` < 32 chars or containing `change-me`/`replace-me`/`example`/`secret`. |
| S6 | Decompression bomb: sharp decoded with the default 268 MP limit and SVG was accepted; an 8 MB upload could allocate > 1 GB in a 256 MB container (OOM kills every SSE stream). | `apps/api/src/utils/images.ts`, `middleware/upload.ts` | **Fixed**: `limitInputPixels: 40_000_000`, SVG removed from the allow-list, multer `fields: 4, parts: 5`; test `test/uploads.test.ts` (49 MP PNG → 415, SVG → 415). |
| S7 | Open-orders cap counted outside the transaction: parallel requests from one session could exceed 3. | `apps/api/src/modules/ordering/service.ts` | **Fixed**: counted under the restaurant row lock. |
| S8 | Reserved subdomains: `slug: 'app' \| 'api' \| 'www' \| 'mail'` was accepted on PATCH and generated at register ("App" → `app`), pointing QR codes at the CMS/API host and letting `hostSlug` serve a tenant on `api.otvori.menu`. | `packages/shared/src/schemas/common.ts`, `apps/api/src/modules/restaurants/service.ts` | **Fixed**: `RESERVED_SLUGS` + `isReservedSlug()`; `slugSchema` refuses them, `uniqueSlug()` skips them; test in `test/auth.test.ts`. |
| S9 | JWT algorithm not pinned (safe with jsonwebtoken 9 string secrets, but implicit). | `apps/api/src/utils/jwt.ts` | **Fixed**: `algorithm`/`algorithms: ['HS256']` on sign and verify. |

### Front-ends

| # | Finding | Where | Fix |
| --- | --- | --- | --- |
| S10 | No error boundary and no chunk-load recovery: a tab left open across a deploy (the waiter's phone, a guest's menu) requests a hashed chunk that no longer exists → CMS shows React Router's raw error page, the menu goes blank. | `apps/cms/src/router.tsx`, `apps/menu/src/App.tsx` | **Fixed**: CMS root `ErrorBoundary` route (`components/shell/RouteError.tsx`) and menu `components/ErrorBoundary.tsx`; both reload once on a stale-chunk error (`lib/stale-chunk.ts`, sessionStorage flag against loops) and listen to `vite:preloadError`; tests `cms/test/route-error.test.tsx`, `menu/test/error-boundary.test.tsx`. |
| S11 | Service worker cached failed navigations: a 502 during `deploy.sh` became the offline shell. | `apps/cms/src/sw.js` | **Fixed**: only `response.ok` is cached. |
| S12 | Service-worker cache name was hand-versioned (`v2`): old hashed assets accumulated forever and icon/manifest/sound changes never reached installed PWAs. | `apps/cms/vite.config.ts`, `deploy/Dockerfile.caddy`, `.github/workflows/deploy.yml` | **Fixed**: `src/sw.js` is emitted as `/sw.js` with `tabla-cms-shell-<APP_VERSION>` (git short SHA in Docker, timestamp locally); `activate` evicts the previous release. |
| S13 | CMS `--faint` text at 2.56:1 on white (hints, counts, "Available on Pro", "or" divider) and `text-success` at 3.3:1 fail WCAG AA. | `apps/cms/src/styles.css` | **Fixed**: `--faint #73737d` (light) / `#8a8a93` (dark phone), success `#15803d`. |
| S14 | No `Content-Security-Policy` anywhere. | `deploy/Caddyfile`, `Caddyfile.local` | **Fixed (minimal)**: `frame-ancestors 'none'; object-src 'none'; base-uri 'self'` on every host (X-Frame-Options aligned to DENY). A full `script-src`/`style-src` policy is in the TODO. |
| S15 | Legal links were `#` placeholders in the footer ("Uslovi", "Privatnost"). | `apps/web/src/config.ts`, `components/Footer.astro` | **Mitigated**: rows are hidden while the URL is `#`. Writing the pages is the owner's (TODO 1). |
| S16 | Lighthouse on the menu with real photos: **80** performance, LCP 4.3 s — every 76 px row downloaded the 800×800 photo (150 KB each) and the 512 px logo PNG weighed 350 KB. | `apps/api/src/utils/images.ts`, `modules/items/service.ts`, `packages/shared/src/dto.ts`, `apps/menu/src/components/ItemRow.tsx` | **Fixed**: migration `20261022120000-item-thumbnails` adds `menu_items.thumbnail_url`; uploads store a 160×160 WebP next to the photo (3–8 KB), rows use `thumbnailUrl ?? imageUrl`, the first three rows load eagerly with `fetchpriority=high`; logos are 256×256 palette PNG (26 KB for the same photo). Result **97/100/100/100**. Existing photos/logos keep working and get thumbnails on the next upload. |
| S17 | CMS login page: no `<main>` landmark; no `robots.txt` (the SPA fallback served `index.html` for it). | `apps/cms/src/pages/auth/AuthLayout.tsx`, `apps/cms/public/robots.txt` | **Fixed**: `<main>` in the auth layout; `robots.txt` with `Disallow: /` (the admin must not be indexed — Lighthouse's SEO score for the CMS is therefore 63 by design). |

### Deploy, CI, ops

| # | Finding | Where | Fix |
| --- | --- | --- | --- |
| S18 | `backup.sh` failed every night with nothing to prune: `grep -v` exits 1 on empty input and `pipefail` aborts after the upload. | `deploy/backup.sh` | **Fixed**: the two greps tolerate empty output. |
| S19 | Keep-alive race: Caddy keeps upstream sockets 2 min, Node closed them at 65 s → occasional 502 on a non-replayable POST. (The comment in `index.ts` had it backwards.) | `deploy/Caddyfile*`, `apps/api/src/index.ts` | **Fixed**: `transport http { keepalive 50s }` on every `reverse_proxy api:3000`; comment corrected. |
| S20 | `deploy/.env.example` was a stale duplicate (`CLOUDFLARE_API_TOKEN` is never read; nothing loads `.env`). | `deploy/.env.example` | **Fixed**: removed. |
| S21 | Docs recommended proxying `app` through Cloudflare later: with `TRUST_PROXY=1` every admin would share a handful of edge IPs in the rate limiter and the SSE stream would be buffered. | `deploy/README.md`, `deploy/TODO-manual.md` | **Fixed**: `app`, `api`, `*` stay DNS-only; explained. |
| S22 | CI never built the Docker images; a Dockerfile/lockfile-trim breakage surfaced only in Deploy. | `.github/workflows/ci.yml` | **Fixed**: `images` job builds both with `push: false`. |
| S23 | `stop_grace_period` (10 s default) equalled the API's own 10 s drain → SIGKILL mid-shutdown. | `deploy/docker-compose.yml` | **Fixed**: 20 s. |
| S24 | `workflow_dispatch` input interpolated into shell (`${{ inputs.tag }}` inside `run:`). | `.github/workflows/deploy.yml` | **Fixed**: passed through `env:`. |
| S25 | Source maps shipped in the runtime image; no body-size cap in Caddy; planner hint `effective_cache_size=384MB` above the 256 MB limit. | `apps/api/tsconfig.build.json`, `deploy/Caddyfile*`, `deploy/docker-compose.yml` | **Fixed**: `sourceMap: false` for the build, `request_body max_size 10MB` in front of the API, `192MB`. |
| S26 | Dead config: `VITE_PUBLIC_MENU_BASE_URL` / `publicMenuUrlFromTemplate()` had no call site (links come from the API's `publicUrl`). | `apps/cms/src/lib/format.ts`, `.env.example`, `deploy/Dockerfile.caddy` | **Fixed**: removed; the build arg slot is now `APP_VERSION`. |

## Checked and fine

- **Tenant isolation**: every admin route is `requireAuth → requireMembership`; `restaurantIdOf(req)` is the only source
  of the id; every query in categories, items (incl. variants, image, reorder, availability), tables (block, QR),
  ordering (staff + guest by session), analytics (raw SQL with `restaurant_id = :restaurantId`), public events filters
  by it; no `findByPk` on a scoped table; reorder validates the id set inside the restaurant before updating; order
  lines are validated against the live menu and priced server-side; `membership.test.ts` covers cross-tenant reads,
  writes, child ids, roles and superadmin.
- **Auth**: HS256 access JWT with issuer + type; 48-byte refresh tokens stored hashed, rotated, reuse revokes all
  sessions; httpOnly/Secure/SameSite=Lax cookie on `/api/auth`; one-time magic/reset rows; bcrypt 12 with a dummy
  compare for unknown emails; `isSuperadmin` re-read from the DB on every request; SSE token typed, 5 min, bound to
  the restaurant, membership re-checked on connect and mounted before the bearer router.
- **Validation**: every body/query through a shared Zod schema, every id through `uuidParam()`, 1 MB JSON limit,
  8 MB uploads, pagination capped, enums for locale/range, 400/413/415 mapping; `x-powered-by` off.
- **Errors/logging**: no stack traces; `details` on 500 only outside production; Zod details are path/message/code.
- **Ordering/real-time**: daily number under `SELECT … FOR UPDATE`; conditional status updates; expiry job guarded
  and `unref`'d; SSE listeners removed on close; shutdown ends streams before `server.close()`; the rate limiter's
  memory store prunes itself. Caddy: `encode` honours `no-transform`, `flush_interval -1`, no proxy timeouts → the
  stream is never buffered or cut.
- **Migrations**: umzug + `sequelize_meta`, names stored without extension, `down()` drops enums; three migrations
  apply cleanly on an empty DB (`global-setup.ts`) and on the dev DB.
- **Docker**: multi-stage, `--omit=dev`, no `tsx`, no `.env`, runs as `node`, sharp loads on alpine, fonts present,
  `APP_VERSION` label + health; verified by building the image locally. Compose: 256+256+128 MB, healthchecks,
  `depends_on` conditions, log rotation, volumes, only Caddy publishes ports.
- **CI/Deploy**: Node 22 + Postgres service, typecheck/lint/test/build, images pushed as `<sha>` + `latest` only after
  CI succeeds on `main`, SSH step passes secrets via `envs` only, rollback = `deploy.sh <older tag>`.
- **Env docs**: every variable read by the API is documented in `apps/api/.env.example` and `deploy/.env.prod.example`;
  compose marks `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `DOMAIN`, `ACME_EMAIL`, `CF_API_TOKEN` as required.
- **Front-end security**: no `dangerouslySetInnerHTML`; all image URLs are server-generated; no open redirect
  (`state.from` is a router path); `rel="noreferrer"` on external links; access token only in memory.
- **Accessibility**: icon buttons labelled, inputs labelled, dialogs `role=dialog aria-modal aria-labelledby` with
  focus trap/Escape/restore, `lang` switches with the locale, toasts are live regions, reduced motion honoured,
  44 px targets in the guest app; contrast of every token pair passes after S13.
- **Stale names**: no user-visible `tabla`/`salveta`/`localhost` string remains; the hits are the identifiers CLAUDE.md
  lists as deliberately kept (cookie, storage keys, SW cache prefix, DB role, compose project, JWT issuer, comments).
- **npm audit**: 7 moderate, all transitive and unreachable in practice: `sprintf-js` via umzug's CLI argparse (we
  never format user input through it) and `uuid < 11.1.1` via sequelize (the v3/v5 buffer path is not used). No
  production fix without a major-version bump of umzug/sequelize; re-check at the next dependency update.
- **Bundle sizes (gzip)**: menu initial 108 KB (react-dom is 64 KB), lazy sheets 0.5–4 KB; CMS initial 102 KB + shared
  chunks ≈ 70 KB, largest page chunk 26 KB; nothing above 150 KB.
- **Lighthouse (mobile, production builds, same-origin proxy)**: menu `kafeterija.localhost/t/7` with six photos and a
  logo: 97/100/100/100 (was 80 before S16); CMS `/login`: 86–93 performance (Google Fonts stylesheet is
  render-blocking, see TODO), 100 accessibility, 100 best practices, SEO 63 by design (`Disallow: /`).
- **Tests after this commit**: api 50, cms 27, menu 47, web 15 — all green (`npm test`).

## TODO (not done in Phase 9a)

1. **Terms and privacy pages** — write `/uslovi/` and `/privatnost/` (sr/en) and set `links.terms`/`links.privacy` in
   `apps/web/src/config.ts`; the footer shows them automatically. Needs the owner's text.
2. **Full CSP** — hash the two inline handlers (menu `index.html` font `onload`, Astro hoisted scripts), allow Google
   Fonts origins for the CMS, `blob:` for QR/crop previews, then add `script-src`/`style-src`/`img-src`/`connect-src`
   (report-only first).
3. **Refresh-token rotation grace** — `consumeRefreshToken` is check-then-update; two CMS tabs restoring at the same
   instant can trip the reuse detector and sign the user out everywhere. Make it an atomic `UPDATE … WHERE used_at IS
   NULL RETURNING` and treat a token used < 10 s ago as a benign retry.
4. **Unique-constraint races** — `assertNumberFree` (tables) and `uniqueSlug` run outside the insert; a true race
   surfaces as a generic 409 with `details.fields`. Map Postgres constraint names to `TABLE_NUMBER_TAKEN`/`SLUG_TAKEN`
   and drop `fields` from the response.
5. **Slug change after publishing** breaks printed QR codes silently — forbid it when `publishedAt` is set or warn
   loudly in Settings.
6. **Rate-limit gaps** — add per-IP limits to `POST /refresh`, `POST /logout`, `GET /magic-link/:token`, public
   `GET /orders/:id` and `POST /orders/:id/cancel`; a café NAT shares the 30/15 min auth bucket.
7. **SSE stream cap** — no per-user cap on open streams and a revoked membership keeps its stream until it
   disconnects; add a cap (≈ 5) and end streams on membership deletion.
8. **CORS scope** — `/api/auth` and `/api/admin` accept every `*.otvori.menu` origin with credentials; restrict them to
   `APP_URL` (keep the wildcard for `/api/public`).
9. **Migration advisory lock** — wrap `runMigrations()` in `pg_advisory_lock` before ever running two API instances.
10. **Time zone validation** — `timezoneSchema` accepts ICU names Postgres may not know (`AT TIME ZONE` → 500 for that
    venue's analytics); validate against `pg_timezone_names`.
11. **CMS render-blocking fonts** — self-host Figtree/Libre Baskerville in the CMS like the marketing site does
    (≈ 1.4 s FCP on simulated 4G).
12. **Phone keyboard access to Delete** — `ItemSheet` has no Delete (only the desktop drawer); add it.
13. **"Import from spreadsheet"** is a disabled button with a tooltip touch users never see; replace with the
    "we enter your menu for you" mailto until the feature exists.
14. **Caddy healthcheck + wait in `deploy.sh`** — a Caddyfile/certificate failure is only visible in the final
    informational curl; add a healthcheck and wait for it. Pin `node:22.x-alpine`, `caddy:2.x` and the Cloudflare
    module version for reproducible rebuilds.
15. **`NODE_OPTIONS=--max-old-space-size=160`** for the API container so sharp's native memory fits under 256 MB.
16. **Test coverage holes** — register / forgot / reset / magic-link landing, item update + image crop/upload in the
    CMS, category CRUD + reorder, tables CRUD + QR/PDF download, branding, settings save, superadmin, SSE
    reconnect/backoff/watchdog, venue switcher; menu: item sheet add with variant/note, order again, `?item=` deep
    link + Back, polling stop; web: SEO tags, 404, sitemap.
17. **Serbian register** in the guest copy mixes "vi" (older strings) and "ti" (ordering) — pick one.
18. Minor: `ORDERING_PAUSED` custom-message detection compares against the English default string (send
    `details.custom` instead); desktop `Drawer` does not lock body scroll; the menu's 5xx state reuses the
    "check your connection" copy; the clear-search button is 36 px.
