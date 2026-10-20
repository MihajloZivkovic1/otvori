import { Op, literal, type FindAttributeOptions } from 'sequelize';
import type {
  PaginatedDto,
  SuperadminListRestaurantsQuery,
  SuperadminRestaurantDto,
  SuperadminUpdateRestaurantInput,
} from '@qr-menu/shared';
import { Membership, Restaurant, User } from '../../db/models/index.js';
import { notFound } from '../../utils/errors.js';
import { definedOnly, toIso } from '../../utils/objects.js';

const TABLE_COUNT = literal('(SELECT COUNT(*) FROM tables t WHERE t.restaurant_id = "Restaurant"."id")');
const ITEM_COUNT = literal('(SELECT COUNT(*) FROM menu_items mi WHERE mi.restaurant_id = "Restaurant"."id")');
const COUNT_ATTRIBUTES: FindAttributeOptions = {
  include: [
    [TABLE_COUNT, 'tableCount'],
    [ITEM_COUNT, 'itemCount'],
  ],
};

type Owner = { id: string; name: string; email: string } | null;

function toDto(restaurant: Restaurant, owner: Owner): SuperadminRestaurantDto {
  return {
    id: restaurant.id,
    slug: restaurant.slug,
    name: restaurant.name,
    city: restaurant.city,
    status: restaurant.status,
    plan: restaurant.plan,
    trialEndsAt: toIso(restaurant.trialEndsAt),
    publishedAt: toIso(restaurant.publishedAt),
    tableCount: Number(restaurant.get('tableCount') ?? 0),
    itemCount: Number(restaurant.get('itemCount') ?? 0),
    owner,
    createdAt: restaurant.createdAt.toISOString(),
    updatedAt: restaurant.updatedAt.toISOString(),
  };
}

async function ownersFor(restaurantIds: string[]): Promise<Map<string, Owner>> {
  if (restaurantIds.length === 0) return new Map();
  const memberships = await Membership.findAll({
    where: { restaurantId: restaurantIds, role: 'owner' },
    include: [{ model: User, attributes: ['id', 'name', 'email'] }],
  });
  const map = new Map<string, Owner>();
  for (const membership of memberships) {
    if (!map.has(membership.restaurantId) && membership.user) {
      const { id, name, email } = membership.user;
      map.set(membership.restaurantId, { id, name, email });
    }
  }
  return map;
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (match) => `\\${match}`);

export async function listRestaurants(
  query: SuperadminListRestaurantsQuery,
): Promise<PaginatedDto<SuperadminRestaurantDto>> {
  const pattern = query.search ? `%${escapeLike(query.search)}%` : null;
  const { rows, count } = await Restaurant.findAndCountAll({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.plan ? { plan: query.plan } : {}),
      ...(pattern
        ? { [Op.or]: [{ name: { [Op.iLike]: pattern } }, { city: { [Op.iLike]: pattern } }, { slug: { [Op.iLike]: pattern } }] }
        : {}),
    },
    attributes: COUNT_ATTRIBUTES,
    order: [['updatedAt', 'DESC']],
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  const owners = await ownersFor(rows.map((r) => r.id));
  return {
    items: rows.map((r) => toDto(r, owners.get(r.id) ?? null)),
    total: count,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function updateRestaurant(
  restaurantId: string,
  input: SuperadminUpdateRestaurantInput,
): Promise<SuperadminRestaurantDto> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: COUNT_ATTRIBUTES });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  await restaurant.update(
    definedOnly({
      status: input.status,
      plan: input.plan,
      trialEndsAt: input.trialEndsAt === undefined ? undefined : input.trialEndsAt ? new Date(input.trialEndsAt) : null,
    }),
  );
  const owners = await ownersFor([restaurant.id]);
  return toDto(restaurant, owners.get(restaurant.id) ?? null);
}
