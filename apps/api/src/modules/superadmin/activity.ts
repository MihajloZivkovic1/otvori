import { Op, type WhereOptions } from 'sequelize';
import type { SuperadminActivityPageDto, SuperadminActivityQuery } from '@qr-menu/shared';
import { AuditLog, Restaurant } from '../../db/models/index.js';
import { kindWhere, toAuditEntryDto } from '../audit/service.js';

/** GET /api/superadmin/activity — every venue's audit log plus the platform-level rows, with filters. */
export async function listActivity(query: SuperadminActivityQuery): Promise<SuperadminActivityPageDto> {
  const where: WhereOptions<AuditLog> = { ...kindWhere(query) };
  if (query.restaurantId) Object.assign(where, { restaurantId: query.restaurantId });
  if (query.userId) Object.assign(where, { userId: query.userId });
  if (query.from || query.to) {
    Object.assign(where, {
      createdAt: {
        ...(query.from ? { [Op.gte]: new Date(query.from) } : {}),
        ...(query.to ? { [Op.lte]: new Date(query.to) } : {}),
      },
    });
  }
  const [{ rows, count }, restaurants, users] = await Promise.all([
    AuditLog.findAndCountAll({
      where,
      include: [{ model: Restaurant, attributes: ['id', 'name'], required: false }],
      order: [['createdAt', 'DESC']],
      limit: query.pageSize,
      offset: (query.page - 1) * query.pageSize,
    }),
    Restaurant.findAll({ attributes: ['id', 'name'], order: [['name', 'ASC']] }),
    AuditLog.findAll({
      where: { userId: { [Op.ne]: null } },
      attributes: ['userId', 'userName'],
      group: ['userId', 'userName'],
      order: [['userName', 'ASC']],
      limit: 500,
    }),
  ]);
  const seen = new Map<string, string>();
  for (const u of users) if (u.userId && !seen.has(u.userId)) seen.set(u.userId, u.userName ?? '');
  return {
    items: rows.map((row) => ({
      ...toAuditEntryDto(row),
      restaurant: row.restaurant ? { id: row.restaurant.id, name: row.restaurant.name } : null,
    })),
    total: count,
    page: query.page,
    pageSize: query.pageSize,
    restaurants: restaurants.map((r) => ({ id: r.id, name: r.name })),
    users: [...seen].map(([id, name]) => ({ id, name })),
  };
}
