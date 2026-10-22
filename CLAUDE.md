# otvori (qr-menu) — project conventions

Multi-tenant QR table-menu SaaS for restaurants. npm-workspaces monorepo driven by Turborepo.
Product name: **otvori** (lowercase in running text and in the wordmark; "otvori.menu" when referring to the service or the
domain). Tagline "Skeniraj. Otvori. Naruči." (EN "Scan. Open. Order."); the concept is *opening* — the code opens the menu,
the venue opens its doors — never napkins. Public menus live on `https://{slug}.otvori.menu`, the admin CMS on
`app.otvori.menu`, the API on `api.otvori.menu`, the marketing site on the apex. Brand assets come from
`design/otvori-brand.html` (Claude Design export, markup in the `__bundler/template` script tag): the mark is a QR finder
square whose right side has swung open (32-unit grid, frame stroke 3.2, inner square 8, door hinged at x=24.5), the wordmark
is lowercase "otvori" in Libre Baskerville **400**, plum `#7A3E48`, paper `#F7F2EB`, ink `#1F1A17`; the favicon tile is the
mark at 75 % on a plum square with radius 7/32. The CMS uses `components/Wordmark.tsx` (`OtvoriMark` + `Wordmark`), the menu
app inlines the mark in `components/Footer.tsx`, the PDF QR sheet draws the same paths with
`apps/api/assets/fonts/LibreBaskerville-Regular.ttf`, the marketing site has `components/Mark.astro` + `Wordmark.astro`
(icons via `scripts/icons.mjs`, OG images via `scripts/og.mjs`), the CMS icons via `scripts/make-icons.mjs`.

**Historical identifiers that deliberately keep old names** (renaming them would break existing installs, sessions and
saved browser state for no user-visible gain): the repo and npm scope (`qr-menu`, `@qr-menu/*`), env var names, the refresh
cookie `tabla_refresh`, every `tabla.*` localStorage / sessionStorage key, the service-worker cache name `tabla-cms-shell-*`,
the Postgres role/database defaults (`salveta`, baked into the production data volume), the compose project name `salveta`
(prefixes the volume names) and the demo passwords `tabla1234`. Anything a user can read — UI copy, mail, PDF, titles,
manifests, docs, image names, domains, the superadmin seed `admin@otvori.menu`, the mail sender `otvori <zdravo@otvori.menu>`
— says otvori.

## Layout

| Path | What | Status |
| --- | --- | --- |
| `packages/shared` | Constants, Zod request schemas, response DTO schemas + inferred types, `resolveText()` | Phase 1 (done) |
| `apps/api` | Express 5 API (Sequelize 6 + sequelize-typescript, Postgres 16) | Phase 1 (done) |
| `apps/menu` | Public guest menu (React 19 + Vite 8 + Tailwind v4) | Phase 2 (done) |
| `apps/cms` | Admin CMS (React 19 + Vite 8 + Tailwind v4, react-router data router, TanStack Query, react-hook-form) | Phase 3 (done) |
| `apps/web` | Marketing site at the apex (Astro 7 static, Tailwind v4, no framework islands) | Phase 5 (done) |
| `deploy/` | Production stack for one 1 GB droplet: compose file, two Dockerfiles, Caddyfile, deploy/backup/restore scripts, README | Phase 4 (done) |

`apps/api/src`: `config/` (env), `db/` (sequelize instance, `models/`, `migrations/`, `seeders/`),
`modules/<name>/` (`router.ts`, `controller.ts`, `service.ts`, `schemas.ts`), `middleware/`, `utils/`, `scripts/`
(`create-superadmin.ts`), `app.ts`, `index.ts` (connects, runs migrations when `MIGRATE_ON_START`, listens, graceful SIGTERM).
Tests live in `apps/api/test`.

`apps/cms/src`: `main.tsx` (QueryClient → ToastProvider → AuthProvider → RouterProvider, SW registration), `router.tsx` (route
tree, lazy pages), `pages/` (one file per screen, `auth/` for login/register/forgot/magic/reset), `components/ui/` (primitives),
`components/shell/` (sidebar, top bar, tab bar, layouts, guards), `components/{menu,tables,branding,settings,superadmin,orders}/`,
`lib/` (api, auth, queries, storage, format, screens, crop, download, color, notify), `hooks/`, `styles.css`. Tests in `apps/cms/test`.

`apps/menu/src`: `main.tsx` (QueryClient, `BrowserRouter`, re-applies the cached tenant theme before first paint), `App.tsx`
(routes `/r/:slug/t/:table`, `/r/:slug/*`, `/t/:table` and `*`), `pages/MenuPage.tsx` (the one screen: data, locale, theme, events, sheet routing),
`components/` (Header, CategoryBar, CategorySection, ItemRow, ItemSheet, OfflineScreen, MenuSkeleton, Footer, Chips, LogoTile, icons),
`hooks/` (useMenu, useActiveCategory, useLockBodyScroll, useFocusTrap), `lib/` (api, tenant, session, locale, i18n, format, theme,
events), `styles.css` (tokens + Tailwind). Tests live in `apps/menu/test` (vitest + Testing Library, jsdom; `helpers.tsx` has the
menu fixtures, a fetch mock and `renderMenu()`).

## Commands

```bash
npm run db:up                 # Postgres 16 in Docker (POSTGRES_PORT=5433 npm run db:up to change the host port)
cp apps/api/.env.example apps/api/.env   # then edit DATABASE_URL etc.
npm run build -w @qr-menu/shared         # api imports shared from packages/shared/dist (turbo does this automatically)
npm run migrate               # umzug up      (apps/api: npm run migrate / migrate:undo / migrate:status)
npm run seed                  # demo data; re-runnable, wipes + recreates only the seeded rows
npm run create-superadmin:dev -w @qr-menu/api -- admin@x.y 'password'   # dev; prod image: npm run create-superadmin (dist)
npm run dev                   # turbo: shared tsc --watch + api tsx watch (+ vite apps)
npm run typecheck             # all workspaces (apps/web runs `astro check`)
npm run lint                  # eslint in shared, api, cms, menu; prettier --check in web
npm test                      # every suite, turbo --concurrency=2 (api needs Postgres; uses "<db>_test" or TEST_DATABASE_URL)
```

`@qr-menu/shared` is a compiled package: consumers import `dist/`. After editing shared, rebuild it (or keep `npm run dev` running).

