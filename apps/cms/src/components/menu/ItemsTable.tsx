import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { MenuItemDto } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { formatPrice, text } from '../../lib/format';
import { Icon } from '../icons';
import { Button, IconButton } from '../ui/Button';
import { MiniTag } from '../ui/Chip';
import { EmptyState } from '../ui/EmptyState';
import { Switch } from '../ui/Switch';
import { useListSensors, verticalOnly } from './dnd';
import { useElevation } from '../security/ElevationProvider';
import { useRestaurantContext } from '../shell/RestaurantLayout';
import { ItemThumb } from './ItemThumb';
import { knownTags, TAG_LABELS } from './labels';

const GRID = 'grid grid-cols-[28px_44px_1fr_96px_72px_76px] items-center gap-3';

interface ItemsTableProps {
  items: MenuItemDto[];
  currency: string;
  defaultLocale: string;
  /** Staff (Phase 11) only get the availability switch: no edit, no drag handle. */
  canEdit?: boolean;
  canDelete: boolean;
  onReorder: (ids: string[]) => void;
  onToggleAvailable: (item: MenuItemDto, available: boolean) => void;
  onEdit: (item: MenuItemDto) => void;
  onDelete: (item: MenuItemDto) => void;
  onAdd: () => void;
}

/** Desktop item rows for the selected category (design: 28/44/1fr/96/72/76 grid, 60px rows). */
export function ItemsTable({ items, currency, defaultLocale, canEdit = true, canDelete, onReorder, onToggleAvailable, onEdit, onDelete, onAdd }: ItemsTableProps) {
  const sensors = useListSensors();
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to).map((i) => i.id));
  };

  return (
    <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className={cn(GRID, 'h-9 border-b border-line-2 px-3 text-[11px] font-semibold uppercase tracking-[.06em] text-muted')} role="row">
        <span />
        <span />
        <span>Item</span>
        <span className="text-right">Price</span>
        <span>Available</span>
        <span />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ul aria-label="Items">
            {items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                name={text(item.name, defaultLocale) || 'Untitled item'}
                description={text(item.description, defaultLocale)}
                price={formatPrice(item.priceCents, currency)}
                canEdit={canEdit}
                canDelete={canEdit && canDelete}
                onToggle={(available) => onToggleAvailable(item, available)}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {items.length === 0 ? (
        <EmptyState
          variant="inline"
          title="No items in this category yet."
          actions={
            canEdit ? (
              <Button size="sm" onClick={onAdd}>
                Add item
              </Button>
            ) : undefined
          }
        />
      ) : null}
    </div>
  );
}

interface ItemRowProps {
  item: MenuItemDto;
  name: string;
  description: string;
  price: string;
  canEdit: boolean;
  canDelete: boolean;
  onToggle: (available: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ItemRow({ item, name, description, price, canEdit, canDelete, onToggle, onEdit, onDelete }: ItemRowProps) {
  const { restaurant, hasModule } = useRestaurantContext();
  const { locked } = useElevation();
  const missingPosCode = hasModule('pos') && restaurant.posConfig.sendOrdersToPos && !item.posProductCode;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled: !canEdit });
  const available = item.isEffectivelyAvailable;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid={`item-row-${item.id}`}
      className={cn(
        GRID,
        'min-h-[60px] border-b border-line-2 bg-surface px-3 py-2',
        !available && 'opacity-55',
        isDragging && 'relative z-10 shadow-[0_8px_24px_rgba(0,0,0,.12)]',
      )}
    >
      {canEdit ? (
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Reorder ${name}`}
          className="grid cursor-grab touch-none place-items-center text-faint active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" size={16} />
        </button>
      ) : (
        <span />
      )}
      <ItemThumb src={item.thumbnailUrl ?? item.imageUrl} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{name}</span>
          {knownTags(item.tags).map((tag) => (
            <MiniTag key={tag}>{TAG_LABELS[tag]}</MiniTag>
          ))}
          {item.variants.length > 0 ? <span className="text-xs text-faint">{item.variants.length} variants</span> : null}
          {missingPosCode ? (
            <span className="rounded-sm bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-semibold tracking-[.04em] text-[#991B1B]" title="Guests cannot order this item while orders go to the register">
              NO POS CODE
            </span>
          ) : null}
        </div>
        {description ? <div className="truncate text-[13px] text-muted">{description}</div> : null}
      </div>
      <div className="text-right font-medium tabular-nums">
        {item.variants.length > 0 ? <span className="mr-1 text-xs font-normal text-muted">from </span> : null}
        {price}
      </div>
      <Switch checked={available} onChange={onToggle} label={`Available: ${name}`} />
      <div className="flex justify-end gap-1">
        {canEdit ? (
          <IconButton label={locked ? `Edit ${name} (needs the owner PIN)` : `Edit ${name}`} variant="outline" onClick={onEdit}>
            <Icon name={locked ? 'lock' : 'pencil'} size={14} />
          </IconButton>
        ) : null}
        {canDelete ? (
          <IconButton label={`Delete ${name}`} variant="outline" onClick={onDelete}>
            <Icon name="trash" size={14} />
          </IconButton>
        ) : null}
      </div>
    </li>
  );
}
