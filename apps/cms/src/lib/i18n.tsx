import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { CMS_LOCALES, type CmsLocale } from '@qr-menu/shared';
import { cmsLocale as stored } from './storage';

/**
 * CMS interface language (Phase 13c). English is the source; Serbian covers the shell (navigation, account menu,
 * shortcuts, error screens, common actions). Screens not yet translated fall back to English — see
 * docs/ADMIN-UX-REVIEW.md for the remaining TODO.
 */
const SR: Record<string, string> = {
  Menu: 'Meni',
  'Tables & QR': 'Stolovi i QR',
  Tables: 'Stolovi',
  Orders: 'Narudžbine',
  Branding: 'Izgled',
  Analytics: 'Analitika',
  Settings: 'Podešavanja',
  More: 'Više',
  Home: 'Početna',
  Restaurants: 'Lokali',
  Users: 'Korisnici',
  Activity: 'Aktivnost',
  System: 'Sistem',
  Superadmin: 'Superadmin',
  'Sign out': 'Odjava',
  'Sign out everywhere else': 'Odjavi se sa svih drugih uređaja',
  Account: 'Nalog',
  Profile: 'Profil',
  Language: 'Jezik',
  Theme: 'Tema',
  'System theme': 'Sistemska',
  Light: 'Svetla',
  Dark: 'Tamna',
  English: 'English',
  Serbian: 'Srpski',
  'Keyboard shortcuts': 'Prečice na tastaturi',
  Search: 'Pretraga',
  'Search…': 'Pretraži…',
  'Nothing found': 'Nema rezultata',
  Save: 'Sačuvaj',
  Cancel: 'Otkaži',
  Undo: 'Poništi',
  'Page not found': 'Stranica nije pronađena',
  'The link may be old, or the page moved.': 'Link je možda zastareo ili je stranica premeštena.',
  'No access': 'Nemaš pristup',
  'You are signed in, but this page is not yours to see.': 'Prijavljen/a si, ali ova stranica nije dostupna tvom nalogu.',
  'Go home': 'Na početnu',
  'Something went wrong': 'Nešto je pošlo naopako',
  Reload: 'Osveži',
  'Your session expired. Sign in again to continue where you left off.': 'Sesija je istekla. Prijavi se ponovo da nastaviš gde si stao/la.',
  'Set a new password': 'Postavi novu lozinku',
  'Your password was set by an administrator. Choose your own before you continue.': 'Lozinku ti je postavio administrator. Izaberi svoju pre nego što nastaviš.',
  'Current password': 'Trenutna lozinka',
  'New password': 'Nova lozinka',
  'Change password': 'Promeni lozinku',
  Name: 'Ime',
  'E-mail': 'E-mail',
  Devices: 'Uređaji',
  'This device': 'Ovaj uređaj',
  'Go to': 'Idi na',
  Pages: 'Stranice',
  Items: 'Artikli',
  'New venue': 'Novi lokal',
  'Open help': 'Otvori pomoć',
  'Close dialogs': 'Zatvori prozore',
  'Add item': 'Dodaj artikal',
  'Save the form': 'Sačuvaj formu',
};

interface I18n {
  locale: CmsLocale;
  setLocale: (locale: CmsLocale) => void;
  t: (text: string) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<CmsLocale>(() => stored.get());
  const setLocale = useCallback((next: CmsLocale) => {
    stored.set(next);
    setLocaleState(next);
    document.documentElement.lang = next === 'sr' ? 'sr-Latn' : 'en';
  }, []);
  const t = useCallback((text: string) => (locale === 'sr' ? (SR[text] ?? text) : text), [locale]);
  const value = useMemo<I18n>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** `t('Settings')` → the shell label in the chosen language (falls back to the English key). */
export function useT(): I18n {
  const value = useContext(I18nContext);
  if (!value) return { locale: 'en', setLocale: () => undefined, t: (text) => text };
  return value;
}

export const LOCALE_LABELS: Record<CmsLocale, string> = { en: 'English', sr: 'Srpski' };
export { CMS_LOCALES };