## Stack rules

- Node 22, TypeScript strict, **ESM everywhere** (`"type": "module"`, `module: NodeNext`, relative imports end in `.js`).
- TypeScript **5.9.3**, pinned exactly in every workspace (typescript-eslint, ts-api-utils and `astro check` do not support
  TS 6/7; a nested `typescript@6` in the lockfile is a regression). Decorators are legacy `experimentalDecorators` with `useDefineForClassFields: false`.
  `emitDecoratorMetadata` is **off** (tsx/esbuild cannot emit it) → every `@Column` declares its `DataType` explicitly.
- Express 5: async handlers may `throw`; rejections reach the error middleware. No try/catch boilerplate in controllers.
- Validation: **every** request body/query is parsed with a Zod schema from `@qr-menu/shared` (`schema.parse(req.body)` in the controller).
  Route params that are ids go through `uuidParam()`. `ZodError` → 400.
- Error shape is always `{ error: { code, message, details? } }` (`utils/errors.ts`, `middleware/error.ts`).
  400 validation, 401 auth, 403 membership/role, 404 not found, 409 conflict (`EMAIL_TAKEN`, `SLUG_TAKEN`, `TABLE_NUMBER_TAKEN`), 413/415 uploads, 429 rate limit.
- Logging: pino (`utils/logger.ts`), pino-http per request. Never `console.log` in app code.
- `GET /api/health` → `{ ok, db, version }`; `ok:false` + 503 when the 2 s Postgres ping fails. `version` = `APP_VERSION` env
  (the git short SHA baked into the Docker image; `dev` when unset).
- Migrations only (umzug + Sequelize QueryInterface, `src/db/migrations/*.ts`); **never** `sequelize.sync()`.
  Migration names are stored without extension so `.ts` (dev) and `.js` (dist) agree. `MIGRATE_ON_START` (default on in
  production, off elsewhere) makes `index.ts` run pending migrations before listening, so the container needs no init step.

## Tenant isolation (non-negotiable)

- Admin routes are `/api/admin/restaurants/:restaurantId/...`. `requireMembership()` resolves the membership of the
  authenticated user for the `:restaurantId` route param and stores `req.membership`.
- `POST /api/admin/restaurants` `{ name }` is the one admin route without a `:restaurantId`: it creates another venue (unique
  slug, own 14-day trial) with the caller as owner. Gate: the caller owns a venue on plan `pro` or is a superadmin, otherwise
  403 `PLAN_REQUIRED`. `createRestaurantWithOwner()` in `modules/restaurants/service.ts` is shared with `POST /api/auth/register`.
- Services take `restaurantId` as an explicit argument (from `restaurantIdOf(req)`), and **every query filters by it**.
  The restaurant id is never read from the request body.
- Owner-only (`requireOwner`): PATCH restaurant settings, logo upload, publish, DELETE restaurant/category/item/table.
  Staff can manage menu content, tables, availability, images and read analytics.
- Superadmins pass membership checks as implicit owners (support use) and get `/api/superadmin/*`.

## Data conventions

- DB columns are `snake_case`; model attributes and all JSON over the wire are `camelCase` (`price_cents` ↔ `priceCents`).
  Sequelize `underscored: true` does the mapping.
- Prices are integers in minor units (`priceCents`; 250,00 RSD = 25000).
- Translatable text is JSONB keyed by locale: `{ "sr": "...", "en": "..." }` (`TranslatedText`). Public endpoints resolve it
  with `resolveText(text, locale, restaurant.defaultLocale)`; admin endpoints return the raw object.
- Allowed allergens `ALLERGENS` = G, M, E, N, S, F, C, Se; tags `TAGS` = vegan, spicy, new; locales `LOCALES` = sr, en (all in shared).
- `RestaurantSummaryDto` (memberships in `/me` and auth responses) carries `city`, `logoUrl`, `primaryColor`; `SuperadminRestaurantDto`
  carries `city`, `logoUrl`, `primaryColor` too, so switchers and the superadmin index can render branded tiles without extra requests.
- Effective availability = `isAvailable && (unavailableUntil == null || unavailableUntil < now)`; DTOs expose `isEffectivelyAvailable`.
  `PATCH /items/:id/availability`: `{available:true}` clears, `{available:false}` is indefinite,
  `{available:false, until}` sets `isAvailable=true` + `unavailableUntil` (`'tomorrow-06:00'` = next 06:00 in the restaurant time zone).
- `restaurants.updated_at` is bumped (`touchRestaurant()`) by every service that changes categories, items, variants or tables.
- Item variants are nested in item create/update payloads with replace-all semantics.
- Reorder endpoints (`PUT .../reorder`) accept `{ ids: [...] }` or a bare array; send the complete ordered list
  (for items: all items of one category).
- Timestamps in DTOs are ISO strings. Time-zone math uses `utils/time.ts` (Intl based, no date library).

## Auth

- Access token: HS256 JWT (`JWT_ACCESS_SECRET`, default 15 min) in `Authorization: Bearer`.
- Refresh token: opaque random token, stored as SHA-256 hash in `auth_tokens` (type `refresh`), sent as httpOnly cookie
  (`tabla_refresh`, path `/api/auth`, SameSite=Lax, Secure in production). `POST /api/auth/refresh` rotates it;
  reuse of a consumed token revokes all of the user's sessions.
- Magic links and password resets are one-time `auth_tokens` rows (15 min / 1 h). `utils/mailer.ts` picks the provider from
  `MAIL_PROVIDER`: `log` (dev/test; messages are also collected in `outbox`) or `resend` (Resend REST API with `RESEND_API_KEY`,
  no SDK). Links point at `APP_URL/auth/magic?token=` and `APP_URL/auth/reset?token=`.
- `POST /register` creates user + restaurant (slug from the name, made unique with `-2`, `-3`, …) + owner membership; 14-day trial.

## Public menu

- `GET /api/public/:slug/menu?locale=sr` or, host-based, `GET /api/public/menu` with `Host: {slug}.<suffix>` where the suffix
  comes from `PUBLIC_MENU_BASE_URL` (`http://{slug}.localhost:5174` in dev, `https://{slug}.otvori.menu` in prod).
