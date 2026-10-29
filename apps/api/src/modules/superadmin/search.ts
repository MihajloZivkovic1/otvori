import { Op, literal } from 'sequelize';
import { ADMIN_LIMITS, type SuperadminSearchDto } from '@qr-menu/shared';
import { MenuItem, Restaurant, RestaurantTable, User } from '../../db/models/index.js';
import { sequelize } from '../../db/sequelize.js';
import { labelOf } from '../audit/service.js';
import { escapeLike } from './service.js';

/** GET /api/superadmin/search?q= — the ⌘K palette: venues, users, menu items and tables across every venue. */
export async function search(q: string): Promise<SuperadminSearchDto> {
  const limit = ADMIN_LIMITS.searchLimit;
  const pattern = `%${escapeLike(q)}%`;
  const escaped = sequelize.escape(pattern);
  const number = /^\d{1,4}$/.test(q) ? Number(q) : null;
  const [restaurants, users, items, tables] = await Promise.all([
    Restaurant.findAll({
      where: { [Op.or]: [{ name: { [Op.iLike]: pattern } }, { slug: { [Op.iLike]: pattern } }, { city: { [Op.iLike]: pattern } }] },
      attributes: ['id', 'name', 'slug', 'city', 'status'],
      order: [['name', 'ASC']],
      limit,
    }),
    User.findAll({
      where: { [Op.or]: [{ name: { [Op.iLike]: pattern } }, { email: { [Op.iLike]: pattern } }] },
      attributes: ['id', 'name', 'email'],
      order: [['name', 'ASC']],
      limit,
    }),
    MenuItem.findAll({
      where: literal(`("MenuItem"."name"->>'sr' ILIKE ${escaped} OR "MenuItem"."name"->>'en' ILIKE ${escaped})`),
      attributes: ['id', 'name', 'restaurantId'],
      include: [{ model: Restaurant, attributes: ['id', 'name'] }],
      order: [['updatedAt', 'DESC']],
      limit,
    }),
    RestaurantTable.findAll({
      where: number !== null ? { [Op.or]: [{ number }, { label: { [Op.iLike]: pattern } }] } : { label: { [Op.iLike]: pattern } },
      attributes: ['id', 'label', 'number', 'restaurantId'],
      include: [{ model: Restaurant, attributes: ['id', 'name'] }],
      order: [['number', 'ASC']],
      limit,
    }),
  ]);
  return {
    restaurants: restaurants.map((r) => ({ id: r.id, name: r.name, slug: r.slug, city: r.city, status: r.status })),
    users: users.map((u) => ({ id: u.id, name: u.name, email: u.email })),
    items: items.map((i) => ({ id: i.id, name: labelOf(i.name) ?? '', restaurant: { id: i.restaurant?.id ?? i.restaurantId, name: i.restaurant?.name ?? '' } })),
    tables: tables.map((t) => ({ id: t.id, label: t.label, number: t.number, restaurant: { id: t.restaurant?.id ?? t.restaurantId, name: t.restaurant?.name ?? '' } })),
  };
}
