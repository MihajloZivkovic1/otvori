import { Op, type Order } from 'sequelize';
import {
  isEffectivelyAvailable,
  pickLocale,
  promotionMenuItemIds,
  resolveText,
  type CreatePromotionInput,
  type PromotionBody,
  type PromotionDto,
  type PublicPromotionDto,
  type PublicPromotionItemDto,
  type TogglePromotionInput,
  type UpdatePromotionInput,
} from '@qr-menu/shared';
import { Category, MenuItem, Promotion, Restaurant } from '../../db/models/index.js';
import { badRequest, notFound } from '../../utils/errors.js';
import { processItemImage } from '../../utils/images.js';
import { definedOnly, toIso } from '../../utils/objects.js';
import { deleteStoredUrl, storage } from '../../utils/storage.js';
import * as audit from '../audit/service.js';
import { loadPublishedRestaurant, orderableOnPos } from '../public/service.js';
import { isPromotionActiveNow } from './active.js';

/** Highest priority first, then the newest. The public endpoint picks its single modal in the same order. */
const PROMOTION_ORDER: Order = [
  ['priority', 'DESC'],
  ['createdAt', 'DESC'],
];

function bodyOf(promotion: Promotion): PromotionBody {
  // The column pair is validated by the shared discriminated union on every write.
  return { template: promotion.template, content: promotion.content } as PromotionBody;
}

export function toPromotionDto(promotion: Promotion, timezone: string, now = new Date()): PromotionDto {
  return {
    ...bodyOf(promotion),
    id: promotion.id,
    restaurantId: promotion.restaurantId,
    title: promotion.title,
    display: promotion.display,
    accentColor: promotion.accentColor,
    priority: promotion.priority,
    isActive: promotion.isActive,
    startsAt: toIso(promotion.startsAt),
    endsAt: toIso(promotion.endsAt),
    recurrence: promotion.recurrence,
    style: promotion.style,
    imageUrl: promotion.imageUrl,
    isActiveNow: isPromotionActiveNow(promotion, timezone, now),
    createdAt: promotion.createdAt.toISOString(),
    updatedAt: promotion.updatedAt.toISOString(),
  };
}

async function loadRestaurant(restaurantId: string): Promise<Restaurant> {
  const restaurant = await Restaurant.findByPk(restaurantId, { attributes: ['id', 'timezone'] });
  if (!restaurant) throw notFound('Restaurant not found', 'RESTAURANT_NOT_FOUND');
  return restaurant;
}

async function loadPromotion(restaurantId: string, promotionId: string): Promise<Promotion> {
  const promotion = await Promotion.findOne({ where: { id: promotionId, restaurantId } });
  if (!promotion) throw notFound('Promotion not found');
  return promotion;
}

/** Used by the `/admin/promotions/:promoId` routes to find the venue the membership check applies to. */
export async function restaurantIdOfPromotion(promotionId: string): Promise<string> {
  const promotion = await Promotion.findByPk(promotionId, { attributes: ['restaurantId'] });
  if (!promotion) throw notFound('Promotion not found');
  return promotion.restaurantId;
}

export async function listPromotions(restaurantId: string): Promise<PromotionDto[]> {
  const [restaurant, promotions] = await Promise.all([
    loadRestaurant(restaurantId),
    Promotion.findAll({ where: { restaurantId }, order: PROMOTION_ORDER }),
  ]);
  const now = new Date();
  return promotions.map((promotion) => toPromotionDto(promotion, restaurant.timezone, now));
}

export async function getPromotion(restaurantId: string, promotionId: string): Promise<PromotionDto> {
  const [restaurant, promotion] = await Promise.all([loadRestaurant(restaurantId), loadPromotion(restaurantId, promotionId)]);
  return toPromotionDto(promotion, restaurant.timezone);
}

/** Items referenced by the content must belong to this venue (a foreign id is a 404 like everywhere else). */
async function assertItemsBelong(restaurantId: string, body: PromotionBody): Promise<void> {
  const ids = promotionMenuItemIds(body);
  if (ids.length === 0) return;
  const count = await MenuItem.count({ where: { restaurantId, id: { [Op.in]: ids } } });
  if (count !== ids.length) throw notFound('Menu item not found');
}

