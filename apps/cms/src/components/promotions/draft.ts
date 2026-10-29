import {
  createPromotionSchema,
  type CreatePromotionInput,
  type DealContent,
  type DrinkListContent,
  type FeaturedItemsContent,
  type MenuItemDto,
  type NoticeContent,
  type PromotionBody,
  type PromotionDisplay,
  type PromotionDto,
  type PromotionStyle,
  type PromotionTemplate,
  type PublicPromotionItemDto,
  type RestaurantDto,
} from '@qr-menu/shared';
import type { PromotionLike } from '@qr-menu/menu/promotions';
import { text } from '../../lib/format';

/** Recurrence as the form holds it: the switch plus the window. */
export interface DraftRecurrence {
  enabled: boolean;
  weekdays: number[];
  from: string;
  to: string;
}

/**
 * Editor state. Every template keeps its own content so switching templates (step 1) never loses what was typed;
 * only the chosen one is sent. Dates are `datetime-local` strings ('' = none).
 */
export interface PromotionDraft {
  title: string;
  template: PromotionTemplate;
  drinkList: DrinkListContent;
  featured: FeaturedItemsContent;
  deal: DealContent;
  notice: NoticeContent;
  display: PromotionDisplay;
  accentColor: string | null;
  priority: number;
  isActive: boolean;
  startsAt: string;
  endsAt: string;
  recurrence: DraftRecurrence;
  /** Colour / pill overrides (null fields = template defaults). */
  style: Required<PromotionStyle>;
}

export const DRINK_LIST_VARIANT_META: Record<NonNullable<DrinkListContent['variant']>, { name: string; description: string }> = {
  poster: { name: 'Poster', description: 'The printed card: vertical title on the left, three drink icons.' },
  simple: { name: 'Simple', description: 'Title across the top, no icons — more room for the drinks.' },
  chalk: { name: 'Chalkboard', description: 'Dark board with light type and a dashed frame.' },
};

export const TEMPLATE_META: Record<PromotionTemplate, { name: string; description: string }> = {
  drink_list: { name: 'Drink list', description: 'A printed-style card: vertical title, two columns of drinks with their ingredients.' },
  featured_items: { name: 'Featured items', description: 'One to three dishes from the menu with photo and live price, each with a badge.' },
  deal: { name: 'Deal', description: 'One offer with a headline, the price and the old price struck through.' },
  notice: { name: 'Notice', description: 'A plain announcement: opening hours, a private event, a new terrace.' },
};

export const DISPLAY_META: Record<PromotionDisplay, { name: string; description: string }> = {
  modal: { name: 'Pop-up', description: 'Opens over the menu shortly after it loads. Once closed, it stays closed for 24 hours on that phone.' },
  banner: { name: 'Bottom banner', description: 'A bar at the bottom of the menu with “View”. Guests can tuck it into a small pill.' },
  card: { name: 'Inline card', description: 'A card above the first category. Tapping it opens the full promotion.' },
};

const DEFAULT_RECURRENCE: DraftRecurrence = { enabled: false, weekdays: [1, 2, 3, 4, 5], from: '16:00', to: '18:00' };

export function emptyDraft(restaurant: Pick<RestaurantDto, 'name'>): PromotionDraft {
  return {
    title: '',
    template: 'drink_list',
    drinkList: { logoText: restaurant.name, columns: 2, entries: [] },
    featured: { items: [] },
    deal: { headline: '', priceCents: Number.NaN },
    notice: { headline: '', body: '' },
    display: 'card',
    accentColor: null,
    priority: 0,
    isActive: true,
    startsAt: '',
    endsAt: '',
    recurrence: DEFAULT_RECURRENCE,
    style: { textColor: null, backgroundColor: null, pillPosition: null, pillColor: null, pillStyle: null, pillTextColor: null },
  };
}

