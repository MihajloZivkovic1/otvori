import { Op, literal, type FindAttributeOptions, type Order as SequelizeOrder, type WhereOptions } from 'sequelize';
import {
  DEFAULT_MODULES,
  isReservedSlug,
  slugSchema,
  type ImpersonationDto,
  type ModuleKey,
  type PaginatedDto,
  type SlugCheckDto,
  type SuperadminCreateRestaurantInput,
  type SuperadminListRestaurantsQuery,
  type SuperadminRestaurantDetailDto,
  type SuperadminRestaurantDto,
  type SuperadminUpdateRestaurantInput,
} from '@qr-menu/shared';
import { env } from '../../config/env.js';
import { dtoModules, featureEnabled } from '../../config/features.js';
import { Category, Membership, Order, Restaurant, ScanEvent, TeamInvite, User } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import type { AuthUser } from '../../types/express.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { signImpersonationToken } from '../../utils/jwt.js';
import { definedOnly, toIso } from '../../utils/objects.js';
import { buildMenuUrl } from '../../utils/public-url.js';
import { slugify } from '../../utils/slug.js';
import { generateOpaqueToken } from '../../utils/tokens.js';
import * as audit from '../audit/service.js';
import { deleteRestaurant as deleteVenue } from '../restaurants/service.js';
import { listMembers } from './members.js';

const DAY_MS = 86_400_000;

/* ------------------------------------------------------------------ attributes shared by the list and the detail */

const TABLE_COUNT = literal('(SELECT COUNT(*) FROM tables t WHERE t.restaurant_id = "Restaurant"."id")');
const ITEM_COUNT = literal('(SELECT COUNT(*) FROM menu_items mi WHERE mi.restaurant_id = "Restaurant"."id")');
const LAST_SCAN = literal('(SELECT MAX(se.scanned_at) FROM scan_events se WHERE se.restaurant_id = "Restaurant"."id")');
const OWNER_EMAIL = literal(
  `(SELECT u.email FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.restaurant_id = "Restaurant"."id" AND m.role = 'owner' ORDER BY u.created_at ASC LIMIT 1)`,
);
export const LIST_ATTRIBUTES: FindAttributeOptions = {
  include: [
    [TABLE_COUNT, 'tableCount'],
    [ITEM_COUNT, 'itemCount'],
    [LAST_SCAN, 'lastScanAt'],
    [OWNER_EMAIL, 'ownerEmail'],
  ],
};

type Owner = { id: string; name: string; email: string } | null;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value as string);
}

export function toSuperadminDto(restaurant: Restaurant, owner: Owner): SuperadminRestaurantDto {
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    city: restaurant.city,
    logoUrl: restaurant.logoUrl,
    primaryColor: restaurant.primaryColor,
    status: restaurant.status,
    plan: restaurant.plan,
    trialEndsAt: toIso(restaurant.trialEndsAt),
    publishedAt: toIso(restaurant.publishedAt),
    tableCount: Number(restaurant.get('tableCount') ?? 0),
    itemCount: Number(restaurant.get('itemCount') ?? 0),
    modules: dtoModules(restaurant.modules),
    owner,
    lastScanAt: toIso(toDate(restaurant.get('lastScanAt'))),
    paidUntil: restaurant.paidUntil ?? null,
    onboardingStep: restaurant.onboardingStep ?? null,
    createdAt: restaurant.createdAt.toISOString(),
    updatedAt: restaurant.updatedAt.toISOString(),
  };
}

export async function ownersFor(restaurantIds: string[]): Promise<Map<string, Owner>> {
  if (restaurantIds.length === 0) return new Map();
  const memberships = await Membership.findAll({
    where: { restaurantId: restaurantIds, role: 'owner' },
    include: [{ model: User, attributes: ['id', 'name', 'email', 'createdAt'] }],
  });
  const map = new Map<string, Owner>();
  // Deterministic "the" owner: the account created first.
  const sorted = memberships.sort((a, b) => (a.user?.createdAt.getTime() ?? 0) - (b.user?.createdAt.getTime() ?? 0));
  for (const membership of sorted) {
    if (!map.has(membership.restaurantId) && membership.user) {
      const { id, name, email } = membership.user;
      map.set(membership.restaurantId, { id, name, email });
    }
  }
  return map;
}