- Only when `published_at` is set and status ≠ `suspended`; hidden categories and categories without items are omitted;
  unavailable items are included with `isAvailable:false`. Response has `Cache-Control: public, max-age=30`.
- `POST /api/public/:slug/events` with `{type:'scan', sessionId, tableNumber?}` or `{type:'item_view', sessionId, itemId}`
  (rate-limited per IP). A repeated scan from the same session within 30 min is ignored; item views attach to the session's
  latest scan (one is created if missing). Table QR codes encode `PUBLIC_MENU_BASE_URL/t/<tableNumber>` (`utils/public-url.ts`;
  the menu app still accepts the older `?t=<tableNumber>`).

## Table ordering (Phase 6)

Guests send orders / call the waiter from the public menu; staff handle them on their phone in the CMS. No payment:
orders are messages to staff, not transactions. API code lives in `apps/api/src/modules/ordering/` (`service.ts` domain,
`controller.ts` guest + staff handlers, `router.ts` staff routers, `events.ts` in-process bus, `sse.ts` stream + token
guard, `expiry.ts` interval job); guest routes are mounted in `modules/public/router.ts`, table blocking in `modules/tables`.

- **Restaurant flags** (`PATCH /admin/restaurants/:id`, owner only): `orderingMode` = `off` (default, view-only) |
  `call_waiter` (call/bill buttons only) | `order` (guests order; calls included); `orderingPaused` + `pausedMessage`
  (≤ 120 chars). Paused = the menu shows the banner and hides "+" / cart, `POST /orders` → 409 `ORDERING_PAUSED`;
  calls keep working. Both flags are in `RestaurantDto` and in `PublicMenuDto.restaurant`; because the public menu is
  cached for 30 s (HTTP + query staleTime) a mode/pause change reaches open guest menus within about a minute, while
  the API enforces it immediately (a stale client gets the 409/403 and refetches).