/** ISO → the value a `datetime-local` input shows (local wall clock, minute precision). */
export function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `datetime-local` value → ISO (or null when empty / unparsable). */
export function toIsoOrNull(local: string): string | null {
  if (!local) return null;
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function draftFromDto(dto: PromotionDto, restaurant: Pick<RestaurantDto, 'name'>): PromotionDraft {
  const draft = emptyDraft(restaurant);
  switch (dto.template) {
    case 'drink_list':
      draft.drinkList = dto.content;
      break;
    case 'featured_items':
      draft.featured = dto.content;
      break;
    case 'deal':
      draft.deal = dto.content;
      break;
    case 'notice':
      draft.notice = dto.content;
      break;
  }
  return {
    ...draft,
    title: dto.title,
    template: dto.template,
    display: dto.display,
    accentColor: dto.accentColor,
    priority: dto.priority,
    isActive: dto.isActive,
    startsAt: toLocalInput(dto.startsAt),
    endsAt: toLocalInput(dto.endsAt),
    recurrence: dto.recurrence ? { enabled: true, ...dto.recurrence } : DEFAULT_RECURRENCE,
    style: {
      textColor: dto.style?.textColor ?? null,
      backgroundColor: dto.style?.backgroundColor ?? null,
      pillPosition: dto.style?.pillPosition ?? null,
      pillColor: dto.style?.pillColor ?? null,
      pillStyle: dto.style?.pillStyle ?? null,
      pillTextColor: dto.style?.pillTextColor ?? null,
    },
  };
}

const clean = (value: string | undefined): string | undefined => (value && value.trim() ? value.trim() : undefined);

/** The `{ template, content }` pair of the chosen template, with empty optionals dropped. */
export function draftBody(draft: PromotionDraft): PromotionBody {
  switch (draft.template) {
    case 'drink_list':
      return {
        template: 'drink_list',
        content: {
          subtitle: clean(draft.drinkList.subtitle),
          logoText: clean(draft.drinkList.logoText),
          columns: draft.drinkList.columns,
          variant: draft.drinkList.variant ?? 'poster',
          icons: draft.drinkList.icons ?? 'cocktails',
          entries: draft.drinkList.entries.map((entry) => ({
            name: entry.name.trim(),
            lines: entry.lines.map((line) => line.trim()).filter(Boolean),
            ...(entry.menuItemId ? { menuItemId: entry.menuItemId } : {}),
          })),
        },
      };
    case 'featured_items':
      return {
        template: 'featured_items',
        content: {
          intro: clean(draft.featured.intro),
          items: draft.featured.items.map((item) => ({ menuItemId: item.menuItemId, badge: clean(item.badge) })),
        },
      };
    case 'deal':
      return {
        template: 'deal',
        content: {
          headline: draft.deal.headline.trim(),
          description: clean(draft.deal.description),
          priceCents: draft.deal.priceCents,
          oldPriceCents: Number.isFinite(draft.deal.oldPriceCents) ? draft.deal.oldPriceCents : undefined,
          ...(draft.deal.menuItemId ? { menuItemId: draft.deal.menuItemId } : {}),
        },
      };
    case 'notice':
      return { template: 'notice', content: { headline: draft.notice.headline.trim(), body: draft.notice.body.trim() } };
  }
}

/** The create payload (also the PATCH payload: every field is sent, so the server state mirrors the form). */
export function draftToInput(draft: PromotionDraft): Record<string, unknown> {
  return {
    ...draftBody(draft),
    title: draft.title.trim(),
    display: draft.display,
    accentColor: draft.accentColor,
    priority: draft.priority,
    isActive: draft.isActive,
    startsAt: toIsoOrNull(draft.startsAt),
    endsAt: toIsoOrNull(draft.endsAt),
    recurrence: draft.recurrence.enabled ? { weekdays: [...draft.recurrence.weekdays].sort(), from: draft.recurrence.from, to: draft.recurrence.to } : null,
    style: draftStyle(draft),
  };
}

/** null when nothing is overridden, so the stored row stays clean. */
export function draftStyle(draft: PromotionDraft): PromotionStyle | null {
  const entries = Object.entries(draft.style).filter(([, value]) => value);
  return entries.length ? (Object.fromEntries(entries) as PromotionStyle) : null;
}

export type DraftErrors = Partial<Record<'title' | 'content' | 'display' | 'priority' | 'startsAt' | 'endsAt' | 'recurrence' | 'accentColor' | 'style', string>>;

/** Runs the shared schema; returns the typed input or the field errors to show. */
export function validateDraft(draft: PromotionDraft): { ok: true; input: CreatePromotionInput } | { ok: false; errors: DraftErrors } {
  const result = createPromotionSchema.safeParse(draftToInput(draft));
  if (result.success) return { ok: true, input: result.data };
  const errors: DraftErrors = {};
  for (const issue of result.error.issues) {
    const [head, ...rest] = issue.path.map(String);
    const key = (head ?? 'content') as keyof DraftErrors;
    if (errors[key]) continue;
    errors[key] = head === 'content' && rest.length ? `${rest.join(' › ')}: ${issue.message}` : issue.message;
  }
  return { ok: false, errors };
}

/** A venue item as the templates expect it (the guest endpoint resolves these server-side). */
export function toPreviewItem(item: MenuItemDto, defaultLocale: string): PublicPromotionItemDto {
  return {
    id: item.id,
    name: text(item.name, defaultLocale),
    description: text(item.description, defaultLocale) || null,
    priceCents: item.priceCents,
    imageUrl: item.imageUrl,
    thumbnailUrl: item.thumbnailUrl,
    isAvailable: item.isEffectivelyAvailable,
  };
}

/** What the live preview renders from the unsaved form state. */
export function previewOf(draft: PromotionDraft, items: MenuItemDto[], defaultLocale: string, imageUrl: string | null): PromotionLike {
  const body = draftBody(draft);
  const ids = new Set<string>();
  if (body.template === 'drink_list') body.content.entries.forEach((entry) => entry.menuItemId && ids.add(entry.menuItemId));
  if (body.template === 'featured_items') body.content.items.forEach((item) => ids.add(item.menuItemId));
  if (body.template === 'deal' && body.content.menuItemId) ids.add(body.content.menuItemId);
  return {
    ...body,
    title: draft.title.trim() || TEMPLATE_META[draft.template].name,
    style: draftStyle(draft),
    imageUrl,
    items: items.filter((item) => ids.has(item.id)).map((item) => toPreviewItem(item, defaultLocale)),
  };
}

/** "Negroni — Gin, Campari" style description → ingredient lines for a picked drink. */
export function descriptionToLines(description: string | null): string[] {
  if (!description) return [];
  return description
    .split(/\r?\n|,|;|\//)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
}
