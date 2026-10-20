import { describe, expect, it } from 'vitest';
import { formatRsd, localePath, otherLocale } from '../src/i18n';
import { currentSection, initLangSwitch, switchHref } from '../src/scripts/locale';

describe('locale helpers', () => {
  it('maps locales to paths and to the other locale', () => {
    expect(localePath('sr')).toBe('/');
    expect(localePath('en')).toBe('/en/');
    expect(otherLocale('sr')).toBe('en');
    expect(otherLocale('en')).toBe('sr');
  });

  it('formats RSD amounts with Serbian grouping in both locales', () => {
    expect(formatRsd(1490)).toBe('1.490');
    expect(formatRsd(29900)).toBe('29.900');
  });
});

describe('language switch keeps the section', () => {
  const tops = [
    { id: 'kako', top: 900 },
    { id: 'dobijas', top: 1800 },
    { id: 'cene', top: 2700 },
    { id: 'pitanja', top: 3600 },
  ];

  it('picks the last section scrolled past, honouring the header offset', () => {
    expect(currentSection(tops, 0)).toBeNull();
    expect(currentSection(tops, 830)).toBe('kako');
    expect(currentSection(tops, 2650)).toBe('cene');
    expect(currentSection(tops, 9999)).toBe('pitanja');
  });

  it('builds the target href with the hash only when there is a section', () => {
    expect(switchHref('/en/', 'cene')).toBe('/en/#cene');
    expect(switchHref('/', null)).toBe('/');
  });

  it('rewrites the link on click based on the scroll position', () => {
    document.body.innerHTML = `
      <a data-lang-switch href="/en/">EN</a>
      <section id="kako"></section><section id="dobijas"></section><section id="cene"></section><section id="pitanja"></section>`;
    const sections = Array.from(document.querySelectorAll('section'));
    sections.forEach((el, i) => {
      el.getBoundingClientRect = () => ({
        top: (i + 1) * 900 - 2000,
        bottom: 0,
        left: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      });
    });
    Object.defineProperty(window, 'scrollY', { value: 2000, configurable: true });
    initLangSwitch(document);
    const link = document.querySelector<HTMLAnchorElement>('[data-lang-switch]')!;
    link.addEventListener('click', (e) => e.preventDefault());
    link.click();
    expect(link.getAttribute('href')).toBe('/en/#dobijas');
  });
});
