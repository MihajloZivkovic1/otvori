import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useT } from '../../lib/i18n';
import { Modal } from '../ui/Modal';
import { CommandPalette, type PaletteContext } from './CommandPalette';

interface Shortcut {
  keys: string[];
  label: string;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? '⌘' : 'Ctrl';

function typing(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * Keyboard shortcuts of the whole app (Phase 13c): ⌘K search, ? help, g + letter to jump, n for a new item.
 * Mounted once per shell with the context the palette needs. Nothing fires while typing in a field.
 */
export function GlobalKeys({ context }: { context: PaletteContext }) {
  const navigate = useNavigate();
  const { t } = useT();
  const [palette, setPalette] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    let pendingG = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPalette((v) => !v);
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      if (event.key === '?') {
        event.preventDefault();
        setHelp((v) => !v);
        return;
      }
      const now = Date.now();
      if (event.key === 'g') {
        pendingG = now;
        return;
      }
      if (pendingG && now - pendingG < 1200) {
        pendingG = 0;
        const venue = context.venue;
        const map: Record<string, string | undefined> = venue
          ? { m: `/r/${venue.id}/menu`, t: `/r/${venue.id}/tables`, p: `/r/${venue.id}/promotions`, o: `/r/${venue.id}/orders`, b: `/r/${venue.id}/branding`, a: `/r/${venue.id}/analytics`, s: `/r/${venue.id}/settings` }
          : { r: '/admin/restaurants', u: '/admin/users', a: '/admin/activity', y: '/admin/system', n: '/admin/restaurants/new' };
        const target = map[event.key.toLowerCase()];
        if (target) {
          event.preventDefault();
          navigate(target);
        }
        return;
      }
      if (event.key === 'n' && context.venue?.isOwner) {
        event.preventDefault();
        navigate(`/r/${context.venue.id}/menu?item=new`);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [context, navigate]);

  const shortcuts: Shortcut[] = context.venue
    ? [
        { keys: [MOD, 'K'], label: t('Search') },
        { keys: [MOD, 'S'], label: t('Save the form') },
        { keys: ['?'], label: t('Open help') },
        { keys: ['Esc'], label: t('Close dialogs') },
        { keys: ['N'], label: t('Add item') },
        { keys: ['G', 'M'], label: `${t('Go to')} ${t('Menu')}` },
        { keys: ['G', 'T'], label: `${t('Go to')} ${t('Tables & QR')}` },
        { keys: ['G', 'O'], label: `${t('Go to')} ${t('Orders')}` },
        { keys: ['G', 'B'], label: `${t('Go to')} ${t('Branding')}` },
        { keys: ['G', 'A'], label: `${t('Go to')} ${t('Analytics')}` },
        { keys: ['G', 'S'], label: `${t('Go to')} ${t('Settings')}` },
        { keys: ['↑', '↓'], label: 'Move between rows in lists' },
      ]
    : [
        { keys: [MOD, 'K'], label: t('Search') },
        { keys: [MOD, 'S'], label: t('Save the form') },
        { keys: ['?'], label: t('Open help') },
        { keys: ['Esc'], label: t('Close dialogs') },
        { keys: ['G', 'R'], label: `${t('Go to')} ${t('Restaurants')}` },
        { keys: ['G', 'N'], label: t('New venue') },
        { keys: ['G', 'U'], label: `${t('Go to')} ${t('Users')}` },
        { keys: ['G', 'A'], label: `${t('Go to')} ${t('Activity')}` },
        { keys: ['G', 'Y'], label: `${t('Go to')} ${t('System')}` },
        { keys: ['↑', '↓'], label: 'Move between rows in lists' },
      ];

  return (
    <>
      <CommandPalette open={palette} onClose={() => setPalette(false)} context={context} />
      <Modal open={help} onClose={() => setHelp(false)} title={t('Keyboard shortcuts')}>
        <ul className="flex flex-col divide-y divide-line-2 text-[13px]">
          {shortcuts.map((shortcut) => (
            <li key={shortcut.label} className="flex items-center justify-between gap-4 py-2">
              <span className="text-ink-2">{shortcut.label}</span>
              <span className="flex gap-1">
                {shortcut.keys.map((key, i) => (
                  <kbd key={i} className="rounded border border-line bg-canvas px-1.5 py-0.5 font-mono text-[11px] text-ink">
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
