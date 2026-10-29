import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { CategoryDto, MenuItemDto } from '@qr-menu/shared';
import { Icon } from '../components/icons';
import { CategoryList } from '../components/menu/CategoryList';
import { CategoryModal } from '../components/menu/CategoryModal';
import { ImportMenuModal } from '../components/menu/ImportMenuModal';
import { verticalOnly } from '../components/menu/dnd';
import { ItemDrawer } from '../components/menu/ItemDrawer';
import { ItemSheet } from '../components/menu/ItemSheet';
import { ItemsTable } from '../components/menu/ItemsTable';
import { ItemThumb } from '../components/menu/ItemThumb';
import { primaryLocale } from '../components/menu/LangTabs';
import { MenuSkeleton, MobileMenuSkeleton } from '../components/menu/MenuSkeleton';
import { SwipeRow } from '../components/menu/SwipeRow';
import { LockGlyph } from '../components/security/LockStatus';
import { useGuard } from '../components/security/ElevationProvider';
import { MobileHeader } from '../components/shell/PageHeader';
import { useRestaurantContext } from '../components/shell/RestaurantLayout';
import { Button, IconButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmModal } from '../components/ui/Modal';
import { Switch } from '../components/ui/Switch';
import { useToast } from '../components/ui/Toast';
import { errorMessage } from '../lib/api';
import { cn } from '../lib/cn';
import { formatPrice, plural, text } from '../lib/format';
import {
  useCategories,
  useCreateCategory,
  useDeleteItem,
  useItems,
  useReorderCategories,
  useReorderItems,
  useSetAvailability,
  useUpdateCategory,
} from '../lib/queries';

export function MenuPage() {
  const { isMobile } = useRestaurantContext();
  return isMobile ? <MobileMenu /> : <DesktopMenu />;
}

/* ------------------------------------------------------------------ shared state */

function useMenuState() {
  const { restaurant } = useRestaurantContext();
  const rid = restaurant.id;
  const toast = useToast();
  const categoriesQuery = useCategories(rid);
  const itemsQuery = useItems(rid);
  const [params, setParams] = useSearchParams();

  const categories = categoriesQuery.data ?? [];
  const items = itemsQuery.data ?? [];
  const requested = params.get('c');
  const selectedId = requested && categories.some((c) => c.id === requested) ? requested : (categories[0]?.id ?? null);
  const selected = categories.find((c) => c.id === selectedId) ?? null;
  const categoryItems = items.filter((i) => i.categoryId === selectedId);

  const itemParam = params.get('item');
  const editing: MenuItemDto | 'new' | null =
    itemParam === 'new' ? 'new' : itemParam ? (items.find((i) => i.id === itemParam) ?? null) : null;

  const setParam = (key: string, value: string | null, replace: boolean) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace },
    );

  const updateCategory = useUpdateCategory(rid);
  const reorderCategories = useReorderCategories(rid);
  const reorderItems = useReorderItems(rid);
  const setAvailability = useSetAvailability(rid);
  const deleteItem = useDeleteItem(rid);
  const createCategory = useCreateCategory(rid);
  const onError = (error: unknown) => toast.error(errorMessage(error));

  return {
    restaurant,
    categoriesQuery,
    itemsQuery,
    loading: categoriesQuery.isPending || itemsQuery.isPending,
    error: categoriesQuery.error ?? itemsQuery.error,
    categories,
    items,
    selected,
    selectedId,
    categoryItems,
    editing,
    select: (id: string) => setParam('c', id, true),
    openItem: (id: string | 'new') => setParam('item', id, false),
    closeItem: () => setParam('item', null, true),
    toggleHidden: (category: CategoryDto) =>
      updateCategory.mutate({ id: category.id, input: { isHidden: !category.isHidden } }, { onError }),
    reorderCategories: (ids: string[]) => reorderCategories.mutate(ids, { onError }),
    reorderItems: (ids: string[]) => reorderItems.mutate(ids, { onError }),
    toggleAvailable: (item: MenuItemDto, available: boolean) =>
      setAvailability.mutate({ id: item.id, input: { available } }, { onError }),
    deleteItem,
    createCategory: async (name: string) => {
      try {
        const created = await createCategory.mutateAsync({ name: { [primaryLocale(restaurant.defaultLocale)]: name } });
        setParam('c', created.id, true);
      } catch (error) {
        onError(error);
      }
    },
  };
}

