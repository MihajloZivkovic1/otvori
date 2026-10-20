import { useState } from 'react';
import type { Locale, MenuItemDto } from '@qr-menu/shared';
import { errorMessage } from '../../lib/api';
import { useDeleteItem } from '../../lib/queries';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { Button } from '../ui/Button';
import { ConfirmModal } from '../ui/Modal';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import { ItemFields } from './ItemFields';
import { LangTabs, primaryLocale } from './LangTabs';
import { useItemForm } from './useItemForm';

interface ItemSheetProps {
  item: MenuItemDto | null;
  categoryId: string;
  onClose: () => void;
}

/** Mobile item editor (design M7): full-screen modal, sticky Save above the safe area. */
export function ItemSheet({ item, categoryId, onClose }: ItemSheetProps) {
  const { restaurant, isOwner } = useRestaurantContext();
  const toast = useToast();
  const primary = primaryLocale(restaurant.defaultLocale);
  const [lang, setLang] = useState<Locale>(primary);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deleteItem = useDeleteItem(restaurant.id);
  const editor = useItemForm({ restaurant, categoryId, item, onSaved: onClose });
  const title = item ? 'Edit item' : 'New item';

  const requestClose = () => {
    if (editor.isDirty) setConfirmDiscard(true);
    else onClose();
  };

  return (
    <>
      <Sheet
        open
        onClose={requestClose}
        title={title}
        header={
          <header className="safe-top flex items-center justify-between border-b border-line px-4 pb-2">
            <Button variant="accent-text" className="h-11 px-1 font-medium text-base" onClick={requestClose}>
              Cancel
            </Button>
            <span className="text-[17px] font-semibold">{title}</span>
            <div className="flex min-w-[64px] justify-end">
              <LangTabs supported={restaurant.supportedLocales} value={lang} onChange={setLang} />
            </div>
          </header>
        }
        footer={
          <div className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
            <Button variant="primary" block className="h-[50px] rounded-xl text-base" onClick={() => void editor.submit()} loading={editor.saving}>
              Save
            </Button>
          </div>
        }
      >
        <form
          className="flex flex-col gap-5 px-5 pb-6 pt-5"
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
            layout="sheet"
          />
          {item && isOwner ? (
            <Button variant="danger-ghost" size="xl" className="text-[15px]" onClick={() => setConfirmDelete(true)}>
              Delete item
            </Button>
          ) : null}
        </form>
      </Sheet>
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
