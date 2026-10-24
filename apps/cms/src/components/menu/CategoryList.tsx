import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, type FormEvent } from 'react';
import type { CategoryDto } from '@qr-menu/shared';
import { cn } from '../../lib/cn';
import { text } from '../../lib/format';
import { Icon } from '../icons';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Chip';
import { Input } from '../ui/Field';
import { useListSensors, verticalOnly } from './dnd';

interface CategoryListProps {
  categories: CategoryDto[];
  selectedId: string | null;
  defaultLocale: string;
  onSelect: (id: string) => void;
  onToggleHidden: (category: CategoryDto) => void;
  onReorder: (ids: string[]) => void;
  onCreate: (name: string) => Promise<unknown>;
  /** Staff (Phase 11): no drag, no hide/show, no "New category". */
  readOnly?: boolean;
  /** Owner-action wrapper (opens the PIN keypad first on a locked device). */
  guard?: <A extends unknown[]>(fn: (...args: A) => void) => (...args: A) => void;
  className?: string;
}

/** Left column of the desktop menu editor: sortable categories + inline "New category" input. */
export function CategoryList({ categories, selectedId, defaultLocale, onSelect, onToggleHidden, onReorder, onCreate, readOnly = false, guard = (fn) => fn, className }: CategoryListProps) {
  const sensors = useListSensors();
  const [draft, setDraft] = useState('');
  const [creating, setCreating] = useState(false);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = categories.findIndex((c) => c.id === active.id);
    const to = categories.findIndex((c) => c.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(categories, from, to).map((c) => c.id));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    guard(() => {
      setCreating(true);
      void onCreate(name)
        .then(() => setDraft(''))
        .finally(() => setCreating(false));
    })();
  };

  return (
    <div className={cn('flex shrink-0 flex-col border-r border-line bg-surface', className)}>
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-line-2 pl-5 pr-4">
        <span className="text-xs font-semibold uppercase tracking-[.06em] text-muted">Categories</span>
        {readOnly ? null : <span className="text-xs text-faint">Drag to reorder</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[verticalOnly]} onDragEnd={onDragEnd}>
          <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-0.5" aria-label="Categories">
              {categories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  name={text(category.name, defaultLocale) || 'Untitled'}
                  selected={category.id === selectedId}
                  readOnly={readOnly}
                  onSelect={() => onSelect(category.id)}
                  onToggleHidden={guard(() => onToggleHidden(category))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        {readOnly ? null : (
        <form onSubmit={(e) => void submit(e)} className="flex gap-1.5 px-1.5 pb-0.5 pt-1.5">
          <Input
            aria-label="New category"
            placeholder="New category"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={100}
            className="h-[34px] min-w-0 flex-1 text-[13px]"
          />
          <Button type="submit" size="sm" className="h-[34px] px-3 text-[13px]" loading={creating} disabled={!draft.trim()}>
            Add
          </Button>
        </form>
        )}
      </div>
    </div>
  );
}

interface CategoryRowProps {
  category: CategoryDto;
  name: string;
  selected: boolean;
  readOnly: boolean;
  onSelect: () => void;
  onToggleHidden: () => void;
}

function CategoryRow({ category, name, selected, readOnly, onSelect, onToggleHidden }: CategoryRowProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: category.id, disabled: readOnly });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.8 : category.isHidden ? 0.55 : 1 }}
      className={cn(
        'flex h-10 items-center gap-2 rounded-lg pl-1.5 pr-2 hover:bg-line-2',
        selected && 'bg-line-2',
        isDragging && 'z-10 bg-surface shadow-[0_8px_24px_rgba(0,0,0,.12)]',
      )}
    >
      {readOnly ? (
        <span className="w-4" />
      ) : (
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Reorder ${name}`}
          className="grid w-4 cursor-grab touch-none place-items-center text-faint active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <Icon name="grip" size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn('flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 text-left text-[13.5px] font-medium', selected ? 'text-ink' : 'text-ink-3')}
      >
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {category.isHidden ? <Badge>HIDDEN</Badge> : null}
        <span className="text-xs tabular-nums text-faint">{category.itemCount}</span>
      </button>
      {readOnly ? null : (
      <button
        type="button"
        onClick={onToggleHidden}
        aria-label={category.isHidden ? `Show ${name} to guests` : `Hide ${name} from guests`}
        aria-pressed={category.isHidden}
        title={category.isHidden ? 'Show to guests' : 'Hide from guests'}
        className="grid size-7 cursor-pointer place-items-center rounded-md text-faint hover:bg-line hover:text-ink"
      >
        <Icon name={category.isHidden ? 'eyeOff' : 'eye'} size={15} />
      </button>
      )}
    </li>
  );
}