function summaryOf(category: CategoryDto, items: MenuItemDto[]): string {
  const unavailable = items.filter((i) => !i.isEffectivelyAvailable).length;
  const parts = [plural(items.length, 'item', 'items'), `${unavailable} unavailable`];
  if (category.isHidden) parts.push('hidden from guests');
  return parts.join(' · ');
}

function LoadError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <EmptyState
      icon="warning"
      title="Could not load the menu"
      description={errorMessage(error)}
      actions={
        <Button variant="primary" onClick={retry}>
          Try again
        </Button>
      }
    />
  );
}

/* ------------------------------------------------------------------ desktop */

function DesktopMenu() {
  const state = useMenuState();
  const { restaurant, isOwner } = useRestaurantContext();
  const { guard } = useGuard();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [renaming, setRenaming] = useState<CategoryDto | null>(null);
  const [deleting, setDeleting] = useState<MenuItemDto | null>(null);

  if (state.loading) return <MenuSkeleton />;
  if (state.error) {
    return (
      <LoadError
        error={state.error}
        retry={() => {
          void state.categoriesQuery.refetch();
          void state.itemsQuery.refetch();
        }}
      />
    );
  }

  if (state.categories.length === 0) {
    return (
      <>
        <EmptyState
          title="Your menu is empty"
          description="Start with a category like “Coffee” or “Mains”, then add items to it. Guests see changes the moment you publish."
          actions={
            isOwner ? (
              <>
                <Button variant="primary" icon={<LockGlyph />} onClick={guard(() => setCreating(true))}>
                  Add first category
                </Button>
                <Button icon={<LockGlyph />} onClick={guard(() => setImporting(true))}>
                  Import from spreadsheet
                </Button>
              </>
            ) : (
              <span className="text-[13px] text-muted">The owner adds the first category.</span>
            )
          }
        />
        {creating ? <CategoryModal category={null} onClose={() => setCreating(false)} onCreated={(c) => state.select(c.id)} /> : null}
        {importing ? <ImportMenuModal restaurantId={restaurant.id} currency={restaurant.currency} onClose={() => setImporting(false)} /> : null}
      </>
    );
  }

  const selected = state.selected!;
  const selectedName = text(selected.name, restaurant.defaultLocale) || 'Untitled';

  return (
    <div className="flex min-h-0 flex-1">
      <CategoryList
        className="w-[300px] max-wide:w-60"
        categories={state.categories}
        selectedId={state.selectedId}
        defaultLocale={restaurant.defaultLocale}
        onSelect={state.select}
        onToggleHidden={state.toggleHidden}
        onReorder={state.reorderCategories}
        onCreate={state.createCategory}
        readOnly={!isOwner}
        guard={guard}
      />
      <section className="flex min-w-0 flex-1 flex-col" aria-labelledby="category-title">
        <div className="flex items-end justify-between gap-4 px-6 pb-4 pt-6">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <h1 id="category-title" className="truncate text-xl font-semibold leading-tight tracking-[-.01em]">
                {selectedName}
              </h1>
              {isOwner ? (
                <IconButton label="Rename category" size={28} onClick={guard(() => setRenaming(selected))}>
                  <Icon name="pencil" size={14} />
                </IconButton>
              ) : null}
            </div>
            <div className="text-[13px] text-muted">{summaryOf(selected, state.categoryItems)}</div>
          </div>
          {isOwner ? (
            <Button variant="primary" icon={<LockGlyph className="text-on-accent" />} onClick={guard(() => state.openItem('new'))}>
              <Icon name="plus" size={14} strokeWidth={2} />
              Add item
            </Button>
          ) : (
            <span className="text-[13px] text-muted">Staff can switch items on and off; the owner edits the menu.</span>
          )}
        </div>
        <div className="px-6 pb-6">
          <ItemsTable
            items={state.categoryItems}
            currency={restaurant.currency}
            defaultLocale={restaurant.defaultLocale}
            canEdit={isOwner}
            canDelete={isOwner}
            onReorder={state.reorderItems}
            onToggleAvailable={state.toggleAvailable}
            onEdit={guard((item: MenuItemDto) => state.openItem(item.id))}
            onDelete={guard((item: MenuItemDto) => setDeleting(item))}
            onAdd={guard(() => state.openItem('new'))}
          />
        </div>
      </section>

      {state.editing ? (
        <ItemDrawer
          item={state.editing === 'new' ? null : state.editing}
          categoryId={state.editing === 'new' ? selected.id : state.editing.categoryId}
          onClose={state.closeItem}
        />
      ) : null}
      {renaming ? <CategoryModal category={renaming} onClose={() => setRenaming(null)} /> : null}
      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          state.deleteItem.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Item deleted');
              setDeleting(null);
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
        title={`Delete “${deleting ? text(deleting.name, restaurant.defaultLocale) : ''}”?`}
        description="Guests will no longer see it. This cannot be undone."
        confirmLabel="Delete item"
        danger
        loading={state.deleteItem.isPending}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ mobile (M3 / M5 / M6) */

function MobileMenu() {
  const state = useMenuState();
  const { restaurant, isOwner } = useRestaurantContext();
  const { guard, locked } = useGuard();
  const toast = useToast();
  const [reorderMode, setReorderMode] = useState(false);
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<MenuItemDto | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 6 } }));
  const home = `/r/${restaurant.id}`;

  const header = (
    <MobileHeader
      title="Menu"
      backTo={home}
      action={
        state.categories.length > 0 && isOwner ? (
          <Button variant="accent-text" className="h-11 px-2" icon={<LockGlyph />} onClick={reorderMode ? () => setReorderMode(false) : guard(() => setReorderMode(true))} aria-pressed={reorderMode}>
            {reorderMode ? 'Done' : 'Reorder'}
          </Button>
        ) : null
      }
    />
  );

  if (state.loading) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <MobileMenuSkeleton />
      </div>
    );
  }
  if (state.error) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        <LoadError
          error={state.error}
          retry={() => {
            void state.categoriesQuery.refetch();
            void state.itemsQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (state.categories.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        {header}
        {isOwner ? (
          <div className="flex gap-1.5 border-b border-line px-4 pb-2.5 pt-2">
            <button type="button" onClick={guard(() => setCreating(true))} className="h-9 cursor-pointer rounded-full border border-dashed border-line px-3 text-sm font-medium text-muted">
              + Category
            </button>
          </div>
        ) : null}
        <EmptyState
          title="No menu yet"
          description={isOwner ? 'Add a category, then your first item. Takes about a minute.' : 'The owner has not added anything yet.'}
          actions={
            isOwner ? (
              <div className="flex flex-col items-center gap-1">
                <Button variant="primary" size="xl" className="px-5 text-[15px]" icon={<LockGlyph className="text-on-accent" />} onClick={guard(() => setCreating(true))}>
                  Add category
                </Button>
                <span className="mt-1 text-sm text-muted">Or set up on desktop for the full editor.</span>
              </div>
            ) : undefined
          }
        />
        {creating ? <CategoryModal category={null} onClose={() => setCreating(false)} onCreated={(c) => state.select(c.id)} /> : null}
      </div>
    );
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = state.categoryItems.findIndex((i) => i.id === active.id);
    const to = state.categoryItems.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    state.reorderItems(arrayMove(state.categoryItems, from, to).map((i) => i.id));
  };

  return (
    <div className="flex flex-1 flex-col">
      {header}
      <div className="no-scrollbar sticky top-0 z-10 flex gap-1.5 overflow-x-auto border-b border-line bg-canvas px-4 pb-2.5 pt-2" role="tablist" aria-label="Categories">
        {state.categories.map((category) => {
          const active = category.id === state.selectedId;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                state.select(category.id);
                setOpenRow(null);
              }}
              className={cn(
                'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium',
                active ? 'border-accent bg-accent text-on-accent' : 'border-line bg-transparent text-ink',
                category.isHidden && !active && 'opacity-60',
              )}
            >
              {category.isHidden ? <Icon name="eyeOff" size={13} /> : null}
              {text(category.name, restaurant.defaultLocale) || 'Untitled'}
            </button>
          );
        })}
        {isOwner ? (
          <button type="button" onClick={guard(() => setCreating(true))} className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line px-3 text-sm font-medium text-muted">
            <LockGlyph />+ Category
          </button>
        ) : null}
      </div>

      <div className="flex flex-col pb-24">
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={onDragEnd}>
          <SortableContext items={state.categoryItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul aria-label="Items">
              {state.categoryItems.map((item) => (
                <MobileItemRow
                  key={item.id}
                  item={item}
                  name={text(item.name, restaurant.defaultLocale) || 'Untitled item'}
                  price={formatPrice(item.priceCents, restaurant.currency)}
                  reorderMode={reorderMode}
                  canEdit={isOwner}
                  locked={locked}
                  open={openRow === item.id}
                  onOpenChange={(open) => setOpenRow(open ? item.id : null)}
                  onToggle={(available) => state.toggleAvailable(item, available)}
                  onEdit={guard(() => {
                    setOpenRow(null);
                    state.openItem(item.id);
                  })}
                  onDelete={isOwner ? guard(() => setDeleting(item)) : undefined}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {state.categoryItems.length === 0 ? (
          <EmptyState variant="inline" title="No items in this category yet." actions={isOwner ? <Button size="sm" onClick={guard(() => state.openItem('new'))}>Add item</Button> : undefined} />
        ) : (
          <p className="p-4 text-center text-xs text-muted">
            {!isOwner ? 'Tap the switch to take an item off for today.' : reorderMode ? 'Drag the handles to reorder, then tap Done.' : 'Swipe left for Edit / Delete · hold the handle to reorder'}
          </p>
        )}
      </div>

      {isOwner ? (
        <button
          type="button"
          aria-label={locked ? 'Add item (needs the owner PIN)' : 'Add item'}
          onClick={guard(() => state.openItem('new'))}
          className="fixed right-5 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-30 grid size-14 cursor-pointer place-items-center rounded-full bg-accent text-on-accent shadow-[0_8px_20px_rgba(122,62,72,.35)]"
        >
          {locked ? <Icon name="lock" size={20} strokeWidth={2} /> : <Icon name="plus" size={22} strokeWidth={2.2} />}
        </button>
      ) : null}

      {state.editing ? (
        <ItemSheet
          item={state.editing === 'new' ? null : state.editing}
          categoryId={state.editing === 'new' ? state.selectedId! : state.editing.categoryId}
          onClose={state.closeItem}
        />
      ) : null}
      {creating ? <CategoryModal category={null} onClose={() => setCreating(false)} onCreated={(c) => state.select(c.id)} /> : null}
      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          state.deleteItem.mutate(deleting.id, {
            onSuccess: () => {
              toast.success('Item deleted');
              setDeleting(null);
              setOpenRow(null);
            },
            onError: (error) => toast.error(errorMessage(error)),
          })
        }
        title={`Delete “${deleting ? text(deleting.name, restaurant.defaultLocale) : ''}”?`}
        description="Guests will no longer see it. This cannot be undone."
        confirmLabel="Delete item"
        danger
        loading={state.deleteItem.isPending}
      />
    </div>
  );
}

interface MobileItemRowProps {
  item: MenuItemDto;
  name: string;
  price: string;
  reorderMode: boolean;
  canEdit: boolean;
  locked: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (available: boolean) => void;
  onEdit: () => void;
  onDelete?: () => void;
}

function MobileItemRow({ item, name, price, reorderMode, canEdit, locked, open, onOpenChange, onToggle, onEdit, onDelete }: MobileItemRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canEdit });
  const available = item.isEffectivelyAvailable;
  const row = (
    <div className={cn('flex min-h-16 items-center gap-3 bg-surface px-4 py-2', !available && 'opacity-50')}>
      <ItemThumb src={item.imageUrl} />
      {canEdit ? (
        <button type="button" onClick={onEdit} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-px text-left">
          <span className="flex items-center gap-1.5 truncate text-[15px] font-medium">
            {name}
            {locked ? <Icon name="lock" size={11} strokeWidth={2.2} className="shrink-0 text-muted" aria-label="Needs the owner PIN" /> : null}
          </span>
          <span className="text-[13px] tabular-nums text-muted">
            {item.variants.length > 0 ? 'from ' : ''}
            {price}
          </span>
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-px text-left">
          <span className="truncate text-[15px] font-medium">{name}</span>
          <span className="text-[13px] tabular-nums text-muted">
            {item.variants.length > 0 ? 'from ' : ''}
            {price}
          </span>
        </div>
      )}
      <Switch size="lg" checked={available} onChange={onToggle} label={`Available: ${name}`} />
      {canEdit ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Reorder ${name}`}
          className={cn('-mr-2 grid h-11 w-7 cursor-grab touch-none place-items-center active:cursor-grabbing', reorderMode ? 'text-ink' : 'text-muted')}
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" size={19} />
        </button>
      ) : null}
    </div>
  );
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn(isDragging && 'relative z-10 shadow-[0_8px_24px_rgba(0,0,0,.14)]')}>
      {canEdit ? (
        <SwipeRow open={open} onOpenChange={onOpenChange} disabled={reorderMode} onEdit={onEdit} onDelete={onDelete}>
          {row}
        </SwipeRow>
      ) : (
        row
      )}
    </li>
  );
}
