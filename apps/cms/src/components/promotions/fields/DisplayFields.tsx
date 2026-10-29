import { useState } from 'react';
import { PROMOTION_DISPLAYS, PROMOTION_LIMITS, WEEKDAYS, hexColorSchema, type PillPosition, type PillStyle, type PromotionDisplay } from '@qr-menu/shared';
import { cn } from '../../../lib/cn';
import { useRestaurantContext } from '../../shell/RestaurantLayout';
import { Chip } from '../../ui/Chip';
import { Field, Input } from '../../ui/Field';
import { Segmented } from '../../ui/Segmented';
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
/** Background presets: paper, white, warm, mint, ink, charcoal. */
const BACKGROUNDS = ['#F6EEE6', '#FFFFFF', '#FFF4E6', '#E8F1EC', '#1F1A17', '#2B2522'];
/** Text presets: ink, white, warm grey, plum. */
const TEXTS = ['#1F1A17', '#FFFFFF', '#6A5F5A', '#7A3E48'];

/** Free-typed hex field: keeps partial input locally and only reports a complete #RRGGBB (or '' = clear). */
function HexInput({ value, presets, onChange, label }: { value: string | null; presets: readonly string[]; onChange: (hex: string | null) => void; label: string }) {
  const external = value && !presets.includes(value.toUpperCase()) ? value : '';
  const [text, setText] = useState(external);
  // Reset the local text when the committed value changes from outside (a swatch click) — the React "adjust state
  // during render" pattern, so no effect is needed.
  const [seen, setSeen] = useState(external);
  if (seen !== external) {
    setSeen(external);
    setText(external);
  }
  return (
    <Input
      aria-label={label}
      placeholder="#RRGGBB"
      className="w-28"
      value={text}
      onChange={(event) => {
        const next = event.target.value.trim();
        setText(next);
        if (next === '') onChange(null);
        else if (hexColorSchema.safeParse(next).success) onChange(next.toUpperCase());
      }}
    />
  );
}

/** Step 3: how, when and how prominently the promotion shows. */
export function DisplayFields({ value, onChange, errors }: Props) {
  const { restaurant } = useRestaurantContext();
  const venueColor = restaurant.primaryColor;

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
          <HexInput label="Custom accent colour" value={value.accentColor} presets={PRESETS} onChange={(accentColor) => onChange({ accentColor })} />
        </div>
      </Field>

      <Field label="Background" hint="Behind the promotion, the banner and the pill. Default = the template's own (paper for the drink list, the menu surface otherwise)." error={errors.style}>
        <div className="flex flex-wrap items-center gap-2">
          <Swatch color="transparent" label="Default background" selected={value.style.backgroundColor === null} onClick={() => onChange({ style: { ...value.style, backgroundColor: null } })} outline />
          {BACKGROUNDS.map((color) => (
            <Swatch key={color} color={color} label={`Background ${color}`} selected={value.style.backgroundColor?.toUpperCase() === color} onClick={() => onChange({ style: { ...value.style, backgroundColor: color } })} />
          ))}
          <HexInput label="Custom background colour" value={value.style.backgroundColor} presets={BACKGROUNDS} onChange={(backgroundColor) => onChange({ style: { ...value.style, backgroundColor } })} />
        </div>
      </Field>

      <Field label="Text colour" hint="Body text inside the promotion and on the banner. Default = readable on the background.">
        <div className="flex flex-wrap items-center gap-2">
          <Swatch color="transparent" label="Automatic text colour" selected={value.style.textColor === null} onClick={() => onChange({ style: { ...value.style, textColor: null } })} outline />
          {TEXTS.map((color) => (
            <Swatch key={color} color={color} label={`Text ${color}`} selected={value.style.textColor?.toUpperCase() === color} onClick={() => onChange({ style: { ...value.style, textColor: color } })} />
          ))}
          <HexInput label="Custom text colour" value={value.style.textColor} presets={TEXTS} onChange={(textColor) => onChange({ style: { ...value.style, textColor } })} />
        </div>
      </Field>

      {value.display === 'banner' ? (
        <Field label="Collapsed pill" hint="The small pill a guest sees after closing the banner; one tap opens the promotion.">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Segmented<PillPosition>
                label="Pill position"
                value={value.style.pillPosition ?? 'right'}
                onChange={(pillPosition) => onChange({ style: { ...value.style, pillPosition } })}
                options={[
                  { value: 'right', label: 'Bottom right' },
                  { value: 'left', label: 'Bottom left' },
                ]}
              />
              <Segmented<PillStyle>
                label="Pill style"
                value={value.style.pillStyle ?? 'solid'}
                onChange={(pillStyle) => onChange({ style: { ...value.style, pillStyle } })}
                options={[
                  { value: 'solid', label: 'Solid' },
                  { value: 'outline', label: 'Outline' },
                ]}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Swatch color="transparent" label="Pill colour same as banner" selected={value.style.pillColor === null} onClick={() => onChange({ style: { ...value.style, pillColor: null } })} outline />
              {[...PRESETS, '#FFFFFF'].map((color) => (
                <Swatch key={color} color={color} label={`Pill ${color}`} selected={value.style.pillColor?.toUpperCase() === color} onClick={() => onChange({ style: { ...value.style, pillColor: color } })} />
              ))}
              <HexInput label="Custom pill colour" value={value.style.pillColor} presets={[...PRESETS, '#FFFFFF']} onChange={(pillColor) => onChange({ style: { ...value.style, pillColor } })} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-full text-xs text-muted">Pill text</span>
              <Swatch color="transparent" label="Automatic pill text colour" selected={value.style.pillTextColor === null} onClick={() => onChange({ style: { ...value.style, pillTextColor: null } })} outline />
              {TEXTS.map((color) => (
                <Swatch key={color} color={color} label={`Pill text ${color}`} selected={value.style.pillTextColor?.toUpperCase() === color} onClick={() => onChange({ style: { ...value.style, pillTextColor: color } })} />
              ))}
              <HexInput label="Custom pill text colour" value={value.style.pillTextColor} presets={TEXTS} onChange={(pillTextColor) => onChange({ style: { ...value.style, pillTextColor } })} />
            </div>
          </div>
        </Field>
      ) : null}

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

function Swatch({ color, label, selected, onClick, outline = false }: { color: string; label: string; selected: boolean; onClick: () => void; outline?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      style={{ background: color, boxShadow: 'inset 0 0 0 1px var(--swatch-ring)' }}
      className={cn('size-8 rounded-full ring-2 ring-offset-2 ring-offset-surface', outline && 'border border-dashed border-line-strong', selected ? 'ring-ink' : 'ring-transparent hover:ring-line-strong')}
    >
      {outline ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}
