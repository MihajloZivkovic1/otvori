import { lightSurfaces, type CategoryDto, type MenuItemDto, type Theme } from '@qr-menu/shared';
import { usePrefersDark } from '../../hooks/useMediaQuery';
import { cn } from '../../lib/cn';
import { textOn } from '../../lib/color';
import { formatPrice, text } from '../../lib/format';
import { LogoTile } from '../LogoTile';

/**
 * Guest-menu palettes from design/Tabla Guest Menu.html (the preview mimics the public menu, not the CMS). The light
 * surfaces follow the venue's background color exactly like apps/menu/src/lib/theme.ts (shared `lightSurfaces`).
 */
const LIGHT_TEXT = { ink: '#1F1A17', muted: '#6E645C', line: 'rgba(31,26,23,.1)' };
const DARK = { bg: '#1B1816', ink: '#F3EDE6', muted: '#ABA198', line: 'rgba(243,237,230,.12)', chip: '#2E2927', placeholder: '#3A322D' };

interface PhonePreviewProps {
  name: string;
  color: string;
  /** Light-appearance page background (#rrggbb); anything invalid falls back to the cream default. */
  background: string;
  theme: Theme;
  logoUrl: string | null;
  categories: CategoryDto[];
  items: MenuItemDto[];
  currency: string;
  defaultLocale: string;
  /** phone = 300×620 device frame (desktop); card = flat card below the controls (mobile, design M10). */
  variant: 'phone' | 'card';
}

/** Live preview of the guest menu header + first category, rendered from the *unsaved* branding form state. */
export function PhonePreview({ name, color, background, theme, logoUrl, categories, items, currency, defaultLocale, variant }: PhonePreviewProps) {
  const prefersDark = usePrefersDark();
  const dark = theme === 'dark' || (theme === 'auto' && prefersDark);
  const palette = dark ? DARK : { ...LIGHT_TEXT, ...lightSurfaces(/^#[0-9a-f]{6}$/i.test(background) ? background : null) };
  const accent = /^#[0-9a-f]{6}$/i.test(color) ? color : '#7A3E48';
  const onAccent = textOn(accent);
  const visible = categories.filter((c) => !c.isHidden);
  const first = visible.find((c) => items.some((i) => i.categoryId === c.id)) ?? visible[0] ?? null;
  const chips = (visible.length ? visible : [{ id: 'a', name: { en: 'Coffee' } }, { id: 'b', name: { en: 'Breakfast' } }, { id: 'c', name: { en: 'Pastries' } }]).slice(0, 3);
  const previewItems = first ? items.filter((i) => i.categoryId === first.id).slice(0, 3) : [];
  const phone = variant === 'phone';

  return (
    <div
      aria-label="Live menu preview"
      className={cn('overflow-hidden', phone ? 'relative h-[620px] w-[300px] rounded-[32px] shadow-[0_0_0_8px_#18181B,0_0_0_9px_#3F3F46,0_20px_50px_rgba(0,0,0,.25)]' : 'rounded-[20px] border border-line')}
      style={{ background: palette.bg, color: palette.ink }}
    >
      <div className={cn('flex flex-col', phone ? 'gap-3 px-4 pb-3 pt-10' : 'gap-2.5 px-4 pb-2.5 pt-4')}>
        <div className="flex items-center gap-2.5">
          <LogoTile name={name} color={accent} logoUrl={logoUrl} size={36} radius={10} />
          <div className="font-serif text-[17px] font-bold leading-[1.15]">{name.trim() || 'Your restaurant'}</div>
        </div>
        <span className="inline-flex h-6 w-fit items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold" style={{ background: palette.chip }}>
          <span className="size-[5px] rounded-full" style={{ background: accent }} />
          Table 7
        </span>
      </div>
      <div className={cn('flex gap-1.5 px-4', phone ? 'py-2' : 'pb-2 pt-1.5')} style={{ borderBottom: `1px solid ${palette.line}` }}>
        {chips.map((chip, index) => (
          <span
            key={chip.id}
            className="inline-flex h-[30px] items-center whitespace-nowrap rounded-full px-3 text-xs font-medium"
            style={index === 0 ? { background: accent, color: onAccent } : { border: `1px solid ${palette.line}` }}
          >
            {text(chip.name, defaultLocale) || 'Category'}
          </span>
        ))}
      </div>
      <div className={cn('flex flex-col px-4', phone ? 'pt-4' : 'pb-1 pt-2')}>
        {first ? <div className="mb-1 font-serif text-base font-bold">{text(first.name, defaultLocale)}</div> : null}
        {previewItems.length === 0 ? (
          <div className="py-6 text-center text-xs" style={{ color: palette.muted }}>
            Add items to see them here.
          </div>
        ) : (
          previewItems.map((item) => (
            <div key={item.id} className={cn('flex gap-2.5', phone ? 'py-3' : 'py-2.5')} style={{ borderBottom: `1px solid ${palette.line}` }}>
              <div className="flex flex-1 flex-col gap-[3px]">
                <div className="flex justify-between gap-2">
                  <span className="font-serif text-sm">{text(item.name, defaultLocale)}</span>
                  <span className="text-xs font-semibold tabular-nums">{formatPrice(item.priceCents, currency)}</span>
                </div>
                {text(item.description, defaultLocale) ? (
                  <div className="text-[11px] leading-[1.4]" style={{ color: palette.muted }}>
                    {text(item.description, defaultLocale)}
                  </div>
                ) : null}
              </div>
              <div className={cn('shrink-0 overflow-hidden rounded-[10px]', phone ? 'size-[52px]' : 'size-12')} style={{ background: palette.placeholder }}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" className="size-full object-cover" /> : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
