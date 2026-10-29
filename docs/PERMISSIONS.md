# Permissions — who may do what in the CMS (Phase 11)

Two roles per venue (`memberships.role`): **owner** and **staff**. Superadmins pass every check as an implicit owner
(support use) and are never asked for the owner PIN.

Every admin route is classified as **service** (both roles) or **owner**. Owner routes are guarded by the single
`requireOwner` middleware (`apps/api/src/middleware/membership.ts`):

| Caller | Venue has an owner PIN | Result |
| --- | --- | --- |
| staff | any | `403 ROLE_REQUIRED` |
| owner | no | allowed |
| owner | yes, request carries a valid `X-Elevation` token for this sign-in | allowed (`req.membership.elevated = true`) |
| owner | yes, no / invalid / other session's token | `403 PIN_REQUIRED` |
| superadmin | any | allowed |

The elevation token is an HS256 JWT (`type: 'elevation'`, `rid`, `sid` = the sign-in's session id, `win`) issued by
`POST …/security/unlock` after the PIN (or the owner's password) and after a password sign-in; it is bound to the
sign-in (`sid` must match the access token), lives at most 15 minutes (`session` tokens are renewed by
`POST …/security/extend`), and is only ever held by the device that typed the PIN. The UI gate (keypad) is therefore
never the only gate: a request from devtools without the header gets the same 403.

The matrix below is enforced server-side by the routers and verified by `apps/api/test/permissions.test.ts`.

## `/api/admin/restaurants` (not tenant-scoped)

| Route | Class | Notes |
| --- | --- | --- |
| `POST /restaurants` | owner-of-a-Pro-venue or superadmin | creates another venue (`PLAN_REQUIRED` otherwise); no PIN (new venue has none) |

## `/api/admin/restaurants/:restaurantId/…`

### Venue

| Route | Class |
| --- | --- |
| `GET /` | service |
| `PATCH /` (name, slug, branding, locale, currency, ordering mode/pause, `modules.ordering`) | **owner** |
| `POST /logo` | **owner** |
| `POST /publish` | **owner** |
| `DELETE /` | **owner** |

### Menu structure and content

| Route | Class |
| --- | --- |
| `GET /categories` | service |
| `POST /categories`, `PATCH /categories/:id` (rename, hide/show), `PUT /categories/reorder`, `DELETE /categories/:id` | **owner** |
| `GET /items`, `GET /items/:id` | service |
| `POST /items`, `PATCH /items/:id` (price, names, variants, allergens, tags, POS code, category), `PUT /items/reorder`, `DELETE /items/:id`, `POST /items/:id/image` | **owner** |
| `PATCH /items/:id/availability` (`{available}` / `until: 'tomorrow-06:00'`) | service |

### Tables and QR

| Route | Class |
| --- | --- |
| `GET /tables` | service |
| `POST /tables`, `PATCH /tables/:id`, `PUT /tables/reorder`, `DELETE /tables/:id` | **owner** |
| `GET /tables/qr-sheet.pdf`, `GET /tables/:id/qr.png`, `GET /tables/:id/qr.svg` (QR print/download) | **owner** |
| `POST /tables/:id/block`, `DELETE /tables/:id/block` (30-minute block; ordering module) | service |

### Ordering (module `ordering`)

| Route | Class |
| --- | --- |
| `GET /orders`, `GET /orders/:id`, `PATCH /orders/:id` (accept / deliver / reject) | service |
| `GET /requests`, `PATCH /requests/:id` (call done) | service |
| `POST /sse-token`, `GET /events?token=` | service |
| `PATCH /orders/:id/payment { cash }` (module `payments`) | service |
| `POST /orders/:id/fiscal/retry`, `POST /orders/:id/fiscal/manual` (module `pos`) | service |

### Analytics

| Route | Class |
| --- | --- |
| `GET /analytics?range=` | service (staff may read; there is no export endpoint — if one is added it is **owner**) |

### Integrations (modules `payments` / `pos`)

| Route | Class |
| --- | --- |
| `GET /payment-config`, `PATCH /payment-config`, `POST /payment-config/test` | **owner** |
| `GET /pos-config`, `PATCH /pos-config`, `POST /pos-config/test` | **owner** |
| `GET /pos/products`, `POST /pos/sync`, `GET /pos/tables`, `GET /pos/taxes` | **owner** |

### Owner PIN (`/security`) — owner *role*, deliberately without the elevation gate

| Route | Class |
| --- | --- |
| `GET /security` (`pinSet`, own `dailyDigest`, `lockedUntil`) | service |
| `PATCH /security { dailyDigest }` | owner role |
| `PUT /security/pin { pin, password }`, `DELETE /security/pin { password }` | owner role (the password proves the owner) |
| `POST /security/unlock { pin \| password, window }` → elevation token | owner role (5 wrong → 15-minute lockout, logged, owners mailed after the 2nd lockout in 24 h) |
| `POST /security/extend` (header `X-Elevation`, `session` window only) | owner role |

### Team (`/team`)

| Route | Class |
| --- | --- |
| `GET /team` | **owner** |
| `POST /team/invites`, `DELETE /team/invites/:inviteId` | **owner** |
| `POST /team/join-code`, `DELETE /team/join-code` | **owner** |
| `PATCH /team/:membershipId { role }`, `DELETE /team/:membershipId` (never the last owner: `409 LAST_OWNER`) | **owner** |

### Audit log

| Route | Class |
| --- | --- |
| `GET /audit-log?kind&action&userId&from&to&page&pageSize` | **owner** |

## Public auth routes added in Phase 11 (`/api/auth`)

| Route | Who |
| --- | --- |
| `GET /invite/:token` (preview), `POST /invite { token, name?, password? }` | anyone with the e-mailed link (one-time, 7 days) |
| `POST /join { code, name, email?, password }` | anyone with the venue's 6-digit join code (24 h; rate-limited like sign-in) |

## What the CMS shows

- **Staff** see service screens only: the menu with availability switches (no add / edit / reorder / delete, no
  "New category"), tables with Share, Copy link and the 30-minute block (no add / edit / delete / print / download),
  orders and calls, "Unavailable today", read-only Branding and Settings (no Protection / Team cards, no history).
- **Owners** on a venue *with* a PIN see every owner control with a lock glyph while the device is locked; tapping
  it opens the keypad (and the API client replays any request refused with `PIN_REQUIRED` once the keypad succeeds).
  The top bar (desktop) / status strip (phone) shows "Locked · Unlock" or "Unlocked · m:ss · Lock".
