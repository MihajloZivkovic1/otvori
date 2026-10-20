import { useState, type FormEvent } from 'react';
import type { CategoryDto, TranslatedText } from '@qr-menu/shared';
import { LOCALES } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '../../lib/queries';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Field, Input } from '../ui/Field';
import { ConfirmModal, Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';

const LANG_NAMES: Record<string, string> = { sr: 'Serbian', en: 'English' };

interface CategoryModalProps {
  /** null = create. */
  category: CategoryDto | null;
  onClose: () => void;
  onCreated?: (category: CategoryDto) => void;
}

/** Create / rename a category in every supported language; owners can also delete it here. */
export function CategoryModal({ category, onClose, onCreated }: CategoryModalProps) {
  const { restaurant, isOwner } = useRestaurantContext();
  const toast = useToast();
  const locales = LOCALES.filter((l) => restaurant.supportedLocales.includes(l));
  const [names, setNames] = useState<TranslatedText>(() =>
    Object.fromEntries(locales.map((l) => [l, category?.name[l] ?? ''])) as TranslatedText,
  );
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const create = useCreateCategory(restaurant.id);
  const update = useUpdateCategory(restaurant.id);
  const remove = useDeleteCategory(restaurant.id);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name: TranslatedText = {};
    for (const [locale, value] of Object.entries(names)) {
      const trimmed = value?.trim();
      if (trimmed) name[locale as keyof TranslatedText] = trimmed;
    }
    if (Object.keys(name).length === 0) {
      setError('Enter a name in at least one language');
      return;
    }
    setError(null);
    try {
      if (category) {
        await update.mutateAsync({ id: category.id, input: { name } });
        toast.success('Category renamed');
      } else {
        const created = await create.mutateAsync({ name });
        toast.success('Category added');
        onCreated?.(created);
      }
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const pending = create.isPending || update.isPending;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={category ? 'Rename category' : 'New category'}
        footer={
          <>
            {category && isOwner ? (
              <Button variant="danger-ghost" className="mr-auto" onClick={() => setConfirmDelete(true)}>
                Delete category
              </Button>
            ) : null}
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={pending} onClick={(event) => void submit(event)}>
              {category ? 'Save' : 'Add category'}
            </Button>
          </>
        }
      >
        <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-4" noValidate>
          {locales.map((locale, index) => (
            <Field key={locale} label={`Name (${LANG_NAMES[locale] ?? locale.toUpperCase()})`} htmlFor={`cat-${locale}`} error={index === 0 ? error ?? undefined : undefined}>
              <Input
                id={`cat-${locale}`}
                value={names[locale] ?? ''}
                maxLength={500}
                data-autofocus={index === 0 || undefined}
                onChange={(event) => setNames((prev) => ({ ...prev, [locale]: event.target.value }))}
              />
            </Field>
          ))}
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Submit
          </button>
        </form>
      </Modal>
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          category &&
          remove.mutate(category.id, {
            onSuccess: () => {
              toast.success('Category deleted');
              setConfirmDelete(false);
              onClose();
            },
            onError: (err) => toast.error(errorMessage(err)),
          })
        }
        title="Delete this category?"
        description={`All ${category?.itemCount ?? 0} items in it will be deleted too. This cannot be undone.`}
        confirmLabel="Delete category"
        danger
        loading={remove.isPending}
      />
    </>
  );
}
