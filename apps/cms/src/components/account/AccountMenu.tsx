import { useEffect, useRef, useState } from 'react';
import { CMS_LOCALES, CMS_THEMES, type CmsLocale, type CmsTheme } from '@qr-menu/shared';
import { useAuth, useMe } from '../../lib/auth';
import { cn } from '../../lib/cn';
import { LOCALE_LABELS, useT } from '../../lib/i18n';
import { THEME_LABELS, useTheme } from '../../lib/theme';
import { Icon } from '../icons';
import { ProfileModal } from './ProfileModal';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

/**
 * The person in the sidebar footer (Phase 13c): profile, CMS language, appearance and sign-out. Compact rails
 * show the avatar only; the dropdown opens above the footer.
 */
export function AccountMenu({ wide, subtitle }: { wide: boolean; subtitle: string }) {
  const me = useMe();
  const { signOut } = useAuth();
  const { t, locale, setLocale } = useT();
  const [theme, setTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const row = 'flex h-9 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] font-medium text-ink hover:bg-line-2';

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${t('Account')}: ${me.user.name}`}
        onClick={() => setOpen((v) => !v)}
        className={cn('flex w-full cursor-pointer items-center gap-2.5 rounded-lg text-left hover:bg-line-2', wide ? 'px-1.5 py-1' : 'justify-center p-1')}
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-line text-[11px] font-semibold text-ink-2" aria-hidden="true">
          {initials(me.user.name)}
        </span>
        {wide ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{me.user.name}</span>
              <span className="block truncate text-xs text-muted">{subtitle}</span>
            </span>
            <Icon name="chevronsUpDown" size={14} className="shrink-0 text-muted" />
          </>
        ) : null}
      </button>
      {open ? (
        <div role="menu" aria-label={t('Account')} className="pop-enter absolute bottom-full left-0 z-30 mb-1 flex w-[240px] flex-col gap-0.5 rounded-[10px] border border-line bg-surface p-1.5 shadow-[0_8px_30px_rgba(0,0,0,.12)]">
          <div className="px-2.5 pb-1.5 pt-1">
            <div className="truncate text-[13px] font-medium">{me.user.name}</div>
            <div className="truncate text-xs text-muted">{me.user.email}</div>
          </div>
          <button
            type="button"
            role="menuitem"
            className={row}
            onClick={() => {
              setOpen(false);
              setProfile(true);
            }}
          >
            <Icon name="user" size={15} className="text-muted" /> {t('Profile')}
          </button>
          <div className="my-1 h-px bg-line" aria-hidden="true" />
          <div className="px-2.5 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{t('Language')}</div>
          <div role="radiogroup" aria-label={t('Language')} className="flex gap-1 px-1.5 pb-1">
            {CMS_LOCALES.map((value: CmsLocale) => (
              <button key={value} type="button" role="radio" aria-checked={locale === value} onClick={() => setLocale(value)} className={cn('h-8 flex-1 cursor-pointer rounded-md border text-[13px] font-medium', locale === value ? 'border-ink bg-ink text-surface' : 'border-line text-ink-2 hover:bg-line-2')}>
                {LOCALE_LABELS[value]}
              </button>
            ))}
          </div>
          <div className="px-2.5 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-[.06em] text-muted">{t('Theme')}</div>
          <div role="radiogroup" aria-label={t('Theme')} className="flex gap-1 px-1.5 pb-1">
            {CMS_THEMES.map((value: CmsTheme) => (
              <button key={value} type="button" role="radio" aria-checked={theme === value} onClick={() => setTheme(value)} className={cn('h-8 flex-1 cursor-pointer rounded-md border text-[12px] font-medium', theme === value ? 'border-ink bg-ink text-surface' : 'border-line text-ink-2 hover:bg-line-2')}>
                {t(THEME_LABELS[value]).replace(' theme', '')}
              </button>
            ))}
          </div>
          <div className="my-1 h-px bg-line" aria-hidden="true" />
          <button type="button" role="menuitem" className={cn(row, 'text-danger-text')} onClick={() => void signOut()}>
            <Icon name="signOut" size={15} /> {t('Sign out')}
          </button>
        </div>
      ) : null}
      {profile ? <ProfileModal onClose={() => setProfile(false)} /> : null}
    </div>
  );
}
