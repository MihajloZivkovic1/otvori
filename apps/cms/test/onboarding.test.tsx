import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { MenuImportPreviewDto, SuperadminRestaurantDetailDto, TableDto } from '@qr-menu/shared';
import { ids, mockApi, renderApp, requests, restaurant, sessionFor, superadmin, superadminDetail, tables, type FetchHandler } from './helpers';

const NEW_ID = '12341234-1234-4123-8123-123412341234';
const adminOnly = () => ({ ...sessionFor(superadmin), memberships: [] });

/** A venue that grows as the wizard saves each step. */
function wizardBackend(): { handler: FetchHandler; venue: () => SuperadminRestaurantDetailDto } {
  let venue: SuperadminRestaurantDetailDto | null = null;
  const base = `/api/superadmin/restaurants/${NEW_ID}`;
  const preview: MenuImportPreviewDto = {
    rows: [
      { line: 2, category: 'Kafa', name: { sr: 'Espresso', en: 'Espresso' }, description: null, priceCents: 18000, allergens: [], tags: [], errors: [] },
      { line: 3, category: 'Kafa', name: { sr: 'Kapućino' }, description: null, priceCents: 25000, allergens: ['M'], tags: ['new'], errors: [] },
      { line: 4, category: 'Doručak', name: { sr: '' }, description: null, priceCents: null, allergens: [], tags: [], errors: ['Name is missing', 'Price is missing'] },
    ],
    valid: 2,
    invalid: 1,
    categories: ['Kafa', 'Doručak'],
    existingCategories: [],
    unknownColumns: [],
  };
  const handler: FetchHandler = ({ url, method, body }) => {
    const path = url.pathname;
    if (path === '/api/superadmin/slug-check') {
      const slug = url.searchParams.get('slug') ?? '';
      return slug === 'kafeterija'
        ? { body: { slug, available: false, reason: 'taken', suggestion: 'kafeterija-2' } }
        : { body: { slug, available: true, reason: null, suggestion: slug } };
    }
    if (path === '/api/superadmin/restaurants' && method === 'POST') {
      const input = body as { name: string; slug: string; city: string | null };
      venue = { ...superadminDetail, id: NEW_ID, name: input.name, slug: input.slug, city: input.city, status: 'trial', plan: 'trial', trialEndsAt: '2026-11-12T00:00:00.000Z', publishedAt: null, tableCount: 0, itemCount: 0, categoryCount: 0, memberCount: 0, owner: null, members: [], invites: [], onboardingStep: 2, modules: { ordering: false, payments: false, pos: false } };
      return { status: 201, body: venue };
    }
    if (!venue) return undefined;
    if (path === base && method === 'GET') return { body: venue };
    if (path === base && method === 'PATCH') {
      venue = { ...venue, ...(body as Partial<SuperadminRestaurantDetailDto>) };
      return { body: venue };
    }
    if (path === `${base}/members` && method === 'POST') {
      const input = body as { email: string; name?: string; role: 'owner' | 'staff'; password?: string; mustChangePassword: boolean };
      const member = { membershipId: 'm-1', userId: 'u-1', name: input.name ?? 'Existing', email: input.email, phone: null, role: input.role, hasPassword: true, hasRealEmail: true, mustChangePassword: input.mustChangePassword, lastLoginAt: null, deactivatedAt: null };
      venue = { ...venue, members: [...venue.members, member], memberCount: venue.members.length + 1, owner: input.role === 'owner' ? { id: 'u-1', name: member.name, email: member.email } : venue.owner };
      return { status: 201, body: { member, created: Boolean(input.password), members: venue.members } };
    }
    if (path === `/api/admin/restaurants/${NEW_ID}/tables/bulk` && method === 'POST') {
      const input = body as { count: number; prefix: string };
      const created: TableDto[] = Array.from({ length: input.count }, (_, i) => ({ ...tables[0]!, id: `t-${i + 1}`, number: i + 1, label: `${input.prefix} ${i + 1}`, restaurantId: NEW_ID }));
      venue = { ...venue, tableCount: input.count };
      return { status: 201, body: { created: input.count, tables: created } };
    }
    if (path === `/api/admin/restaurants/${NEW_ID}/menu/import/preview` && method === 'POST') return { body: preview };
    if (path === `/api/admin/restaurants/${NEW_ID}/menu/import` && method === 'POST') {
      const input = body as { rows: unknown[] };
      venue = { ...venue, itemCount: input.rows.length, categoryCount: 1 };
      return { status: 201, body: { categoriesCreated: 1, categoriesReused: 0, itemsCreated: input.rows.length, rowsSkipped: 0 } };
    }
    if (path === `${base}/welcome-email` && method === 'POST') {
      const input = body as { password?: string; userId?: string };
      return { body: { ok: true, to: 'pera@bistro.rs', includedPassword: Boolean(input.password), text: `Zdravo Pera,\nLozinka: ${input.password ?? '(link)'}` } };
    }
    if (path === `${base}/impersonate` && method === 'POST') {
      return { status: 201, body: { token: 'imp-new', expiresAt: new Date(Date.now() + 3_600_000).toISOString(), restaurant: { id: NEW_ID, name: venue.name, slug: venue.slug }, owner: venue.owner } };
    }
    if (path === `/api/admin/restaurants/${NEW_ID}` && method === 'GET') return { body: { ...restaurant, id: NEW_ID, name: venue.name, slug: venue.slug, publishedAt: null } };
    if (path.startsWith(`/api/admin/restaurants/${NEW_ID}/`) && method === 'GET') return { body: [] };
    return undefined;
  };
  return { handler, venue: () => venue! };
}

