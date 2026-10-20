# salveta (qr-menu) — project conventions

Multi-tenant QR table-menu SaaS for restaurants. npm-workspaces monorepo driven by Turborepo.
Product name: **salveta** (lowercase wordmark, domain `salveta.menu`; the repo, package names, env vars and storage keys keep the
historical `qr-menu` / `tabla` identifiers). Public menus live on `https://{slug}.salveta.menu`, the admin CMS on `app.salveta.menu`,
the API on `api.salveta.menu`, the marketing site on the apex. Brand assets (napkin glyph + "salveta" wordmark in Libre Baskerville 700,
plum `#7A3E48`) come from `design/salveta.menu website.html`; the CMS uses `components/Wordmark.tsx`, the PDF QR sheet draws the same
glyph path with `apps/api/assets/fonts/LibreBaskerville-Bold.ttf`.

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
`components/shell/` (sidebar, top bar, tab bar, layouts, guards), `components/{menu,tables,branding,settings,superadmin}/`,
`lib/` (api, auth, queries, storage, format, screens, crop, download, color), `hooks/`, `styles.css`. Tests in `apps/cms/test`.

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
  comes from `PUBLIC_MENU_BASE_URL` (`http://{slug}.localhost:5174` in dev, `https://{slug}.salveta.menu` in prod).
- Only when `published_at` is set and status ≠ `suspended`; hidden categories and categories without items are omitted;
  unavailable items are included with `isAvailable:false`. Response has `Cache-Control: public, max-age=30`.
- `POST /api/public/:slug/events` with `{type:'scan', sessionId, tableNumber?}` or `{type:'item_view', sessionId, itemId}`
  (rate-limited per IP). A repeated scan from the same session within 30 min is ignored; item views attach to the session's
  latest scan (one is created if missing). Table QR codes encode `PUBLIC_MENU_BASE_URL/t/<tableNumber>` (`utils/public-url.ts`;
  the menu app still accepts the older `?t=<tableNumber>`).

## Uploads / storage

- multer (memory) → sharp. Logo: 512×512 PNG (`fit: contain`, transparent). Item image: 800×800 WebP (`fit: cover`).
- `utils/storage.ts`: S3-compatible driver (DigitalOcean Spaces) when `S3_BUCKET` + keys are set, otherwise local
  `UPLOADS_DIR` served at `API_URL/uploads`. Keys: `restaurants/<id>/logo-<ts>.png`, `restaurants/<id>/items/<itemId>-<ts>.webp`.
- QR: `qrcode` (PNG/SVG); A4 QR sheet via pdfkit with DejaVu Sans (needed for č/ć/đ/š/ž).

## Public menu app (`apps/menu`)

Stack: React 19, Vite 8, TypeScript strict, Tailwind v4 via `@tailwindcss/vite`, React Router 8 (declarative `BrowserRouter`,
`useSearchParams`), TanStack Query 5. No UI kit, icon or animation library; the few SVGs are inlined in `components/icons.tsx`.
Budget: initial JS ≈ 100 KB gzipped (react-dom alone is 64 KB); the item sheet is a lazy chunk prefetched when idle.
Lighthouse mobile on the seeded menu: 100/100/100/100.

### Running it on this machine
```bash
npm run dev -w @qr-menu/api            # apps/api/.env → PORT=3100, Postgres on 5433 (see .env; seed with `npm run seed`)
npm run dev -w @qr-menu/menu           # http://localhost:5174/t/7  ·  http://kafeterija.localhost:5174/t/7  ·  /r/bistro-zemun
```
`apps/menu/.env` (gitignored, copy from `.env.example`): `VITE_API_URL=http://localhost:3100`, `VITE_DEFAULT_SLUG=kafeterija`.
The dev and preview servers listen on 5174 and proxy `/api` to `API_PROXY_TARGET || VITE_API_URL` with the Host header preserved
(`changeOrigin: false`), so `{slug}.localhost:5174` lets the API resolve the slug from the Host exactly like `{slug}.salveta.menu`.
Useful URL bits: `/t/7` table (legacy `?t=7` still works), `?lang=en`, `?item=<itemId>` opens the sheet.

