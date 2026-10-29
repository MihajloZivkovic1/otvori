import { PROMOTION_DISPLAYS, PROMOTION_LIMITS, WEEKDAYS, hexColorSchema, type PromotionDisplay } from '@qr-menu/shared';
import { cn } from '../../../lib/cn';
import { useRestaurantContext } from '../../shell/RestaurantLayout';
import { Chip } from '../../ui/Chip';
import { Field, Input } from '../../ui/Field';
import { Switch } from '../../ui/Switch';
import { DISPLAY_META, type DraftErrors, type PromotionDraft } from '../draft';

interface Props {
  value: PromotionDraft;
  onChange: (patch: Partial<PromotionDraft>) => void;
  errors: DraftErrors;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/** Accent presets next to the venue colour: the reference red, a green, a blue, a gold, ink. */
const PRESETS = ['#E8453C', '#1F6F5B', '#2F5DA8', '#B8860B', '#1F1A17'];

/** Step 3: how, when and how prominently the promotion shows. */
export function DisplayFields({ value, onChange, errors }: Props) {
  const { restaurant } = useRestaurantContext();
  const venueColor = restaurant.primaryColor;
  const customAccent = value.accentColor && !PRESETS.includes(value.accentColor.toUpperCase()) ? value.accentColor : '';

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold">Show as</legend>
        {PROMOTION_DISPLAYS.map((display: PromotionDisplay) => {
          const selected = value.display === display;
          return (
            <label key={display} className={cn('flex cursor-pointer items-start gap-3 rounded-[10px] border p-3', selected ? 'border-accent bg-accent-soft/40' : 'border-line')}>
              <input type="radio" name="display" value={display} checked={selected} onChange={() => onChange({ display })} className="mt-1 accent-[#7a3e48]" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{DISPLAY_META[display].name}</span>
                <span className="text-xs leading-[1.45] text-muted">{DISPLAY_META[display].description}</span>
              </span>
            </label>
          );
        })}
        {errors.display ? <p className="text-xs text-danger-text">{errors.display}</p> : null}
      </fieldset>

      <Field label="Accent colour" hint="Used for the title, names and the banner. Default = the venue colour." error={errors.accentColor}>
        <div className="flex flex-wrap items-center gap-2">
          <Swatch color={venueColor} label={`Venue colour ${venueColor}`} selected={value.accentColor === null} onClick={() => onChange({ accentColor: null })} />
          {PRESETS.map((color) => (
            <Swatch key={color} color={color} label={color} selected={value.accentColor?.toUpperCase() === color} onClick={() => onChange({ accentColor: color })} />
          ))}
          <Input
            aria-label="Custom accent colour"
            placeholder="#RRGGBB"
            className="w-28"
            value={customAccent}
            onChange={(event) => {
              const next = event.target.value.trim();
              onChange({ accentColor: hexColorSchema.safeParse(next).success ? next.toUpperCase() : next === '' ? null : value.accentColor });
            }}
          />
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Priority" htmlFor="promo-priority" hint="Higher shows first; the pop-up with the highest priority wins." error={errors.priority}>
          <Input
            id="promo-priority"
            type="number"
            inputMode="numeric"
            min={PROMOTION_LIMITS.priorityMin}
            max={PROMOTION_LIMITS.priorityMax}
            value={Number.isFinite(value.priority) ? value.priority : ''}
            onChange={(event) => onChange({ priority: event.target.value === '' ? 0 : Number(event.target.value) })}
          />
        </Field>
        <Field label="Active">
          <div className="flex h-10 items-center gap-3">
            <Switch checked={value.isActive} onChange={(isActive) => onChange({ isActive })} label="Active" />
            <span className="text-sm text-muted">{value.isActive ? 'Shown while scheduled' : 'Hidden until switched on'}</span>
          </div>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts" htmlFor="promo-starts" hint="Optional." error={errors.startsAt}>
          <Input id="promo-starts" type="datetime-local" value={value.startsAt} onChange={(event) => onChange({ startsAt: event.target.value })} />
        </Field>
        <Field label="Ends" htmlFor="promo-ends" hint="Optional." error={errors.endsAt}>
          <Input id="promo-ends" type="datetime-local" value={value.endsAt} onChange={(event) => onChange({ endsAt: event.target.value })} />
        </Field>
      </div>

      <div className="flex flex-col gap-3 rounded-[10px] border border-line p-3.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="text-sm font-medium">Repeat weekly</span>
            <span className="text-xs text-muted">Only during these hours (venue time zone: {restaurant.timezone}). The end may be past midnight.</span>
          </span>
          <Switch checked={value.recurrence.enabled} onChange={(enabled) => onChange({ recurrence: { ...value.recurrence, enabled } })} label="Repeat weekly" />
        </div>
        {value.recurrence.enabled ? (
          <>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekdays">
              {WEEKDAYS.map((day) => {
                const selected = value.recurrence.weekdays.includes(day);
                return (
                  <Chip
                    key={day}
                    selected={selected}
                    onClick={() =>
                      onChange({
                        recurrence: {
                          ...value.recurrence,
                          weekdays: selected ? value.recurrence.weekdays.filter((d) => d !== day) : [...value.recurrence.weekdays, day],
                        },
                      })
                    }
                  >
                    {WEEKDAY_LABELS[day - 1]}
                  </Chip>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From" htmlFor="promo-from">
                <Input id="promo-from" type="time" value={value.recurrence.from} onChange={(event) => onChange({ recurrence: { ...value.recurrence, from: event.target.value } })} />
              </Field>
              <Field label="To" htmlFor="promo-to">
                <Input id="promo-to" type="time" value={value.recurrence.to} onChange={(event) => onChange({ recurrence: { ...value.recurrence, to: event.target.value } })} />
              </Field>
            </div>
            {errors.recurrence ? <p className="text-xs text-danger-text">{errors.recurrence}</p> : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function Swatch({ color, label, selected, onClick }: { color: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      style={{ background: color }}
      className={cn('size-8 rounded-full ring-2 ring-offset-2 ring-offset-surface', selected ? 'ring-ink' : 'ring-transparent hover:ring-line-strong')}
    />
  );
}