describe('venue onboarding wizard (Phase 13b)', () => {
  it('creates a venue with a new owner, 12 tables and an imported menu, then mails the owner', async () => {
    const backend = wizardBackend();
    const spy = mockApi({ session: adminOnly() }, backend.handler);
    const { router } = renderApp('/admin/restaurants/new');
    const typist = userEvent.setup();

    // Step 1 — the slug follows the name and is checked live; a taken one offers the suggestion.
    expect(await screen.findByRole('heading', { name: 'New venue' })).toBeInTheDocument();
    const name = screen.getByLabelText('Venue name');
    await typist.type(name, 'Kafeterija');
    expect(await screen.findByText(/Taken — try kafeterija-2/)).toBeInTheDocument();
    await typist.clear(name);
    await typist.type(name, 'Bistro Zemun');
    await waitFor(() => expect(screen.getByLabelText('Menu address')).toHaveValue('bistro-zemun'));
    expect(await screen.findByText(/bistro-zemun.otvori.menu is free/)).toBeInTheDocument();
    await typist.type(screen.getByLabelText('City'), 'Zemun');
    await typist.click(screen.getByRole('button', { name: 'Create venue and continue' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/restaurants/${NEW_ID}/setup/2`));
    const created = requests(spy).find((r) => r.method === 'POST' && r.url.pathname === '/api/superadmin/restaurants');
    expect(created?.body).toMatchObject({ name: 'Bistro Zemun', slug: 'bistro-zemun', city: 'Zemun', defaultLocale: 'sr', supportedLocales: ['sr', 'en'] });

    // Step 2 — a brand-new owner account with a generated password that must be changed on first sign-in.
    expect(await screen.findByRole('heading', { name: 'Owner' })).toBeInTheDocument();
    const owner = screen.getByRole('form', { name: 'Member' });
    await typist.type(within(owner).getByLabelText('E-mail'), 'pera@bistro.rs');
    await typist.type(within(owner).getByLabelText('Name'), 'Pera Perić');
    await typist.click(within(owner).getByRole('button', { name: 'Generate' }));
    const password = (within(owner).getByLabelText('Password') as HTMLInputElement).value;
    expect(password).toHaveLength(12);
    expect(within(owner).getByLabelText('Password')).toHaveAttribute('type', 'text');
    await typist.click(within(owner).getByRole('button', { name: 'Add owner' }));
    expect(await screen.findByText('pera@bistro.rs')).toBeInTheDocument();
    const added = requests(spy).find((r) => r.method === 'POST' && r.url.pathname.endsWith('/members'));
    expect(added?.body).toMatchObject({ email: 'pera@bistro.rs', name: 'Pera Perić', password, role: 'owner', mustChangePassword: true });
    await typist.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/restaurants/${NEW_ID}/setup/3`));

    // Step 3 — plan, trial end (+14 days by default) and modules.
    expect(await screen.findByRole('heading', { name: 'Plan & modules' })).toBeInTheDocument();
    expect(screen.getByLabelText('Trial ends')).not.toHaveValue('');
    await typist.click(screen.getByRole('switch', { name: 'Ordering' }));
    await typist.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/restaurants/${NEW_ID}/setup/4`));
    const plan = requests(spy).filter((r) => r.method === 'PATCH' && r.url.pathname === `/api/superadmin/restaurants/${NEW_ID}`).at(-1);
    expect(plan?.body).toMatchObject({ status: 'trial', plan: 'trial', modules: { ordering: true, payments: false, pos: false }, onboardingStep: 4 });

    // Step 4 — 12 tables with the "Sto" prefix …
    expect(await screen.findByRole('heading', { name: 'Setup' })).toBeInTheDocument();
    await typist.click(screen.getByRole('button', { name: 'Add tables' }));
    const tablesDialog = await screen.findByRole('dialog', { name: 'Add tables' });
    expect(within(tablesDialog).getByLabelText('How many')).toHaveValue(12);
    expect(within(tablesDialog).getByLabelText('Label prefix')).toHaveValue('Sto');
    await typist.click(within(tablesDialog).getByRole('button', { name: /Create 12 tables/ }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Add tables' })).not.toBeInTheDocument());
    expect(await screen.findByText(/12 tables so far/)).toBeInTheDocument();
    const bulk = requests(spy).find((r) => r.url.pathname.endsWith('/tables/bulk'));
    expect(bulk?.body).toEqual({ count: 12, prefix: 'Sto' });

    // … and the spreadsheet import with its preview: two good rows, one with errors left out.
    await typist.click(screen.getByRole('button', { name: 'Import from spreadsheet' }));
    const importDialog = await screen.findByRole('dialog', { name: 'Import from spreadsheet' });
    const file = new File(['category,name_sr,price\nKafa,Espresso,180'], 'meni.csv', { type: 'text/csv' });
    fireEvent.change(within(importDialog).getByLabelText('Spreadsheet file'), { target: { files: [file] } });
    expect(await within(importDialog).findByText('2 OK')).toBeInTheDocument();
    expect(within(importDialog).getByText('1 WITH ERRORS')).toBeInTheDocument();
    expect(within(importDialog).getByText('Name is missing')).toBeInTheDocument();
    await typist.click(within(importDialog).getByRole('button', { name: 'Import 2 items' }));
    expect(await within(importDialog).findByText('2 items imported')).toBeInTheDocument();
    const imported = requests(spy).find((r) => r.method === 'POST' && r.url.pathname.endsWith('/menu/import'));
    expect((imported?.body as { rows: unknown[] }).rows).toHaveLength(2);
    await typist.click(within(importDialog).getByRole('button', { name: 'Done' }));
    expect(await screen.findByText(/2 items in 1 category so far/)).toBeInTheDocument();

    await typist.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/restaurants/${NEW_ID}/setup/done`));
    const finished = requests(spy).filter((r) => r.method === 'PATCH' && r.url.pathname === `/api/superadmin/restaurants/${NEW_ID}`).at(-1);
    expect(finished?.body).toEqual({ onboardingStep: null });
    expect(backend.venue().onboardingStep).toBeNull();

    // Finish screen — the welcome mail carries the password the wizard remembered (session only).
    expect(await screen.findByRole('heading', { name: 'Bistro Zemun is set up' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open as owner' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download QR sheet PDF' })).toBeInTheDocument();
    await typist.click(screen.getByRole('button', { name: 'Send welcome e-mail' }));
    const mailDialog = await screen.findByRole('dialog', { name: 'Send welcome e-mail' });
    expect(within(mailDialog).getByRole('switch', { name: 'Include the password I set' })).toBeChecked();
    await typist.click(within(mailDialog).getByRole('button', { name: 'Send' }));
    expect(await screen.findByRole('dialog', { name: 'Welcome e-mail sent' })).toHaveTextContent(`Lozinka: ${password}`);
    const mail = requests(spy).find((r) => r.url.pathname.endsWith('/welcome-email'));
    expect(mail?.body).toMatchObject({ userId: 'u-1', password });
  });

  it('resumes an unfinished setup from the venue page and works at phone width', async () => {
    const backend = wizardBackend();
    mockApi({ session: adminOnly() }, ({ url, method, body }) => {
      if (url.pathname === `/api/superadmin/restaurants/${ids.restaurant}` && method === 'GET') return { body: { ...superadminDetail, onboardingStep: 3 } };
      return backend.handler({ url, method, body, headers: new Headers(), nth: 1 });
    });
    const { router } = renderApp(`/admin/restaurants/${ids.restaurant}`, { viewport: 'mobile' });
    const typist = userEvent.setup();
    await typist.click(await screen.findByRole('button', { name: 'Resume setup' }));
    await waitFor(() => expect(router.state.location.pathname).toBe(`/admin/restaurants/${ids.restaurant}/setup/3`));
    expect(await screen.findByRole('heading', { name: 'Plan & modules' })).toBeInTheDocument();
    const steps = screen.getByRole('list', { name: 'Steps' });
    expect(within(steps).getByText('3').closest('li')).toHaveAttribute('aria-current', 'step');
    // Past steps are reachable; the phone layout stacks the fields in one column.
    expect(within(steps).getAllByRole('button')).toHaveLength(2);
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
  });
});

describe('menu editor import', () => {
  it('opens the spreadsheet import from the empty menu', async () => {
    mockApi({ session: sessionFor({ ...superadmin, isSuperadmin: false }) }, ({ url, method }) => {
      if (url.pathname === `/api/admin/restaurants/${ids.restaurant}/categories` && method === 'GET') return { body: [] };
      if (url.pathname === `/api/admin/restaurants/${ids.restaurant}/items` && method === 'GET') return { body: [] };
      return undefined;
    });
    renderApp(`/r/${ids.restaurant}/menu`);
    const typist = userEvent.setup();
    await typist.click(await screen.findByRole('button', { name: 'Import from spreadsheet' }));
    const dialog = await screen.findByRole('dialog', { name: 'Import from spreadsheet' });
    expect(within(dialog).getByRole('button', { name: 'Excel (.xlsx)' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Import' })).toBeDisabled();
  });
});