- **Entities**: `orders` (restaurant_id, table_id SET NULL + `table_number` snapshot, session_id, status, `number` =
  daily sequential per restaurant in its time zone (assigned under `SELECT … FOR UPDATE` on the restaurant row, shown as
  "#142"), guest_name ≤ 40, note ≤ 200, total_cents (always computed server-side; the client's total is ignored), locale,
  rejected_reason, created/updated/accepted/delivered/closed_at), `order_items` (menu_item_id / variant_id SET NULL,
  `name` JSONB snapshot in the guest locale + restaurant default locale, variant_name, unit_price_cents, quantity,
  line_note ≤ 80, sort_order), `service_requests` (table_id CASCADE + table_number, type `call_waiter|bill`,
  status `open|done`, done_at), `tables.blocked_until`. Indexes on (restaurant_id, status, created_at) and a partial
  index on `new` orders for the expiry job. Orders never touch `restaurants.updated_at` (they are not menu content).
- **Statuses** `ORDER_STATUSES` and the transition table `ORDER_TRANSITIONS` / `canTransitionOrder()` in
  `packages/shared/src/ordering.ts`: `new → accepted | rejected | cancelled | expired`, `accepted → delivered | rejected`,
  final states never change. Guests may only `cancel` while `new`; staff set `accepted | delivered | rejected`
  (`STAFF_ORDER_STATUSES`; `rejectedReason` ≤ 200 only with `rejected`, the guest sees it); `expired` is set by
  `expireStaleOrders()` (every minute via `startOrderExpiryJob()` in `index.ts`, plus lazily when a guest reads a stale
  `new` order) after `ORDERING_LIMITS.expiryMinutes` = 20. Staff status changes are conditional updates on the status
  that was read, so two waiters cannot both accept. Illegal moves → 409 `INVALID_TRANSITION`.
- **Guest API** (`/api/public/:slug/…` and the host-based form; every route needs `X-Session-Id: <uuid>` = the menu
  app's `sessionStorage['tabla.session']`, else 400 `SESSION_REQUIRED`): `POST /orders` `{ tableNumber, items:
  [{ itemId, variantId?, quantity 1–20, note? }] (1–30 lines), note?, guestName?, locale? }` → 201 `PublicOrderDto`;
  `GET /orders/:id` and `POST /orders/:id/cancel` only for the matching session (otherwise 404); `POST /requests`
  `{ type, tableNumber }` → 201 (or 200 when the same type is already open for that table: its `updatedAt` is bumped,
  one card per table and type). Validation at submit: the table must exist (404 `TABLE_NOT_FOUND`) and not be blocked
  (423 `TABLE_BLOCKED`), items must belong to the restaurant, sit in a visible category and be effectively available
  (409 `ITEM_UNAVAILABLE` with `details.itemIds`), a variant is required when the item has variants and must belong to
  it (400), mode must allow it (403 `ORDERING_DISABLED`), max 3 open (`new`/`accepted`) orders per session (409
  `TOO_MANY_OPEN_ORDERS`). Responses are `Cache-Control: no-store`.
- **Staff API** (`/api/admin/restaurants/:id/…`, membership, both roles): `GET /orders?status=new,accepted&since=`
  (no params = open orders ∪ today's, oldest first, `expiresAt` set while `new`), `GET /orders/:id`, `PATCH /orders/:id`
  `{ status, rejectedReason? }`, `GET /requests?status=open` (no params = open ∪ today's), `PATCH /requests/:id`
  `{ status: 'done' }` (idempotent), `POST /tables/:id/block` (30 min) / `DELETE /tables/:id/block`; `TableDto.blockedUntil`
  is null once the block has passed. `GET /analytics` gained `ordering` (orders, accepted rate %, median seconds to
  accept, ordered revenue = accepted + delivered; guest-cancelled orders are excluded everywhere).
- **Real-time**: `POST /admin/restaurants/:id/sse-token` → `{ token, expiresIn: 300 }` (HS256 JWT `type: 'sse'`,
  `rid` = restaurant), then `GET /admin/restaurants/:id/events?token=` (EventSource cannot send headers; the guard
  re-checks the membership on connect and is mounted **before** the bearer-protected scoped router). Events:
  `order.created`, `order.updated`, `request.created`, `request.updated` (payload = the staff DTO) and `ping` every
  25 s; the stream sends `retry: 3000`, `Cache-Control: no-cache, no-transform` (Caddy's `encode` honours
  `no-transform`, so the stream is never compressed/buffered; `deploy/Caddyfile*` also proxy `…/events` with
  `flush_interval -1`), `X-Accel-Buffering: no`, and flushes headers immediately. Nothing in the API compresses
  responses. Fan-out is the in-process `orderingBus` (one `EventEmitter`, channel per restaurant): **single API
  instance only** — with several instances `publish()` would also go to Redis pub/sub and every instance would forward
  what it receives to its own streams; the expiry job would run on one instance. Shutdown ends all streams first so
  `server.close()` can finish; clients reconnect.
- **Abuse controls** (`middleware/rate-limit.ts`, in-memory, skipped in tests): `POST /orders` 10 per session and 60 per
  IP per 10 min, `POST /requests` 8 per session and 60 per IP per 10 min, plus the 3-open-orders cap and the staff
  table block (423 "Ordering from this table is temporarily disabled. Please call the waiter."). All limits are in
  `ORDERING_LIMITS` (shared).
- Seed: Kafeterija Dorćol runs in `order` mode with a week of orders (mostly delivered, some rejected/expired/
  cancelled), two `new` + one `accepted` right now and two open requests; Bistro Zemun is `call_waiter`.

## Uploads / storage

- multer (memory) → sharp. Logo: 512×512 PNG (`fit: contain`, transparent). Item image: 800×800 WebP (`fit: cover`).
- `utils/storage.ts`: S3-compatible driver (DigitalOcean Spaces) when `S3_BUCKET` + keys are set, otherwise local
  `UPLOADS_DIR` served at `API_URL/uploads`. Keys: `restaurants/<id>/logo-<ts>.png`, `restaurants/<id>/items/<itemId>-<ts>.webp`.
- QR: `qrcode` (PNG/SVG); A4 QR sheet via pdfkit with DejaVu Sans (needed for č/ć/đ/š/ž).

## Public menu app (`apps/menu`)

Stack: React 19, Vite 8, TypeScript strict, Tailwind v4 via `@tailwindcss/vite`, React Router 8 (declarative `BrowserRouter`,
`useSearchParams`), TanStack Query 5. No UI kit, icon or animation library; the few SVGs are inlined in `components/icons.tsx`.
Budget: initial JS ≈ 108 KB gzipped (react-dom alone is 64 KB); the item sheet, the cart sheet and the order status page
are lazy chunks (the sheets are prefetched when idle).
Lighthouse mobile on the seeded menu: 100/100/100/100.

### Running it on this machine
```bash
npm run dev -w @qr-menu/api            # apps/api/.env → PORT=3100, Postgres on 5433 (see .env; seed with `npm run seed`)
npm run dev -w @qr-menu/menu           # http://localhost:5174/t/7  ·  http://kafeterija.localhost:5174/t/7  ·  /r/bistro-zemun
```
`apps/menu/.env` (gitignored, copy from `.env.example`): `VITE_API_URL=http://localhost:3100`, `VITE_DEFAULT_SLUG=kafeterija`.
The dev and preview servers listen on 5174 and proxy `/api` to `API_PROXY_TARGET || VITE_API_URL` with the Host header preserved
(`changeOrigin: false`), so `{slug}.localhost:5174` lets the API resolve the slug from the Host exactly like `{slug}.otvori.menu`.
Useful URL bits: `/t/7` table (legacy `?t=7` still works), `?lang=en`, `?item=<itemId>` opens the sheet, `?cart=1` the cart,
`/order/<orderId>` the status page (only readable with the session that placed it).

To reproduce the production same-origin setup (and the Lighthouse run): `VITE_API_URL= npx vite build` then
`API_PROXY_TARGET=http://localhost:3100 npx vite preview --port 4174` in `apps/menu`, open `http://kafeterija.localhost:4174/t/7`,
and run `npx lighthouse <that url>` (mobile is Lighthouse's default).

### Conventions
- **Restaurant resolution** (`lib/tenant.ts` → `resolveTenant`): `/r/:slug` path → host subdomain (`kafeterija.otvori.menu`,
  `kafeterija.localhost`; apex/`www`/IPs/`localhost` give nothing) → `VITE_DEFAULT_SLUG` → none. With a slug the app calls
  `/api/public/:slug/menu`; with none, or when the slug came from the host *and* the API is same-origin, it calls the host-based
  `/api/public/menu` — the URL the production build preloads (`<link rel="preload" as="fetch">`, emitted only when `VITE_API_URL` is empty).
- **API base** (`lib/api.ts`): dev → always same origin (Vite proxy); production build → `VITE_API_URL`, or same origin when empty.
  Errors are `ApiError(status, code)` / `NetworkError`; `menuErrorKind()` maps them to the offline-screen copy
  (`network`, `not-published` = 404 `MENU_NOT_PUBLISHED`, `not-found`, `error`).
- **Shared package**: types (`PublicMenuDto`, …), `pickLocale`, constants come from `@qr-menu/shared`; nothing is redefined.
  Zod never ships to the browser: `publicMenuDtoSchema` is only used behind `import.meta.env.DEV` (shared is `sideEffects: false`).
- **Tokens & theming** (`styles.css`, `lib/theme.ts`): raw tokens on `:root` — `--bg --surface --ink --muted --line --line-strong
  --chip --placeholder --scrim --accent --on-accent` — dark values under `:root[data-theme="dark"]` and, for `theme: auto`,
  under `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`. `@theme inline` maps them to utilities
  (`bg-canvas text-ink text-muted border-line border-line-strong bg-chip bg-surface bg-placeholder bg-scrim bg-accent text-on-accent`).
  `applyTheme(theme, primaryColor)` sets `data-theme` (removed for auto) plus `--accent-light` = primaryColor and `--on-accent-light`
  (white vs dark ink by luminance). On dark surfaces CSS lifts the accent with `oklch(from …)` (50 % toward white, 85 % chroma), which
  reproduces the design's light/dark accent pairs. The accent is only used for chips, the logo tile, the retry button and focus rings,
  never for body text. Light/dark palettes, type sizes and spacing come from `design/Tabla Guest Menu.html`.
- **Fonts**: Google Fonts (Figtree 400/500/600, Libre Baskerville 400/700, `display=swap`) via preconnect + a non-blocking stylesheet
  in `index.html`. Serif = restaurant name, category headings, item names (400 in rows, 700 in the sheet) and the "otvori" wordmark in the footer (400).
- **index.html** carries a static copy of `MenuSkeleton` inside `#root` (first paint without JS; React replaces it) and the build
  inlines the stylesheet (`inlineCss` plugin in `vite.config.ts`). Keep the static skeleton in sync when `MenuSkeleton` changes.
- **i18n** (`lib/i18n.ts`): UI strings for `sr`/`en` only; menu content arrives resolved from the API. UI locale =
  `pickLocale(?lang ?? localStorage['tabla.lang'], restaurant.supportedLocales, restaurant.defaultLocale)`; the switcher writes
  `?lang` (replace) + localStorage, which changes the query key `['menu', tenantKey, locale]` and refetches (`keepPreviousData`).
  Prices: `formatPrice(cents, currency, locale)` — amount first, currency last ("290 RSD", "1.290,50 RSD"), cents only when non-zero;
  variants show `od/from <lowest variant>`. Serbian plurals via `Intl.PluralRules` ("1 stavka / 2 stavke / 5 stavki").
- **Events** (`lib/events.ts`): `scan` once per tab session and table (`sessionStorage['tabla.scan.<tenant>.<table>']`; the API also
  de-duplicates for 30 min), `item_view` when the sheet opens; `fetch(..., { keepalive: true })`, errors swallowed. Session id = uuid in
  `sessionStorage['tabla.session']`; table = the `/t/:table` route param (fallback `?t=`) persisted in `sessionStorage['tabla.table.<tenant>']`.
- **Sheet**: opened by pushing `?item=<id>` with `state.sheet`, so Back closes it (direct links close with `replace`). Modal dialog:
  body scroll locked (`position: fixed`), focus trapped, Escape closes, focus returns to the row. Unavailable rows render as a
  non-interactive `div` at 45 % opacity with "Danas nije dostupno / Not available today".
- **Category bar**: `useActiveCategory` observes sections with `rootMargin: -61px 0px -55% 0px` (61 = sticky bar height, sections have
  `scroll-mt-[61px]`); taps lock the observer for ~0.8 s so the chip does not flicker; reaching the page bottom selects the last category.
- The last loaded header (name, logo, accent, theme) is cached per tenant in `localStorage['tabla.tenant.<tenant>']` so the skeleton
  and offline screens are branded and returning guests get no light→dark flash.
- **Ordering** (design/ordering-menu.html A1–A6; gated by `restaurant.orderingMode` / `orderingPaused` from the menu payload):
  `order` mode = "+" on available rows (direct add + toast, or the item sheet with variant radio, quantity stepper 1–20 and line
  note ≤ 80), the fixed accent cart bar and the cart sheet (`?cart=1` pushed with `state.sheet` like `?item=`): steppers, order
  note ≤ 200, optional name ≤ 40, inline table field only when no table is known, "Pošalji konobaru". `call_waiter` and `order`
  modes show the call bar (`OrderingBar`: "Pozovi konobara" / "Račun", 60 s cooldown per type persisted in
  `sessionStorage['tabla.call.<tenant>.<type>']`, "Konobar je obavešten" chip); without a table the buttons first open
  `TablePrompt`. Paused (`order` mode only) = banner with `pausedMessage` (or the default copy), no "+", no cart bar, calls still
  work. The cart is `sessionStorage['tabla.cart.<tenant>']` (`lib/cart.ts`: ids + quantity + note only; `priceCart()` re-prices
  against the live menu and drops lines whose item vanished; unavailable lines are dimmed and left out of the payload).
  `POST /orders` goes through `lib/api.ts` with `X-Session-Id`; on success the cart is cleared, the order is remembered in
  `sessionStorage['tabla.orders.<tenant>']` (`lib/orders.ts`, newest first, feeds the "Tvoje narudžbine" header link with the
  open count) and the app navigates (replace) to `/order/:id` (`/r/:slug/order/:id` in the path form). `pages/OrderPage.tsx`
  polls `GET /orders/:id` every 5 s until a final status, renders the three-step progress, the rejection reason, "Otkaži"
  (two-tap confirm, only while `new`), "Naruči ponovo" (re-fills the cart from `menuItemId`/`variantId` and opens it),
  "Pozovi konobara" with the same cooldown, "Nazad na meni", and the session's earlier orders. API error codes map to copy
  in `orderingErrorMessage()` (`ORDERING_PAUSED` shows the venue's own message). Status colours `text-ok`/`bg-ok-soft` and
  `text-bad`/`bg-bad-soft` reuse the vegan/spicy tag tokens; `.pulse-dot` is the live indicator. The accent is additionally
  used for the "+" glyph and the "Tvoje narudžbine" link (controls, not body text).
- Scripts: `npm run dev|build|preview|typecheck|test -w @qr-menu/menu` (same for `@qr-menu/cms`). Root `npm run build` builds shared → api, menu, cms.

## Admin CMS app (`apps/cms`)

Stack: React 19, Vite 8, TypeScript strict, Tailwind v4 (`@tailwindcss/vite`), React Router 8 **data router** (`createBrowserRouter`
in `router.tsx`, every page is a `lazy` chunk, tests mount the same `routes` with `createMemoryRouter`), TanStack Query 5,
react-hook-form + `@hookform/resolvers/zod` with the schemas from `@qr-menu/shared`, `@dnd-kit/core` + `sortable` for reordering.
No UI kit; icons are inline SVGs traced from the design (`components/icons.tsx`). Design sources: `design/Tabla Admin Panel (1).html`
and `design/ordering-cms.html` (waiter screen).

### Running it on this machine
```bash
npm run dev -w @qr-menu/api            # PORT=3100 (apps/api/.env); APP_URL=http://localhost:5173 so magic links land in the CMS
npm run dev -w @qr-menu/cms            # http://localhost:5173 — Vite proxies /api to VITE_API_URL (apps/cms/.env, gitignored)
```
`apps/cms/.env.example`: `VITE_API_URL=http://localhost:3100` (dev proxy target; production builds call it directly, empty =
same origin), optional `VITE_PUBLIC_MENU_BASE_URL`. Seed logins: `ana@kafeterija.rs` / `tabla1234` (owner), `admin@otvori.menu` /
`admin1234` (superadmin, no memberships → lands on `/superadmin`).

### Auth flow (`lib/api.ts`, `lib/auth.tsx`)
- Access token lives only in memory (`tokenStore`); the refresh token is the httpOnly cookie the API sets (`credentials: 'include'`).
- `api()` adds `Authorization: Bearer`, and on a 401 calls `POST /api/auth/refresh` **once** (single-flight) and retries; if that
  fails too it clears the token and calls the unauthorized handler → `AuthProvider` goes `anonymous` → `RequireAuth` renders
  `<Navigate to="/login" state={{ from }}>` (no `from` after an explicit sign-out). Public auth endpoints pass `auth: false`.
- `AuthProvider` status: `restoring | anonymous | authenticated`. On load it restores silently via the cookie only when
  `localStorage['tabla.cms.remember']` ("Remember me", default on) or `sessionStorage['tabla.cms.session']` (same tab) is set —
  that is how "Remember me" works, since the API cookie always lives 30 days. `signIn(session, remember)` after
  login/register/magic link/reset; `signOut()` posts `/logout` and clears the QueryClient; `refreshMe()` re-reads `/api/auth/me`.
- Auth screens: `/login` (password, "Email me a magic link"), `/register` (creates user + venue and opens its empty menu),
  `/forgot`, `/auth/magic?token=`, `/auth/reset?token=` (the paths the API mailer links to).

### Routing & active restaurant
- `/` → `HomeRedirect`: last used venue (`localStorage['tabla.cms.lastRestaurant.<userId>']`) → first membership → `/superadmin`
  (superadmins) → `/no-venue`. `/r/:restaurantId/*` → `RestaurantLayout` checks the membership (superadmins pass as owners), loads
  `GET /admin/restaurants/:id`, stores it as last used and provides `useRestaurantContext()` = `{ restaurant, role, isOwner, isMobile }`.
- Screens: `menu` (`?c=<categoryId>` selected category, `?item=<id>|new` opens the editor), `menu/unavailable`, `tables`,
  `orders` (only while `orderingMode ≠ 'off'`), `branding`, `analytics` (`?range=7d|14d|30d`), `settings`, `more` (mobile),
  index = Home on phones / redirect to `menu` otherwise.
  `/superadmin` lists every venue (`SuperadminLayout` keeps the last venue in the switcher); clicking a row opens `/r/:id/menu`.
- Venue switcher (`Sidebar` dropdown, `VenueSheet` on phones): tile in the venue's `primaryColor`/logo, city as secondary text,
  and “+ Add a venue” at the end → `AddVenueModal` (name → `POST /api/admin/restaurants` → `refreshMe()` → `/r/:id/menu`).
  `canAddVenue(me)` = owner of a venue on plan `pro` or superadmin; everyone else sees the row disabled with “Available on Pro”.
  Superadmin rows use the same tile (`primaryColor`, `logoUrl`) and show the city.
- Owner-only UI (settings/branding edits, Publish, Delete) is gated with `isOwner`; the API enforces it anyway.
- **Orders / waiter screen** (design/ordering-cms.html B1–B9, English like the rest of the admin): `OrderingProvider`
  (`components/orders/OrderingProvider.tsx`, mounted by `RestaurantLayout`) is idle while `orderingMode === 'off'`; otherwise it
  loads `['orders', rid]` + `['requests', rid]`, opens the SSE stream (`POST /sse-token` → `EventSource(…/events?token=)`,
  fresh token on every reconnect, exponential backoff ≤ 30 s, a watchdog that reconnects after 60 s without a `ping`, refetch on
  `open` and on `visibilitychange`) and applies `order.*` / `request.*` events to the query cache (`upsertOrder` / `upsertRequest`,
  newer `updatedAt` wins). While the stream is down both lists poll every 10 s and the pill says "Reconnecting…". `useOrdering()`
  gives `{ enabled, orders, requests, counts: { calls, newOrders, inProgress, open, badge }, connected, muted, setMuted }` anywhere
  under the venue; outside the provider it is the disabled default. Badge = `new` orders + open calls: on the sidebar / rail
  "Orders" item, the phone tab bar (`[Menu, Tables, Orders, More]`, Analytics moves under More) and the document title
  (`(2) Orders · Kafeterija Dorćol`, set in `AppShell`). `order.created` / `request.created` play `public/sounds/order.wav`
  (generated by `scripts/make-sound.mjs`, cached by the service worker) unless muted (`localStorage['tabla.cms.ordersMuted']`),
  vibrate where supported and show a system notification when the tab is hidden; the permission prompt is requested once, from
  the first tap on the Orders screen. `pages/OrdersPage.tsx`: Calls / New / In progress groups (oldest first), accept / deliver /
  done, the reject sheet with reason chips in the venue's **default menu locale** (the guest reads them; `components/orders/reasons.ts`)
  plus an optional message, the collapsed "Today" history with totals, the empty state, and the desktop three-column board. Home
  gets the open-count card, Settings the owner-only "Ordering" card (`components/settings/OrderingCard.tsx`: mode, pause,
  paused message ≤ 120), Tables "Block 30 min" / "Blocked until hh:mm · Unblock" (both roles) with "#142 new" / "1 call" tags,
  Analytics the "Ordering" card (orders, accepted %, median time to accept, ordered revenue). Query keys `['orders', rid]`,
  `['requests', rid]`; tests stub `EventSource` with `MockEventSource` from `test/helpers.tsx` (jsdom has none, so without the
  stub the provider runs in polling mode).

### Layout & tokens
- `≤640px` = phone (bottom tab bar, full-screen `Sheet`s, swipe rows, `useIsMobile()`); `641–1024px` = 64px icon rail with tooltips
  (`useIsCompact()`); `>1024px` = 240px sidebar. Custom Tailwind breakpoints `tab` (641px) and `wide` (1025px); `max-tab:`/`max-wide:` for the inverse.
- Tokens on `:root` (`--bg --surface --ink --ink-2 --ink-3 --muted --faint --line --line2 --line-strong --accent --on-accent
  --accent-soft`) mapped by `@theme inline` to `bg-canvas text-ink text-ink-2 text-muted text-faint border-line bg-line-2
  bg-accent text-on-accent …`. The accent is always the otvori plum `#7A3E48`; the tenant's `primaryColor` is only used by
  `LogoTile` and the Branding `PhonePreview`. The dark variant (`#141416 / #1C1C20 / accent #B86F7C`) applies via
  `prefers-color-scheme: dark` **on phone widths only** (design frame M4). `a` color is in `@layer base` so utilities override it.
- `--sidebar-w` on `<html>` lets the `Drawer` scrim stop at the sidebar edge (drawers/modals/sheets portal to `<body>`).

### UI primitives (`components/ui`)
`Button` (primary/secondary/ghost/danger/danger-ghost/accent-text; sm 32 · md 36 · lg 40 · xl 44 · mobile 48), `IconButton`,
`Field` + `Input`/`Textarea`/`Select`/`AffixInput` (price with currency suffix), `Switch` (+ presentational `SwitchTrack` for
tappable rows; sizes sm 36×20 / md 40×24 / lg 48×28), `Chip` (allergen glyph pills, ink-filled tag pills), `MiniTag`, `Badge`,
`StatusPill`, `Segmented`, `Drawer` (480px, 420px ≤1024), `Sheet` (`full` M7-style or `bottom`), `Modal` + `ConfirmModal`,
`ToastProvider`/`useToast`, `Skeleton`, `EmptyState` (`page`/`inline`), `Tooltip`, `Menu`. All overlays use `useFocusTrap`
(Tab loop, Escape, focus restore, `[data-autofocus]`) and `useLockBodyScroll`.

### Data layer (`lib/queries.ts`)
Query keys: `['restaurant'|'categories'|'items'|'tables', rid]`, `['analytics', rid, range]`, `['qr', rid, tableId, fmt]`,
`['superadmin','restaurants', query]`. Items are fetched for the whole restaurant once and filtered per category. Optimistic
updates (with rollback + `onSettled` invalidate): availability switch, category hide/show, category/item reorder. Everything else
sets the returned DTO into the cache and invalidates. QR images and the PDF come through `apiBlob()` (bearer token) and object URLs.

### Item editor
`useItemForm` (RHF + `zodResolver(createItemSchema)`, also used for updates) feeds `ItemFields`, rendered by `ItemDrawer`
(desktop) and `ItemSheet` (phone). The default-locale tab edits everything; the other locale edits only name/description.
Prices are typed in major units (`PriceInput` ↔ `priceCents`), variants via `useFieldArray`. A new photo is cropped client-side
(`lib/crop.ts`, square, zoom 1–2) and uploaded to `POST /items/:id/image` after the item is saved. `isAvailable` is only sent when
the switch was touched so a "back at 06:00" state survives an unrelated edit. Closing a dirty form asks to discard.

### Mobile specifics
`SwipeRow` (pointer events, −144px reveal for Edit/Delete), press-and-hold grip reorder (dnd-kit `PointerSensor` delay), FAB,
`UnavailablePage` (one switch per item: off → `{available:false, until:'tomorrow-06:00'}`, on → `{available:true}`, "Turn all on"),
Tables rows expand with Share (`navigator.share`, clipboard fallback), Download and the ordering block, `VenueSheet` switcher,
`InstallHint` (`beforeinstallprompt`, iOS Share hint; dismissal in localStorage). PWA: `public/manifest.webmanifest`, `public/icons/*`,
`public/sw.js` (app shell + the alert sound, never `/api`), registered in production builds only.

### Tests (`apps/cms/test`)
vitest + Testing Library in jsdom. `helpers.tsx` has DTO fixtures, `mockApi(state, override?)` (default answers for every
endpoint the shell needs, `statefulItems()` persists availability changes across refetches), `setViewport('desktop'|'tablet'|'mobile')`
(matchMedia stub) and `renderApp(route, { viewport, authenticated })` which mounts the real route tree; an authenticated render
sets the session flag and lets the app restore through the mocked `POST /api/auth/refresh`.

## Marketing site (`apps/web`)

Stack: Astro 7 (`output: 'static'`, `trailingSlash: 'always'`, `compressHTML`, stylesheet inlined), TypeScript strict, Tailwind v4
via `@tailwindcss/vite`, `@astrojs/sitemap`. **No React**: the only interactivity (SR/EN switch, monthly/yearly pricing, FAQ accordion,
phone nav) is plain TypeScript in `src/scripts/*.ts` (`init*(root)` functions, < 1 KB gzipped, inlined by Astro). Design source:
`design/otvori-brand.html` for the brand and the Phase 5 export `design/salveta.menu website.html` for the page structure
(Claude Design exports: markup in the `__bundler/template` script tag, fonts base64 in `__bundler/manifest`). Lighthouse mobile on the seeded preview: 100/100/100/100 (sr), 99/100/100/100 (en).

```bash
npm run dev -w @qr-menu/web          # http://localhost:4321  ·  /en/  ·  /print/qr-card/?venue=…&table=7&qr=https://…
npm run build|preview|typecheck|lint|test -w @qr-menu/web
npm run icons -w @qr-menu/web        # regenerates public/favicon.* + icons/ from the glyph (sharp)
npm run og -w @qr-menu/web           # renders public/og-sr.png / og-en.png with headless Chrome (CHROME_PATH)
```

- `src/config.ts` holds **every outbound link** (sign in, register, demo menu, quote mailto, terms/privacy), contact, brand constants and
  the RSD prices (`pricing.starter|pro.monthly|yearly`). Change links there only.
- Routes: `/` (Serbian, default, `sr-Latn`) and `/en/` (`src/pages/en/index.astro`), both render `components/Landing.astro`; `/404.html`;
  `/print/qr-card/` (noindex, excluded from the sitemap). Astro `i18n` config: `defaultLocale: 'sr'`, `prefixDefaultLocale: false`.
- Copy lives in `src/i18n/sr.ts` (verbatim from the design, source of truth) and `src/i18n/en.ts`, typed by `Dictionary` in
  `i18n/types.ts`; `t(locale)`, `localePath()`, `otherLocale()`, `formatRsd()` (sr-RS grouping in both locales, "1.490").
- `layouts/Base.astro`: title/description per locale, canonical, `hreflang` sr/en/x-default, Open Graph + Twitter (`/og-{locale}.png`,
  1200×630), JSON-LD `Organization` + `SoftwareApplication` with the two RSD offers, font preloads (latin + latin-ext on sr), optional
  analytics tag (`PUBLIC_ANALYTICS_SRC` + `PUBLIC_ANALYTICS_DOMAIN`, cookieless → no cookie banner). `SITE_URL` (build env) sets `site`.
- Language switch: `<a data-lang-switch href="/en/">`; on click `scripts/locale.ts` appends the hash of the section currently in view
  (`#kako #dobijas #cene #pitanja`) so the other locale opens at the same section. Works without JS as a plain link.
- Styling (`src/styles/global.css`): self-hosted variable woff2 fonts from the design in `public/fonts` (Figtree, Libre Baskerville
  regular/italic, Caveat subset to the napkin caption) with `font-display: swap` and metric-matched fallbacks (`size-adjust` etc. → CLS 0).
  `@theme` tokens: `paper #F7F2EB`, `ink`, `muted #71717A` (white cards) / `muted-paper #66666F` (≥ 4.5:1 on paper), `plum #7A3E48`,
  `plum-light/pale/soft`, `dark`. Utilities: `tex-dark` / `tex-light` (the design's feTurbulence grain as a tiled data-URI SVG, opacity
  .16/.14), `fold-card` (top-right folded corner; `--fold-bg` = surface behind the card), `napkin` (paper gradient with the bottom-right
  cut; `--napkin-bg`), `btn btn-plum|outline|paper|white`. Mobile = design frame 390 (default classes), desktop = frame 1440 (`lg:`).
- Decorative scenes (hero table, editor mocks, napkin stack) are HTML/CSS/SVG exactly like the design; `QrMock.astro` is the fake QR
  pattern. There are no raster images apart from the OG PNGs, so `astro:assets` is not used.
- `/print/qr-card/`: 90×90 mm napkin card (`@page { size: 90mm 90mm; margin: 0 }`), params `venue`, `logo` (image URL), `table`,
  `qr` (URL to encode, rendered client-side with `qrcode-generator` as SVG) or `qrImage` (ready image URL), `url` (short link text),
  `lang`. Headless Chrome `--print-to-pdf` yields a single 255.12 × 255.12 pt page.
- Tests (`test/*.test.ts`, vitest + jsdom): pricing toggle, locale helpers + language switch, FAQ accordion, phone nav.
  `typecheck` = `astro check`; `lint` = prettier check.
- Deploy: `deploy/Dockerfile.caddy` builds it with `SITE_URL=https://$DOMAIN` into `/srv/web`, served at the apex; `www.` redirects to the apex.

## Deployment (`deploy/`)

Target: one 1 GB DigitalOcean droplet (Ubuntu 24.04, fra1) running `deploy/docker-compose.yml`: `postgres:16-alpine`
(tuned: `shared_buffers=128MB`, `max_connections=40`, limit 256m), `otvori-api` (limit 256m) and `otvori-caddy` (limit 128m,
the three static builds inside). **Images are built by `.github/workflows/deploy.yml`** (after CI succeeds on `main`) and pushed to
`ghcr.io/<owner>/otvori-api|otvori-caddy:<git short sha>` + `latest`; the droplet only runs `deploy/deploy.sh <tag>`
(`compose pull && up -d`, waits for the API health check, `image prune`). Rollback = `deploy.sh <older tag>`.

- Runtime config is `deploy/.env.prod` (gitignored; `.env.prod.example` documents every variable; secrets from
  `openssl rand -base64 48`, the Postgres password `openssl rand -hex 32` because it is embedded in `DATABASE_URL`).
- Caddy (`deploy/Caddyfile`): apex = marketing site, `www` → apex, `app.` = CMS SPA + `/api` proxy, `api.` = API, `*.` = menu SPA +
  `/api` proxy; every certificate (incl. the wildcard) via Cloudflare DNS-01 (`CF_API_TOKEN`); zstd/gzip, HSTS and friends,
  `/assets` + `/_astro` immutable, `index.html`/`sw.js` `no-cache`. `Caddyfile.local` = same routes with `local_certs` for the laptop
  stack (`docker-compose.local.yml`, `DOMAIN=localhost`).
- API in production: `TRUST_PROXY=1`, CORS allowlist = `APP_URL` + `CORS_ORIGINS` (apex, www) + every `{slug}.DOMAIN`, secure
  httpOnly cookies, auth/public-event rate limits, JSON logs, graceful SIGTERM (10 s), migrations on start, `APP_VERSION` = image tag.
- Storage: Spaces bucket `otvori` (fra1, CDN): `restaurants/<id>/…` public-read via `S3_PUBLIC_URL` (CDN), `backups/` private.
  `deploy/backup.sh` (cron, `pg_dump | gzip`, keeps 14 days) and `deploy/restore.sh` use the aws CLI with the Spaces endpoint.
- `deploy/README.md` is the full checklist (DNS records, Spaces, droplet, swap, Docker, secrets, first deploy, superadmin, backups,
  rollback, logs); `deploy/TODO-manual.md` the one-time manual steps.

## Testing

- Root `npm test` = `turbo run test --concurrency=2`: with all five suites in parallel the CMS Testing Library queries time out.
- `apps/api`: vitest + supertest against a real Postgres: `test/global-setup.ts` creates the test DB and runs migrations once;
  `test/setup.ts` truncates all tables before each test. Files run sequentially (`fileParallelism: false`).
- `apps/cms`: vitest + Testing Library in jsdom (`npm test -w @qr-menu/cms`); see "Admin CMS app → Tests".
- `apps/menu`: vitest + Testing Library in jsdom (`npm test -w @qr-menu/menu`). `test/setup.ts` stubs `IntersectionObserver`
  (drive it with `MockIntersectionObserver.instances[i].trigger(...)`), `scrollIntoView`/`scrollTo`, and clears storage;
  `mockFetch(handler)` replaces `fetch` per test and `renderMenu(route)` mounts the app in a `MemoryRouter` with a fresh QueryClient.
- Seed credentials: superadmin `admin@otvori.menu` / `admin1234`; demo owner `ana@kafeterija.rs` / `tabla1234`
  (restaurant "Kafeterija Dorćol", slug `kafeterija`); other demo owners use `tabla1234`.

## When adding an endpoint

1. Add the Zod request schema (and DTO if new) to `packages/shared/src/schemas` / `dto.ts`, export from `index.ts`, rebuild shared.
2. Service function takes `restaurantId` explicitly and filters by it; bump `touchRestaurant()` if menu/table content changes.
3. Controller: parse with the schema, call the service, `res.json(dto)`. Router: mount with the right role guard.
4. Add/extend a test in `apps/api/test`. Run `npm run typecheck` and `npm test`.
