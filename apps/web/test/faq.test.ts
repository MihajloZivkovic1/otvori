import { beforeEach, describe, expect, it } from 'vitest';
import { initFaq } from '../src/scripts/faq';

const item = (i: number, open: boolean) => `
  <div><h3><button type="button" aria-expanded="${open}" aria-controls="faq-${i}" id="faq-${i}-btn">Q${i}</button></h3>
  <div id="faq-${i}" role="region" aria-labelledby="faq-${i}-btn" ${open ? '' : 'hidden'}>A${i}</div></div>`;

describe('faq accordion', () => {
  beforeEach(() => {
    document.body.innerHTML = `<div data-faq>${item(0, true)}${item(1, false)}${item(2, false)}</div>`;
    initFaq(document);
  });

  const btn = (i: number) => document.getElementById(`faq-${i}-btn`) as HTMLButtonElement;
  const panel = (i: number) => document.getElementById(`faq-${i}`) as HTMLElement;

  it('opens the clicked item and closes the others', () => {
    btn(2).click();
    expect(btn(2).getAttribute('aria-expanded')).toBe('true');
    expect(panel(2).hidden).toBe(false);
    expect(btn(0).getAttribute('aria-expanded')).toBe('false');
    expect(panel(0).hidden).toBe(true);
  });

  it('collapses an open item when clicked again', () => {
    btn(0).click();
    expect(btn(0).getAttribute('aria-expanded')).toBe('false');
    expect(panel(0).hidden).toBe(true);
  });

  it('moves focus with arrow keys', () => {
    btn(0).focus();
    btn(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(btn(1));
    btn(1).dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(document.activeElement).toBe(btn(2));
  });
});
