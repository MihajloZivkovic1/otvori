import { useState } from 'react';
import { DRINK_LIST_VARIANTS, PROMOTION_LIMITS, type DrinkListContent, type MenuItemDto } from '@qr-menu/shared';
import { text } from '../../../lib/format';
import { Icon } from '../../icons';
import { useRestaurantContext } from '../../shell/RestaurantLayout';
import { Button, IconButton } from '../../ui/Button';
import { Field, Input, Textarea } from '../../ui/Field';
import { Segmented } from '../../ui/Segmented';
import { MenuItemPicker } from '../MenuItemPicker';
import { DRINK_LIST_VARIANT_META, descriptionToLines } from '../draft';
import { Switch } from '../../ui/Switch';
import { cn } from '../../../lib/cn';

interface Props {
  value: DrinkListContent;
  onChange: (next: DrinkListContent) => void;
  error?: string;
}

/** Step 2 for the drink list: subtitle, logo text, columns and the entries (typed or picked from the menu). */
export function DrinkListFields({ value, onChange, error }: Props) {
  const { restaurant } = useRestaurantContext();
  const [picking, setPicking] = useState(false);
  const entries = value.entries;
  const setEntries = (next: DrinkListContent['entries']) => onChange({ ...value, entries: next });
  const update = (index: number, patch: Partial<DrinkListContent['entries'][number]>) => setEntries(entries.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    const [entry] = next.splice(index, 1);
    next.splice(target, 0, entry!);
    setEntries(next);
  };
  const addPicked = (items: MenuItemDto[]) =>
    setEntries([
      ...entries,
      ...items.map((item) => ({ name: text(item.name, restaurant.defaultLocale), lines: descriptionToLines(text(item.description, restaurant.defaultLocale)), menuItemId: item.id })),
    ]);

  const variant = value.variant ?? 'poster';
  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Look</legend>
        <div role="radiogroup" aria-label="Drink list look" className="grid gap-2 sm:grid-cols-3">
          {DRINK_LIST_VARIANTS.map((candidate) => {
            const selected = variant === candidate;
            return (
              <button
                key={candidate}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange({ ...value, variant: candidate })}
                className={cn('flex cursor-pointer flex-col gap-0.5 rounded-[10px] border p-3 text-left', selected ? 'border-accent bg-accent-soft/40' : 'border-line hover:border-line-strong')}
              >
                <span className="text-sm font-medium">{DRINK_LIST_VARIANT_META[candidate].name}</span>
                <span className="text-xs leading-[1.4] text-muted">{DRINK_LIST_VARIANT_META[candidate].description}</span>
              </button>
            );
          })}
        </div>
        {variant !== 'simple' ? (
          <label className="flex h-10 items-center justify-between gap-3 text-sm">
            <span>Drink icons beside the title</span>
            <Switch checked={(value.icons ?? 'cocktails') !== 'none'} onChange={(on) => onChange({ ...value, icons: on ? 'cocktails' : 'none' })} label="Drink icons" />
          </label>
        ) : null}
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Logo text" htmlFor="promo-logo" hint="Printed in the logo spot, top left.">
          <Input id="promo-logo" value={value.logoText ?? ''} maxLength={PROMOTION_LIMITS.logoTextMax} onChange={(event) => onChange({ ...value, logoText: event.target.value })} />
        </Field>
        <Field label="Footer line" htmlFor="promo-subtitle" hint="Optional, bottom right of the card.">
          <Input id="promo-subtitle" value={value.subtitle ?? ''} maxLength={PROMOTION_LIMITS.subtitleMax} onChange={(event) => onChange({ ...value, subtitle: event.target.value })} />
        </Field>
      </div>
      <Field label="Columns">
        <Segmented label="Columns" value={String(value.columns)} onChange={(next) => onChange({ ...value, columns: next === '2' ? 2 : 1 })} options={[{ value: '1', label: 'One' }, { value: '2', label: 'Two' }]} />
      </Field>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">
            Entries <span className="font-normal text-muted">· {entries.length}/{PROMOTION_LIMITS.entriesMax}</span>
          </span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setPicking(true)} disabled={entries.length >= PROMOTION_LIMITS.entriesMax}>
              Pick from menu
            </Button>
            <Button size="sm" variant="primary" onClick={() => setEntries([...entries, { name: '', lines: [] }])} disabled={entries.length >= PROMOTION_LIMITS.entriesMax}>
              Add entry
            </Button>
          </div>
        </div>
        {error ? <p className="text-xs text-danger-text">{error}</p> : null}
        {entries.length === 0 ? (
          <p className="rounded-[10px] border border-dashed border-line px-4 py-6 text-center text-sm text-muted">No entries yet. Pick drinks from the menu or type them in.</p>
        ) : (
          <ol className="flex flex-col gap-2" aria-label="Entries">
            {entries.map((entry, index) => (
              <li key={index} className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 text-xs tabular-nums text-faint">{index + 1}</span>
                  <Input value={entry.name} maxLength={PROMOTION_LIMITS.entryNameMax} placeholder="Negroni" aria-label={`Entry ${index + 1} name`} onChange={(event) => update(index, { name: event.target.value })} />
                  <IconButton label={`Move entry ${index + 1} up`} size={28} onClick={() => move(index, -1)} disabled={index === 0}>
                    <Icon name="chevronDown" size={12} className="rotate-180" />
                  </IconButton>
                  <IconButton label={`Move entry ${index + 1} down`} size={28} onClick={() => move(index, 1)} disabled={index === entries.length - 1}>
                    <Icon name="chevronDown" size={12} />
                  </IconButton>
                  <IconButton label={`Remove entry ${index + 1}`} size={28} onClick={() => setEntries(entries.filter((_, i) => i !== index))}>
                    <Icon name="trash" size={14} />
                  </IconButton>
                </div>
                <div className="flex flex-col gap-1 pl-7">
                  <Textarea
                    rows={Math.min(6, Math.max(2, entry.lines.length + 1))}
                    value={entry.lines.join('\n')}
                    placeholder={'One ingredient per line\nBeefeater gin\nCampari'}
                    aria-label={`Entry ${index + 1} ingredients`}
                    onChange={(event) => update(index, { lines: event.target.value.split('\n').slice(0, PROMOTION_LIMITS.entryLinesMax) })}
                  />
                  {entry.menuItemId ? <span className="text-[11px] text-muted">Linked to a menu item · unavailable items are dimmed on the card</span> : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <MenuItemPicker open={picking} onClose={() => setPicking(false)} onPick={addPicked} multiple max={PROMOTION_LIMITS.entriesMax - entries.length} title="Pick drinks" />
    </div>
  );
}