To reproduce the production same-origin setup (and the Lighthouse run): `VITE_API_URL= npx vite build` then
`API_PROXY_TARGET=http://localhost:3100 npx vite preview --port 4174` in `apps/menu`, open `http://kafeterija.localhost:4174/t/7`,
and run `npx lighthouse <that url>` (mobile is Lighthouse's default).

### Conventions
- **Restaurant resolution** (`lib/tenant.ts` → `resolveTenant`): `/r/:slug` path → host subdomain (`kafeterija.salveta.menu`,
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
  in `index.html`. Serif = restaurant name, category headings, item names (400 in rows, 700 in the sheet) and the "salveta" wordmark.
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
- Scripts: `npm run dev|build|preview|typecheck|test -w @qr-menu/menu` (same for `@qr-menu/cms`). Root `npm run build` builds shared → api, menu, cms.

## Admin CMS app (`apps/cms`)

Stack: React 19, Vite 8, TypeScript strict, Tailwind v4 (`@tailwindcss/vite`), React Router 8 **data router** (`createBrowserRouter`
in `router.tsx`, every page is a `lazy` chunk, tests mount the same `routes` with `createMemoryRouter`), TanStack Query 5,
react-hook-form + `@hookform/resolvers/zod` with the schemas from `@qr-menu/shared`, `@dnd-kit/core` + `sortable` for reordering.
No UI kit; icons are inline SVGs traced from the design (`components/icons.tsx`). Design source: `design/Tabla Admin Panel (1).html`.

### Running it on this machine
```bash
npm run dev -w @qr-menu/api            # PORT=3100 (apps/api/.env); APP_URL=http://localhost:5173 so magic links land in the CMS
npm run dev -w @qr-menu/cms            # http://localhost:5173 — Vite proxies /api to VITE_API_URL (apps/cms/.env, gitignored)
```
`apps/cms/.env.example`: `VITE_API_URL=http://localhost:3100` (dev proxy target; production builds call it directly, empty =
same origin), optional `VITE_PUBLIC_MENU_BASE_URL`. Seed logins: `ana@kafeterija.rs` / `tabla1234` (owner), `admin@salveta.menu` /
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
  `branding`, `analytics` (`?range=7d|14d|30d`), `settings`, `more` (mobile), index = Home on phones / redirect to `menu` otherwise.
  `/superadmin` lists every venue (`SuperadminLayout` keeps the last venue in the switcher); clicking a row opens `/r/:id/menu`.
- Venue switcher (`Sidebar` dropdown, `VenueSheet` on phones): tile in the venue's `primaryColor`/logo, city as secondary text,
  and “+ Add a venue” at the end → `AddVenueModal` (name → `POST /api/admin/restaurants` → `refreshMe()` → `/r/:id/menu`).
  `canAddVenue(me)` = owner of a venue on plan `pro` or superadmin; everyone else sees the row disabled with “Available on Pro”.
  Superadmin rows use the same tile (`primaryColor`, `logoUrl`) and show the city.
- Owner-only UI (settings/branding edits, Publish, Delete) is gated with `isOwner`; the API enforces it anyway.

### Layout & tokens
- `≤640px` = phone (bottom tab bar, full-screen `Sheet`s, swipe rows, `useIsMobile()`); `641–1024px` = 64px icon rail with tooltips
  (`useIsCompact()`); `>1024px` = 240px sidebar. Custom Tailwind breakpoints `tab` (641px) and `wide` (1025px); `max-tab:`/`max-wide:` for the inverse.
- Tokens on `:root` (`--bg --surface --ink --ink-2 --ink-3 --muted --faint --line --line2 --line-strong --accent --on-accent
  --accent-soft`) mapped by `@theme inline` to `bg-canvas text-ink text-ink-2 text-muted text-faint border-line bg-line-2
  bg-accent text-on-accent …`. The accent is always the salveta plum `#7A3E48`; the tenant's `primaryColor` is only used by
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
Tables rows expand with Share (`navigator.share`, clipboard fallback) and Download, `VenueSheet` switcher, `InstallHint`
(`beforeinstallprompt`, iOS Share hint; dismissal in localStorage). PWA: `public/manifest.webmanifest`, `public/icons/*`,
`public/sw.js` (app shell only, never `/api`), registered in production builds only.

### Tests (`apps/cms/test`)
vitest + Testing Library in jsdom. `helpers.tsx` has DTO fixtures, `mockApi(state, override?)` (default answers for every
endpoint the shell needs, `statefulItems()` persists availability changes across refetches), `setViewport('desktop'|'tablet'|'mobile')`
(matchMedia stub) and `renderApp(route, { viewport, authenticated })` which mounts the real route tree; an authenticated render
sets the session flag and lets the app restore through the mocked `POST /api/auth/refresh`.

## Marketing site (`apps/web`)

Stack: Astro 7 (`output: 'static'`, `trailingSlash: 'always'`, `compressHTML`, stylesheet inlined), TypeScript strict, Tailwind v4
via `@tailwindcss/vite`, `@astrojs/sitemap`. **No React**: the only interactivity (SR/EN switch, monthly/yearly pricing, FAQ accordion,
phone nav) is plain TypeScript in `src/scripts/*.ts` (`init*(root)` functions, < 1 KB gzipped, inlined by Astro). Design source:
`design/salveta.menu website.html` (Claude Design export: markup in the `__bundler/template` script tag, fonts base64 in
`__bundler/manifest`). Lighthouse mobile on the seeded preview: 100/100/100/100 (sr), 99/100/100/100 (en).

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
(tuned: `shared_buffers=128MB`, `max_connections=40`, limit 256m), `salveta-api` (limit 256m) and `salveta-caddy` (limit 128m,
the three static builds inside). **Images are built by `.github/workflows/deploy.yml`** (after CI succeeds on `main`) and pushed to
`ghcr.io/<owner>/salveta-api|salveta-caddy:<git short sha>` + `latest`; the droplet only runs `deploy/deploy.sh <tag>`
(`compose pull && up -d`, waits for the API health check, `image prune`). Rollback = `deploy.sh <older tag>`.

- Runtime config is `deploy/.env.prod` (gitignored; `.env.prod.example` documents every variable; secrets from
  `openssl rand -base64 48`, the Postgres password `openssl rand -hex 32` because it is embedded in `DATABASE_URL`).
- Caddy (`deploy/Caddyfile`): apex = marketing site, `www` → apex, `app.` = CMS SPA + `/api` proxy, `api.` = API, `*.` = menu SPA +
  `/api` proxy; every certificate (incl. the wildcard) via Cloudflare DNS-01 (`CF_API_TOKEN`); zstd/gzip, HSTS and friends,
  `/assets` + `/_astro` immutable, `index.html`/`sw.js` `no-cache`. `Caddyfile.local` = same routes with `local_certs` for the laptop
  stack (`docker-compose.local.yml`, `DOMAIN=localhost`).
- API in production: `TRUST_PROXY=1`, CORS allowlist = `APP_URL` + `CORS_ORIGINS` (apex, www) + every `{slug}.DOMAIN`, secure
  httpOnly cookies, auth/public-event rate limits, JSON logs, graceful SIGTERM (10 s), migrations on start, `APP_VERSION` = image tag.
- Storage: Spaces bucket `salveta` (fra1, CDN): `restaurants/<id>/…` public-read via `S3_PUBLIC_URL` (CDN), `backups/` private.
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
- Seed credentials: superadmin `admin@salveta.menu` / `admin1234`; demo owner `ana@kafeterija.rs` / `tabla1234`
  (restaurant "Kafeterija Dorćol", slug `kafeterija`); other demo owners use `tabla1234`.

## When adding an endpoint

1. Add the Zod request schema (and DTO if new) to `packages/shared/src/schemas` / `dto.ts`, export from `index.ts`, rebuild shared.
2. Service function takes `restaurantId` explicitly and filters by it; bump `touchRestaurant()` if menu/table content changes.
3. Controller: parse with the schema, call the service, `res.json(dto)`. Router: mount with the right role guard.
4. Add/extend a test in `apps/api/test`. Run `npm run typecheck` and `npm test`.
