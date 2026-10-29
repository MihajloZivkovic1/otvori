import { useState } from 'react';
import type { Locale, MenuItemDto } from '@qr-menu/shared';
import { useSaveShortcut } from '../../hooks/useFormGuards';
import { errorMessage } from '../../lib/api';
import { useDeleteItem } from '../../lib/queries';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { ConfirmModal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { ItemFields } from './ItemFields';
import { LangTabs, primaryLocale } from './LangTabs';
import { useItemForm } from './useItemForm';

interface ItemDrawerProps {
  item: MenuItemDto | null;
  categoryId: string;
  onClose: () => void;
}

/** Desktop item editor (design: 480px right drawer, 420px at ≤1024px). */
export function ItemDrawer({ item, categoryId, onClose }: ItemDrawerProps) {
  const { restaurant, isOwner } = useRestaurantContext();
  const toast = useToast();
  const primary = primaryLocale(restaurant.defaultLocale);
  const [lang, setLang] = useState<Locale>(primary);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteItem = useDeleteItem(restaurant.id);
  const editor = useItemForm({ restaurant, categoryId, item, onSaved: onClose });
  useSaveShortcut(() => void editor.submit());

  const requestClose = () => {
    if (editor.isDirty) setConfirmDiscard(true);
    else onClose();
  };

  return (
    <>
      <Drawer
        open
        onClose={requestClose}
        title={item ? 'Edit item' : 'New item'}
        headerExtra={<LangTabs supported={restaurant.supportedLocales} value={lang} onChange={setLang} />}
        footer={
          <div className="flex items-center justify-between">
            {item && isOwner ? (
              <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                Delete item
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button onClick={requestClose}>Cancel</Button>
              <Button variant="primary" onClick={() => void editor.submit()} loading={editor.saving}>
                Save
              </Button>
            </div>
          </div>
        }
      >
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void editor.submit();
          }}
        >
          <ItemFields
            editor={editor}
            lang={lang}
            primaryLang={primary}
            currency={restaurant.currency}
            currentImageUrl={item?.imageUrl ?? null}
            layout="drawer"
          />
          <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
            Submit
          </button>
        </form>
      </Drawer>
      <ConfirmModal
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        title="Discard changes?"
        description="Your edits to this item will be lost."
        confirmLabel="Discard"
        danger
      />
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          item &&
          deleteItem.mutate(item.id, {
            onSuccess: () => {
              toast.success('Item deleted');
              setConfirmDelete(false);
              onClose();
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
        title="Delete this item?"
        description="Guests will no longer see it. This cannot be undone."
        confirmLabel="Delete item"
        danger
        loading={deleteItem.isPending}
      />
    </>
  );
}
