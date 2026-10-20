# Tabla (qr-menu) — project conventions

Multi-tenant QR table-menu SaaS for restaurants. npm-workspaces monorepo driven by Turborepo.
Product name: **Tabla**. Public menus live on `https://{slug}.tabla.rs`, the admin CMS on a separate host.

## Layout

| Path | What | Status |
| --- | --- | --- |
| `packages/shared` | Constants, Zod request schemas, response DTO schemas + inferred types, `resolveText()` | Phase 1 (done) |
| `apps/api` | Express 5 API (Sequelize 6 + sequelize-typescript, Postgres 16) | Phase 1 (done) |
| `apps/menu` | Public menu (React + Vite) | Phase 2, untouched |
| `apps/cms` | Admin CMS (React + Vite) | Phase 2, untouched |

`apps/api/src`: `config/` (env), `db/` (sequelize instance, `models/`, `migrations/`, `seeders/`),
`modules/<name>/` (`router.ts`, `controller.ts`, `service.ts`, `schemas.ts`), `middleware/`, `utils/`, `app.ts`, `index.ts`.
Tests live in `apps/api/test`.

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
  comes from `PUBLIC_MENU_BASE_URL` (`http://{slug}.localhost:5174` in dev, `https://{slug}.tabla.rs` in prod).
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

## Testing

- vitest + supertest against a real Postgres: `test/global-setup.ts` creates the test DB and runs migrations once;
  `test/setup.ts` truncates all tables before each test. Files run sequentially (`fileParallelism: false`).
- Seed credentials: superadmin `admin@tabla.rs` / `admin1234`; demo owner `ana@kafeterija.rs` / `tabla1234`
  (restaurant "Kafeterija Dorćol", slug `kafeterija`); other demo owners use `tabla1234`.

## When adding an endpoint

1. Add the Zod request schema (and DTO if new) to `packages/shared/src/schemas` / `dto.ts`, export from `index.ts`, rebuild shared.
2. Service function takes `restaurantId` explicitly and filters by it; bump `touchRestaurant()` if menu/table content changes.
3. Controller: parse with the schema, call the service, `res.json(dto)`. Router: mount with the right role guard.
4. Add/extend a test in `apps/api/test`. Run `npm run typecheck` and `npm test`.
