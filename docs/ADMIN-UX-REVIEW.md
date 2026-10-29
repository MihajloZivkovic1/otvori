# Admin UX review — Phase 13c

A pass over the CMS and the new superadmin area with a product designer's checklist (Stripe / Vercel / Linear admin
conventions), keeping the existing design system (`design/Tabla Admin Panel (1).html` tokens, the otvori plum accent).
What changed is listed first, what is deliberately left for later at the end.

## Changed

### Shell and navigation
- **Superadmin area is its own shell** (`/admin/*`, `components/admin/AdminShell.tsx`): sidebar Restaurants / Users /
  Activity / System, breadcrumb starting at "Superadmin", no venue switcher, no venue nav, no publish pill, no "View live
  menu". Entering it clears the remembered venue and any impersonation, so nothing from the last venue leaks in (the bug
  from the screenshot). `/superadmin` redirects to `/admin/restaurants`.
- **Impersonation banner** ("Prijavljen kao vlasnik lokala X · Nazad u admin") sits above the venue shell for the whole
  "Open as owner" session; "Nazad u admin" returns to the venue page and forgets the token.
- **Venue switcher for superadmins** lists every venue grouped by status with a search box; picking one always goes
  through "Open as owner" so the banner shows. Owners see their own venues exactly as before.
- **Account menu** in the sidebar footer (both shells) and on the phone More screen: profile (name, e-mail with password
  confirmation), password change (signs every other device out), devices list with "Sign out everywhere else", CMS
  language (EN / SR), appearance (system / light / dark), sign out.
- **Error pages** in the design system: 404 for unknown routes, 403 when a signed-in account opens a page that is not
  theirs (another venue, the admin area), 500 for route errors (with the "new version deployed, reload" case kept).
- **Session handling**: the access token is refreshed a minute before it expires (no 401 mid-save), the sign-in page
  says "Your session expired…" and returns to the page you were on; "/" opens the last page you used (per account,
  only if it still belongs to you). An admin-set password forces a "Set a new password" screen before anything else.

### Lists and tables (`components/ui/DataTable.tsx`)
- One table primitive for the admin lists: sticky header, sort indicators (`aria-sort`), right-aligned numbers,
  hover rows, rows are focusable links (Enter / Space open, ↑ ↓ Home End move), skeleton / error / empty states,
  "Showing 1–50 of 212" with Previous / Next, dimmed while the next page loads, card list on phones.
- Filters and sort live in the URL (`?q=&status=&plan=&module=&setup=1&sort=&dir=&page=`), so Back and reloads keep them.

### Pages and forms
- Consistent page header (`PageHeader`: title, subtitle, primary action on the right) on every new screen; mobile
  headers with a back chevron where the screen is nested.
- Dirty-state guard (`hooks/useFormGuards.ts`): in-app navigation and tab close ask before losing unsaved changes
  on Settings, Branding, Plan & modules and Billing notes. ⌘S / Ctrl+S saves those forms and the item editor.
- Disabled controls carry a reason as a tooltip (menu items, Save with "Nothing changed yet", "Add the owner first").
- Validation is inline under the field (wizard, member form, profile) with the API's field message when it has one.

### Destructive actions
- Confirm dialogs name the thing: "Delete “Espresso”?", "Delete Sto 7?", "Remove Ana from Kafeterija?", "Deactivate
  pera@…?", "Delete E2E Bistro?" with the venue name typed to confirm.
- **Undo** on item, category and table deletes (`lib/undo.ts`): the row disappears at once, the toast offers Undo for
  six seconds, the request only goes out afterwards (or immediately when the tab is hidden). Toasts gained an action
  button for this.

### Search and keyboard
- ⌘K / Ctrl+K command palette (`components/shell/CommandPalette.tsx`): inside a venue — items, tables and pages from
  what is already loaded; in the admin area — venues, users, items and tables across every venue through
  `GET /api/superadmin/search`, plus the admin pages. Listbox roles, ↑ ↓ Enter Esc.
- `?` opens the shortcuts help; `g` + letter jumps (m/t/o/b/a/s in a venue, r/u/a/y/n in the admin area), `n` adds an
  item on the menu. Nothing fires while typing.
- Focus rings (`:focus-visible`) were already global; table rows and the new overlays use them.

### Errors from the API
- `errorMessage()` never shows raw JSON or a status line: field errors read "field: message", 5xx and unknown codes
  get a sentence, rate limits, expired sessions and deactivated accounts have their own wording.

### Mobile
- Admin shell on a phone: bottom tab bar (Restaurants / Users / Activity / System), lists as card lists, detail page
  with stacked header and horizontally scrolling tabs, drawers become bottom sheets.
- The onboarding wizard works at 390 px: one-column forms, the stepper collapses to numbers, modals fit the width
  (checked in headless Chrome: no horizontal overflow).

## Left as TODO (deliberate)
- **Full Serbian translation of the CMS.** The language switch exists and covers the shell: navigation, account
  menu, shortcuts help, error screens, common actions. Screens (menu editor, tables, orders, settings, analytics, the
  admin pages) are still English; translating them is a dictionary job over ~700 strings and should be done with the
  copy owner, not guessed.
- **Dark theme on desktop** is now available from the account menu but was only designed for phones (frame M4); a
  few desktop surfaces (QR previews, the branding phone mock) keep light backgrounds by design and were not re-tuned.
- **Column chooser / density** on tables, and server-side column resizing — not needed at the current data size.
- **Optimistic updates** for admin status/plan changes: they go through the server and update the cache on success;
  the lists already dim while reloading, so no optimistic path was added there (a wrong optimistic status on a venue
  is worse than a 300 ms wait).
- **Toasts with undo for venue delete, member removal and account deactivation**: these are rare, one-way admin
  actions and keep the type-the-name / confirm pattern on purpose.
- **Session expiry warning banner**: with silent refresh in place the only real expiry is the 30-day refresh cookie;
  a countdown would be noise. The sign-in page explains it instead.
- **Automated contrast check**: tokens were audited by hand when the design system was built (`--faint` ≥ 4.5:1,
  `--muted-paper` on paper); no new colours were introduced beyond the existing tokens. A Lighthouse a11y run over
  the admin pages is still worth doing before the next release.
- **Audit log retention UI**, bulk actions on lists (multi-select + "suspend 3 venues"), saved filters — not asked for.