export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (match) => `\\${match}`);

export async function loadRestaurant(restaurantId: string): Promise<Restaurant> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: LIST_ATTRIBUTES });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return restaurant;
}

/* ------------------------------------------------------------------ list */

const SORT_COLUMNS: Record<SuperadminListRestaurantsQuery['sort'], string> = {
  name: '"Restaurant"."name"',
  status: '"Restaurant"."status"',
  plan: '"Restaurant"."plan"',
  trialEndsAt: '"Restaurant"."trial_ends_at"',
  tables: '"tableCount"',
  items: '"itemCount"',
  owner: '"ownerEmail"',
  updatedAt: '"Restaurant"."updated_at"',
  lastScanAt: '"lastScanAt"',
  createdAt: '"Restaurant"."created_at"',
};

export async function listRestaurants(query: SuperadminListRestaurantsQuery): Promise<PaginatedDto<SuperadminRestaurantDto>> {
  const where: WhereOptions<Restaurant> & { [Op.and]?: unknown[] } = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.plan ? { plan: query.plan } : {}),
    ...(query.onboarding ? { onboardingStep: { [Op.ne]: null } } : {}),
  };
  const and: unknown[] = [];
  if (query.search) {
    const pattern = sequelize.escape(`%${escapeLike(query.search)}%`);
    and.push({
      [Op.or]: [
        { name: { [Op.iLike]: `%${escapeLike(query.search)}%` } },
        { city: { [Op.iLike]: `%${escapeLike(query.search)}%` } },
        { slug: { [Op.iLike]: `%${escapeLike(query.search)}%` } },
        literal(`EXISTS (SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.restaurant_id = "Restaurant"."id" AND u.email ILIKE ${pattern})`),
      ],
    });
  }
  if (query.module) {
    const key: ModuleKey = query.module;
    and.push(literal(`COALESCE(("Restaurant"."modules"->>'${key}')::boolean, false) IS TRUE`));
  }
  if (and.length) where[Op.and] = and;

  const dir = query.dir.toUpperCase();
  const order: SequelizeOrder = [literal(`${SORT_COLUMNS[query.sort]} ${dir} NULLS LAST`), ['name', 'ASC']];
  const { rows, count } = await Restaurant.findAndCountAll({
    where,
    attributes: LIST_ATTRIBUTES,
    order,
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  const owners = await ownersFor(rows.map((r) => r.id));
  return {
    items: rows.map((r) => toSuperadminDto(r, owners.get(r.id) ?? null)),
    total: count,
    page: query.page,
    pageSize: query.pageSize,
  };
}

/* ------------------------------------------------------------------ detail */

export async function getRestaurantDetail(restaurantId: string): Promise<SuperadminRestaurantDetailDto> {
  const restaurant = await loadRestaurant(restaurantId);
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const now = new Date();
  const [owners, categoryCount, memberCount, scansLast7Days, ordersLast7Days, members, invites] = await Promise.all([
    ownersFor([restaurant.id]),
    Category.count({ where: { restaurantId } }),
    Membership.count({ where: { restaurantId } }),
    ScanEvent.count({ where: { restaurantId, scannedAt: { [Op.gte]: weekAgo } } }),
    Order.count({ where: { restaurantId, createdAt: { [Op.gte]: weekAgo } } }),
    listMembers(restaurantId),
    TeamInvite.findAll({
      where: { restaurantId, kind: 'email', usedAt: null, revokedAt: null, expiresAt: { [Op.gt]: now } },
      include: [{ model: User, as: 'inviter', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
    }),
  ]);
  return {
    ...toSuperadminDto(restaurant, owners.get(restaurant.id) ?? null),
    address: restaurant.address,
    timezone: restaurant.timezone,
    currency: restaurant.currency,
    defaultLocale: restaurant.defaultLocale,
    supportedLocales: restaurant.supportedLocales,
    tagline: restaurant.tagline,
    menuNote: restaurant.menuNote,
    orderingMode: restaurant.orderingMode,
    orderingPaused: restaurant.orderingPaused,
    pinSet: restaurant.ownerPinHash !== null && restaurant.ownerPinHash !== undefined,
    publicUrl: buildMenuUrl(restaurant.slug),
    cmsUrl: `${env.APP_URL}/r/${restaurant.id}`,
    billingNote: restaurant.billingNote ?? null,
    adminNotes: restaurant.adminNotes ?? null,
    categoryCount,
    memberCount,
    scansLast7Days,
    ordersLast7Days,
    members,
    invites: invites.map((invite) => ({
      id: invite.id,
      email: invite.email ?? '',
      role: invite.role,
      invitedBy: invite.inviter?.name ?? null,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
    })),
  };
}

/* ------------------------------------------------------------------ slug */

async function slugTaken(slug: string, exceptId?: string): Promise<boolean> {
  const where: WhereOptions<Restaurant> = exceptId ? { slug, id: { [Op.ne]: exceptId } } : { slug };
  return (await Restaurant.count({ where })) > 0;
}

/** A free slug near `base` (base, base-2, base-3, …), never a reserved one. */
export async function freeSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base);
  for (let attempt = 0; attempt < 50; attempt++) {
    const candidate = attempt === 0 ? root : `${root.slice(0, 55)}-${attempt + 1}`;
    if (isReservedSlug(candidate)) continue;
    if (!(await slugTaken(candidate, exceptId))) return candidate;
  }
  return `${root.slice(0, 50)}-${generateOpaqueToken(4).toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

/** GET /api/superadmin/slug-check?slug= — live feedback for the wizard's slug field. */
export async function checkSlug(raw: string, restaurantId?: string): Promise<SlugCheckDto> {
  const parsed = slugSchema.safeParse(raw);
  const suggestion = await freeSlug(raw || 'restaurant', restaurantId);
  if (!parsed.success) {
    const reserved = isReservedSlug(raw.trim().toLowerCase());
    return { slug: raw, available: false, reason: reserved ? 'reserved' : 'invalid', suggestion };
  }
  const taken = await slugTaken(parsed.data, restaurantId);
  return { slug: parsed.data, available: !taken, reason: taken ? 'taken' : null, suggestion: taken ? suggestion : parsed.data };
}

/* ------------------------------------------------------------------ create (wizard step 1), update, delete */

/** POST /api/superadmin/restaurants — a venue without an owner yet; the wizard adds one in step 2. */
export async function createRestaurant(input: SuperadminCreateRestaurantInput): Promise<SuperadminRestaurantDetailDto> {
  const slug = input.slug ? input.slug : await freeSlug(input.name);
  if (await slugTaken(slug)) throw conflict('SLUG_TAKEN', 'This slug is already in use');
  const supportedLocales = input.supportedLocales ?? ['sr', 'en'];
  const defaultLocale = input.defaultLocale ?? 'sr';
  if (!supportedLocales.includes(defaultLocale)) throw badRequest('supportedLocales must include defaultLocale');
  const restaurant = await Restaurant.create({
    slug,
    name: input.name,
    status: 'trial',
    plan: 'trial',
    trialEndsAt: new Date(Date.now() + 14 * DAY_MS),
    onboardingStep: 2,
    ...definedOnly({
      city: input.city,
      address: input.address,
      timezone: input.timezone,
      currency: input.currency,
      defaultLocale,
      supportedLocales,
      tagline: input.tagline,
      menuNote: input.menuNote,
      primaryColor: input.primaryColor,
      orderingMode: input.orderingMode,
    }),
  });
  await audit.record({
    restaurantId: restaurant.id,
    action: 'admin.restaurant_create',
    entity: { type: 'restaurant', id: restaurant.id, label: restaurant.name },
    after: { slug: restaurant.slug, city: restaurant.city },
  });
  return getRestaurantDetail(restaurant.id);
}

const AUDITED_KEYS = [
  'name', 'slug', 'city', 'address', 'timezone', 'currency', 'defaultLocale', 'supportedLocales', 'tagline', 'menuNote',
  'primaryColor', 'orderingMode', 'status', 'plan', 'trialEndsAt', 'modules', 'billingNote', 'paidUntil', 'adminNotes', 'onboardingStep',
] as const;

export async function updateRestaurant(restaurantId: string, input: SuperadminUpdateRestaurantInput): Promise<SuperadminRestaurantDetailDto> {
  const restaurant = await loadRestaurant(restaurantId);
  if (input.slug && input.slug !== restaurant.slug && (await slugTaken(input.slug, restaurantId))) {
    throw conflict('SLUG_TAKEN', 'This slug is already in use');
  }
  const supportedLocales: string[] = input.supportedLocales ?? restaurant.supportedLocales;
  const defaultLocale: string = input.defaultLocale ?? restaurant.defaultLocale;
  if (!supportedLocales.includes(defaultLocale)) throw badRequest('supportedLocales must include defaultLocale');
  // A module whose global feature flag is off cannot be switched by anyone: the UI shows it as "not available
  // yet" and sends it back masked, so the stored value is left alone rather than overwritten.
  const modules = input.modules
    ? Object.fromEntries(Object.entries(input.modules).filter(([key]) => featureEnabled(key as ModuleKey)))
    : undefined;
  const snapshot = () => Object.fromEntries(AUDITED_KEYS.map((key) => [key, restaurant.get(key)])) as Record<string, unknown>;
  const before = snapshot();
  const { modules: _modules, trialEndsAt, ...rest } = input;
  void _modules;
  await restaurant.update(
    definedOnly({
      ...rest,
      trialEndsAt: trialEndsAt === undefined ? undefined : trialEndsAt ? new Date(trialEndsAt) : null,
      modules: modules ? { ...DEFAULT_MODULES, ...restaurant.modules, ...modules } : undefined,
    }),
  );
  const changes = audit.diff(before, snapshot());
  if (changes) {
    await audit.record({
      restaurantId,
      action: 'admin.restaurant_update',
      entity: { type: 'restaurant', id: restaurantId, label: restaurant.name },
      ...changes,
    });
  }
  return getRestaurantDetail(restaurantId);
}

/** DELETE /api/superadmin/restaurants/:id — the venue's own audit rows cascade away, so the trace is platform-level. */
export async function deleteRestaurant(restaurantId: string): Promise<void> {
  const restaurant = await loadRestaurant(restaurantId);
  await deleteVenue(restaurantId);
  await audit.record({
    restaurantId: null,
    action: 'admin.restaurant_delete',
    entity: { type: 'restaurant', id: restaurantId, label: restaurant.name },
    before: { slug: restaurant.slug, city: restaurant.city, status: restaurant.status, plan: restaurant.plan },
  });
}

/* ------------------------------------------------------------------ "Open as owner" */

/**
 * POST /api/superadmin/restaurants/:id/impersonate — a token that lets the superadmin use the venue's CMS as its
 * owner for IMPERSONATION_LIMITS.ttlMinutes, without touching the owner's password or sessions. Audited.
 */
export async function impersonate(restaurantId: string, admin: AuthUser): Promise<ImpersonationDto> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['id', 'name', 'slug'] });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  const owners = await ownersFor([restaurant.id]);
  const owner = owners.get(restaurant.id) ?? null;
  const { token, expiresAt } = signImpersonationToken(admin.id, restaurant.id);
  await audit.record({
    restaurantId: restaurant.id,
    action: 'auth.impersonate',
    entity: { type: 'restaurant', id: restaurant.id, label: restaurant.name },
    after: { owner: owner?.email ?? null, expiresAt: expiresAt.toISOString() },
  });
  return {
    token,
    expiresAt: expiresAt.toISOString(),
    restaurant: { id: restaurant.id, name: restaurant.name, slug: restaurant.slug },
    owner,
  };
}
