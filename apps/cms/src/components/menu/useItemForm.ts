import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  createItemSchema,
  type CreateItemInput,
  type MenuItemDto,
  type RestaurantDto,
  type TranslatedText,
  type UpdateItemInput,
} from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { cropSquare } from '../../lib/crop';
import { useCreateItem, useUpdateItem, useUploadItemImage } from '../../lib/queries';
import { useToast } from '../ui/Toast';
import { knownAllergens, knownTags } from './labels';

export type ItemFormValues = CreateItemInput;

function toFormValues(item: MenuItemDto | null, categoryId: string): Partial<ItemFormValues> {
  if (!item) {
    return {
      categoryId,
      name: { sr: '', en: '' },
      description: { sr: '', en: '' },
      priceCents: undefined,
      allergens: [],
      tags: [],
      isAvailable: true,
      unavailableUntil: null,
      variants: [],
    };
  }
  return {
    categoryId: item.categoryId,
    name: { sr: item.name.sr ?? '', en: item.name.en ?? '' },
    description: { sr: item.description?.sr ?? '', en: item.description?.en ?? '' },
    priceCents: item.priceCents,
    allergens: knownAllergens(item.allergens),
    tags: knownTags(item.tags),
    isAvailable: item.isEffectivelyAvailable,
    unavailableUntil: null,
    variants: item.variants.map((v) => ({ name: v.name, priceCents: v.priceCents })),
  };
}

function compact(value: TranslatedText | null | undefined): TranslatedText {
  const out: TranslatedText = {};
  for (const [locale, textValue] of Object.entries(value ?? {})) {
    const trimmed = textValue?.trim();
    if (trimmed) out[locale as keyof TranslatedText] = trimmed;
  }
  return out;
}

interface UseItemFormOptions {
  restaurant: RestaurantDto;
  categoryId: string;
  item: MenuItemDto | null;
  onSaved: (item: MenuItemDto) => void;
}

/**
 * Shared form state for the desktop drawer and the mobile sheet. Validation is the shared `createItemSchema`
 * (also used for updates: the API's update schema is the same shape with every field optional).
 */
export function useItemForm({ restaurant, categoryId, item, onSaved }: UseItemFormOptions) {
  const toast = useToast();
  const createItem = useCreateItem(restaurant.id);
  const updateItem = useUpdateItem(restaurant.id);
  const uploadImage = useUploadItemImage(restaurant.id);
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(createItemSchema),
    defaultValues: toFormValues(item, categoryId),
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [availabilityTouched, setAvailabilityTouched] = useState(false);

  const markAvailabilityTouched = useCallback(() => setAvailabilityTouched(true), []);

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const description = compact(values.description);
      const payload: UpdateItemInput = {
        categoryId: values.categoryId,
        name: compact(values.name),
        description: Object.keys(description).length ? description : null,
        priceCents: values.priceCents,
        allergens: values.allergens ?? [],
        tags: values.tags ?? [],
        variants: (values.variants ?? []).map((v, index) => ({ name: v.name, priceCents: v.priceCents, sortOrder: index })),
      };
      if (!item || availabilityTouched) {
        payload.isAvailable = values.isAvailable ?? true;
        payload.unavailableUntil = null;
      }
      let saved = item
        ? await updateItem.mutateAsync({ id: item.id, input: payload })
        : await createItem.mutateAsync(payload as CreateItemInput);
      if (photo) {
        const blob = await cropSquare(photo, zoom);
        saved = await uploadImage.mutateAsync({ id: saved.id, file: blob });
      }
      toast.success(item ? 'Item saved' : 'Item added');
      onSaved(saved);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save the item'));
    } finally {
      setSaving(false);
    }
  });

  return {
    form,
    submit,
    saving,
    photo,
    setPhoto,
    zoom,
    setZoom,
    markAvailabilityTouched,
    isDirty: form.formState.isDirty || photo !== null,
  };
}

export type ItemEditor = ReturnType<typeof useItemForm>;
