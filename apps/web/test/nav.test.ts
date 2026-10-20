import { beforeEach, describe, expect, it } from 'vitest';
import { initNav } from '../src/scripts/nav';

describe('phone navigation', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button data-nav-toggle aria-expanded="false" aria-controls="mobile-nav">
        <svg><path class="nav-open-icon"></path><path class="nav-close-icon hidden"></path></svg>
      </button>
      <nav id="mobile-nav" hidden><a href="#cene">Cene</a></nav>`;
    initNav(document);
  });

  const toggle = () => document.querySelector('[data-nav-toggle]') as HTMLButtonElement;
  const panel = () => document.getElementById('mobile-nav') as HTMLElement;

  it('opens and closes the panel and swaps the icon', () => {
    toggle().click();
    expect(panel().hidden).toBe(false);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.nav-close-icon')!.classList.contains('hidden')).toBe(false);
    toggle().click();
    expect(panel().hidden).toBe(true);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });

  it('closes on Escape and when a link is chosen', () => {
    toggle().click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(panel().hidden).toBe(true);
    toggle().click();
    panel()
      .querySelector('a')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(panel().hidden).toBe(true);
  });
});