function auditSnapshot(promotion: Promotion): Record<string, unknown> {
  return {
    title: promotion.title,
    template: promotion.template,
    display: promotion.display,
    accentColor: promotion.accentColor,
    priority: promotion.priority,
    isActive: promotion.isActive,
    startsAt: toIso(promotion.startsAt),
    endsAt: toIso(promotion.endsAt),
    recurrence: promotion.recurrence,
    style: promotion.style,
    content: promotion.content,
  };
}

export async function createPromotion(restaurantId: string, input: CreatePromotionInput): Promise<PromotionDto> {
  const restaurant = await loadRestaurant(restaurantId);
  const { template, content, ...fields } = input;
  await assertItemsBelong(restaurantId, { template, content } as PromotionBody);
  const promotion = await Promotion.create({
    restaurantId,
    title: fields.title,
    template,
    content,
    display: fields.display ?? 'card',
    accentColor: fields.accentColor ?? null,
    priority: fields.priority ?? 0,
    isActive: fields.isActive ?? true,
    startsAt: fields.startsAt ? new Date(fields.startsAt) : null,
    endsAt: fields.endsAt ? new Date(fields.endsAt) : null,
    recurrence: fields.recurrence ?? null,
    style: fields.style ?? null,
  });
  await audit.record({ restaurantId, action: 'promotion.create', entity: { type: 'promotion', id: promotion.id, label: promotion.title }, after: auditSnapshot(promotion) });
  return toPromotionDto(promotion, restaurant.timezone);
}

export async function updatePromotion(restaurantId: string, promotionId: string, input: UpdatePromotionInput): Promise<PromotionDto> {
  const [restaurant, promotion] = await Promise.all([loadRestaurant(restaurantId), loadPromotion(restaurantId, promotionId)]);
  const before = auditSnapshot(promotion);
  const { template, content, startsAt, endsAt, ...fields } = input;
  const changes: Partial<Promotion> = definedOnly(fields);
  if (template !== undefined) {
    await assertItemsBelong(restaurantId, { template, content } as PromotionBody);
    changes.template = template;
    changes.content = content;
  }
  if (startsAt !== undefined) changes.startsAt = startsAt ? new Date(startsAt) : null;
  if (endsAt !== undefined) changes.endsAt = endsAt ? new Date(endsAt) : null;
  // The dates must stay in order after a partial patch too.
  const nextStart = changes.startsAt !== undefined ? changes.startsAt : promotion.startsAt;
  const nextEnd = changes.endsAt !== undefined ? changes.endsAt : promotion.endsAt;
  if (nextStart && nextEnd && nextEnd.getTime() < nextStart.getTime()) {
    throw badRequest('Request validation failed', [{ path: 'endsAt', message: 'The end must be after the start', code: 'custom' }]);
  }
  const previousImage = promotion.imageUrl;
  await promotion.update(changes);
  if (input.imageUrl === null && previousImage) await deleteStoredUrl(previousImage);
  const diff = audit.diff(before, auditSnapshot(promotion));
  if (diff) await audit.record({ restaurantId, action: 'promotion.update', entity: { type: 'promotion', id: promotionId, label: promotion.title }, ...diff });
  return toPromotionDto(promotion, restaurant.timezone);
}

export async function togglePromotion(restaurantId: string, promotionId: string, input: TogglePromotionInput): Promise<PromotionDto> {
  const [restaurant, promotion] = await Promise.all([loadRestaurant(restaurantId), loadPromotion(restaurantId, promotionId)]);
  if (promotion.isActive !== input.isActive) {
    await promotion.update({ isActive: input.isActive });
    await audit.record({
      restaurantId,
      action: 'promotion.toggle',
      entity: { type: 'promotion', id: promotionId, label: promotion.title },
      before: { isActive: !input.isActive },
      after: { isActive: input.isActive },
    });
  }
  return toPromotionDto(promotion, restaurant.timezone);
}

