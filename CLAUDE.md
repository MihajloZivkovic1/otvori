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
| `deploy/` | Docker Compose production stack: Postgres, API image, Caddy image that builds and serves the static apps | Phase 5 |

`apps/api/src`: `config/` (env), `db/` (sequelize instance, `models/`, `migrations/`, `seeders/`),
`modules/<name>/` (`router.ts`, `controller.ts`, `service.ts`, `schemas.ts`), `middleware/`, `utils/`, `app.ts`, `index.ts`.
Tests live in `apps/api/test`.

`apps/cms/src`: `main.tsx` (QueryClient → ToastProvider → AuthProvider → RouterProvider, SW registration), `router.tsx` (route
tree, lazy pages), `pages/` (one file per screen, `auth/` for login/register/forgot/magic/reset), `components/ui/` (primitives),
`components/shell/` (sidebar, top bar, tab bar, layouts, guards), `components/{menu,tables,branding,settings,superadmin}/`,
`lib/` (api, auth, queries, storage, format, screens, crop, download, color), `hooks/`, `styles.css`. Tests in `apps/cms/test`.

`apps/menu/src`: `main.tsx` (QueryClient, `BrowserRouter`, re-applies the cached tenant theme before first paint), `App.tsx`
(routes `/r/:slug/*` and `*`), `pages/MenuPage.tsx` (the one screen: data, locale, theme, events, sheet routing),
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
npm run dev                   # turbo: shared tsc --watch + api tsx watch (+ vite apps)
npm run typecheck             # all workspaces
npm test                      # apps/api vitest + supertest (needs Postgres; uses "<db>_test" or TEST_DATABASE_URL)
```

`@qr-menu/shared` is a compiled package: consumers import `dist/`. After editing shared, rebuild it (or keep `npm run dev` running).

## Stack rules

- Node 22, TypeScript strict, **ESM everywhere** (`"type": "module"`, `module: NodeNext`, relative imports end in `.js`).
- TypeScript 7 (native tsc). Decorators are legacy `experimentalDecorators` with `useDefineForClassFields: false`.
  `emitDecoratorMetadata` is **off** (tsx/esbuild cannot emit it) → every `@Column` declares its `DataType` explicitly.
- Express 5: async handlers may `throw`; rejections reach the error middleware. No try/catch boilerplate in controllers.
- Validation: **every** request body/query is parsed with a Zod schema from `@qr-menu/shared` (`schema.parse(req.body)` in the controller).
  Route params that are ids go through `uuidParam()`. `ZodError` → 400.
- Error shape is always `{ error: { code, message, details? } }` (`utils/errors.ts`, `middleware/error.ts`).
  400 validation, 401 auth, 403 membership/role, 404 not found, 409 conflict (`EMAIL_TAKEN`, `SLUG_TAKEN`, `TABLE_NUMBER_TAKEN`), 413/415 uploads, 429 rate limit.
- Logging: pino (`utils/logger.ts`), pino-http per request. Never `console.log` in app code.
- Migrations only (umzug + Sequelize QueryInterface, `src/db/migrations/*.ts`); **never** `sequelize.sync()`.
  Migration names are stored without extension so `.ts` (dev) and `.js` (dist) agree.

## Tenant isolation (non-negotiable)

- Admin routes are `/api/admin/restaurants/:restaurantId/...`. `requireMembership()` resolves the membership of the
  authenticated user for the `:restaurantId` route param and stores `req.membership`.
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
- Magic links and password resets are one-time `auth_tokens` rows (15 min / 1 h). The mailer is a stub that logs
  (`utils/mailer.ts`; in tests messages are collected in `outbox`). Links point at `APP_URL/auth/magic?token=` and `APP_URL/auth/reset?token=`.
- `POST /register` creates user + restaurant (slug from the name, made unique with `-2`, `-3`, …) + owner membership; 14-day trial.

## Public menu

- `GET /api/public/:slug/menu?locale=sr` or, host-based, `GET /api/public/menu` with `Host: {slug}.<suffix>` where the suffix
  comes from `PUBLIC_MENU_BASE_URL` (`http://{slug}.localhost:5174` in dev, `https://{slug}.salveta.menu` in prod).
- Only when `published_at` is set and status ≠ `suspended`; hidden categories and categories without items are omitted;
  unavailable items are included with `isAvailable:false`. Response has `Cache-Control: public, max-age=30`.
- `POST /api/public/:slug/events` with `{type:'scan', sessionId, tableNumber?}` or `{type:'item_view', sessionId, itemId}`
  (rate-limited per IP). A repeated scan from the same session within 30 min is ignored; item views attach to the session's
  latest scan (one is created if missing). Table QR codes encode `PUBLIC_MENU_BASE_URL/?t=<tableNumber>`.

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
npm run dev -w @qr-menu/menu           # http://localhost:5174/?t=7  ·  http://kafeterija.localhost:5174/?t=7  ·  /r/bistro-zemun
```
`apps/menu/.env` (gitignored, copy from `.env.example`): `VITE_API_URL=http://localhost:3100`, `VITE_DEFAULT_SLUG=kafeterija`.
The dev and preview servers listen on 5174 and proxy `/api` to `API_PROXY_TARGET || VITE_API_URL` with the Host header preserved
(`changeOrigin: false`), so `{slug}.localhost:5174` lets the API resolve the slug from the Host exactly like `{slug}.salveta.menu`.
Useful URL params: `?t=7` table, `?lang=en`, `?item=<itemId>` opens the sheet.

To reproduce the production same-origin setup (and the Lighthouse run): `VITE_API_URL= npx vite build` then
`API_PROXY_TARGET=http://localhost:3100 npx vite preview --port 4174` in `apps/menu`, open `http://kafeterija.localhost:4174/?t=7`,
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
  `sessionStorage['tabla.session']`; table = `?t=` persisted in `sessionStorage['tabla.table.<tenant>']`.
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

## Testing

- vitest + supertest against a real Postgres: `test/global-setup.ts` creates the test DB and runs migrations once;
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
