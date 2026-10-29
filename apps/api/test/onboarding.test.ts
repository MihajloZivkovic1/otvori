import { describe, expect, it } from 'vitest';
import type { CopyMenuResultDto, MenuImportPreviewDto, MenuItemDto, SuperadminRestaurantDetailDto, TableDto } from '@qr-menu/shared';
import { AuditLog, User } from '../src/db/models/index.js';
import { parsePrice, previewRows, templateCsv, templateXlsx } from '../src/modules/menu-import/service.js';
import { outbox } from '../src/utils/mailer.js';
import { parseCsv, readXlsx, writeXlsx } from '../src/utils/xlsx.js';
import { api, bearer, createCategory, createItem, login, registerUser, type RegisteredUser } from './helpers.js';

async function superadmin(): Promise<RegisteredUser> {
  const admin = await registerUser({ restaurantName: 'HQ', email: `admin-${Date.now()}@otvori.menu`, name: 'Mihajlo Admin' });
  await User.update({ isSuperadmin: true, phone: '+381 60 000 0000' }, { where: { id: admin.user.id } });
  return admin;
}

const binary = (res: { body: unknown }) => res.body as Buffer;

describe('spreadsheet parsing', () => {
  it('reads CSV with either delimiter, quotes and a BOM', () => {
    expect(parseCsv('﻿a,b\n"x, y","say ""hi"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
    expect(parseCsv('category;name_sr;price\r\nKafa;Espresso;180\r\n\r\n')).toEqual([
      ['category', 'name_sr', 'price'],
      ['Kafa', 'Espresso', '180'],
    ]);
  });

  it('round-trips XLSX through the writer and reader (numbers, strings, Cyrillic, empty cells)', () => {
    const rows: (string | number)[][] = [
      ['category', 'name_sr', 'price'],
      ['Кафа', 'Еспресо & "Ristretto"', 180],
      ['Doručak', '', 650.5],
    ];
    const read = readXlsx(writeXlsx(rows));
    expect(read).toEqual([
      ['category', 'name_sr', 'price'],
      ['Кафа', 'Еспресо & "Ristretto"', '180'],
      ['Doručak', '', '650.5'],
    ]);
    const template = readXlsx(templateXlsx());
    expect(template[0]).toEqual(['category', 'name_sr', 'name_en', 'description_sr', 'description_en', 'price', 'allergens', 'tags']);
    expect(template).toHaveLength(5);
    expect(parseCsv(templateCsv())[0]).toEqual(template[0]);
  });

  it('understands Serbian and English prices', () => {
    expect(parsePrice('180')).toBe(18000);
    expect(parsePrice('1.290,50')).toBe(129050);
    expect(parsePrice('1,290.50')).toBe(129050);
    expect(parsePrice('1.290')).toBe(129000);
    expect(parsePrice('290,5')).toBe(29050);
    expect(parsePrice('650 RSD')).toBe(65000);
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('-5')).toBeNull();
  });

  it('maps header aliases, validates every row and reports errors per line', () => {
    const preview = previewRows(
      [
        ['Kategorija', 'Naziv', 'Name_EN', 'Cena', 'Alergeni', 'Tagovi', 'Napomena'],
        ['Kafa', 'Espresso', 'Espresso', '180', 'gluten, M', 'novo', 'ignored'],
        ['', 'Bez kategorije', '', '100', '', '', ''],
        ['Kafa', '', '', '', 'XX', 'hot', ''],
        ['Doručak', 'Omlet', '', 'deset', '', '', ''],
      ],
      { existingCategoryNames: ['kafa'] },
    );
    expect(preview.unknownColumns).toEqual(['Napomena']);
    expect(preview.categories).toEqual(['Kafa', 'Doručak']);
    expect(preview.existingCategories).toEqual(['Kafa']);
    expect(preview.valid).toBe(1);
    expect(preview.invalid).toBe(3);
    expect(preview.rows[0]).toMatchObject({ line: 2, category: 'Kafa', name: { sr: 'Espresso', en: 'Espresso' }, priceCents: 18000, allergens: ['G', 'M'], tags: ['new'], errors: [] });
    expect(preview.rows[1]!.errors).toEqual(['Category is missing']);
    expect(preview.rows[2]!.errors).toEqual(['Name is missing', 'Price is missing', 'Unknown allergen “XX” (use G, M, E, N, S, F, C, Se)', 'Unknown tag “hot” (use vegan, spicy, new)']);
    expect(preview.rows[3]!.errors).toEqual(['“deset” is not a price']);
    expect(() => previewRows([['name_sr', 'price']], { existingCategoryNames: [] })).toThrow(/Missing columns: category/);
  });
});

describe('venue onboarding through the superadmin API', () => {
  it('checks slugs live and creates a venue without an owner at wizard step 2', async () => {
    const admin = await superadmin();
    await registerUser({ restaurantName: 'Kafeterija' });

    const taken = await api.get('/api/superadmin/slug-check?slug=kafeterija').set(bearer(admin.accessToken));
    expect(taken.body).toMatchObject({ slug: 'kafeterija', available: false, reason: 'taken', suggestion: 'kafeterija-2' });
    const reserved = await api.get('/api/superadmin/slug-check?slug=admin').set(bearer(admin.accessToken));
    expect(reserved.body).toMatchObject({ available: false, reason: 'reserved' });
    const invalid = await api.get('/api/superadmin/slug-check?slug=Ka%20fe').set(bearer(admin.accessToken));
    expect(invalid.body).toMatchObject({ available: false, reason: 'invalid', suggestion: 'ka-fe' });
    const free = await api.get('/api/superadmin/slug-check?slug=bistro-zemun').set(bearer(admin.accessToken));
    expect(free.body).toMatchObject({ available: true, reason: null, suggestion: 'bistro-zemun' });

    const created = await api
      .post('/api/superadmin/restaurants')
      .set(bearer(admin.accessToken))
      .send({ name: 'Bistro Zemun', city: 'Zemun', address: 'Kej oslobođenja 1', timezone: 'Europe/Belgrade', currency: 'RSD', defaultLocale: 'sr', supportedLocales: ['sr', 'en'], tagline: 'Riblji specijaliteti' });
    expect(created.status).toBe(201);
    const venue = created.body as SuperadminRestaurantDetailDto;
    expect(venue).toMatchObject({ slug: 'bistro-zemun', status: 'trial', plan: 'trial', onboardingStep: 2, owner: null, members: [], city: 'Zemun', tagline: 'Riblji specijaliteti' });
    expect(venue.trialEndsAt).not.toBeNull();

    const dup = await api.post('/api/superadmin/restaurants').set(bearer(admin.accessToken)).send({ name: 'Bistro', slug: 'bistro-zemun' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('SLUG_TAKEN');
    const autoSlug = await api.post('/api/superadmin/restaurants').set(bearer(admin.accessToken)).send({ name: 'Bistro Zemun' });
    expect(autoSlug.body.slug).toBe('bistro-zemun-2');

    const stranger = await registerUser();
    const ownerDenied = await api.post('/api/superadmin/restaurants').set(bearer(stranger.accessToken)).send({ name: 'Nope' });
    expect(ownerDenied.status).toBe(403);

    // Step 3 saves plan + modules, step 4 marks it done.
    const step3 = await api.patch(`/api/superadmin/restaurants/${venue.id}`).set(bearer(admin.accessToken)).send({ status: 'active', plan: 'starter', modules: { ordering: true }, onboardingStep: 4 });
    expect(step3.body).toMatchObject({ status: 'active', plan: 'starter', modules: { ordering: true }, onboardingStep: 4 });
    const done = await api.patch(`/api/superadmin/restaurants/${venue.id}`).set(bearer(admin.accessToken)).send({ onboardingStep: null });
    expect(done.body.onboardingStep).toBeNull();
    const list = await api.get('/api/superadmin/restaurants?onboarding=true').set(bearer(admin.accessToken));
    expect((list.body.items as SuperadminRestaurantDetailDto[]).map((r) => r.id)).toEqual([autoSlug.body.id]);
  });

  it('creates tables in bulk with a label prefix, skipping taken numbers', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const base = `/api/admin/restaurants/${owner.restaurantId}/tables`;
    await api.post(base).set(bearer(owner.accessToken)).send({ number: 3, label: 'Bašta 3' });

    const bulk = await api.post(`${base}/bulk`).set(bearer(owner.accessToken)).send({ count: 12, prefix: 'Sto', startAt: 1 });
    expect(bulk.status).toBe(201);
    expect(bulk.body.created).toBe(12);
    const tables = bulk.body.tables as TableDto[];
    expect(tables).toHaveLength(13);
    expect(tables.map((t) => t.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(tables.find((t) => t.number === 3)!.label).toBe('Bašta 3');
    expect(tables.find((t) => t.number === 4)!.label).toBe('Sto 4');

    const more = await api.post(`${base}/bulk`).set(bearer(owner.accessToken)).send({ count: 2 });
    expect((more.body.tables as TableDto[]).map((t) => t.number).slice(-2)).toEqual([14, 15]);
    const tooMany = await api.post(`${base}/bulk`).set(bearer(owner.accessToken)).send({ count: 501 });
    expect(tooMany.status).toBe(400);
    const audit = await AuditLog.findOne({ where: { restaurantId: owner.restaurantId, action: 'table.bulk_create' } });
    expect(audit?.after).toMatchObject({ count: 12, prefix: 'Sto', from: 1, to: 13 });
  });

  it('previews and imports a spreadsheet (CSV and XLSX), merging or skipping existing categories', async () => {
    const owner = await registerUser({ restaurantName: 'Kafeterija' });
    const base = `/api/admin/restaurants/${owner.restaurantId}/menu/import`;
    const kafa = await createCategory(owner, { name: { sr: 'Kafa' } });
    await createItem(owner, { categoryId: kafa.id, name: { sr: 'Postojeći' }, priceCents: 10000 });

    const template = await api
      .get(`${base}/template.xlsx`)
      .set(bearer(owner.accessToken))
      .buffer()
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(template.status).toBe(200);
    expect(template.headers['content-disposition']).toContain('otvori-meni-sablon.xlsx');

    const preview = await api.post(`${base}/preview`).set(bearer(owner.accessToken)).attach('file', binary(template), 'meni.xlsx');
    expect(preview.status).toBe(200);
    const dto = preview.body as MenuImportPreviewDto;
    expect(dto).toMatchObject({ valid: 4, invalid: 0, categories: ['Kafa', 'Doručak'], existingCategories: ['Kafa'], unknownColumns: [] });
    expect(dto.rows[2]).toMatchObject({ category: 'Doručak', name: { sr: 'Tost sa avokadom', en: 'Avocado toast' }, priceCents: 65000, allergens: ['G', 'Se'], tags: ['vegan'] });

    const csv = Buffer.from('category,name_sr,price\nKafa,Macchiato,200\nKafa,"Latte, veliki",abc\n', 'utf8');
    const csvPreview = await api.post(`${base}/preview`).set(bearer(owner.accessToken)).attach('file', csv, 'meni.csv');
    expect(csvPreview.body).toMatchObject({ valid: 1, invalid: 1 });
    expect((csvPreview.body as MenuImportPreviewDto).rows[1]!.errors).toEqual(['“abc” is not a price']);

    const bad = await api.post(`${base}/preview`).set(bearer(owner.accessToken)).attach('file', Buffer.from('name_sr,price\nX,1'), 'x.csv');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('IMPORT_INVALID');

    const rows = dto.rows.map(({ category, name, description, priceCents, allergens, tags }) => ({ category, name, description, priceCents, allergens, tags }));
    const merged = await api.post(base).set(bearer(owner.accessToken)).send({ rows });
    expect(merged.status).toBe(201);
    expect(merged.body).toEqual({ categoriesCreated: 1, categoriesReused: 1, itemsCreated: 4, rowsSkipped: 0 });
    const items = (await api.get(`/api/admin/restaurants/${owner.restaurantId}/items`).set(bearer(owner.accessToken))).body as MenuItemDto[];
    expect(items).toHaveLength(5);
    const inKafa = items.filter((i) => i.categoryId === kafa.id);
    expect(inKafa.map((i) => i.name.sr)).toEqual(['Postojeći', 'Espresso', 'Kapućino']);
    expect(inKafa.map((i) => i.sortOrder)).toEqual([0, 1, 2]);

    // Both categories exist by now, so "skip existing" imports nothing; a new category in the file still would.
    const skipped = await api.post(base).set(bearer(owner.accessToken)).send({ rows: [...rows, { ...rows[0]!, category: 'Deserti' }], existing: 'skip' });
    expect(skipped.body).toEqual({ categoriesCreated: 1, categoriesReused: 0, itemsCreated: 1, rowsSkipped: 4 });

    const staff = await registerUser();
    const forbidden = await api.post(base).set(bearer(staff.accessToken)).send({ rows });
    expect(forbidden.status).toBe(403);
    const audit = await AuditLog.findOne({ where: { restaurantId: owner.restaurantId, action: 'menu.import' } });
    expect(audit?.after).toMatchObject({ itemsCreated: 4, rows: 4 });
  });

  it('deep-copies a menu from another venue without images, codes or availability state', async () => {
    const admin = await superadmin();
    const source = await registerUser({ restaurantName: 'Izvor' });
    const target = await registerUser({ restaurantName: 'Cilj' });
    const cat = await createCategory(source, { name: { sr: 'Pića', en: 'Drinks' } });
    const hidden = await createCategory(source, { name: { sr: 'Skriveno' }, isHidden: true });
    await createItem(source, {
      categoryId: cat.id,
      name: { sr: 'Sok', en: 'Juice' },
      description: { sr: 'Sveže ceđen' },
      priceCents: 30000,
      allergens: ['N'],
      tags: ['new'],
      isAvailable: false,
      posProductCode: 'POS-1',
      variants: [
        { name: 'Mali', priceCents: 25000 },
        { name: 'Veliki', priceCents: 35000 },
      ],
      variantLabel: { sr: 'Veličina' },
    });
    await createItem(source, { categoryId: hidden.id, name: { sr: 'Tajna' }, priceCents: 100 });
    const existing = await createCategory(target, { name: { sr: 'Postojeća' } });

    const copied = await api.post(`/api/superadmin/restaurants/${target.restaurantId}/menu/copy`).set(bearer(admin.accessToken)).send({ sourceRestaurantId: source.restaurantId });
    expect(copied.status).toBe(201);
    expect(copied.body as CopyMenuResultDto).toEqual({ categories: 2, items: 2, variants: 2 });

    const categories = (await api.get(`/api/admin/restaurants/${target.restaurantId}/categories`).set(bearer(target.accessToken))).body as { id: string; name: Record<string, string>; isHidden: boolean; sortOrder: number }[];
    expect(categories.map((c) => c.name.sr)).toEqual(['Postojeća', 'Pića', 'Skriveno']);
    expect(categories[2]!.isHidden).toBe(true);
    expect(categories[0]!.id).toBe(existing.id);
    const items = (await api.get(`/api/admin/restaurants/${target.restaurantId}/items`).set(bearer(target.accessToken))).body as MenuItemDto[];
    const juice = items.find((i) => i.name.sr === 'Sok')!;
    expect(juice).toMatchObject({ restaurantId: target.restaurantId, isAvailable: true, imageUrl: null, posProductCode: null, allergens: ['N'], tags: ['new'], variantLabel: { sr: 'Veličina' } });
    expect(juice.variants.map((v) => [v.name, v.priceCents])).toEqual([
      ['Mali', 25000],
      ['Veliki', 35000],
    ]);
    // The source is untouched and the copy's category ids differ.
    const sourceItems = (await api.get(`/api/admin/restaurants/${source.restaurantId}/items`).set(bearer(source.accessToken))).body as MenuItemDto[];
    expect(sourceItems.find((i) => i.name.sr === 'Sok')!.isAvailable).toBe(false);
    expect(juice.categoryId).not.toBe(cat.id);

    const self = await api.post(`/api/superadmin/restaurants/${target.restaurantId}/menu/copy`).set(bearer(admin.accessToken)).send({ sourceRestaurantId: target.restaurantId });
    expect(self.status).toBe(400);
    const notAdmin = await api.post(`/api/superadmin/restaurants/${target.restaurantId}/menu/copy`).set(bearer(target.accessToken)).send({ sourceRestaurantId: source.restaurantId });
    expect(notAdmin.status).toBe(403);
  });

  it('sends the Serbian welcome mail with the password or a set-password link', async () => {
    const admin = await superadmin();
    const created = await api.post('/api/superadmin/restaurants').set(bearer(admin.accessToken)).send({ name: 'Bistro Zemun' });
    const venueId = created.body.id as string;
    const noOwner = await api.post(`/api/superadmin/restaurants/${venueId}/welcome-email`).set(bearer(admin.accessToken)).send({});
    expect(noOwner.status).toBe(409);

    await api.post(`/api/superadmin/restaurants/${venueId}/members`).set(bearer(admin.accessToken)).send({ email: 'pera@bistro.rs', role: 'owner', name: 'Pera Perić', password: 'Tajna12345', mustChangePassword: true });
    outbox.length = 0;
    const withPassword = await api.post(`/api/superadmin/restaurants/${venueId}/welcome-email`).set(bearer(admin.accessToken)).send({ password: 'Tajna12345', note: 'Vidimo se u četvrtak.' });
    expect(withPassword.status).toBe(200);
    expect(withPassword.body).toMatchObject({ ok: true, to: 'pera@bistro.rs', includedPassword: true });
    const mail = outbox.find((m) => m.to === 'pera@bistro.rs')!;
    expect(mail.subject).toBe('Dobrodošli u otvori — Bistro Zemun');
    expect(mail.text).toContain('Zdravo Pera Perić');
    expect(mail.text).toContain('Lozinka: Tajna12345');
    expect(mail.text).toContain('Prijava: http://localhost:5173/login');
    expect(mail.text).toContain('Vidimo se u četvrtak.');
    expect(mail.text).toContain('1. Prijavi se');
    expect(mail.text).toContain('Mihajlo Admin');
    expect(mail.text).toContain('+381 60 000 0000');
    expect(mail.text).toContain('bistro-zemun.localhost:5174');
    expect(withPassword.body.text).toBe(mail.text);

    outbox.length = 0;
    const withLink = await api.post(`/api/superadmin/restaurants/${venueId}/welcome-email`).set(bearer(admin.accessToken)).send({});
    expect(withLink.body.includedPassword).toBe(false);
    const linkMail = outbox[0]!;
    expect(linkMail.text).not.toContain('Lozinka:');
    const url = /Postavi lozinku ovim linkom \(važi 7 dana\): (\S+)/.exec(linkMail.text)![1]!;
    const token = new URL(url).searchParams.get('token')!;
    const reset = await api.post('/api/auth/reset-password').send({ token, password: 'NovaLozinka123' });
    expect(reset.status).toBe(200);
    const signedIn = await login('pera@bistro.rs', 'NovaLozinka123');
    expect(signedIn.memberships[0]!.restaurant.id).toBe(venueId);
    // The password is never written to the audit log.
    const rows = await AuditLog.findAll({ where: { restaurantId: venueId } });
    expect(JSON.stringify(rows.map((r) => r.after))).not.toContain('Tajna12345');
    expect(rows.some((r) => r.action === 'admin.welcome_email')).toBe(true);
  });
});