export async function deletePromotion(restaurantId: string, promotionId: string): Promise<void> {
  const promotion = await loadPromotion(restaurantId, promotionId);
  await promotion.destroy();
  await deleteStoredUrl(promotion.imageUrl);
  await audit.record({ restaurantId, action: 'promotion.delete', entity: { type: 'promotion', id: promotionId, label: promotion.title }, before: auditSnapshot(promotion) });
}

/** Same pipeline as the menu-item photo (800×800 WebP); the previous file is removed. */
export async function uploadPromotionImage(restaurantId: string, promotionId: string, file: Buffer): Promise<PromotionDto> {
  const [restaurant, promotion] = await Promise.all([loadRestaurant(restaurantId), loadPromotion(restaurantId, promotionId)]);
  const webp = await processItemImage(file);
  const key = `restaurants/${restaurantId}/promotions/${promotion.id}-${Date.now()}.webp`;
  const url = await storage.put(key, webp, 'image/webp');
  const previous = promotion.imageUrl;
  await promotion.update({ imageUrl: url });
  await deleteStoredUrl(previous);
  await audit.record({ restaurantId, action: 'promotion.image', entity: { type: 'promotion', id: promotionId, label: promotion.title }, after: { imageUrl: url } });
  return toPromotionDto(promotion, restaurant.timezone);
}

/* ------------------------------------------------------------------ public */

/**
 * Promotions that are active right now for a published venue, highest priority first, with at most one `modal`
 * (the first in that order) and every referenced menu item resolved in the requested locale.
 */
export async function listPublicPromotions(slug: string, requestedLocale?: string, now = new Date()): Promise<PublicPromotionDto[]> {
  const restaurant = await loadPublishedRestaurant(slug);
  const locale = pickLocale(requestedLocale, restaurant.supportedLocales, restaurant.defaultLocale);
  const fallback = restaurant.defaultLocale;
  const rows = await Promotion.findAll({ where: { restaurantId: restaurant.id, isActive: true }, order: PROMOTION_ORDER });

  let modalTaken = false;
  const active = rows.filter((promotion) => {
    if (!isPromotionActiveNow(promotion, restaurant.timezone, now)) return false;
    if (promotion.display !== 'modal') return true;
    if (modalTaken) return false;
    modalTaken = true;
    return true;
  });

  const itemIds = [...new Set(active.flatMap((promotion) => promotionMenuItemIds(bodyOf(promotion))))];
  const itemsById = new Map<string, PublicPromotionItemDto>();
  if (itemIds.length > 0) {
    const [items, hiddenCategories] = await Promise.all([
      MenuItem.findAll({ where: { restaurantId: restaurant.id, id: { [Op.in]: itemIds } } }),
      Category.findAll({ where: { restaurantId: restaurant.id, isHidden: true }, attributes: ['id'] }),
    ]);
    const hidden = new Set(hiddenCategories.map((category) => category.id));
    for (const item of items) {
      itemsById.set(item.id, {
        id: item.id,
        name: resolveText(item.name, locale, fallback),
        description: item.description ? resolveText(item.description, locale, fallback) || null : null,
        priceCents: item.priceCents,
        imageUrl: item.imageUrl,
        thumbnailUrl: item.thumbnailUrl,
        isAvailable:
          !hidden.has(item.categoryId) && isEffectivelyAvailable(item.isAvailable, item.unavailableUntil, now) && orderableOnPos(restaurant, item),
      });
    }
  }

  return active.map((promotion) => ({
    ...bodyOf(promotion),
    id: promotion.id,
    title: promotion.title,
    display: promotion.display,
    accentColor: promotion.accentColor,
    style: promotion.style,
    priority: promotion.priority,
    imageUrl: promotion.imageUrl,
    updatedAt: promotion.updatedAt.toISOString(),
    items: promotionMenuItemIds(bodyOf(promotion))
      .map((id) => itemsById.get(id))
      .filter((item): item is PublicPromotionItemDto => Boolean(item)),
  }));
}
