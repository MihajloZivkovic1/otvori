import { describe, expect, it } from 'vitest';
import { dict } from '../src/lib/i18n';
import { filterCategories, formatPrice, normalizeForSearch } from '../src/lib/format';
import { slugFromHost } from '../src/lib/tenant';
import { applyTheme, normalizeHex, readableOn } from '../src/lib/theme';
import { menuSr } from './helpers';

const NBSP = ' ';

describe('formatPrice', () => {
  it('puts the amount first and the currency last in both locales', () => {
    expect(formatPrice(29000, 'RSD', 'sr')).toBe(`290${NBSP}RSD`);
    expect(formatPrice(29000, 'RSD', 'en')).toBe(`290${NBSP}RSD`);
  });
  it('uses locale grouping and shows cents only when needed', () => {
    expect(formatPrice(129050, 'RSD', 'en')).toBe(`1,290.50${NBSP}RSD`);
    expect(formatPrice(129050, 'RSD', 'sr')).toBe(`1.290,50${NBSP}RSD`);
    expect(formatPrice(129000, 'RSD', 'sr')).toBe(`1.290${NBSP}RSD`);
  });
  it('falls back gracefully for non-ISO currency strings', () => {
    expect(formatPrice(25000, 'din', 'sr')).toBe(`250${NBSP}din`);
    expect(formatPrice(25000, 'dinara', 'sr')).toBe(`250${NBSP}dinara`);
    expect(formatPrice(290, 'EUR', 'en')).toBe(`2.90${NBSP}€`);
  });
});

describe('itemCount pluralisation', () => {
  it('follows Serbian plural rules', () => {
    const { itemCount } = dict.sr;
    expect(itemCount(1)).toBe('1 stavka');
    expect(itemCount(2)).toBe('2 stavke');
    expect(itemCount(4)).toBe('4 stavke');
    expect(itemCount(5)).toBe('5 stavki');
    expect(itemCount(11)).toBe('11 stavki');
    expect(itemCount(21)).toBe('21 stavka');
  });
  it('and English ones', () => {
    expect(dict.en.itemCount(1)).toBe('1 item');
    expect(dict.en.itemCount(3)).toBe('3 items');
  });
});

describe('search', () => {
  it('normalises Serbian diacritics', () => {
    expect(normalizeForSearch('Ćevapi sa Đuvečem')).toBe('cevapi sa duvecem');
  });
  it('matches names and descriptions and drops empty categories', () => {
    const result = filterCategories(menuSr.categories, 'susam');
    expect(result.map((category) => category.name)).toEqual(['Doručak']);
    expect(filterCategories(menuSr.categories, '')).toBe(menuSr.categories);
  });
});

describe('tenant from host', () => {
  it('reads the subdomain and ignores apex / localhost / IPs', () => {
    expect(slugFromHost('kafeterija.tabla.rs')).toBe('kafeterija');
    expect(slugFromHost('kafeterija.localhost')).toBe('kafeterija');
    expect(slugFromHost('tabla.rs')).toBeNull();
    expect(slugFromHost('www.tabla.rs')).toBeNull();
    expect(slugFromHost('localhost')).toBeNull();
    expect(slugFromHost('127.0.0.1')).toBeNull();
  });
});

describe('theme', () => {
  it('picks a readable text color on the accent', () => {
    expect(readableOn('#7A3E48')).toBe('#FFFFFF');
    expect(readableOn('#F7F2EB')).toBe('#1B1816');
    expect(readableOn('#B8860B')).toBe('#1B1816');
  });
  it('normalises hex colors', () => {
    expect(normalizeHex(' 7a3e48 ')).toBe('#7A3E48');
    expect(normalizeHex('#abc')).toBeNull();
    expect(normalizeHex('nope')).toBeNull();
  });
  it('applies the restaurant theme and accent to the document', () => {
    applyTheme('dark', '#2F5D50');
    const root = document.documentElement;
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.getPropertyValue('--accent-light')).toBe('#2F5D50');
    expect(root.style.getPropertyValue('--on-accent-light')).toBe('#FFFFFF');
    applyTheme('auto', 'not-a-color');
    expect(root.style.getPropertyValue('--accent-light')).toBe('#7A3E48');
    expect(root.dataset.theme).toBeUndefined();
  });
});
