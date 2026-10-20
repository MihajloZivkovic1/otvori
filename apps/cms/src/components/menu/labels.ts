import { ALLERGENS, TAGS, type Allergen, type Tag } from '@qr-menu/shared';

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  G: 'Gluten',
  M: 'Milk',
  E: 'Egg',
  N: 'Nuts',
  S: 'Soy',
  F: 'Fish',
  C: 'Celery',
  Se: 'Sesame',
};

export const TAG_LABELS: Record<Tag, string> = { vegan: 'Vegan', spicy: 'Spicy', new: 'New' };

export function knownAllergens(values: readonly string[]): Allergen[] {
  return values.filter((v): v is Allergen => (ALLERGENS as readonly string[]).includes(v));
}

export function knownTags(values: readonly string[]): Tag[] {
  return values.filter((v): v is Tag => (TAGS as readonly string[]).includes(v));
}
